# Artifact Contract

## Reference
- Reference: `C:\Users\dangq\.codex\plugins\cache\openai-curated-remote\openai-templates\0.1.0\skills\artifact-template-system-design\assets\reference.docx`
- SHA-256: `13504F6C221A42C1726460A9E865E563355539FF97D702D6C9B2267B4B261D76`
- One portrait Letter section, 0.70 in left/right/top and 0.62 in bottom margins.
- The renderer is unavailable because LibreOffice is not present. The supplied `preview.png`, section audit, style audit, and package inspection are the layout evidence.

## Template System
- Keep the cover treatment: muted blue system name, navy proposal title, three metadata columns, then four-row metadata table.
- Keep numbered section headings and the original nine tables in the same order.
- Preserve the font system: Helvetica Neue dominates with directly formatted heading and body roles.
- All editable content is plain text in `word/document.xml`; no content controls are present.
- Preserve every package part except `word/document.xml` in the output.

## Slot Map
- Cover: system name, title, status/owner/date, and metadata rows.
- Body paragraphs: abstract, background, architecture narrative, lifecycle, guarantees, security, decision, and open questions.
- Tables: goals, components, contract, consistency scenarios, operational signals, alternatives, and milestones.

## Content Basis
- Investigation evidence comes from `fe/src/app/pages/SearchPage.tsx`, `fe/src/app/hooks/use-search-v2.ts`, `fe/src/app/hooks/use-products-v2.ts`, `services/search-service/.../ProductEventConsumer.java`, `services/search-service/.../ProductProjectionRepairJob.java`, product/category migrations, and the local running API inspected on 2026-07-27.
- Do not claim a production deployment, an executed replay, or a measured SLO. Recommendations are explicitly proposed design work.
