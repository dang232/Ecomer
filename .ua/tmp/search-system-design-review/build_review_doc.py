from __future__ import annotations

import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(r"C:\Users\dangq\OneDrive\Documents\GitHub\Full-Stack-E-commerce")
REFERENCE = Path(r"C:\Users\dangq\.codex\plugins\cache\openai-curated-remote\openai-templates\0.1.0\skills\artifact-template-system-design\assets\reference.docx")
OUTPUT = ROOT / "docs" / "SEARCH-CATALOG-PROJECTION-REVIEW-2026-07-27.docx"
WORK = ROOT / ".ua" / "tmp" / "search-system-design-review" / "working.docx"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
ET.register_namespace("w", NS["w"])


def paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.findall(".//w:t", NS))


def set_paragraph(paragraph: ET.Element, value: str) -> None:
    texts = paragraph.findall(".//w:t", NS)
    if not texts:
        return
    texts[0].text = value
    for text in texts[1:]:
        text.text = ""


def cell_paragraph(table: ET.Element, row: int, col: int) -> ET.Element:
    rows = table.findall("w:tr", NS)
    cells = rows[row].findall("w:tc", NS)
    return cells[col].find("w:p", NS)


def set_cell(table: ET.Element, row: int, col: int, value: str) -> None:
    rows = table.findall("w:tr", NS)
    cells = rows[row].findall("w:tc", NS)
    paragraphs = cells[col].findall("w:p", NS)
    if not paragraphs:
        raise ValueError(f"Missing table cell {row}, {col}")
    set_paragraph(paragraphs[0], value)
    for paragraph in paragraphs[1:]:
        set_paragraph(paragraph, "")


def replace_paragraphs(document: ET.Element) -> None:
    replacements = {
        "System Name": "VNShop Catalog Discovery",
        "Title of Proposal": "Search Projection Recovery Review",
        "[Summarize the proposed system, the problem it solves, and the intended outcome. Describe the core design at a high level, including the main boundaries, dependencies, and guarantees. Keep this section concise enough that a reviewer can understand the proposal without reading the full document.]": "The storefront caches cursor pages correctly, but filtered category discovery can report no products while product-service contains them. This review proposes a recoverable catalog-to-search projection with a canonical category taxonomy and a controlled backfill path.",
        "[Describe the workloads and constraints this design must support. Clarify what the proposal does not attempt to solve, the assumptions it relies on, and the most important operational or implementation boundaries.]": "Scope: buyer search and category navigation. The design keeps product-service as catalog source of truth; it does not redesign relevance ranking, pricing, or checkout. Kafka remains the live propagation mechanism, augmented by explicit bootstrap and reconciliation.",
        "[Describe the current state, the specific problem, and why the existing approach is no longer sufficient. Include relevant scale, reliability, security, cost, or developer-experience constraints, and explain the impact of leaving the problem unresolved.]": "A selected category activates GET /search/v2, whereas an unfiltered browse calls GET /products/v2. In the local dataset product-service has Fashion, Beauty, Home, and Sports products, while search-service's read model only contains Electronics. The UI correctly renders the empty search response, which makes valid catalog inventory disappear.",
        "[Explain the proposed system boundary and the major responsibilities on each side. Name the primary components, how they interact, and which inputs determine behavior. State the key design principle or invariant that should guide implementation and review.]": "Product-service owns products and category validation. Its outbox publishes changes; search-service projects them for discovery. A versioned snapshot/replay API plus a checkpointed backfill closes historical gaps. The invariant: every active catalog product with a canonical category is eventually represented or explicitly quarantined in search.",
        "Figure 1. [Proposed System Architecture].": "Figure 1. Product-service and taxonomy -> outbox/Kafka -> search projector and reconciliation -> Elasticsearch/JPA read model -> gateway -> React search cache.",
        "[Describe how a request, event, or job enters the system and identify the required inputs.]": "A buyer changes query/category/filter state, or a product/category event is published. The request carries a normalized cursor filter set; a recovery job carries a durable source checkpoint.",
        "[Describe validation, authentication, authorization, and normalization at the system boundary.]": "Gateway authentication applies to buyer requests. Product writes validate the category against the canonical taxonomy. Search normalizes filters and binds cursors to their canonical filter representation.",
        "[Describe which configuration, policy, state, or dependency data is loaded before processing.]": "Search reads its projection checkpoint, idempotency key, JPA read model, and Elasticsearch availability. Backfill reads a bounded source snapshot plus the source watermark.",
        "[Describe the primary decision or processing step and the output it produces.]": "The projector upserts or deletes a search read model for each product version. Reconciliation compares source and projection counts/checkpoints, then emits repair work for missing or stale rows.",
        "[Describe which durable state must be written before side effects or downstream execution begin.]": "Persist the projection row and source version before Elasticsearch indexing. Persist a backfill checkpoint only after the page has been projected successfully.",
        "[Describe downstream calls, retries, timeouts, budget limits, and terminal conditions.]": "Kafka remains the low-latency channel. Backfill pages use bounded retries and rate limits; failed records go to a visible quarantine queue rather than silently advancing the checkpoint.",
        "[Describe final state updates, the response or output, and the metrics, logs, and traces emitted.]": "Return the cursor page from the read model. Emit projection lag, source-versus-projection count drift, backfill progress, failed records, and cache hit/prefetch signals with correlation IDs.",
        "[State the ordering, durability, or validation guarantee that must hold before execution.]": "Only canonical categories may be attached to catalog products, and each active product version is durable before it is eligible for a search projection.",
        "[State how writes, attempts, or events are identified and ordered.]": "Events use product ID, event ID, operation, and source version. The projector deduplicates event IDs and rejects out-of-order versions for the same product.",
        "[State which versions, identifiers, or inputs must be captured for audit and replay.]": "Capture product ID, category ID, source version, outbox/event ID, created time, projection time, replay job ID, and checkpoint.",
        "[State what this data is and is not a source of truth for.]": "Product-service is authoritative for catalog and category assignment. Search JPA and Elasticsearch are disposable discovery projections; React Query is a short-lived client cache, never a catalog authority.",
        "[Link to interface or schema] and update it with each contract release.": "The product event schema and the proposed snapshot/reconciliation contract are versioned with each release.",
        "[Explain the consistency, idempotency, replay, ordering, or concurrency guarantees required by this design. Distinguish client-facing guarantees from internal analysis or recovery behavior, and identify where duplicate work or partial failure is acceptable.]": "Search is eventually consistent. Duplicate events and backfill overlap are safe through event IDs and source versions. A missing projection must be detectable and recoverable; an empty search response is valid only when the projection is known complete for that filter scope.",
        "[Describe authentication, authorization, and tenant or data-boundary requirements.]": "Keep existing gateway authentication and service-to-service authorization. Snapshot/backfill endpoints are internal-admin only and must not be exposed through the public gateway.",
        "[Describe data minimization, sensitive payload handling, and logging restrictions.]": "Project only public product-discovery fields. Exclude seller secrets, buyer data, and raw credentials from product events, repair records, and logs.",
        "[Describe credential, secret, key, and certificate storage and access requirements.]": "Use existing service configuration and secret injection. Recovery tools use least-privilege service credentials and separate operational roles.",
        "[Describe safe defaults for administrative, replay, migration, and debugging tools.]": "Dry-run by default; require an explicit bounded scope, rate limit, and confirmation for writes. Never reset consumer offsets as the normal repair path.",
        "[Describe retention, deletion, residency, privacy, and audit requirements.]": "Retain replay audit records and checkpoints long enough to prove completion. Product deletion events must remove the search row and document.",
        "[Open question 1: identify a decision that requires reviewer input before implementation.]": "Should product-service expose a paginated internal snapshot endpoint, or should a dedicated projection exporter read its database under a stable contract?",
        "[Open question 2: identify an unresolved product, policy, or operational constraint.]": "Should a category not present in the taxonomy reject the product write, be migrated automatically, or be quarantined for operator review?",
        "[Open question 3: identify a scale, deployment, or regional design choice.]": "What maximum snapshot rate keeps product-service healthy while a full catalog rebuild runs?",
        "[Open question 4: identify an ownership, access-control, or tooling decision.]": "Which team owns the drift alert and approval to run a production recovery job?",
        "[State the recommended decision and summarize the implementation sequence. Name the first milestone, the validation or dry-run stage, the initial production audience, and the conditions that must be met before broader rollout.]": "Approve a canonical taxonomy plus checkpointed projection recovery. First add category validation and a dry-run reconciler; then backfill one non-Electronics category and compare source/projection counts. Roll out only after zero unexplained drift, tested rollback, and cache behavior remains smooth under cursor navigation.",
    }
    for paragraph in document.findall(".//w:p", NS):
        current = paragraph_text(paragraph)
        if current in replacements:
            set_paragraph(paragraph, replacements[current])


def replace_tables(document: ET.Element) -> None:
    tables = document.findall(".//w:tbl", NS)
    values = {
        0: {(0, 0): "STATUS\nProposed", (0, 2): "OWNER\nCatalog + Search", (0, 4): "LAST UPDATED\nJuly 27, 2026"},
        1: {(0, 1): "Codex investigation", (1, 1): "Catalog, Search, Frontend owners", (2, 1): ".ua/domain-graph.json; relevant source paths", (3, 1): "Catalog-to-search projection, category taxonomy, and cursor cache behavior."},
        2: {(1, 0): "Keep category search complete after restarts or missed events.", (1, 1): "Redesign relevance ranking.", (2, 0): "Preload exactly one next cursor page for smooth navigation.", (2, 1): "Make client cache the source of truth.", (3, 0): "Reject or quarantine invalid category assignments.", (3, 1): "Expose recovery endpoints publicly.", (4, 0): "Provide a measurable, reversible backfill rollout.", (4, 1): "Guarantee zero-lag global consistency."},
        3: {(1, 0): "Product service", (1, 1): "Catalog authority; validates category; emits outbox events.", (1, 2): "Product PostgreSQL", (1, 3): "Write fails if taxonomy invalid; retry outbox relay.", (2, 0): "Search service", (2, 1): "Consumes events; projects and reconciles discovery data.", (2, 2): "Search PostgreSQL", (2, 3): "Quarantine/retry projection; do not advance checkpoint.", (3, 0): "Elasticsearch", (3, 1): "Serves filtered cursor queries and facets.", (3, 2): "Search index", (3, 3): "Fall back to JPA where supported; alert on drift.", (4, 0): "React storefront", (4, 1): "Renders results and keeps page N+1 warm.", (4, 2): "TanStack Query cache", (4, 3): "Show loading/error; never fabricate catalog data.", (5, 0): "Operations", (5, 1): "Runs dry-run/replay and monitors completeness.", (5, 2): "Metrics and audit store", (5, 3): "Stop safely; retain failed record evidence."},
        4: {(1, 0): "productId", (1, 1): "UUID", (1, 2): "Yes", (1, 3): "Canonical catalog identifier.", (2, 0): "categoryId", (2, 1): "string", (2, 2): "Yes", (2, 3): "Validated taxonomy identifier.", (3, 0): "sourceVersion", (3, 1): "long", (3, 2): "Yes", (3, 3): "Monotonic per-product ordering value.", (4, 0): "eventId", (4, 1): "UUID", (4, 2): "Yes", (4, 3): "Idempotency and audit identifier.", (5, 0): "operation", (5, 1): "enum", (5, 2): "Yes", (5, 3): "UPSERT or DELETE projection action.", (6, 0): "checkpoint", (6, 1): "cursor", (6, 2): "Replay", (6, 3): "Durable progress marker for bounded backfill.", (7, 0): "projectedAt", (7, 1): "instant", (7, 2): "Yes", (7, 3): "Lag and drift observability."},
        5: {(1, 0): "Duplicate Kafka event or overlap with replay", (1, 1): "No duplicate row or stale overwrite.", (1, 2): "Event ID and source version make writes idempotent.", (2, 0): "Search index write fails", (2, 1): "JPA row retained; repair queued and alert emitted.", (2, 2): "A later repair can rebuild from the durable projection.", (3, 0): "Backfill page fails", (3, 1): "Retry within budget; checkpoint remains unchanged.", (3, 2): "No hidden gap is accepted as success.", (4, 0): "Taxonomy changes during processing", (4, 1): "Versioned category snapshot remains authoritative per run.", (4, 2): "Avoids mixing category definitions in one replay."},
        6: {(1, 0): "Projection completeness", (1, 1): "Alert on source/projection count drift by category.", (1, 2): "Search", (1, 3): "Required", (2, 0): "Projection lag", (2, 1): "Alert on sustained source-to-index delay.", (2, 2): "Search", (2, 3): "Required", (3, 0): "Backfill failure rate", (3, 1): "Page on repeated failed/quarantined records.", (3, 2): "Catalog + Search", (3, 3): "Required", (4, 0): "Taxonomy integrity", (4, 1): "Alert on unknown category assignment attempts.", (4, 2): "Catalog", (4, 3): "Required", (5, 0): "Cursor cache behavior", (5, 1): "Verify page N+1 is warm and no third request occurs.", (5, 2): "Frontend", (5, 3): "Recommended", (6, 0): "Rollout constraint: dry-run first, then canary a category, compare counts and sample records, keep a feature flag, and stop on unexplained drift."},
        7: {(1, 0): "Rely on client fallback to products/v2", (1, 1): "Masks empty category pages.", (1, 2): "Hides a broken search projection and produces inconsistent facets.", (2, 0): "Reset Kafka offsets", (2, 1): "Can replay retained events.", (2, 2): "Retention cannot guarantee historical recovery; it is operationally risky.", (3, 0): "Only repair Elasticsearch", (3, 1): "Simple index rebuild.", (3, 2): "Cannot create missing JPA read models, the observed root cause.", (4, 0): "Manual SQL copy", (4, 1): "Fast local correction.", (4, 2): "Bypasses contracts, auditability, and repeatable recovery."},
        8: {(1, 1): "Taxonomy validation and source/projection drift report", (1, 2): "Unknown categories blocked or quarantined; dry-run reports explainable drift.", (2, 1): "Checkpointed snapshot/replay and quarantine tooling", (2, 2): "A non-Electronics category backfills with matching counts and samples.", (3, 1): "Limited category canary with dashboards and alerts", (3, 2): "No unexplained drift during the stability window.", (4, 1): "Broader recovery and operational ownership", (4, 2): "Rollback tested; launch gates and owners approved."},
    }
    for table_index, cells in values.items():
        for (row, col), value in cells.items():
            set_cell(tables[table_index], row, col, value)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(REFERENCE, WORK)
    with zipfile.ZipFile(WORK, "r") as archive:
        entries = {name: archive.read(name) for name in archive.namelist()}
    document = ET.fromstring(entries["word/document.xml"])
    replace_paragraphs(document)
    replace_tables(document)
    entries["word/document.xml"] = ET.tostring(document, encoding="utf-8", xml_declaration=True)
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, payload in entries.items():
            archive.writestr(name, payload)
    print(OUTPUT)


if __name__ == "__main__":
    main()
