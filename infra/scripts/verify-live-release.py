#!/usr/bin/env python3
"""Compare an Argo-rendered deployment and every running pod to a release lock."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load(path: str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def normalize_image_id(value: str) -> str:
    for prefix in ("docker-pullable://", "docker://", "containerd://"):
        if value.startswith(prefix):
            return value[len(prefix) :]
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lock", required=True)
    parser.add_argument("--deployments", required=True)
    parser.add_argument("--pods", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    lock = load(args.lock)
    deployments = load(args.deployments)
    pods = load(args.pods)
    expected = {
        artifact["id"]: f'{artifact["image"]}@{artifact["digest"]}'
        for artifact in lock["artifacts"]
    }
    errors: list[str] = []
    desired: dict[str, str] = {}
    live: dict[str, set[str]] = {artifact_id: set() for artifact_id in expected}

    for deployment in deployments.get("items", []):
        artifact_id = deployment.get("metadata", {}).get("labels", {}).get("vnshop.io/artifact-id")
        containers = deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
        if not artifact_id or len(containers) != 1:
            errors.append(f"deployment {deployment.get('metadata', {}).get('name')} has invalid artifact/container identity")
            continue
        if artifact_id in desired:
            errors.append(f"duplicate deployment for {artifact_id}")
        desired[artifact_id] = containers[0].get("image", "")

    if set(desired) != set(expected):
        errors.append(f"deployment catalog mismatch: expected={sorted(expected)} actual={sorted(desired)}")
    for artifact_id, image in desired.items():
        if expected.get(artifact_id) != image:
            errors.append(f"deployment {artifact_id}: expected {expected.get(artifact_id)}, got {image}")

    ready_pods: dict[str, int] = {artifact_id: 0 for artifact_id in expected}
    for pod in pods.get("items", []):
        metadata = pod.get("metadata", {})
        artifact_id = metadata.get("labels", {}).get("vnshop.io/artifact-id")
        if artifact_id not in expected:
            errors.append(f"pod {metadata.get('name')} has unknown artifact id {artifact_id}")
            continue
        statuses = pod.get("status", {}).get("containerStatuses", [])
        if len(statuses) != 1:
            errors.append(f"pod {metadata.get('name')} does not have exactly one application container status")
            continue
        status = statuses[0]
        image_id = normalize_image_id(status.get("imageID", ""))
        live[artifact_id].add(image_id)
        if status.get("ready") is True:
            ready_pods[artifact_id] += 1
        if status.get("image") != expected[artifact_id]:
            errors.append(f"pod {metadata.get('name')} desired image differs from lock")
        if image_id != expected[artifact_id]:
            errors.append(
                f"pod {metadata.get('name')} live image id differs: expected {expected[artifact_id]}, got {image_id}"
            )

    for artifact_id, count in ready_pods.items():
        if count < 1:
            errors.append(f"{artifact_id} has no ready pod at the locked image")

    report = {
        "schemaVersion": "1.0",
        "sourceCommit": lock.get("sourceCommit"),
        "artifactCount": len(expected),
        "desired": desired,
        "liveImageIds": {key: sorted(value) for key, value in live.items()},
        "readyPods": ready_pods,
        "valid": not errors,
        "errors": errors,
    }
    Path(args.output).write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(f"verified {len(expected)} locked artifacts across {sum(ready_pods.values())} ready pods")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
