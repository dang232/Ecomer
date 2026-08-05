import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { emptySellerProductForm, type SellerProductForm } from "../model/product-form";

import { ProductVariantFields } from "./product-variant-fields";

function Harness() {
  const form = useForm<SellerProductForm>({ defaultValues: emptySellerProductForm() });
  return <ProductVariantFields form={form} />;
}

describe("ProductVariantFields", () => {
  it("starts with one seller-facing offer instead of a raw Standard SKU row", () => {
    render(<Harness />);

    expect(
      screen.getByRole("radio", { name: "seller.products.editor.variants.modeSingle" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("seller.products.editor.variants.price *")).toBeVisible();
    expect(screen.getByLabelText("seller.products.editor.variants.stock")).toBeVisible();
    expect(
      screen.queryByLabelText("seller.products.editor.variants.name *"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("seller.products.editor.variants.sku")).not.toBeVisible();
  });

  it("reveals option details only when the seller chooses customer options", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("radio", { name: "seller.products.editor.variants.modeVariants" }),
    );

    expect(
      screen.getByRole("radio", { name: "seller.products.editor.variants.modeVariants" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("seller.products.editor.variants.name *")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "seller.products.editor.variants.add" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "seller.products.editor.variants.add" }));
    expect(screen.getAllByLabelText("seller.products.editor.variants.name *")).toHaveLength(2);
  });
});
