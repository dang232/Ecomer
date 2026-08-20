#!/usr/bin/env python3
"""Run a checked-in command matrix with fail-fast native exit semantics."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matrix", type=Path, required=True)
    parser.add_argument("--case", required=True)
    parser.add_argument("--attempt-id", required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        import yaml  # type: ignore
        matrix = yaml.safe_load(args.matrix.read_text(encoding="utf-8"))
    except Exception as exc:
        print(json.dumps({"status": "FAIL", "error": f"matrix load failed: {exc}"}), file=sys.stderr)
        return 2
    if not isinstance(matrix, dict) or set(matrix) != {"schema_version", "cases"} or matrix["schema_version"] != "qa-command-matrix.v1":
        print(json.dumps({"status": "FAIL", "error": "invalid matrix schema"}), file=sys.stderr)
        return 2
    case = matrix["cases"].get(args.case)
    if not isinstance(case, list) or not case:
        print(json.dumps({"status": "FAIL", "error": "unknown or empty case"}), file=sys.stderr)
        return 2
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    records = []
    first_failure = 0
    for index, step in enumerate(case):
        if not isinstance(step, dict) or set(step) != {"id", "command", "cwd"} or not isinstance(step["command"], list) or not step["command"]:
            print(json.dumps({"status": "FAIL", "error": f"invalid step at index {index}"}), file=sys.stderr)
            return 2
        record = {"id": step["id"], "command": step["command"], "cwd": step["cwd"], "started_at": now(), "ended_at": None, "exit_code": None, "outcome": "RUN"}
        if first_failure:
            record["outcome"] = "SKIPPED_DUE_TO_PRIOR_FAILURE"
            record["ended_at"] = now()
            records.append(record)
            continue
        try:
            completed = subprocess.run(step["command"], cwd=step["cwd"], text=True, encoding="utf-8", errors="replace", capture_output=True, check=False)
            record["exit_code"] = completed.returncode
            (args.evidence_dir / f"{index:03d}-{step['id']}.stdout.txt").write_text(completed.stdout, encoding="utf-8")
            (args.evidence_dir / f"{index:03d}-{step['id']}.stderr.txt").write_text(completed.stderr, encoding="utf-8")
            if completed.returncode:
                first_failure = completed.returncode
                record["outcome"] = "FAIL"
            else:
                record["outcome"] = "PASS"
        except (OSError, ValueError) as exc:
            first_failure = 127
            record["exit_code"] = first_failure
            record["outcome"] = "FAIL"
            (args.evidence_dir / f"{index:03d}-{step['id']}.stderr.txt").write_text(str(exc), encoding="utf-8")
        finally:
            record["ended_at"] = now()
            records.append(record)
    result = {"schema_version": "runner-result.v1", "attempt_id": args.attempt_id, "case": args.case, "status": "FAIL" if first_failure else "PASS", "first_failure_code": first_failure, "commands": records, "created_at": now()}
    (args.evidence_dir / "runner-result.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, sort_keys=True))
    return first_failure


if __name__ == "__main__":
    raise SystemExit(main())
