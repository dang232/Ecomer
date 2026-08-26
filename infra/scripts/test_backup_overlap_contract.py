from pathlib import Path
import tempfile


ROOT = Path(__file__).resolve().parents[2]


def test_backup_cron_rejects_overlapping_lock_fixture():
    script = (ROOT / "infra/scripts/backup-cron.sh").read_text()
    fixture = (ROOT / "scripts/fixtures/backup-overlap/backup-cron-overlap.yaml").read_text()
    assert 'LOCK_DIR="${BACKUP_LOCK_DIR:-' in script
    assert 'mkdir "${LOCK_DIR}"' in script
    assert 'exit 75' in script
    assert "overlapping_run: rejected" in fixture

    with tempfile.TemporaryDirectory() as directory:
        lock = Path(directory) / "lock"
        lock.mkdir()
        assert lock.exists()
        assert not (Path(directory) / "second-run-may-proceed").exists()


def test_authoritative_kubernetes_backup_forbids_cron_overlap():
    manifest = (ROOT / "infra/k8s/base/backup-jobs.yaml").read_text()
    assert "concurrencyPolicy: Forbid" in manifest
