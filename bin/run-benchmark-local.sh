#!/usr/bin/env bash
set -euo pipefail

BENCHMARK_LOCAL_HOST="${BENCHMARK_LOCAL_HOST:-127.0.0.1}"
BENCHMARK_LOCAL_PORT="${BENCHMARK_LOCAL_PORT:-${TEST_LOCAL_SERVER_PORT:-8011}}"
DEFAULT_BASE_URL="http://${BENCHMARK_LOCAL_HOST}:${BENCHMARK_LOCAL_PORT}"
BASE_URL="${BENCHMARK_BASE_URL:-${TEST_BASE_URL:-$DEFAULT_BASE_URL}}"
BASE_URL="${BASE_URL%/}"
OUTPUT_FILE="${BENCHMARK_OUTPUT_FILE:-docs/PERFORMANCE_BASELINE.md}"
PID_FILE="${BENCHMARK_PID_FILE:-.benchmark_php_server_pid}"
BENCHMARK_SAMPLES="${BENCHMARK_SAMPLES:-20}"
BENCHMARK_START_LOCAL_SERVER="${BENCHMARK_START_LOCAL_SERVER:-auto}"
SERVER_STARTED="0"
ENVIRONMENT_LABEL=""

cleanup() {
    if [[ "$SERVER_STARTED" == "1" ]] && [[ -f "$PID_FILE" ]]; then
        kill "$(cat "$PID_FILE")" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
}
trap cleanup EXIT INT TERM

wait_for_http() {
    local target_url="$1"
    local attempts="${2:-20}"
    local attempt

    for ((attempt = 1; attempt <= attempts; attempt += 1)); do
        if curl -fsS "$target_url" > /dev/null; then
            return 0
        fi
        sleep 1
    done

    return 1
}

if [[ "$BENCHMARK_START_LOCAL_SERVER" == "auto" ]]; then
    if [[ -n "${BENCHMARK_BASE_URL:-}" || -n "${TEST_BASE_URL:-}" ]]; then
        BENCHMARK_START_LOCAL_SERVER="false"
    else
        BENCHMARK_START_LOCAL_SERVER="true"
    fi
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"

if [[ "$BENCHMARK_START_LOCAL_SERVER" == "true" || "$BENCHMARK_START_LOCAL_SERVER" == "1" ]]; then
    BASE_URL="$DEFAULT_BASE_URL"
    ENVIRONMENT_LABEL="Local (php -S ${BENCHMARK_LOCAL_HOST}:${BENCHMARK_LOCAL_PORT})"
    echo "Starting local PHP server on ${BASE_URL} ..."
    php -S "${BENCHMARK_LOCAL_HOST}:${BENCHMARK_LOCAL_PORT}" -t . > /dev/null 2>&1 &
    echo $! > "$PID_FILE"
    SERVER_STARTED="1"
else
    ENVIRONMENT_LABEL="Existing host (${BASE_URL})"
    echo "Using existing host: ${BASE_URL}"
fi

if ! wait_for_http "${BASE_URL}/"; then
    echo "Benchmark target did not become ready: ${BASE_URL}" >&2
    exit 1
fi

echo "Running benchmark against ${BASE_URL}"
echo "# Performance Baseline" > "$OUTPUT_FILE"
echo "Date: $(date)" >> "$OUTPUT_FILE"
echo "Base URL: ${BASE_URL}" >> "$OUTPUT_FILE"
echo "Environment: ${ENVIRONMENT_LABEL}" >> "$OUTPUT_FILE"
echo "Samples: ${BENCHMARK_SAMPLES}" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Endpoint | Avg (s) | P95 (s) | Status |" >> "$OUTPUT_FILE"
echo "|---|---|---|---|" >> "$OUTPUT_FILE"

measure_endpoint() {
    local name="$1"
    local url="$2"
    local samples="$3"
    local times_file
    local sorted_file
    local avg
    local lines
    local p95_idx
    local p95
    local sample

    times_file="$(mktemp)"
    sorted_file="$(mktemp)"

    for ((sample = 1; sample <= samples; sample += 1)); do
        curl -w "%{time_total}\n" -o /dev/null -sS "$url" >> "$times_file"
    done

    avg="$(awk '{ sum += $1 } END { if (NR > 0) print sum / NR }' "$times_file")"
    sort -n "$times_file" > "$sorted_file"
    lines="$(wc -l < "$sorted_file")"
    p95_idx="$(awk -v lines="$lines" 'BEGIN { idx=int(lines * 0.95); if (idx < 1) idx=1; print idx }')"
    p95="$(sed -n "${p95_idx}p" "$sorted_file")"

    echo "| $name | $avg | $p95 | OK |" >> "$OUTPUT_FILE"
    echo "  Measured $name: Avg=${avg}s, P95=${p95}s"

    rm -f "$times_file" "$sorted_file"
}

measure_endpoint "Home /" "${BASE_URL}/" "$BENCHMARK_SAMPLES"
measure_endpoint "Health Check" "${BASE_URL}/api.php?resource=health" "$BENCHMARK_SAMPLES"
measure_endpoint "Availability" "${BASE_URL}/api.php?resource=availability" "$BENCHMARK_SAMPLES"
measure_endpoint "Service Reviews" "${BASE_URL}/api.php?resource=reviews" "$BENCHMARK_SAMPLES"
measure_endpoint "Figo Chat (GET)" "${BASE_URL}/figo-chat.php" "$BENCHMARK_SAMPLES"

echo "Benchmark complete. Results saved to $OUTPUT_FILE"
cat "$OUTPUT_FILE"
