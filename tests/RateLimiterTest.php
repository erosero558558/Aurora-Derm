<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

$tempDataDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-ratelimiter-' . uniqid('', true);
putenv('PIELARMONIA_DATA_DIR=' . $tempDataDir);
putenv('PIELARMONIA_RATE_LIMIT_PER_USER_ENABLED=true');
putenv('PIELARMONIA_RATE_LIMIT_USER_MAX_REQUESTS=1');
putenv('PIELARMONIA_RATE_LIMIT_USER_WINDOW_SECONDS=60');

if (!is_dir($tempDataDir) && !@mkdir($tempDataDir, 0777, true) && !is_dir($tempDataDir)) {
    fwrite(STDERR, "No se pudo crear directorio temporal de pruebas.\n");
    exit(1);
}

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/audit.php';
require_once __DIR__ . '/../lib/ratelimit.php';

$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

run_test('sliding window blocks and then allows after window expires', function (): void {
    $action = 'sliding-window-test-' . bin2hex(random_bytes(4));
    assert_true(check_rate_limit($action, 2, 1));
    assert_true(check_rate_limit($action, 2, 1));
    assert_false(check_rate_limit($action, 2, 1));

    sleep(2);
    assert_true(check_rate_limit($action, 2, 1));
});

run_test('per-user limit isolates users on same IP', function (): void {
    $action = 'per-user-test-' . bin2hex(random_bytes(4));

    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer token-user-a';
    assert_true(check_rate_limit($action, 10, 60));
    assert_false(check_rate_limit($action, 10, 60));

    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer token-user-b';
    assert_true(check_rate_limit($action, 10, 60));
});

run_test('ratelimit blocked event is written to audit log', function (): void {
    $action = 'audit-event-test-' . bin2hex(random_bytes(4));
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer token-audit';

    assert_true(check_rate_limit($action, 1, 60));
    assert_false(check_rate_limit($action, 1, 60));

    $auditFile = audit_log_file_path();
    assert_true(is_file($auditFile), 'Expected audit log file');
    $lines = @file($auditFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    assert_true(is_array($lines) && count($lines) > 0, 'Expected at least one audit log line');

    $foundBlockedEvent = false;
    foreach ($lines as $line) {
        $entry = json_decode((string) $line, true);
        if (!is_array($entry)) {
            continue;
        }
        if (($entry['event'] ?? '') === 'ratelimit.blocked') {
            $foundBlockedEvent = true;
            break;
        }
    }

    assert_true($foundBlockedEvent, 'Expected ratelimit.blocked in audit log');
});

function delete_tree_rate_limiter(string $path): void
{
    if (!is_dir($path)) {
        return;
    }

    $entries = scandir($path);
    if (!is_array($entries)) {
        return;
    }

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $target = $path . DIRECTORY_SEPARATOR . $entry;
        if (is_dir($target)) {
            delete_tree_rate_limiter($target);
            @rmdir($target);
            continue;
        }
        @unlink($target);
    }
}

unset($_SERVER['HTTP_AUTHORIZATION']);
delete_tree_rate_limiter($tempDataDir);
@rmdir($tempDataDir);

print_test_summary();
