#!/usr/bin/env python3
"""Deterministic F1 plan-contract validation and optional evidence report check."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
STATUSES = {"PASS", "FAIL", "BLOCKED_EXTERNAL", "INCONCLUSIVE", "NO-GO"}
IMPLEMENTATION_ROWS = 8
EXPECTED_OWNERS = {
    "1": "Todo 1",
    "2": "Todo 2",
    "3": "Todo 3",
    "4": "Todo 4",
    "5": "Todo 5",
    "6": "Todo 6",
    "7": "Todo 7",
    "8": "Todo 8",
    "F1": "plan-compliance-owner",
    "F2": "code-quality-owner",
    "F3": "runtime-qa-owner",
    "F4": "scope-fidelity-owner",
}


def check_report(value: dict) -> list[str]:
    required = {"attempt_id", "commit_sha", "tree_sha", "repository_status", "production_status"}
    errors = [f"missing contract field: {field}" for field in sorted(required - set(value))]
    if value.get("production_status") == "GO":
        errors.append("production GO is coordinator/seal owned")
    if value.get("repository_status") not in STATUSES:
        errors.append("repository status is not a closed enum")
    return errors


def plan_contract(plan: str) -> list[str]:
    errors: list[str] = []
    rows = re.findall(r"^- \[[ xX]\] ([1-8])\.", plan, flags=re.MULTILINE)
    if len(rows) != IMPLEMENTATION_ROWS or set(rows) != set(str(index) for index in range(1, 9)):
        errors.append("plan must contain exactly eight implementation rows 1-8")
    final_rows = re.findall(r"^- \[[ xX]\] (F[1-4])\.", plan, flags=re.MULTILINE)
    if final_rows != ["F1", "F2", "F3", "F4"]:
        errors.append("plan must contain F1-F4 in order")
    placeholder_rows = re.findall(r"^- \[[ xX]\].*(?:TODO|placeholder|your task here).*", plan, flags=re.MULTILINE | re.IGNORECASE)
    if placeholder_rows:
        errors.append("plan contains an unresolved placeholder row")
    if "fake values" not in plan.lower() or "BLOCKED_EXTERNAL" not in plan:
        errors.append("plan must explicitly forbid fake values and define blocked external evidence")
    if "attempt ID" not in plan and "attempt_id" not in plan:
        errors.append("plan must define canonical attempt binding")
    if "checkpoint" not in plan.lower() or "ownership" not in plan.lower():
        errors.append("plan must define checkpoint and ownership contracts")
    for task, owner in EXPECTED_OWNERS.items():
        if task in {"F1", "F2", "F3", "F4"} and owner not in plan:
            errors.append(f"missing verifier owner contract: {owner}")
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
