"""Static contract checks for the video-moderator runtime infrastructure."""

from pathlib import Path
import re
import unittest


REPO = Path(__file__).resolve().parents[2]
COMPOSE = REPO / "docker-compose.yml"
KAFKA_BOOTSTRAP = REPO / "infra/scripts/init-kafka-topics.sh"
KAFKA_BOOTSTRAP_K8S = REPO / "infra/k8s/base/kafka-bootstrap-job.yaml"
WORKLOADS_K8S = REPO / "infra/k8s/base/workloads.yaml"
DOCKERFILE = REPO / "services/video-moderator/Dockerfile"


def _service_block(document: str, service: str, next_service: str) -> str:
    start = document.index(f"  {service}:")
    end = document.index(f"  {next_service}:", start)
    return document[start:end]


def _k8s_workload_block(document: str, workload: str, next_workload: str) -> str:
    start_marker = f"\n---\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: {workload}"
    end_marker = f"\n---\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: {next_workload}"
    start = document.index(start_marker)
    end = document.index(end_marker, start)
    return document[start:end]


def _kafka_contract(document: str) -> None:
    assert '"video.moderation.dlt:3"' in document
    assert (
        "$ACL --add --allow-principal User:svc-video-moderator "
        "--operation Write --topic video.moderation.dlt"
    ) in document


class VideoModeratorInfrastructureContractTest(unittest.TestCase):
    def test_compose_tmpfs_is_owned_by_the_moderator_uid(self) -> None:
        compose = COMPOSE.read_text(encoding="utf-8")
        block = _service_block(compose, "video-moderator", "jaeger")
        tmpfs = re.search(r"^\s+- /tmp/video-moderator:(.+)$", block, re.MULTILINE)

        self.assertIsNotNone(tmpfs)
        assert tmpfs is not None
        options = set(tmpfs.group(1).split(","))
        required_options = {"size=2G", "noexec", "uid=65532", "gid=65532", "mode=1770"}
        self.assertTrue(required_options <= options)
        self.assertIn("USER 65532", DOCKERFILE.read_text(encoding="utf-8"))
        self.assertIn("no-new-privileges:true", block)
        self.assertIn("read_only: true", block)
        self.assertIn("- ALL", block)
    def test_local_and_kubernetes_kafka_bootstraps_create_the_moderator_dlt(self) -> None:
        _kafka_contract(KAFKA_BOOTSTRAP.read_text(encoding="utf-8"))
        _kafka_contract(KAFKA_BOOTSTRAP_K8S.read_text(encoding="utf-8"))
    def test_kubernetes_workload_uses_the_moderator_identity_and_memory_scratch(self) -> None:
        workloads = WORKLOADS_K8S.read_text(encoding="utf-8")
        block = _k8s_workload_block(workloads, "vnshop-video-moderator", "vnshop-video-transcoder")

        self.assertIn("runAsNonRoot: true", block)
        self.assertIn("runAsUser: 65532", block)
        self.assertIn("runAsGroup: 65532", block)
        self.assertIn("fsGroup: 65532", block)
        self.assertIn("mountPath: /tmp", block)
        self.assertIn("medium: Memory", block)
        self.assertIn("sizeLimit: 4Gi", block)
        self.assertIn("allowPrivilegeEscalation: false", block)
        self.assertIn("readOnlyRootFilesystem: true", block)
        self.assertIn('drop: ["ALL"]', block)


if __name__ == "__main__":
    unittest.main()
