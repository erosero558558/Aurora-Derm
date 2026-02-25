<?php

declare(strict_types=1);

// Include the refactored library
require_once __DIR__ . '/../lib/figo_queue.php';

// Setup environment
$tempDir = sys_get_temp_dir() . '/figo_test_' . bin2hex(random_bytes(4));
if (!mkdir($tempDir, 0777, true) && !is_dir($tempDir)) {
    die("Failed to create temp dir: $tempDir");
}

putenv("PIELARMONIA_DATA_DIR=$tempDir");
putenv("FIGO_PROVIDER_MODE=openclaw_queue");
putenv("OPENCLAW_GATEWAY_ENDPOINT=https://example.com/api");
putenv("OPENCLAW_GATEWAY_API_KEY=test_key");
putenv("OPENCLAW_QUEUE_TTL_SEC=60");

// Helper to clean up
function cleanup($dir) {
    if (!is_dir($dir)) return;
    $files = array_diff(scandir($dir), array('.', '..'));
    foreach ($files as $file) {
        $path = "$dir/$file";
        (is_dir($path)) ? cleanup($path) : unlink($path);
    }
    rmdir($dir);
}

// Assertions
function assert_eq($expected, $actual, $msg) {
    if ($expected !== $actual) {
        echo "[FAIL] $msg: Expected " . json_encode($expected) . ", got " . json_encode($actual) . "\n";
        exit(1);
    }
    echo "[PASS] $msg\n";
}

function assert_true($actual, $msg) {
    if ($actual !== true) {
        echo "[FAIL] $msg: Expected true, got " . json_encode($actual) . "\n";
        exit(1);
    }
    echo "[PASS] $msg\n";
}

function assert_array($actual, $msg) {
    if (!is_array($actual)) {
        echo "[FAIL] $msg: Expected array, got " . gettype($actual) . "\n";
        exit(1);
    }
    echo "[PASS] $msg\n";
}

try {
    echo "Running Figo Queue Tests...\n";

    // 1. Config Test
    assert_eq('openclaw_queue', figo_queue_provider_mode(), 'Provider mode is correct');
    assert_true(figo_queue_enabled(), 'Queue is enabled');
    assert_eq('https://example.com/api', figo_queue_gateway_endpoint(), 'Gateway endpoint is correct');

    // 2. Enqueue Test
    $payload = [
        'messages' => [
            ['role' => 'user', 'content' => 'Hello World']
        ],
        'model' => 'gpt-3.5-turbo',
        'sessionId' => 'sess_test_1'
    ];

    $result = figo_queue_enqueue($payload);
    assert_true($result['ok'], 'Enqueue result OK');
    assert_eq('queued', $result['status'], 'Job status is queued');

    $jobId = $result['jobId'] ?? '';
    assert_true(figo_queue_job_id_is_valid($jobId), 'Job ID is valid');

    // 3. Status Test
    $status = figo_queue_status_payload_for_job($jobId);
    assert_true($status['ok'], 'Status fetch OK');
    assert_eq('queued', $status['status'], 'Status payload says queued');
    assert_eq($jobId, $status['jobId'], 'Job ID matches');

    // 4. Deduplication Test
    $dedupeResult = figo_queue_enqueue($payload);
    assert_true($dedupeResult['ok'], 'Dedupe enqueue OK');
    assert_eq('deduplicated', $dedupeResult['status'], 'Status is deduplicated');
    assert_eq($jobId, $dedupeResult['jobId'], 'Returns same Job ID');

    // 5. Process Job Test (Mock Gateway Failure)
    // This will attempt to call example.com and likely fail or timeout.
    // We expect it to handle it gracefully and return a result array.
    $processResult = figo_queue_process_job($jobId, 1);
    assert_array($processResult, 'Process result is array');

    // Check final status
    $finalStatus = figo_queue_status_payload_for_job($jobId);
    echo "[INFO] Job status after process: " . $finalStatus['status'] . "\n";
    // Depending on network/DNS, it could be failed or retry.
    assert_true(in_array($finalStatus['status'], ['queued', 'processing', 'failed', 'retry']), 'Status is valid after processing attempt');

    echo "All tests passed successfully!\n";

} catch (Throwable $e) {
    echo "\n[ERROR] Exception: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
} finally {
    // Cleanup
    putenv("PIELARMONIA_DATA_DIR");
    putenv("FIGO_PROVIDER_MODE");
    putenv("OPENCLAW_GATEWAY_ENDPOINT");
    putenv("OPENCLAW_GATEWAY_API_KEY");
    putenv("OPENCLAW_QUEUE_TTL_SEC");
    cleanup($tempDir);
}
