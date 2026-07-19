#!/usr/bin/env bash
set -euo pipefail

version="8.30.1"
archive="gitleaks_${version}_linux_x64.tar.gz"
checksum="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
destination="${1:?destination directory is required}"

mkdir -p "$destination"
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  "https://github.com/gitleaks/gitleaks/releases/download/v${version}/${archive}" \
  --output "$destination/$archive"
printf '%s  %s\n' "$checksum" "$destination/$archive" | sha256sum --check --status
tar -xzf "$destination/$archive" -C "$destination" gitleaks
chmod +x "$destination/gitleaks"
"$destination/gitleaks" version
