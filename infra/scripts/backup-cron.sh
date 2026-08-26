#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${LOG_DIR:-${SCRIPT_DIR}/../backups/logs}"
LOG_FILE="${LOG_DIR}/backup-$(date +%Y%m%d).log"
LOCK_DIR="${BACKUP_LOCK_DIR:-${LOG_DIR}/.backup-cron.lock}"
LOCK_FILE="${BACKUP_LOCK_FILE:-${LOG_DIR}/backup.lock}"

mkdir -p "${LOG_DIR}"
if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo "[$(date --iso-8601=seconds)] backup-cron skipped: another backup is running" >> "${LOG_FILE}"
  exit 75
fi
trap 'rmdir "${LOCK_DIR}"' EXIT

{
  if ! command -v flock >/dev/null 2>&1; then
    echo "[$(date --iso-8601=seconds)] flock is required; Windows requires WSL or a Linux host" >&2
    exit 127
  fi

  (
    flock -n 9 || {
      echo "[$(date --iso-8601=seconds)] Backup already running; refusing overlap" >&2
      exit 75
    }
    echo "[$(date --iso-8601=seconds)] Starting scheduled VNShop backup"
    "${SCRIPT_DIR}/backup.sh"
    echo "[$(date --iso-8601=seconds)] Scheduled VNShop backup finished"
  ) 9>"${LOCK_FILE}"
} >> "${LOG_FILE}" 2>&1
