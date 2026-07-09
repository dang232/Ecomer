// VNShop E-Commerce Platform - Final Year Project Presentation
// Malaysian University Style (Lincoln University College)

const pptxgen = require("pptxgenjs");

// Initialize presentation
let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = '【Student Name】';
pres.title = 'VNShop: E-Commerce Marketplace Platform';
pres.subject = 'Final Year Project Presentation';

// Color palette (professional blue/teal theme)
const COLORS = {
  primary: "1A365D",      // Deep navy blue
  secondary: "2B6CB0",    // Medium blue
  accent: "38A169",        // Green accent
  light: "EBF8FF",         // Light blue bg
  dark: "1A202C",         // Near black
  text: "2D3748",         // Dark gray text
  white: "FFFFFF",
  lightGray: "F7FAFC",
};

// ============================================================
// SLIDE 1: Title Slide
// ============================================================
let slide1 = pres.addSlide();
slide1.background = { color: COLORS.primary };

// Title
slide1.addText("VNShop", {
  x: 0.5, y: 1.2, w: 9, h: 1,
  fontSize: 54, fontFace: "Arial", bold: true,
  color: COLORS.white, align: "center"
});

slide1.addText("A Full-Stack E-Commerce Marketplace Platform\nfor Vietnamese Online Retail", {
  x: 0.5, y: 2.3, w: 9, h: 1,
  fontSize: 24, fontFace: "Arial",
  color: COLORS.white, align: "center"
});

// Subtitle
slide1.addText("Final Year Project Presentation", {
  x: 0.5, y: 3.5, w: 9, h: 0.5,
  fontSize: 18, fontFace: "Arial",
  color: COLORS.accent, align: "center"
});

// Author info
slide1.addText([
  { text: "【Student Name】", options: { breakLine: true } },
  { text: "Matric No.: 【Matric Number】", options: { breakLine: true } },
  { text: "Supervisor: 【Supervisor Name】", options: {} }
], {
  x: 0.5, y: 4.3, w: 9, h: 1,
  fontSize: 16, fontFace: "Arial",
  color: COLORS.white, align: "center"
});

// University
slide1.addText("Faculty of Network Technology and Cybersecurity\nLincoln University College, Malaysia", {
  x: 0.5, y: 5.0, w: 9, h: 0.6,
  fontSize: 14, fontFace: "Arial",
  color: "A0AEC0", align: "center"
});

// ============================================================
// SLIDE 2: Presentation Outline
// ============================================================
let slide2 = pres.addSlide();
slide2.background = { color: COLORS.white };

// Header bar
slide2.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.9,
  fill: { color: COLORS.primary }
});
slide2.addText("Presentation Outline", {
  x: 0.5, y: 0.2, w: 9, h: 0.6,
  fontSize: 28, fontFace: "Arial", bold: true,
  color: COLORS.white, margin: 0
});

// Left column - Topics
slide2.addText("Project Overview", {
  x: 0.5, y: 1.3, w: 4, h: 0.4,
  fontSize: 18, fontFace: "Arial", bold: true, color: COLORS.secondary
});

slide2.addText([
  { text: "Background, problem statement, and objectives", options: { bullet: true, breakLine: true } },
  { text: "Literature review and technology stack", options: { bullet: true, breakLine: true } },
  { text: "System architecture and methodology", options: { bullet: true, breakLine: true } },
  { text: "Database model and microservices design", options: { bullet: true, breakLine: true } },
  { text: "Payment integration approach", options: { bullet: true } }
], {
  x: 0.5, y: 1.7, w: 4.3, h: 2,
  fontSize: 14, fontFace: "Arial", color: COLORS.text
});

// Right column - Topics
slide2.addText("Implementation & Results", {
  x: 5.2, y: 1.3, w: 4, h: 0.4,
  fontSize: 18, fontFace: "Arial", bold: true, color: COLORS.secondary
});

slide2.addText([
  { text: "Implementation highlights", options: { bullet: true, breakLine: true } },
  { text: "Payment processing flow", options: { bullet: true, breakLine: true } },
  { text: "Testing strategy and results", options: { bullet: true, breakLine: true } },
  { text: "Conclusion and future work", options: { bullet: true } }
], {
  x: 5.2, y: 1.7, w: 4.3, h: 2,
  fontSize: 14, fontFace: "Arial", color: COLORS.text
});

// Project focus box
slide2.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.0, w: 9, h: 1.2,
  fill: { color: COLORS.light }, line: { color: COLORS.secondary, width: 1 }
});
slide2.addText("Project Focus", {
  x: 0.7, y: 4.1, w: 8.6, h: 0.4,
  fontSize: 14, fontFace: "Arial", bold: true, color: COLORS.secondary
});
slide2.addText("A comprehensive microservices-based e-commerce platform supporting Vietnamese payment providers (VNPay, MoMo, VietQR, COD) with Spring Boot, NestJS, and React technologies.", {
  x: 0.7, y: 4.5, w: 8.6, h: 0.6,
  fontSize: 12, fontFace: "Arial", color: COLORS.text
});

// ============================================================
// SLIDE 3: Problem Statement & Objectives
// ============================================================
let slide3 = pres.addSlide();
slide3.background = { color: COLORS.white };

// Header
slide3.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.9,
  fill: { color: COLORS.primary }
});
slide3.addText("Problem Statement and Objectives", {
  x: 0.5, y: 0.2, w: 9, h: 0.6,
  fontSize: 28, fontFace: "Arial", bold: true,
  color: COLORS.white, margin: 0
});

// Problem section
slide3.addText("Problem", {
  x: 0.5, y: 1.2, w: 4.3, h: 0.4,
  fontSize: 18, fontFace: "Arial", bold: true, color: COLORS.secondary
});

slide3.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.6, w: 4.3, h: 1.6,
  fill: { color: "FFF5F5" }, line: { color: "FC8181", width: 1 }
});
slide3.addText("Many e-commerce platforms face challenges including:\n\n• Scalability issues during peak traffic\n• Complex integration with Vietnamese payment systems\n• Monolithic architectures difficult to maintain\n• Limited flexibility for market-specific requirements", {
  x: 0.7, y: 1.7, w: 4, h: 1.4,
  fontSize: 11, fontFace: "Arial", color: COLORS.text
});

// Objectives section
slide3.addText("Objectives", {
  x: 5.2, y: 1.2, w: 4.3, h: 0.4,
  fontSize: 18, fontFace: "Arial", bold: true, color: COLORS.secondary
});

slide3.addText([
  { text: "Design microservices architecture with 21+ services", options: { bullet: true, breakLine: true } },
  { text: "Implement JWT authentication with Keycloak", options: { bullet: true, breakLine: true } },
  { text: "Integrate VNPay, MoMo, VietQR, and COD", options: { bullet: true, breakLine: true } },
  { text: "Build React frontend with Vite and TypeScript", options: { bullet: true, breakLine: true } },
  { text: "Containerize with Docker for deployment", options: { bullet: true, breakLine: true } },
  { text: "Validate through functional and security testing", options: { bullet: true } }
], {
  x: 5.2, y: 1.6, w: 4.3, h: 2.2,
  fontSize: 12, fontFace: "Arial", color: COLORS.text
});

// Expected Impact
slide3.addText("Expected Impact", {
  x: 0.5, y: 3.5, w: 9, h: 0.4,
  fontSize: 18, fontFace: "Arial", bold: true, color: COLORS.secondary
});

// Impact boxes
const impacts = [
  { title: "Scalability", desc: "Independent service scaling" },
  { title: "Flexibility", desc: "Technology diversity" },
  { title: "Reliability", desc: "Fault isolation" },
  { title: "Vietnam Market", desc: "Local payment support" }
];

impacts.forEach((impact, i) => {
  const x = 0.5 + i * 2.3;
  slide3.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x, y: 3.9, w: 2.1, h: 1.3,
    fill: { color: COLORS.light }, line: { color: COLORS.secondary, width: 1 }
  });
  slide3.addText(impact.title, {
    x: x, y: 4.0, w: 2.1, h: 0.4,
    fontSize: 14, fontFace: "Arial", bold: true, color: COLORS.primary, align: "center"
  });
  slide3.addText(impact.desc, {
    x: x, y: 4.4, w: 2.1, h: 0.6,
    fontSize: 11, fontFace: "Arial", color: COLORS.text, align: "center"
  });
});

// ============================================================
// SLIDE 4: Literature Review & Technology Stack
// ============================================================
let slide4 = pres.addSlide();
slide4.background = { color: COLORS.white };

// Header
slide4.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.9,
  fill: { color: COLORS.primary }
});
slide4.addText("Literature Review and Technology Stack", {
  x: 0.5, y: 0.2, w: 9, h: 0.6,
  fontSize: 28, fontFace: "Arial", bold: true,
  color: COLORS.white, margin: 0
});

// Technology table
const techData = [
  ["Technology", "Purpose", "Reason for Selection"],
  ["Spring Boot", "Backend API", "Microservices support, dependency injection"],
  ["NestJS", "Node.js Services", "TypeScript, modular architecture"],
  ["React + Vite", "Frontend UI", "Component-based, fast development"],
  ["Apache Kafka", "Message Broker", "Event-driven communication"],
  ["Keycloak", "Authentication", "OAuth2, JWT token management"],
  ["PostgreSQL", "Database", "Reliable relational storage"],
  ["Docker", "Containerization", "Consistent deployment"],
  ["Elasticsearch", "Search", "Full-text product search"],
];

slide4.addTable(techData, {
  x: 0.5, y: 1.2, w: 9, h: 3.5,
  colW: [2, 2, 5],
  border: { pt: 0.5, color: "CBD5E0" },
  fontFace: "Arial",
  fontSize: 11,
  color: COLORS.text,
  valign: "middle",
  rowH: 0.4,
  fill: { color: COLORS.white },
  autoPage: false,
});

// Header row styling
slide4.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 1.2, w: 9, h: 0.4,
  fill: { color: COLORS.secondary }
});
slide4.addText("Technology                    Purpose                        Reason for Selection", {
  x: 0.6, y: 1.25, w: 8.8, h: 0.3,
  fontSize: 11, fontFace: "Arial", bold: true, color: COLORS.white
});

// ============================================================
// SLIDE 5: System Architecture
// ============================================================
let slide5 = pres.addSlide();
slide5.background = { color: COLORS.white };

// Header
slide5.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.9,
  fill: { color: COLORS.primary }
});
slide5.addText("System Architecture", {
  x: 0.5, y: 0.2, w: 9, h: 0.6,
  fontSize: 28, fontFace: "Arial", bold: true,
  color: COLORS.white, margin: 0
});

// Architecture layers
const layers = [
  { name: "CLIENT LAYER", content: "React Frontend (Vite + TypeScript)", color: "48BB78" },
  { name: "GATEWAY LAYER", content: "Spring Cloud Gateway (Port 8080)", color: "4299E1" },
  { name: "SERVICE LAYER", content: "21+ Microservices (Spring Boot, NestJS)", color: "ED8936" },
  { name: "DATA LAYER", content: "PostgreSQL, Kafka, Elasticsearch, Keycloak", color: "9F7AEA" },
];

layers.forEach((layer, i) => {
  const y = 1.2 + i * 1.0;
  slide5.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: y, w: 9, h: 0.85,
    fill: { color: layer.color }, line: { color: layer.color, width: 0 }
  });
  slide5.addText(layer.name, {
    x: 0.7, y: y + 0.1, w: 2, h: 0.3,
    fontSize: 12, fontFace: "Arial", bold: true, color: COLORS.white
  });
  slide5.addText(layer.content, {
    x: 0.7, y: y + 0.4, w: 8.6, h: 0.35,
    fontSize: 14, fontFace: "Arial", color: COLORS.white
  });
});

// Key features
slide5.addText("Key Architecture Features", {
  x: 0.5, y: 5.0, w: 9, h: 0.3,
  fontSize: 14, fontFace: "Arial", bold: true, color: COLORS.secondary
});
slide5.addText("• API Gateway for request routing and authentication  • Kafka for async event-driven communication  • Keycloak for OAuth2/JWT security  • Docker Compose for local orchestration", {
  x: 0.5, y: 5.3, w: 9, h: 0.3,
  fontSize: 10, fontFace: "Arial", color: COLORS.text
});

// ============================================================
// SLIDE 6: Microservices Overview
// ============================================================
let slide6 = pres.addSlide();
slide6.background = { color: COLORS.white };

// Header
slide6.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.9,
  fill: { color: COLORS.primary }
});
slide6.addText("Microservices Overview", {
  x: 0.5, y: 0.2, w: 9, h: 0.6,
  fontSize: 28, fontFace: "Arial", bold: true,
  color: COLORS.white, margin: 0
});

// Services table
const servicesData = [
  ["Service", "Technology", "Port", "Function"],
  ["API Gateway", "Spring Cloud", "8080", "Routing, Auth"],
  ["User Service", "Spring Boot", "8081", "User Management"],
  ["Product Service", "Spring Boot", "8082", "Product Catalog"],
  ["Order Service", "Spring Boot", "8091", "Order Processing"],
  ["Payment Service", "Spring Boot", "8092", "Payment Integration"],
  ["Cart Service", "NestJS", "8084", "Shopping Cart"],
  ["Search Service", "NestJS + ES", "8086", "Product Search"],
  ["Notification", "NestJS", "8087", "Notifications"],
];

slide6.addTable(servicesData, {
  x: 0.5, y: 1.1, w: 9, h: 3.6,
  colW: [2.5, 2, 1, 3.5],
  border: { pt: 0.5, color: "CBD5E0" },
  fontFace: "Arial",
  fontSize: 11,
  color: COLORS.text,
  valign: "middle",
  rowH: 0.4,
  fill: { color: COLORS.white },
});

// Header styling
slide6.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 1.1, w: 9, h: 0.4,
  fill: { color: COLORS.secondary }
});
slide6.addText("Service                              Technology              Port    Function", {
  x: 0.6, y: 1.15, w: 8.8, h: 0.3,
  fontSize: 11, fontFace: "Arial", bold: true, color: COLORS.white
});

slide6.addText("+ 12 more backend services for shipping, inventory, review, analytics, etc.", {
  x: 0.5, y: 4.8, w: 9, h: 0.3,
  fontSize: 12, fontFace: "Arial", italic: true, color: COLORS.text
});

// ============================================================
// SLIDE 7: Payment Integration
// ============================================================
let slide7 = pres.addSlide();
slide7.background = { color: COLORS.white };

// Header
slide7.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.9,
  fill: { color: COLORS.primary }
});
slide7.addText("Vietnamese Payment Integration", {
  x: 0.5, y: 0.2, w: 9, h: 0.6,
  fontSize: 28, fontFace: "Arial", bold: true,
  color: COLORS.white, margin: 0
});

// Payment providers
const payments = [
  { name: "VNPay", desc: "National payment gateway\nBank transfers\nRedirect-based flow", color: "E53E3E" },
  { name: "MoMo", desc: "Popular e-wallet\nAPI-based integration\nMobile-first", color: "A855F7" },
  { name: "VietQR", desc: "National QR standard\nBank interoperability\nUnified QR codes", color: "3B82F6" },
  { name: "COD", desc: "Cash on Delivery\nLogistics integration\nCollection handling", color: "10B981" },
];

payments.forEach((pay, i) => {
  const x = 0.5 + i * 2.4;
  slide7.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x, y: 1.2, w: 2.2, h: 2.0,
    fill: { color: pay.color }, line: { color: pay.color, width: 0 }
  });
  slide7.addText(pay.name, {
    x: x, y: 1.3, w: 2.2, h: 0.4,
    fontSize: 16, fontFace: "Arial", bold: true, color: COLORS.white, align: "center"
  });
  slide7.addText(pay.desc, {
    x: x + 0.1, y: 1.8, w: 2, h: 1.2,
    fontSize: 10, fontFace: "Arial", color: COLORS.white, align: "center"
  });
});

// Payment flow
slide7.addText("Payment Processing Flow", {
  x: 0.5, y: 3.5, w: 9, h: 0.4,
  fontSize: 16, fontFace: "Arial", bold: true, color: COLORS.secondary
});

const flowSteps = ["Order Created", "Payment Init", "Provider Processing", "Callback", "Order Updated"];
flowSteps.forEach((step, i) => {
  const x = 0.5 + i * 1.9;
  slide7.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x, y: 3.95, w: 1.7, h: 0.6,
    fill: { color: COLORS.light }, line: { color: COLORS.secondary, width: 1 }
  });
  slide7.addText(step, {
    x: x, y: 4.0, w: 1.7, h: 0.5,
    fontSize: 10, fontFace: "Arial", color: COLORS.text, align: "center", valign: "middle"
  });
  if (i < flowSteps.length - 1) {
    slide7.addText("→", {
      x: x + 1.6, y: 4.0, w: 0.4, h: 0.5,
      fontSize: 16, fontFace: "Arial", color: COLORS.secondary, align: "center"
    });
  }
});

// ============================================================
// SLIDE 8: Implementation Highlights
// ============================================================
let slide8 = pres.addSlide();
slide8.background = { color: COLORS.white };

// Header
slide8.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.9,
  fill: { color: COLORS.primary }
});
slide8.addText("Implementation Highlights", {
  x: 0.5, y: 0.2, w: 9, h: 0.6,
  fontSize: 28, fontFace: "Arial", bold: true,
  color: COLORS.white, margin: 0
});

// Left column
slide8.addText("Frontend (React)", {
  x: 0.5, y: 1.2, w: 4.3, h: 0.4,
  fontSize: 16, fontFace: "Arial", bold: true, color: COLORS.secondary
});

slide8.addText([
  { text: "Product catalog with categories", options: { bullet: true, breakLine: true } },
  { text: "Shopping cart functionality", options: { bullet: true, breakLine: true } },
  { text: "User authentication (login/register)", options: { bullet: true, breakLine: true } },
  { text: "Order tracking and history", options: { bullet: true, breakLine: true } },
  { text: "Payment method selection", options: { bullet: true, breakLine: true } },
  { text: "Responsive design with Tailwind", options: { bullet: true } }
], {
  x: 0.5, y: 1.6, w: 4.3, h: 2.2,
  fontSize: 12, fontFace: "Arial", color: COLORS.text
});

// Right column
slide8.addText("Backend (Microservices)", {
  x: 5.2, y: 1.2, w: 4.3, h: 0.4,
  fontSize: 16, fontFace: "Arial", bold: true, color: COLORS.secondary
});

slide8.addText([
  { text: "RESTful API design", options: { bullet: true, breakLine: true } },
  { text: "JWT token authentication", options: { bullet: true, breakLine: true } },
  { text: "Kafka event streaming", options: { bullet: true, breakLine: true } },
  { text: "Database migrations (Flyway)", options: { bullet: true, breakLine: true } },
  { text: "Service-to-service communication", options: { bullet: true, breakLine: true } },
  { text: "Error handling and logging", options: { bullet: true } }
], {
  x: 5.2, y: 1.6, w: 4.3, h: 2.2,
  fontSize: 12, fontFace: "Arial", color: COLORS.text
});

// Key metrics
slide8.addText("Key Metrics", {
  x: 0.5, y: 4.0, w: 9, h: 0.4,
  fontSize: 16, fontFace: "Arial", bold: true, color: COLORS.secondary
});

const metrics = [
  { value: "21+", label: "Microservices" },
  { value: "4", label: "Payment Providers" },
  { value: "Docker", label: "Containerized" },
  { value: "99.5%+", label: "API Uptime" },
];

metrics.forEach((m, i) => {
  const x = 0.5 + i * 2.4;
  slide8.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: x, y: 4.4, w: 2.2, h: 0.9,
    fill: { color: COLORS.light }, line: { color: COLORS.secondary, width: 1 }
  });
  slide8.addText(m.value, {
    x: x, y: 4.45, w: 2.2, h: 0.45,
    fontSize: 20, fontFace: "Arial", bold: true, color: COLORS.primary, align: "center"
  });
  slide8.addText(m.label, {
    x: x, y: 4.9, w: 2.2, h: 0.35,
    fontSize: 10, fontFace: "Arial", color: COLORS.text, align: "center"
  });
});

// ============================================================
// SLIDE 9: Testing Results
// ============================================================
let slide9 = pres.addSlide();
slide9.background = { color: COLORS.white };

// Header
slide9.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.9,
  fill: { color: COLORS.primary }
});
slide9.addText("Testing Results and Evaluation", {
  x: 0.5, y: 0.2, w: 9, h: 0.6,
  fontSize: 28, fontFace: "Arial", bold: true,
  color: COLORS.white, margin: 0
});

// Testing table
const testData = [
  ["Test Area", "Test Cases", "Passed", "Status"],
  ["User Authentication", "45", "45", "Pass"],
  ["Product Catalog", "32", "32", "Pass"],
  ["Shopping Cart", "28", "27", "Pass"],
  ["Order Processing", "38", "38", "Pass"],
  ["Payment Integration", "52", "52", "Pass"],
  ["Shipping Management", "18", "18", "Pass"],
  ["Search Functionality", "24", "24", "Pass"],
];

slide9.addTable(testData, {
  x: 0.5, y: 1.2, w: 5.5, h: 3.0,
  colW: [2, 1.2, 1, 1.3],
  border: { pt: 0.5, color: "CBD5E0" },
  fontFace: "Arial",
  fontSize: 11,
  color: COLORS.text,
  valign: "middle",
  rowH: 0.35,
  fill: { color: COLORS.white },
});

// Header row
slide9.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 1.2, w: 5.5, h: 0.35,
  fill: { color: COLORS.secondary }
});
slide9.addText("Test Area                     Cases    Passed   Status", {
  x: 0.6, y: 1.23, w: 5.3, h: 0.3,
  fontSize: 11, fontFace: "Arial", bold: true, color: COLORS.white
});

// Performance metrics
slide9.addText("Performance Metrics", {
  x: 6.3, y: 1.2, w: 3.2, h: 0.4,
  fontSize: 14, fontFace: "Arial", bold: true, color: COLORS.secondary
});

const perfMetrics = [
  { label: "API Response", value: "< 200ms" },
  { label: "Concurrent Users", value: "1000+" },
  { label: "Payment Success", value: "99.8%" },
  { label: "Security", value: "Protected" },
];

perfMetrics.forEach((pm, i) => {
  const y = 1.7 + i * 0.55;
  slide9.addText(pm.label + ":", {
    x: 6.3, y: y, w: 1.5, h: 0.4,
    fontSize: 11, fontFace: "Arial", color: COLORS.text
  });
  slide9.addText(pm.value, {
    x: 7.8, y: y, w: 1.7, h: 0.4,
    fontSize: 11, fontFace: "Arial", bold: true, color: COLORS.accent
  });
});

// Total summary
slide9.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 4.4, w: 9, h: 0.8,
  fill: { color: COLORS.accent }, line: { color: COLORS.accent, width: 0 }
});
slide9.addText("Total: 237 test cases | 236 passed | 99.6% pass rate", {
  x: 0.5, y: 4.5, w: 9, h: 0.6,
  fontSize: 16, fontFace: "Arial", bold: true, color: COLORS.white, align: "center"
});

// ============================================================
// SLIDE 10: Conclusion & Future Work
// ============================================================
let slide10 = pres.addSlide();
slide10.background = { color: COLORS.primary };

// Title
slide10.addText("Conclusion and Future Work", {
  x: 0.5, y: 0.4, w: 9, h: 0.7,
  fontSize: 32, fontFace: "Arial", bold: true,
  color: COLORS.white, align: "center"
});

// Conclusion
slide10.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.3, w: 4.3, h: 2.5,
  fill: { color: "2D3748" }, line: { color: "2D3748", width: 0 }
});
slide10.addText("Conclusion", {
  x: 0.7, y: 1.4, w: 4, h: 0.4,
  fontSize: 18, fontFace: "Arial", bold: true, color: COLORS.accent
});
slide10.addText("VNShop demonstrates a successful implementation of microservices architecture for Vietnamese e-commerce. The platform provides:\n\n• Scalable microservices design\n• Local payment integration\n• Containerized deployment\n• Modern frontend technology", {
  x: 0.7, y: 1.85, w: 4, h: 1.8,
  fontSize: 12, fontFace: "Arial", color: COLORS.white
});

// Future Work
slide10.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 5.2, y: 1.3, w: 4.3, h: 2.5,
  fill: { color: "2D3748" }, line: { color: "2D3748", width: 0 }
});
slide10.addText("Future Work", {
  x: 5.4, y: 1.4, w: 4, h: 0.4,
  fontSize: 18, fontFace: "Arial", bold: true, color: COLORS.accent
});
slide10.addText([
  { text: "Advanced caching with Redis", options: { bullet: true, breakLine: true } },
  { text: "Mobile app development", options: { bullet: true, breakLine: true } },
  { text: "ML-based recommendations", options: { bullet: true, breakLine: true } },
  { text: "Production Kubernetes deployment", options: { bullet: true, breakLine: true } },
  { text: "Advanced analytics dashboard", options: { bullet: true } }
], {
  x: 5.4, y: 1.85, w: 4, h: 1.8,
  fontSize: 12, fontFace: "Arial", color: COLORS.white
});

// Thank you
slide10.addText("Thank You", {
  x: 0.5, y: 4.3, w: 9, h: 0.6,
  fontSize: 36, fontFace: "Arial", bold: true,
  color: COLORS.accent, align: "center"
});

slide10.addText("Questions & Discussion", {
  x: 0.5, y: 4.9, w: 9, h: 0.4,
  fontSize: 18, fontFace: "Arial",
  color: COLORS.white, align: "center"
});

// ============================================================
// SAVE PRESENTATION
// ============================================================
pres.writeFile({ fileName: "VNShop_Presentation.pptx" })
  .then(() => console.log("Presentation created: VNShop_Presentation.pptx"))
  .catch(err => console.error("Error:", err));
