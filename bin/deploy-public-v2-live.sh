#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "DEPRECATED: deploy-public-v2-live.sh now delegates to deploy-public-v3-live.sh" >&2
exec "$SCRIPT_DIR/deploy-public-v3-live.sh" "$@"
