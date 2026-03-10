<?php

declare(strict_types=1);

/**
 * Cross-platform PHP test runner.
 *
 * It discovers lightweight script-based tests under tests/ and executes them
 * directly with the current PHP binary.
 */

$testDir = __DIR__;
$includeIntegration = filter_var((string) getenv('PIELARMONIA_TEST_INCLUDE_INTEGRATION'), FILTER_VALIDATE_BOOLEAN);
$hasPdoSqlite = extension_loaded('pdo_sqlite');

function output_indicates_failure(string $output): bool
{
    if ($output === '') {
        return false;
    }

    $patterns = [
        '/^\s*\[FAIL\]/m',
        '/^\s*FAIL:\s/m',
        '/^\s*FAILED:\s/m',
        '/^\s*❌\s*FAIL:\s/mu'
    ];

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $output) === 1) {
            return true;
        }
    }

    return false;
}

function run_php_test(string $file): array
{
    $stdoutFile = tempnam(sys_get_temp_dir(), 'php-test-out-');
    $stderrFile = tempnam(sys_get_temp_dir(), 'php-test-err-');
    if ($stdoutFile === false || $stderrFile === false) {
        throw new RuntimeException('Failed to allocate temp files for PHP test execution.');
    }

    $command = [
        PHP_BINARY,
        '-d',
        'assert.active=1',
        '-d',
        'assert.exception=1',
        $file
    ];

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['file', $stdoutFile, 'w'],
        2 => ['file', $stderrFile, 'w']
    ];

    $process = proc_open($command, $descriptors, $pipes, $GLOBALS['testDir']);
    if (!is_resource($process)) {
        @unlink($stdoutFile);
        @unlink($stderrFile);
        throw new RuntimeException("Failed to start PHP test process: {$file}");
    }

    if (isset($pipes[0]) && is_resource($pipes[0])) {
        fclose($pipes[0]);
    }

    $exitCode = proc_close($process);
    $stdout = (string) @file_get_contents($stdoutFile);
    $stderr = (string) @file_get_contents($stderrFile);
    @unlink($stdoutFile);
    @unlink($stderrFile);

    return [
        'exit_code' => $exitCode,
        'stdout' => $stdout,
        'stderr' => $stderr,
        'output_failed' => output_indicates_failure($stdout . $stderr)
    ];
}

$patterns = [
    'test*.php',
    '*_test.php',
    '*Test.php',
    'verify*.php'
];

$excludedFiles = [
    'test_filesystem.php',
    'test_framework.php',
    'test_server.php',
    'router.php',
    'penetration_test.php',
    'security_scan.php'
];

$integrationOnlyFiles = [
    'BookingServiceIntegrationTest.php',
    'CriticalFlowsE2ETest.php',
    'verify_backups_p0.php',
    'verify_disaster_recovery_cli.php',
    'verify_restore_procedure.php'
];

$sqliteRequiredFiles = [
    'test_storage_backup.php',
    'verify_disaster_recovery_cli.php',
    'verify_restore_procedure.php'
];

$discovered = [];
foreach ($patterns as $pattern) {
    $matches = glob($testDir . DIRECTORY_SEPARATOR . $pattern);
    if (!is_array($matches)) {
        continue;
    }
    foreach ($matches as $match) {
        $real = realpath($match);
        if ($real === false || !is_file($real)) {
            continue;
        }
        $name = basename($real);
        if (in_array($name, $excludedFiles, true)) {
            continue;
        }
        if (!$includeIntegration && in_array($name, $integrationOnlyFiles, true)) {
            continue;
        }
        if (!$hasPdoSqlite && in_array($name, $sqliteRequiredFiles, true)) {
            continue;
        }
        $discovered[$real] = true;
    }
}

$testFiles = array_keys($discovered);
natcasesort($testFiles);
$testFiles = array_values($testFiles);

echo "Running PHP tests...\n";

if (count($testFiles) === 0) {
    echo "No runnable PHP tests found.\n";
    exit(1);
}

$failed = 0;
$passed = 0;

foreach ($testFiles as $file) {
    $relative = str_replace($testDir . DIRECTORY_SEPARATOR, 'tests' . DIRECTORY_SEPARATOR, $file);
    echo "Testing {$relative}...\n";

    $result = run_php_test($file);
    if ($result['stdout'] !== '') {
        echo $result['stdout'];
    }
    if ($result['stderr'] !== '') {
        fwrite(STDERR, $result['stderr']);
    }

    if ($result['exit_code'] === 0 && !$result['output_failed']) {
        $passed++;
    } else {
        $failed++;
        echo "FAILED: {$relative}";
        if ($result['exit_code'] === 0 && $result['output_failed']) {
            echo " (failure marker detected in output)";
        }
        echo "\n";
    }
}

echo "\n";
echo "Tests passed: {$passed}\n";
echo "Tests failed: {$failed}\n";

if ($failed > 0) {
    exit(1);
}

exit(0);
