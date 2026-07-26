package com.vnshop.invoiceservice.application.xml;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.invoiceservice.domain.entity.Invoice;
import com.vnshop.invoiceservice.infrastructure.config.InvoiceProperties;
import jakarta.xml.bind.JAXBContext;
import jakarta.xml.bind.JAXBException;
import jakarta.xml.bind.Marshaller;
import java.io.IOException;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import javax.xml.validation.Validator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.xml.sax.SAXException;

/**
 * Converts an {@link Invoice} entity into a TKHDon XML string conforming to the Vietnamese GDT
 * e-invoice specification (Decree 123/2020 / Circular 78/2021).
 *
 * <p>The generated XML is validated against {@code xsd/tkhdon.xsd} before being returned.
 */
@Slf4j
@Component
@EnableConfigurationProperties(InvoiceProperties.class)
public class InvoiceXmlGenerator {

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private static final String XSD_PATH = "xsd/tkhdon.xsd";

    private final ObjectMapper objectMapper;
    private final InvoiceProperties properties;
    private final Schema xsdSchema;

    public InvoiceXmlGenerator(ObjectMapper objectMapper, InvoiceProperties properties)
            throws SAXException, IOException {
        this.objectMapper = objectMapper;
        this.properties = properties;
        SchemaFactory sf = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
        this.xsdSchema = sf.newSchema(new ClassPathResource(XSD_PATH).getURL());
    }

    /**
     * Generates a TKHDon XML string for the given invoice and validates it against the XSD schema.
     *
     * @param invoice the invoice entity containing items and VAT data
     * @return validated XML string
     * @throws InvoiceXmlException if marshalling or XSD validation fails
     */
    public String generate(Invoice invoice) {
        try {
            TKHDon tkhdon = buildTKHDon(invoice);
            String xml = marshal(tkhdon);
            validateXsd(xml);
            log.debug("Generated and validated TKHDon XML for invoiceId={}", invoice.getId());
            return xml;
        } catch (JAXBException e) {
            throw new InvoiceXmlException("Failed to marshal invoice to XML: " + e.getMessage(), e);
        } catch (SAXException | java.io.IOException e) {
            throw new InvoiceXmlException("Generated XML failed XSD validation: " + e.getMessage(), e);
        }
    }

    // ---------------------------------------------------------------------------
    // Build object graph
    // ---------------------------------------------------------------------------

    private TKHDon buildTKHDon(Invoice invoice) {
        List<ItemDto> items = parseItems(invoice.getItems());

        DLHDon.TTChung ttchung = buildTTChung(invoice);
        NDHDon.NBanHDon seller = buildSeller();
        NMHDon buyer = buildBuyer(invoice);
        List<CTHDon> lineItems = buildLineItems(items);
        NDHDon.TToan totals = buildTotals(items);

        NDHDon ndhdon = new NDHDon(
                seller,
                buyer,
                new NDHDon.DSHHDVu(lineItems),
                totals);

        DLHDon dlhdon = new DLHDon(ttchung, ndhdon);
        return new TKHDon(dlhdon);
    }

    private DLHDon.TTChung buildTTChung(Invoice invoice) {
        DLHDon.TTChung h = new DLHDon.TTChung();
        h.setMauSo(properties.templateCode());
        h.setKyHieu(properties.symbol());

        String sequential = extractSequentialNumber(invoice.getGdtInvoiceNumber());
        h.setSoHD(sequential);
        h.setSoHDDayDu(invoice.getGdtInvoiceNumber());
        h.setNLap(DATE_FMT.format(invoice.getCreatedAt()));
        h.setDvtte(properties.currency());
        h.setTGia("1");
        h.setHtttoan(properties.paymentMethod());
        return h;
    }

    private NDHDon.NBanHDon buildSeller() {
        NDHDon.NBanHDon s = new NDHDon.NBanHDon();
        s.setTen(properties.seller().name());
        s.setMst(properties.seller().taxCode());
        s.setDchi(properties.seller().address());
        if (properties.seller().phone() != null && !properties.seller().phone().isBlank()) {
            s.setSdthoai(properties.seller().phone());
        }
        s.setDctdtu(properties.seller().email());
        return s;
    }

    private NMHDon buildBuyer(Invoice invoice) {
        NMHDon b = new NMHDon();
        // buyer name may not be stored on Invoice; use a default for B2C
        b.setTen("Consumer");
        if (invoice.getBuyerTaxCode() != null && !invoice.getBuyerTaxCode().isBlank()) {
            b.setMst(invoice.getBuyerTaxCode());
            b.setTen("Business Customer");
        }
        return b;
    }

    private List<CTHDon> buildLineItems(List<ItemDto> items) {
        List<CTHDon> lines = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            ItemDto item = items.get(i);
            CTHDon line = new CTHDon();
            line.setStt(i + 1);
            line.setTenHHDV(item.description());
            line.setDvtinh(item.unit());
            line.setSluong(item.quantity().toPlainString());
            line.setDgia(item.unitPrice().toPlainString());

            BigDecimal subtotal = item.unitPrice().multiply(item.quantity()).setScale(0, RoundingMode.HALF_UP);
            BigDecimal vatAmount = subtotal.multiply(item.vatRate())
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            BigDecimal lineTotal = subtotal.add(vatAmount);

            line.setTgtien(subtotal.toPlainString());
            line.setTsuat(item.vatRate().stripTrailingZeros().toPlainString());
            line.setTgtthue(vatAmount.toPlainString());
            line.setTgttTien(lineTotal.toPlainString());
            lines.add(line);
        }
        return lines;
    }

    private NDHDon.TToan buildTotals(List<ItemDto> items) {
        // Group by VAT rate
        Map<String, BigDecimal[]> byRate = new LinkedHashMap<>();
        BigDecimal totalPretax = BigDecimal.ZERO;
        BigDecimal totalVat = BigDecimal.ZERO;

        for (ItemDto item : items) {
            BigDecimal pretax = item.unitPrice().multiply(item.quantity()).setScale(0, RoundingMode.HALF_UP);
            BigDecimal vat = pretax.multiply(item.vatRate())
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            totalPretax = totalPretax.add(pretax);
            totalVat = totalVat.add(vat);

            String rateKey = item.vatRate().stripTrailingZeros().toPlainString();
            byRate.computeIfAbsent(rateKey, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            byRate.get(rateKey)[0] = byRate.get(rateKey)[0].add(pretax);
            byRate.get(rateKey)[1] = byRate.get(rateKey)[1].add(vat);
        }

        List<NDHDon.ThueEntry> buckets = new ArrayList<>();
        for (Map.Entry<String, BigDecimal[]> entry : byRate.entrySet()) {
            buckets.add(new NDHDon.ThueEntry(
                    entry.getKey(),
                    entry.getValue()[0].toPlainString(),
                    entry.getValue()[1].toPlainString()));
        }

        NDHDon.TToan totals = new NDHDon.TToan();
        totals.setTgtcthue(totalPretax.toPlainString());
        totals.setTgtthue(totalVat.toPlainString());
        BigDecimal grandTotal = totalPretax.add(totalVat);
        totals.setTgtttbso(grandTotal.toPlainString());
        totals.setDsThue(new NDHDon.DSThue(buckets));
        return totals;
    }

    // ---------------------------------------------------------------------------
    // JAXB marshal
    // ---------------------------------------------------------------------------

    private String marshal(TKHDon tkhdon) throws JAXBException {
        JAXBContext ctx = JAXBContext.newInstance(
                TKHDon.class, DLHDon.class, NDHDon.class, NMHDon.class, CTHDon.class);
        Marshaller m = ctx.createMarshaller();
        m.setProperty(Marshaller.JAXB_FORMATTED_OUTPUT, Boolean.TRUE);
        m.setProperty(Marshaller.JAXB_ENCODING, "UTF-8");
        StringWriter sw = new StringWriter();
        m.marshal(tkhdon, sw);
        return sw.toString();
    }

    // ---------------------------------------------------------------------------
    // XSD validation
    // ---------------------------------------------------------------------------

    private void validateXsd(String xml) throws SAXException, java.io.IOException {
        Validator validator = xsdSchema.newValidator();
        validator.validate(new StreamSource(new java.io.StringReader(xml)));
    }

    // ---------------------------------------------------------------------------
    // JSON item parsing
    // ---------------------------------------------------------------------------

    private List<ItemDto> parseItems(String itemsJson) {
        try {
            List<Map<String, Object>> raw =
                    objectMapper.readValue(itemsJson, new TypeReference<>() {});
            List<ItemDto> result = new ArrayList<>();
            for (Map<String, Object> m : raw) {
                result.add(new ItemDto(
                        getString(m, "description", "Item"),
                        getString(m, "unit", "pcs"),
                        getBigDecimal(m, "quantity", BigDecimal.ONE),
                        getBigDecimal(m, "unitPrice", BigDecimal.ZERO),
                        getBigDecimal(m, "vatRate", BigDecimal.TEN)));
            }
            return result;
        } catch (Exception e) {
            throw new InvoiceXmlException("Failed to parse invoice items JSON: " + e.getMessage(), e);
        }
    }

    private static String getString(Map<String, Object> m, String key, String fallback) {
        Object v = m.get(key);
        return v != null ? v.toString() : fallback;
    }

    private static BigDecimal getBigDecimal(Map<String, Object> m, String key, BigDecimal fallback) {
        Object v = m.get(key);
        if (v == null) return fallback;
        try { return new BigDecimal(v.toString()); } catch (NumberFormatException e) { return fallback; }
    }

    /**
     * Extracts the sequential portion of a full GDT invoice number.
     * e.g. "1C26T-001/0001" → "0001"
     */
    private static String extractSequentialNumber(String gdtInvoiceNumber) {
        if (gdtInvoiceNumber == null || gdtInvoiceNumber.isBlank()) return "0001";
        int slash = gdtInvoiceNumber.lastIndexOf('/');
        return slash >= 0 ? gdtInvoiceNumber.substring(slash + 1) : gdtInvoiceNumber;
    }

    // ---------------------------------------------------------------------------
    // Internal DTO
    // ---------------------------------------------------------------------------

    private record ItemDto(
            String description,
            String unit,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal vatRate) {}
}
