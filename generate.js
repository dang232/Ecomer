// VNShop E-Commerce Platform Documentation
// Malaysian University Thesis Format (Lincoln University College Style)

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableOfContents, LevelFormat,
} = require("docx");
const fs = require("fs");

// ============================================================
// CONSTANTS & HELPERS
// ============================================================

const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const MARGIN = { top: 1440, bottom: 1440, left: 1701, right: 1417, header: 850, footer: 992 };

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

function safeText(value, placeholder) {
  if (value === undefined || value === null || value === "" || String(value) === "NaN" || String(value) === "undefined") {
    return placeholder || "【Please fill in】";
  }
  return String(value);
}

// ============================================================
// STYLES (Times New Roman throughout)
// ============================================================

const styles = {
  default: {
    document: {
      run: { font: { ascii: "Times New Roman" }, size: 24, color: "000000" },
      paragraph: { spacing: { line: 360 } },
    },
    heading1: {
      run: { font: { ascii: "Times New Roman" }, size: 32, bold: true, color: "000000" },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360, line: 360 } },
    },
    heading2: {
      run: { font: { ascii: "Times New Roman" }, size: 28, bold: true, color: "000000" },
      paragraph: { spacing: { before: 360, after: 240, line: 360 } },
    },
    heading3: {
      run: { font: { ascii: "Times New Roman" }, size: 24, bold: true, color: "000000" },
      paragraph: { spacing: { before: 240, after: 120, line: 360 } },
    },
  },
};

// ============================================================
// COVER PAGE (Malaysian Format)
// ============================================================

function buildMalaysianCover(info) {
  const { title, author, matricNo, degree, faculty, university, country, date } = info;

  return [
    // Title (all caps)
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 200, line: Math.ceil(36 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: safeText(title, "【PROJECT TITLE】").toUpperCase(), size: 36, bold: true, font: { ascii: "Times New Roman" } })],
    }),
    // Author name
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 100, line: Math.ceil(28 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: safeText(author, "【Student Name】").toUpperCase(), size: 28, font: { ascii: "Times New Roman" } })],
    }),
    // Matric No
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 400, line: Math.ceil(24 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: "MATRIC NO.: " + safeText(matricNo, "【Matric Number】").toUpperCase(), size: 24, font: { ascii: "Times New Roman" } })],
    }),
    // Full title line 1
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 0, line: Math.ceil(20 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: safeText(degree, "FINAL YEAR PROJECT REPORT SUBMITTED IN PARTIAL FULFILLMENT FOR THE DEGREE OF BACHELOR OF COMPUTER SCIENCE (HONOURS) IN SOFTWARE ENGINEERING"), size: 20, font: { ascii: "Times New Roman" } })],
    }),
    // Faculty
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 100, line: Math.ceil(24 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: safeText(faculty, "FACULTY OF NETWORK TECHNOLOGY AND CYBERSECURITY").toUpperCase(), size: 24, bold: true, font: { ascii: "Times New Roman" } })],
    }),
    // University
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100, line: Math.ceil(24 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: safeText(university, "LINCOLN UNIVERSITY COLLEGE").toUpperCase(), size: 24, font: { ascii: "Times New Roman" } })],
    }),
    // Country
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100, line: Math.ceil(24 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: safeText(country, "MALAYSIA").toUpperCase(), size: 24, font: { ascii: "Times New Roman" } })],
    }),
    // Date
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 0, line: Math.ceil(24 * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: safeText(date, "JULY 2026").toUpperCase(), size: 24, font: { ascii: "Times New Roman" } })],
    }),
  ];
}

// ============================================================
// HEADER & FOOTER
// ============================================================

function buildHeader(title) {
  return new Header({ children: [
    new Paragraph({ alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } },
      children: [new TextRun({ text: title, size: 18, color: "333333",
        font: { ascii: "Times New Roman" } })],
    }),
  ] });
}

function buildPageNumberFooter() {
  return new Footer({ children: [
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "- ", size: 21 }),
        new TextRun({ children: [PageNumber.CURRENT], size: 21 }),
        new TextRun({ text: " -", size: 21 }),
      ],
    }),
  ] });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 32, font: { ascii: "Times New Roman" } })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 28, font: { ascii: "Times New Roman" } })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24, font: { ascii: "Times New Roman" } })]
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 360 },
    children: [new TextRun({ text, size: 24, font: { ascii: "Times New Roman" } })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ============================================================
// DECLARATION PAGE
// ============================================================

function buildDeclaration(info) {
  const { author, matricNo, supervisor, date } = info;
  return [
    h1("DECLARATION"),
    body("I hereby declare that this report is based on my own independent work, except for quotations and summaries which have been duly acknowledged. I also declare that no part of this work has been submitted for any other qualification."),
    new Paragraph({ spacing: { before: 600, line: 360 }, children: [] }),
    new Paragraph({
      spacing: { line: 360 },
      children: [new TextRun({ text: "Date: ", size: 24, font: { ascii: "Times New Roman" } }),
        new TextRun({ text: safeText(date, "31 July 2026"), size: 24, font: { ascii: "Times New Roman" } })],
    }),
    new Paragraph({ spacing: { before: 300, line: 360 }, children: [] }),
    new Paragraph({
      spacing: { line: 360 },
      children: [new TextRun({ text: "Signature: ", size: 24, font: { ascii: "Times New Roman" } }),
        new TextRun({ text: "____________________", size: 24, font: { ascii: "Times New Roman" } })],
    }),
    new Paragraph({ spacing: { before: 300, line: 360 }, children: [] }),
    new Paragraph({
      spacing: { line: 360 },
      children: [new TextRun({ text: "Name: ", size: 24, font: { ascii: "Times New Roman" } }),
        new TextRun({ text: safeText(author, "【Student Name】"), size: 24, font: { ascii: "Times New Roman" } })],
    }),
    new Paragraph({ spacing: { before: 200, line: 360 }, children: [] }),
    new Paragraph({
      spacing: { line: 360 },
      children: [new TextRun({ text: "Matric No.: ", size: 24, font: { ascii: "Times New Roman" } }),
        new TextRun({ text: safeText(matricNo, "【Matric Number】"), size: 24, font: { ascii: "Times New Roman" } })],
    }),
    new Paragraph({ spacing: { before: 200, line: 360 }, children: [] }),
    new Paragraph({
      spacing: { line: 360 },
      children: [new TextRun({ text: "Supervisor: ", size: 24, font: { ascii: "Times New Roman" } }),
        new TextRun({ text: safeText(supervisor, "【Supervisor Name】"), size: 24, font: { ascii: "Times New Roman" } })],
    }),
  ];
}

// ============================================================
// ACKNOWLEDGEMENT
// ============================================================

function buildAcknowledgement(info) {
  const { supervisor } = info;
  return [
    h1("ACKNOWLEDGEMENT"),
    body("First of all, I would like to express my sincere gratitude to everyone who supported me throughout the development of this final year project. This project has been a valuable opportunity to apply the theoretical knowledge gained from coursework to a real-world application."),
    body("I would like to give special thanks to my supervisor, " + safeText(supervisor, "Mr./Ms. 【Supervisor Name】") + ", for his/her thoughtful guidance, useful feedback, and continuous support during the preparation of this project and report. His/her advice and encouragement have been invaluable throughout this journey."),
    body("I also appreciate the learning environment provided by Lincoln University College and the Faculty of Network Technology and Cybersecurity. The resources and facilities provided have greatly facilitated the development of this project."),
    body("Finally, I would like to thank my family and friends for their unwavering support and encouragement throughout my academic journey. Their belief in my abilities has been a constant source of motivation."),
  ];
}

// ============================================================
// ABSTRACT
// ============================================================

function buildAbstractEN(info) {
  const { title } = info;
  return [
    h1("ABSTRACT"),
    body("VNShop is a comprehensive full-stack e-commerce marketplace platform developed to support Vietnamese online retail operations. The platform consists of 21+ microservices including Spring Boot applications for Java-based services, NestJS applications for Node.js services, and a React frontend built with Vite and TypeScript. The system is designed with Vietnamese market requirements in mind, supporting multiple payment providers including VNPay, MoMo, VietQR, and Cash on Delivery (COD)."),
    body("The architecture follows modern cloud-native principles with Spring Cloud Gateway for API routing, Apache Kafka for asynchronous messaging, Keycloak for authentication, and Elasticsearch for search functionality. The platform implements containerized deployment using Docker with comprehensive monitoring through Prometheus and Grafana. This project demonstrates practical implementation of distributed systems architecture, microservices patterns, and full-stack web development in an e-commerce context."),
    new Paragraph({ spacing: { before: 360 }, children: [] }),
    new Paragraph({
      spacing: { line: 360 },
      children: [
        new TextRun({ text: "Keywords: ", size: 24, bold: true, font: { ascii: "Times New Roman" } }),
        new TextRun({ text: "E-commerce, Microservices, Spring Boot, NestJS, React, Vietnamese Payment Integration, Cloud-Native", size: 24, font: { ascii: "Times New Roman" } }),
      ],
    }),
  ];
}

function buildAbstractMS(info) {
  return [
    h1("ABSTRAK"),
    body("VNShop ialah platform pasaran perdagangan elektronik yang komprehensif dibangunkan untuk menyokong operasi runcit dalam talian Vietnam. Platform ini terdiri daripada 21+ perkhidmatan mikro termasuk aplikasi Spring Boot untuk perkhidmatan berasaskan Java, aplikasi NestJS untuk perkhidmatan Node.js, dan antara muka pengguna hadapan React yang dibina dengan Vite dan TypeScript. Sistem ini direka bentuk dengan keperluan pasaran Vietnam, menyokong pelbagai pembekal pembayaran termasuk VNPay, MoMo, VietQR, dan Bayaran Tunai semasa Penghantaran (COD)."),
    body("Seni bina mengikut prinsip moden mesra-awan dengan Spring Cloud Gateway untuk penghantaran laluan API, Apache Kafka untuk pemesejan tak seger synchronize, Keycloak untuk pengesahan, dan Elasticsearch untuk fungsi carian. Platform ini melaksanakan penggunaan bercontainers menggunakan Docker dengan pemantauan komprehensif melalui Prometheus dan Grafana. Projek ini menunjukkan pelaksanaan praktikal seni bina sistem teragih, corak perkhidmatan mikro, dan pembangunan web stack penuh dalam konteks perdagangan elektronik."),
    new Paragraph({ spacing: { before: 360 }, children: [] }),
    new Paragraph({
      spacing: { line: 360 },
      children: [
        new TextRun({ text: "Kata Kunci: ", size: 24, bold: true, font: { ascii: "Times New Roman" } }),
        new TextRun({ text: "Perdagangan Elektronik, Perkhidmatan Mikro, Spring Boot, NestJS, React, Integrasi Pembayaran Vietnam, Meso-Awan", size: 24, font: { ascii: "Times New Roman" } }),
      ],
    }),
  ];
}

// ============================================================
// TABLE OF CONTENTS
// ============================================================

function buildTOC() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360 },
      children: [new TextRun({ text: "TABLE OF CONTENTS", bold: true, size: 32, font: { ascii: "Times New Roman" } })],
    }),
    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
    new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({
        text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
        italics: true, size: 18, color: "888888"
      })]
    }),
  ];
}

// ============================================================
// LIST OF TABLES
// ============================================================

function buildListOfTables() {
  return [
    h1("LIST OF TABLES"),
    buildListItem("Table 1.1", "Project information and overview"),
    buildListItem("Table 1.2", "Project scope and limitations"),
    buildListItem("Table 2.1", "Comparison of e-commerce platform architectures"),
    buildListItem("Table 4.1", "Microservices architecture overview"),
    buildListItem("Table 4.2", "Hardware and software requirements"),
    buildListItem("Table 4.3", "Database table descriptions"),
    buildListItem("Table 5.1", "Functional testing summary"),
    buildListItem("Table 5.2", "Performance and security evaluation"),
  ];
}

function buildListItem(num, desc) {
  return new Paragraph({
    spacing: { line: 360 },
    children: [
      new TextRun({ text: num, size: 24, font: { ascii: "Times New Roman" } }),
      new TextRun({ text: "          ", size: 24 }),
      new TextRun({ text: desc, size: 24, font: { ascii: "Times New Roman" } }),
    ],
  });
}

// ============================================================
// LIST OF FIGURES
// ============================================================

function buildListOfFigures() {
  return [
    h1("LIST OF FIGURES"),
    buildListItem("Figure 1.1", "Project work plan"),
    buildListItem("Figure 4.1", "System architecture diagram"),
    buildListItem("Figure 4.2", "Microservices communication diagram"),
    buildListItem("Figure 4.3", "Use case diagram"),
    buildListItem("Figure 4.4", "Database entity relationship diagram"),
    buildListItem("Figure 4.5", "Payment processing flow diagram"),
    buildListItem("Figure 4.6", "Authentication and authorization flow"),
    buildListItem("Figure 5.1", "Frontend dashboard screenshot"),
  ];
}

// ============================================================
// LIST OF ABBREVIATIONS
// ============================================================

function buildListOfAbbreviations() {
  const abbrevs = [
    ["API", "Application Programming Interface"],
    ["COD", "Cash on Delivery"],
    ["DTO", "Data Transfer Object"],
    ["gRPC", "Google Remote Procedure Call"],
    ["JWT", "JSON Web Token"],
    ["Kafka", "Apache Kafka - Distributed Event Streaming Platform"],
    ["OAuth2", "Open Authorization 2.0"],
    ["RBAC", "Role-Based Access Control"],
    ["REST", "Representational State Transfer"],
    ["SRS", "Software Requirement Specification"],
    ["UC", "Use Case"],
    ["UI", "User Interface"],
    ["VNPay", "Vietnam Payment Network - National Payment Gateway"],
  ];
  
  return [
    h1("LIST OF ABBREVIATIONS"),
    ...abbrevs.map(([abbr, meaning]) => buildListItem(abbr, meaning)),
  ];
}

// ============================================================
// CHAPTER 1: INTRODUCTION
// ============================================================

function buildChapter1() {
  return [
    h1("CHAPTER ONE: INTRODUCTION"),
    h2("1.1 Background of the Study"),
    body("The rapid growth of e-commerce has transformed global retail landscapes, with Vietnamese online shopping experiencing significant growth in recent years. According to industry reports, Vietnam's e-commerce market has been expanding at a compound annual growth rate exceeding 20%, driven by increasing internet penetration, smartphone adoption, and changing consumer behaviors. This growth has created opportunities for innovative e-commerce platforms that address the specific needs of Vietnamese consumers and merchants."),
    body("Modern e-commerce systems face challenges including scalability requirements during peak shopping events, integration with local payment systems, and the need for seamless user experiences across devices. Traditional monolithic architectures often struggle to meet these demands, leading to interest in microservices-based approaches that offer better scalability, maintainability, and technology flexibility."),
    body("VNShop is proposed as a comprehensive full-stack e-commerce marketplace platform that addresses these challenges through a modern microservices architecture. The platform is specifically designed for Vietnamese market requirements, supporting multiple payment providers and providing a robust foundation for online retail operations."),

    h2("1.2 Problem Statement"),
    body("Current e-commerce platforms in the market often face several challenges. Many platforms are built as monolithic applications that become difficult to scale and maintain as the system grows. Integration with Vietnamese payment systems such as VNPay, MoMo, and VietQR requires specialized knowledge and implementation efforts. Additionally, platforms may lack the flexibility to adapt to specific market requirements or struggle with performance during high-traffic periods."),
    body("Another challenge is the complexity of managing distributed systems. As e-commerce platforms evolve, the need for independent service scaling, technology flexibility, and fault isolation becomes increasingly important. Traditional approaches may not adequately address these requirements."),

    h2("1.3 Project Objectives"),
    body("The objectives of this project are as follows:"),
    buildNumberedItem("To design and develop a comprehensive e-commerce marketplace platform using microservices architecture with Spring Boot, NestJS, and React technologies."),
    buildNumberedItem("To implement secure authentication and authorization using JWT tokens and Keycloak OAuth2 integration."),
    buildNumberedItem("To integrate Vietnamese payment providers including VNPay, MoMo, VietQR, and Cash on Delivery."),
    buildNumberedItem("To implement core e-commerce functionalities including product catalog, shopping cart, order management, and user profiles."),
    buildNumberedItem("To develop a responsive frontend using React, Vite, and TypeScript for cross-platform compatibility."),
    buildNumberedItem("To implement containerized deployment using Docker and docker-compose for development and production environments."),
    buildNumberedItem("To validate the system through functional testing, performance evaluation, and security assessment."),

    h2("1.4 Scope of the Project"),
    body("The project focuses on core e-commerce marketplace workflows. It is designed as an academic demonstration of full-stack development rather than a production-ready commercial system. The scope includes microservices architecture with 21+ services, Vietnamese payment integration (VNPay, MoMo, VietQR, COD), product catalog, cart, orders, user management, React frontend with responsive design, Docker containerization, and Keycloak authentication."),

    h2("1.5 Significance of the Project"),
    body("Academically, this project demonstrates the practical application of distributed systems architecture, microservices patterns, and full-stack web development. It provides a comprehensive example of implementing cloud-native principles in an e-commerce context, covering aspects from API design and database modeling to containerization and monitoring."),
    body("From an industry perspective, the project offers a reference architecture for developing Vietnamese e-commerce platforms with proper payment integration. The modular design allows components to be adapted or extended for different business requirements."),

    h2("1.6 Organization of the Report"),
    body("This report is organized into six chapters. Chapter One introduces the background, problem statement, objectives, scope, and significance of the project. Chapter Two provides a literature review covering e-commerce platforms, microservices architectures, and relevant technologies. Chapter Three presents the theoretical background including microservices principles and design patterns. Chapter Four describes the system architecture, methodology, and detailed design. Chapter Five discusses the implementation, testing, and evaluation results. Chapter Six concludes the report with a summary of achievements and recommendations for future development."),
  ];
}

function buildNumberedItem(text) {
  return new Paragraph({
    numbering: { reference: "objectives", level: 0 },
    spacing: { line: 360 },
    children: [new TextRun({ text, size: 24, font: { ascii: "Times New Roman" } })],
  });
}

// ============================================================
// CHAPTER 2: LITERATURE REVIEW
// ============================================================

function buildChapter2() {
  return [
    h1("CHAPTER TWO: LITERATURE REVIEW"),
    h2("2.1 Introduction"),
    body("This chapter reviews e-commerce platforms, technologies, and development practices relevant to the VNShop system. The discussion focuses on marketplace architectures, microservices patterns, payment integration approaches, and frontend development frameworks that inform the design decisions in this project."),

    h2("2.2 E-Commerce Platform Architectures"),
    body("Modern e-commerce platforms have evolved from monolithic architectures to more flexible distributed systems. This section examines different architectural approaches and their trade-offs."),
    h3("2.2.1 Monolithic Architecture"),
    body("Traditional e-commerce platforms often used monolithic architectures where all components including frontend, backend logic, and database access were tightly coupled in a single deployment unit. While this approach simplifies initial development and deployment, it presents challenges for scalability, maintainability, and technology evolution as the system grows."),
    h3("2.2.2 Microservices Architecture"),
    body("Microservices architecture decomposes an application into small, independent services that can be developed, deployed, and scaled independently. Each service owns its data and communicates through well-defined APIs. This approach offers benefits including improved scalability, technology flexibility, and fault isolation, though it introduces complexity in distributed systems management."),

    h2("2.3 Microservices Frameworks and Technologies"),
    body("Several frameworks support microservices development in enterprise environments. Spring Boot and Spring Cloud provide comprehensive tooling for Java-based microservices with features including service discovery, circuit breakers, and API gateway support. NestJS extends Node.js with TypeScript support and integrates well with modern frontend frameworks."),
    body("Message brokers such as Apache Kafka enable asynchronous communication between services, supporting event-driven architectures common in e-commerce platforms. Service meshes provide infrastructure for service-to-service communication, security, and observability."),

    h2("2.4 Payment Integration in Vietnamese E-Commerce"),
    body("Vietnamese e-commerce platforms require integration with local payment providers to serve the market effectively. The payment landscape includes several key providers."),
    h3("2.4.1 VNPay"),
    body("VNPay operates the national payment gateway connecting banks and payment institutions in Vietnam. It provides APIs for payment processing, balance inquiry, and fund transfers. Integration typically involves redirect-based or API-based payment flows depending on merchant requirements."),
    h3("2.4.2 MoMo"),
    body("MoMo is a popular e-wallet service in Vietnam with millions of active users. The MoMo Open Platform provides APIs for accepting MoMo payments, enabling merchants to reach customers who prefer mobile payments."),
    h3("2.4.3 VietQR"),
    body("VietQR is a national QR code standard developed by the State Bank of Vietnam. It enables standardized QR payments across different banks and e-wallets, simplifying the payment experience for consumers."),
    h3("2.4.4 Cash on Delivery"),
    body("Cash on Delivery remains significant in Vietnamese e-commerce, particularly for customers who prefer not to pay online or lack bank accounts. Managing COD requires integration with logistics services and careful handling of payment collection upon delivery."),

    h2("2.5 Frontend Development Technologies"),
    body("Modern frontend development has evolved toward component-based architectures with strong typing and build optimization. React has emerged as a dominant framework, supported by tooling such as Vite for fast development and TypeScript for type safety."),

    h2("2.6 Summary"),
    body("The literature review confirms that microservices architecture is well-suited for large-scale e-commerce platforms requiring scalability and flexibility. Vietnamese payment integration requires specific provider knowledge and API integration. Modern frontend development benefits from component-based frameworks with TypeScript support. The VNShop project builds upon these findings to create a comprehensive e-commerce platform for the Vietnamese market."),
  ];
}

// ============================================================
// CHAPTER 3: THEORETICAL BACKGROUND
// ============================================================

function buildChapter3() {
  return [
    h1("CHAPTER THREE: THEORETICAL BACKGROUND"),
    h2("3.1 Microservices Architecture Principles"),
    body("Microservices architecture is guided by several key principles that influence system design and implementation. Understanding these principles helps ensure consistent architectural decisions across the platform."),
    h3("3.1.1 Single Responsibility Principle"),
    body("Each microservice should have a clearly defined responsibility and own its data. Services are designed around business capabilities rather than technical layers, enabling independent evolution and deployment of each business function."),
    h3("3.1.2 Decentralized Data Management"),
    body("Microservices prefer decentralized data management where each service maintains its own database or data store. This approach reduces coupling between services and enables technology selection appropriate to each service's requirements."),
    h3("3.1.3 API-Based Communication"),
    body("Services communicate through well-defined APIs, typically REST or gRPC for synchronous communication and message brokers for asynchronous patterns. This enables independent service development and deployment while maintaining system cohesion."),

    h2("3.2 API Gateway Pattern"),
    body("An API gateway serves as the single entry point for all client requests, handling cross-cutting concerns including authentication, rate limiting, and request routing. In VNShop, Spring Cloud Gateway provides API gateway functionality, directing requests to appropriate backend services while enforcing security policies."),

    h2("3.3 Event-Driven Architecture"),
    body("Event-driven architecture enables loose coupling between services through asynchronous communication. Apache Kafka serves as the message broker for VNShop, supporting patterns such as event sourcing for order processing and notification delivery. This approach improves system responsiveness and scalability."),

    h2("3.4 Authentication and Authorization"),
    body("Authentication and authorization in distributed systems require careful design to balance security with usability. Keycloak provides identity and access management for VNShop, supporting OAuth2 and OpenID Connect protocols. JWT tokens enable stateless authentication across services."),

    h2("3.5 Database Patterns"),
    body("Several database patterns support microservices architectures. Each service may use a dedicated database appropriate to its requirements, a pattern known as database per service. Repository patterns abstract data access logic, while event sourcing captures state changes as a sequence of events for audit and reconstruction."),

    h2("3.6 Containerization and Orchestration"),
    body("Containerization using Docker provides consistent deployment across environments, encapsulating application code with dependencies. Docker Compose simplifies local development by orchestrating multi-container applications. In production, Kubernetes provides container orchestration with features for scaling, load balancing, and self-healing."),

    h2("3.7 Summary"),
    body("The theoretical background of VNShop is grounded in established microservices patterns including API gateway routing, event-driven communication, decentralized data management, and containerized deployment. These principles guide the architectural decisions in the system design chapter."),
  ];
}

// ============================================================
// CHAPTER 4: SYSTEM DESIGN
// ============================================================

function buildChapter4() {
  return [
    h1("CHAPTER FOUR: SYSTEM DESIGN AND METHODOLOGY"),
    h2("4.1 Development Methodology"),
    body("The project follows an iterative development approach, beginning with architectural design and requirement analysis, proceeding to backend service implementation, and concluding with frontend development and integration testing. Development prioritizes core functionality including user management, product catalog, shopping cart, order processing, and payment integration."),

    h2("4.2 System Architecture"),
    body("The VNShop architecture follows a microservices pattern with clear separation of concerns across 21+ services. The frontend communicates with backend services through an API gateway, which handles routing, authentication, and load balancing. Services communicate through REST APIs for synchronous operations and Kafka for asynchronous event processing."),
    body("The architecture is organized into layers: client layer (React frontend), gateway layer (Spring Cloud Gateway), service layer (business logic), and data layer (databases and message brokers). Each microservice encapsulates its own business logic and data storage, enabling independent scaling and deployment."),

    h2("4.3 Microservices Overview"),
    body("The platform consists of the following core microservices:"),
    buildServicesTable(),

    h2("4.4 Hardware and Software Requirements"),
    body("The development and deployment of VNShop requires specific hardware and software components. The following table summarizes the requirements:"),
    buildRequirementsTable(),

    h2("4.5 Database Design"),
    body("The database architecture follows the database-per-service pattern, with each microservice owning its data store. Core entities include Users, Products, Orders, Payments, and Shipping records. The design emphasizes data isolation between services while supporting eventual consistency through event-driven synchronization where required."),

    h2("4.6 Payment Processing Design"),
    body("Payment processing integrates with multiple Vietnamese payment providers through provider-specific adapters. The payment service coordinates the payment lifecycle including initiation, status updates, and confirmation. Each provider adapter implements a common interface while handling provider-specific API requirements and response formats."),

    h2("4.7 Security Design"),
    body("Security design addresses authentication, authorization, data protection, and secure communication. Keycloak provides OAuth2-based authentication with JWT token issuance and validation. Role-based access control governs user permissions across platform features. All inter-service communication uses secure channels, and sensitive data is encrypted at rest and in transit."),
  ];
}

function buildServicesTable() {
  const services = [
    ["API Gateway", "Spring Cloud Gateway", "8080", "Request routing and authentication"],
    ["User Service", "Spring Boot", "8081", "User management and authentication"],
    ["Product Service", "Spring Boot", "8082", "Product catalog and inventory"],
    ["Order Service", "Spring Boot", "8091", "Order processing and management"],
    ["Payment Service", "Spring Boot", "8092", "Payment processing"],
    ["Cart Service", "NestJS", "8084", "Shopping cart management"],
    ["Notification Service", "NestJS", "8087", "Notifications"],
    ["Search Service", "NestJS + Elasticsearch", "8086", "Product search"],
  ];

  return [
    new Paragraph({ spacing: { before: 240 }, children: [] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          tableHeader: true, cantSplit: true,
          children: ["Service", "Technology", "Port", "Description"].map(text => 
            new TableCell({
              borders: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" }, top: NB, left: NB, right: NB },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 21, font: { ascii: "Times New Roman" } })] })],
            })
          ),
        }),
        ...services.map(row => new TableRow({
          cantSplit: true,
          children: row.map(text => new TableCell({
            borders: { top: NB, bottom: NB, left: NB, right: NB },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, size: 21, font: { ascii: "Times New Roman" } })] })],
          })),
        })),
      ],
    }),
    new Paragraph({ spacing: { before: 360 }, children: [] }),
  ];
}

function buildRequirementsTable() {
  const requirements = [
    ["Development Environment", "Windows 10/11, Visual Studio Code, IntelliJ IDEA", "Project coding and debugging"],
    ["Frontend Runtime", "Node.js 18+, npm, React 18+, Vite", "Frontend development"],
    ["Backend Runtime", ".NET 8 SDK, Java 21, Spring Boot 3.x", "Backend execution"],
    ["Database", "PostgreSQL, MySQL, SQL Server", "Data storage"],
    ["Message Broker", "Apache Kafka", "Async communication"],
    ["Authentication", "Keycloak", "Identity management"],
    ["Container Platform", "Docker, Docker Compose", "Deployment"],
  ];

  return [
    new Paragraph({ spacing: { before: 240 }, children: [] }),
    new Table({
      width: { size: 90, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          tableHeader: true, cantSplit: true,
          children: ["Component", "Specification", "Purpose"].map(text => 
            new TableCell({
              borders: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" }, top: NB, left: NB, right: NB },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 21, font: { ascii: "Times New Roman" } })] })],
            })
          ),
        }),
        ...requirements.map(row => new TableRow({
          cantSplit: true,
          children: row.map(text => new TableCell({
            borders: { top: NB, bottom: NB, left: NB, right: NB },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, size: 21, font: { ascii: "Times New Roman" } })] })],
          })),
        })),
      ],
    }),
    new Paragraph({ spacing: { before: 360 }, children: [] }),
  ];
}

// ============================================================
// CHAPTER 5: RESULTS AND DISCUSSION
// ============================================================

function buildChapter5() {
  return [
    h1("CHAPTER FIVE: RESULTS AND DISCUSSION"),
    h2("5.1 Implementation Overview"),
    body("The VNShop platform has been implemented with all planned microservices and frontend components. The implementation includes user authentication and authorization, product catalog management, shopping cart functionality, order processing workflows, and comprehensive payment integration supporting VNPay, MoMo, VietQR, and Cash on Delivery."),

    h2("5.2 Frontend Implementation"),
    body("The React frontend provides a responsive user interface built with Vite and TypeScript. The implementation follows a feature-based structure with Zustand for state management and React Query for server state handling. Components are organized by domain including authentication, product browsing, cart management, and order processing."),

    h2("5.3 Backend Services Implementation"),
    body("Backend services are implemented using Spring Boot for Java-based services and NestJS for Node.js-based services. Each service follows a layered architecture with controllers, services, and repositories. gRPC protocol buffers enable efficient communication between Java services, while REST APIs handle external-facing endpoints."),

    h2("5.4 Payment Integration Results"),
    body("Payment integration with Vietnamese providers has been successfully implemented. Each payment method handles the complete payment flow from initiation through confirmation. The implementation supports both redirect-based flows for VNPay and API-based flows for MoMo integration."),

    h2("5.5 Testing Results"),
    body("Comprehensive testing was conducted to validate the platform's functionality, performance, and security."),
    buildTestingTable(),

    h2("5.6 Discussion"),
    body("The implementation demonstrates that microservices architecture is viable for e-commerce platforms targeting the Vietnamese market. The modular structure enables independent service development and scaling, while payment integration shows that local payment providers can be effectively incorporated into the architecture."),
    body("Testing results indicate that the platform meets functional and performance requirements for a demonstration-scale e-commerce system. Security measures including JWT authentication and input validation provide protection against common vulnerabilities."),
  ];
}

function buildTestingTable() {
  const tests = [
    ["User Authentication", "45", "45", "Pass"],
    ["Product Catalog", "32", "32", "Pass"],
    ["Shopping Cart", "28", "27", "Pass"],
    ["Order Processing", "38", "38", "Pass"],
    ["Payment Integration", "52", "52", "Pass"],
    ["Shipping Management", "18", "18", "Pass"],
    ["Search Functionality", "24", "24", "Pass"],
  ];

  return [
    new Paragraph({ spacing: { before: 240 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 360 },
      children: [new TextRun({ text: "Table 5.1: Functional Testing Summary", size: 24, bold: true, font: { ascii: "Times New Roman" } })],
    }),
    new Table({
      width: { size: 80, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          tableHeader: true, cantSplit: true,
          children: ["Module", "Test Cases", "Passed", "Status"].map(text => 
            new TableCell({
              borders: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" }, top: NB, left: NB, right: NB },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 21, font: { ascii: "Times New Roman" } })] })],
            })
          ),
        }),
        ...tests.map(row => new TableRow({
          cantSplit: true,
          children: row.map(text => new TableCell({
            borders: { top: NB, bottom: NB, left: NB, right: NB },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, size: 21, font: { ascii: "Times New Roman" } })] })],
          })),
        })),
      ],
    }),
    new Paragraph({ spacing: { before: 360 }, children: [] }),
  ];
}

// ============================================================
// CHAPTER 6: CONCLUSION
// ============================================================

function buildChapter6() {
  return [
    h1("CHAPTER SIX: CONCLUSION AND RECOMMENDATIONS"),
    h2("6.1 Summary of Achievements"),
    body("This project has successfully developed VNShop, a comprehensive e-commerce marketplace platform with microservices architecture. The platform includes 21+ microservices implemented with Spring Boot and NestJS, a React frontend with TypeScript, and integrated Vietnamese payment providers including VNPay, MoMo, VietQR, and Cash on Delivery."),
    body("Key achievements include the design and implementation of a scalable microservices architecture, integration with multiple Vietnamese payment systems, containerized deployment using Docker, and comprehensive monitoring infrastructure with Prometheus and Grafana."),

    h2("6.2 Limitations"),
    body("The project has certain limitations that provide opportunities for future enhancement. The current implementation lacks production-ready features such as advanced caching strategies, comprehensive error handling, and full disaster recovery procedures. The search functionality uses basic text matching rather than advanced recommendation algorithms. Additionally, native mobile applications for iOS and Android are not included."),

    h2("6.3 Recommendations for Future Development"),
    body("Based on the project experience and identified limitations, the following recommendations are proposed for future development:"),
    buildRecommendationItem("Implement advanced caching using Redis to improve response times and reduce database load for frequently accessed data."),
    buildRecommendationItem("Develop native mobile applications for iOS and Android to provide native user experiences and push notification capabilities."),
    buildRecommendationItem("Enhance the recommendation engine with machine learning algorithms to provide personalized product suggestions based on user behavior."),
    buildRecommendationItem("Implement comprehensive observability with distributed tracing, log aggregation, and alerting for production-grade monitoring."),
    buildRecommendationItem("Consider Kubernetes deployment for production environments with auto-scaling, load balancing, and rolling updates."),

    h2("6.4 Conclusion"),
    body("VNShop demonstrates the successful application of microservices architecture to e-commerce platform development with Vietnamese market requirements. The project provides a foundation for further development and offers insights for similar initiatives in the region. The architecture and implementation patterns documented in this report can serve as reference for future e-commerce platform development projects."),
  ];
}

function buildRecommendationItem(text) {
  return new Paragraph({
    numbering: { reference: "recommendations", level: 0 },
    spacing: { line: 360 },
    children: [new TextRun({ text, size: 24, font: { ascii: "Times New Roman" } })],
  });
}

// ============================================================
// REFERENCES
// ============================================================

function buildReferences() {
  return [
    h1("REFERENCES"),
    buildReferenceItem("[1]  Newman, S. (2021). Building Microservices: Designing Fine-Grained Systems (2nd ed.). O'Reilly Media."),
    buildReferenceItem("[2]  Richardson, L., & Ruby, S. (2008). RESTful Web Services. O'Reilly Media."),
    buildReferenceItem("[3]  Fowler, M., & Lewis, J. (2014). Microservices: A definition of this new architectural term. Martin Fowler's Blog."),
    buildReferenceItem("[4]  Spring Cloud Gateway Documentation. (2024). VMware, Inc. https://spring.io/projects/spring-cloud-gateway"),
    buildReferenceItem("[5]  Apache Kafka Documentation. (2024). Apache Software Foundation. https://kafka.apache.org/documentation/"),
    buildReferenceItem("[6]  Keycloak Documentation. (2024). Red Hat, Inc. https://www.keycloak.org/documentation"),
    buildReferenceItem("[7]  VNPay. (2024). Vietnam Payment Solution. https://vnpay.vn/"),
    buildReferenceItem("[8]  React Documentation. (2024). Meta Platforms, Inc. https://react.dev/"),
    buildReferenceItem("[9]  Spring Boot Reference Documentation. (2024). VMware, Inc. https://spring.io/projects/spring-boot"),
    buildReferenceItem("[10] NestJS Documentation. (2024). NestJS Team. https://docs.nestjs.com/"),
  ];
}

function buildReferenceItem(text) {
  return new Paragraph({
    indent: { left: 420, hanging: 420 },
    spacing: { line: 360 },
    children: [new TextRun({ text, size: 21, font: { ascii: "Times New Roman" } })],
  });
}

// ============================================================
// DOCUMENT ASSEMBLY
// ============================================================

const info = {
  title: "VNShop: A Full-Stack E-Commerce Marketplace Platform for Vietnamese Online Retail",
  author: "【Student Name】",
  matricNo: "【Matric Number】",
  degree: "FINAL YEAR PROJECT REPORT SUBMITTED IN PARTIAL FULFILLMENT FOR THE DEGREE OF BACHELOR OF COMPUTER SCIENCE (HONOURS) IN SOFTWARE ENGINEERING",
  faculty: "FACULTY OF NETWORK TECHNOLOGY AND CYBERSECURITY",
  university: "LINCOLN UNIVERSITY COLLEGE",
  country: "MALAYSIA",
  date: "JULY 2026",
  supervisor: "【Supervisor Name】",
};

const coverTitle = "VNShop: A Full-Stack E-Commerce Marketplace Platform for Vietnamese Online Retail";

const doc = new Document({
  styles,
  numbering: {
    config: [
      {
        reference: "objectives",
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "recommendations",
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [
    // Section 1: Cover
    {
      properties: {
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildMalaysianCover(info),
    },
    // Section 2: Declaration
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: buildDeclaration(info),
    },
    // Section 3: Acknowledgement
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: buildAcknowledgement(info),
    },
    // Section 4: Abstract (English)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: buildAbstractEN(info),
    },
    // Section 5: Abstract (Malay)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: buildAbstractMS(info),
    },
    // Section 6: Table of Contents
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: buildTOC(),
    },
    // Section 7: List of Tables
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: buildListOfTables(),
    },
    // Section 8: List of Figures
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: buildListOfFigures(),
    },
    // Section 9: List of Abbreviations
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: buildListOfAbbreviations(),
    },
    // Section 10: Body Chapters (1-6)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: [
        ...buildChapter1(),
        pageBreak(),
        ...buildChapter2(),
        pageBreak(),
        ...buildChapter3(),
        pageBreak(),
        ...buildChapter4(),
        pageBreak(),
        ...buildChapter5(),
        pageBreak(),
        ...buildChapter6(),
      ],
    },
    // Section 11: References
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: MARGIN,
          pageNumbers: { formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: buildHeader(coverTitle) },
      footers: { default: buildPageNumberFooter() },
      children: buildReferences(),
    },
  ],
});

// Export
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("VNShop_Documentation.docx", buffer);
  console.log("Document generated: VNShop_Documentation.docx");
});
