<?php

// Test: rate limit hardening (IP detection + reset + non-consuming checks)

declare(strict_types=1);

$tempDir = __DIR__ . '/temp_ratelimit_data';
putenv("PIELARMONIA_DATA_DIR=$tempDir");
putenv("PIELARMONIA_TRUSTED_PROXIES=10.10.10.10");

if (is_dir($tempDir)) {
    $it = new RecursiveDirectoryIterator($tempDir, RecursiveDirectoryIterator::SKIP_DOTS);
    $files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) {
        if ($file->isDir()) {
            @rmdir($file->getRealPath());
        } else {
            @unlink($file->getRealPath());
        }
    }
    @rmdir($tempDir);
}

$_SERVER['REMOTE_ADDR'] = '10.10.10.10';
$_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.7, 198.51.100.8';

require_once __DIR__ . '/../api-lib.php';

$action = 'ratelimit-hardening-' . time();

$clientIp = rate_limit_client_ip();
if ($clientIp !== '203.0.113.7') {
    die("FAILED: expected forwarded IP 203.0.113.7, got $clientIp\n");
}

if (is_rate_limited($action, 2, 60)) {
    die("FAILED: action should not be limited before requests\n");
}

if (!check_rate_limit($action, 2, 60)) {
    die("FAILED: first request should pass\n");
}
if (!check_rate_limit($action, 2, 60)) {
    die("FAILED: second request should pass\n");
}
if (check_rate_limit($action, 2, 60)) {
    die("FAILED: third request should be blocked\n");
}

if (!is_rate_limited($action, 2, 60)) {
    die("FAILED: action should be limited after exceeding threshold\n");
}

reset_rate_limit($action);
if (is_rate_limited($action, 2, 60)) {
    die("FAILED: action should be clear after reset\n");
}

if (!check_rate_limit($action, 2, 60)) {
    die("FAILED: request should pass after reset\n");
}

// Teardown
if (is_dir($tempDir)) {
    $it = new RecursiveDirectoryIterator($tempDir, RecursiveDirectoryIterator::SKIP_DOTS);
    $files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) {
        if ($file->isDir()) {
            @rmdir($file->getRealPath());
        } else {
            @unlink($file->getRealPath());
        }
    }
    @rmdir($tempDir);
}

echo "All tests passed.\n";
