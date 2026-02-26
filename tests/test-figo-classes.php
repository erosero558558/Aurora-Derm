<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/Figo/Service.php';

// Setup environment
$tempDir = sys_get_temp_dir() . '/figo_test_new_' . bin2hex(random_bytes(4));
if (!mkdir($tempDir, 0777, true) && !is_dir($tempDir)) {
    die("Failed to create temp dir: $tempDir");
}

putenv("PIELARMONIA_DATA_DIR=$tempDir");
putenv("FIGO_PROVIDER_MODE=openclaw_queue");
putenv("OPENCLAW_GATEWAY_ENDPOINT=https://example.com/api");
putenv("OPENCLAW_GATEWAY_API_KEY=test_key");
putenv("OPENCLAW_QUEUE_TTL_SEC=60");

function cleanup($dir) {
    if (!is_dir($dir)) return;
    $files = array_diff(scandir($dir), array('.', '..'));
    foreach ($files as $file) {
        $path = "$dir/$file";
        (is_dir($path)) ? cleanup($path) : unlink($path);
    }
    rmdir($dir);
}

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

try {
    echo "Running Figo New Classes Tests...\n";

    // Test Config Class
    assert_eq('openclaw_queue', FigoConfig::getProviderMode(), 'Provider mode is correct');
    assert_true(FigoConfig::isQueueEnabled(), 'Queue is enabled');

    // Test Enqueue via Service
    $payload = [
        'messages' => [
            ['role' => 'user', 'content' => 'Hello World']
        ],
        'model' => 'gpt-3.5-turbo',
        'sessionId' => 'sess_test_1'
    ];

    $result = FigoService::enqueue($payload);
    assert_true($result['ok'], 'Enqueue result OK');
    assert_eq('queued', $result['status'], 'Job status is queued');

    $jobId = $result['jobId'] ?? '';
    assert_true(preg_match('/^[a-f0-9]{24,64}$/', $jobId) === 1, 'Job ID is valid');

    // Test Status via Service
    $status = FigoService::statusPayloadForJob($jobId);
    assert_true($status['ok'], 'Status fetch OK');
    assert_eq('queued', $status['status'], 'Status payload says queued');
    assert_eq($jobId, $status['jobId'], 'Job ID matches');

    echo "All new class tests passed successfully!\n";

} catch (Throwable $e) {
    echo "\n[ERROR] Exception: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
} finally {
    putenv("PIELARMONIA_DATA_DIR");
    putenv("FIGO_PROVIDER_MODE");
    putenv("OPENCLAW_GATEWAY_ENDPOINT");
    putenv("OPENCLAW_GATEWAY_API_KEY");
    putenv("OPENCLAW_QUEUE_TTL_SEC");
    cleanup($tempDir);
}
