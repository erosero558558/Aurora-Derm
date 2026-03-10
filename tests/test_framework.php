<?php

declare(strict_types=1);

/**
 * Simple PHP Testing Framework
 */

require_once __DIR__ . '/test_filesystem.php';
require_once __DIR__ . '/test_server.php';

$test_passed = 0;
$test_failed = 0;

function run_test(string $name, callable $fn): void
{
    global $test_passed, $test_failed;
    try {
        $fn();
        echo "✅ $name\n";
        $test_passed++;
    } catch (Throwable $e) {
        echo "❌ $name: " . $e->getMessage() . "\n";
        $test_failed++;
    }
}

function assert_equals($expected, $actual, string $message = ''): void
{
    if ($expected !== $actual) {
        $expectedStr = var_export($expected, true);
        $actualStr = var_export($actual, true);
        throw new Exception("Expected $expectedStr but got $actualStr. $message");
    }
}

function assert_true($condition, string $message = ''): void
{
    if ($condition !== true) {
        throw new Exception("Expected true but got " . var_export($condition, true) . ". $message");
    }
}

function assert_false($condition, string $message = ''): void
{
    if ($condition !== false) {
        throw new Exception("Expected false but got " . var_export($condition, true) . ". $message");
    }
}

function assert_contains(string $needle, string $haystack, string $message = ''): void
{
    if (strpos($haystack, $needle) === false) {
        throw new Exception("Expected string to contain '$needle'. $message");
    }
}

function assert_array_has_key($key, array $array, string $message = ''): void
{
    if (!array_key_exists($key, $array)) {
        throw new Exception("Expected array to have key '$key'. $message");
    }
}

function assert_greater_than($expected, $actual, string $message = ''): void
{
    if ($actual <= $expected) {
        throw new Exception("Expected $actual to be greater than $expected. $message");
    }
}

function skip_test(string $message): void
{
    echo "[SKIP] {$message}\n";
    exit(0);
}

function print_test_summary(): void
{
    global $test_passed, $test_failed;
    echo "\nResults: $test_passed passed, $test_failed failed.\n";
    if ($test_failed > 0) {
        exit(1);
    }
}
