#!/usr/bin/env python3
"""Validate every Todo and final-verifier row as an independent contract."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


STATUSES = {"PASS", "FAIL", "BLOCKED_EXTERNAL", "INCONCLUSIVE", "NO-GO"}
ROW_RE = re.compile(r"^- \[[ xX]\] (\d+|F[1-4])\. (.+)$", re.MULTILINE)
EXPECTED = [str(index) for index in range(1, 9)] + [f"F{index}" for index in range(1, 5)]
OWNERS = {**{str(index): f"Todo {index}" for index in range(1, 9)}, "F1": "plan-compliance-owner", "F2": "code-quality-owner", "F3": "runtime-qa-owner", "F4": "scope-fidelity-owner"}


def check_report(value: dict) -> list[str]:
    required = {"attempt_id", "commit_sha", "tree_sha", "repository_status", "production_status"}
    errors = [f"missing contract field: {field}" for field in sorted(required - set(value))]
    if value.get("production_status") == "GO":
        errors.append("production GO is coordinator/seal owned")
    if value.get("repository_status") not in STATUSES:
        errors.append("repository status is not a closed enum")
    return errors


def _row_block(plan: str, start: int, end: int) -> str:
    return plan[start:end]


def plan_contract(plan: str) -> list[str]:
    errors: list[str] = []
    matches = list(ROW_RE.finditer(plan))
    rows = [match.group(1) for match in matches]
    if rows != EXPECTED:
        errors.append("plan must contain exactly Todo 1-8 followed by F1-F4")
    for index, match in enumerate(matches):
        task = match.group(1)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(plan)
        block = _row_block(plan, match.start(), end)
        normalized = block.replace("`", "")
        if task.startswith("F"):
            if "Reuse the canonical" not in block and "Reuse the same canonical" not in block:
                errors.append(f"{task}: missing canonical attempt field")
            if "python infra/scripts/evidence_session.py checkpoint" not in normalized:
                errors.append(f"{task}: missing checkpoint invocation")
            if OWNERS[task] not in block:
                errors.append(f"{task}: missing owner field")
        elif any(token not in block for token in ("Parallelization:", "Blocked by:", "Commit:")) or not re.search(r"Commit:\s*[YN]\s*\|", block):
            errors.append(f"{task}: missing dependency/parallelization/commit field")
        if "attempt" not in block.lower() or "checkpoint" not in block.lower():
            errors.append(f"{task}: missing attempt/checkpoint contract")
        if not task.startswith("F") and ("QA scenarios" not in block or ("python infra/scripts/powershell-runner.py" not in normalized and not (task == "8" and "python infra/scripts/evidence_session.py aggregate" in normalized))):
            errors.append(f"{task}: missing exact QA invocation")
    if "fake values" not in plan.lower() or "BLOCKED_EXTERNAL" not in plan:
        errors.append("plan must explicitly forbid fake values and define blocked external evidence")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if not args.plan and not args.report:
        parser.error("one of --plan or --report is required")
    errors: list[str] = []
    if args.plan:
        errors.extend(plan_contract(args.plan.read_text(encoding="utf-8")))
    if args.report:
        errors.extend(check_report(json.loads(args.report.read_text(encoding="utf-8-sig"))))
    result = {"schema_version": "plan-contract.v1", "status": "PASS" if not errors else "FAIL", "errors": sorted(set(errors))}
    print(json.dumps(result, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
