<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Setup environment for data_dir_path()
$testDataDir = sys_get_temp_dir() . '/pielarmonia-ratelimit-test-' . uniqid();
if (!is_dir($testDataDir)) {
    mkdir($testDataDir, 0777, true);
}
putenv("PIELARMONIA_DATA_DIR=$testDataDir");

// Include libraries
// lib/storage.php includes common, business, db.
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/ratelimit.php';

echo "Testing Rate Limiter (File-based)...\n";
echo "Using Data Dir: $testDataDir\n";

try {
    // Test 1: Within Limit (Dentro del limite)
    run_test('Rate Limit: Within Limit', function () {
        $action = 'test_within_limit';
        $max = 5;
        $window = 60;

        // Reset first to be sure
        reset_rate_limit($action);

        for ($i = 0; $i < $max; $i++) {
            $allowed = check_rate_limit($action, $max, $window);
            assert_true($allowed, "Request " . ($i + 1) . " should be allowed");
        }
    });

    // Test 2: Blocking (Bloqueo)
    run_test('Rate Limit: Blocking', function () {
        $action = 'test_blocking';
        $max = 3;
        $window = 60;

        reset_rate_limit($action);

        // Consume limit
        for ($i = 0; $i < $max; $i++) {
            check_rate_limit($action, $max, $window);
        }

        // Next one should block
        $allowed = check_rate_limit($action, $max, $window);
        assert_false($allowed, "Request should be blocked after exceeding limit");
    });

    // Test 3: Reset (Reset / Window Expiry)
    run_test('Rate Limit: Reset', function () {
        $action = 'test_reset';
        $max = 2;
        $window = 1; // 1 second window

        reset_rate_limit($action);

        // Consume limit
        check_rate_limit($action, $max, $window);
        check_rate_limit($action, $max, $window);

        // Verify blocked immediately
        assert_false(check_rate_limit($action, $max, $window), "Should be blocked immediately");

        // Wait for window to expire (> 1 second)
        // We sleep 2 seconds to be safe
        sleep(2);

        // Should be allowed now
        assert_true(check_rate_limit($action, $max, $window), "Should be allowed after window expiration");
    });

} catch (Throwable $e) {
    echo "Global Test Error: " . $e->getMessage() . "\n";
    $test_failed++;
} finally {
    // Cleanup
    if (is_dir($testDataDir)) {
        // Simple recursive delete
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($testDataDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($files as $fileinfo) {
            $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
            $todo($fileinfo->getRealPath());
        }
        rmdir($testDataDir);
        echo "Cleaned up temporary directory.\n";
    }
}

print_test_summary();
