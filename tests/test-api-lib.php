<?php

// tests/test-api-lib.php

// Adjust path to api-lib.php based on location of this test file
require_once __DIR__ . '/../api-lib.php';

$passed = 0;
$failed = 0;

function run_test($name, $fn)
{
    global $passed, $failed;
    try {
        $fn();
        echo "✅ $name\n";
        $passed++;
    } catch (Exception $e) {
        echo "❌ $name: " . $e->getMessage() . "\n";
        $failed++;
    } catch (Throwable $e) {
        echo "❌ $name: " . $e->getMessage() . "\n";
        $failed++;
    }
}

function assert_equals($expected, $actual, $message = '')
{
    if ($expected !== $actual) {
        $expectedStr = var_export($expected, true);
        $actualStr = var_export($actual, true);
        throw new Exception("Expected $expectedStr but got $actualStr. $message");
    }
}

function test_strlen(string $value): int
{
    if (function_exists('mb_strlen')) {
        return (int) mb_strlen($value, 'UTF-8');
    }
    return strlen($value);
}

// ── parse_bool ────────────────────────────────────────────────────────────────
echo "Running tests for parse_bool...\n";

run_test('parse_bool(true)', function () { assert_equals(true, parse_bool(true)); });
run_test('parse_bool(false)', function () { assert_equals(false, parse_bool(false)); });
run_test('parse_bool("1")', function () { assert_equals(true, parse_bool('1')); });
run_test('parse_bool("true")', function () { assert_equals(true, parse_bool('true')); });
run_test('parse_bool("True")', function () { assert_equals(true, parse_bool('True')); });
run_test('parse_bool("TRUE")', function () { assert_equals(true, parse_bool('TRUE')); });
run_test('parse_bool("yes")', function () { assert_equals(true, parse_bool('yes')); });
run_test('parse_bool("on")', function () { assert_equals(true, parse_bool('on')); });
run_test('parse_bool("0")', function () { assert_equals(false, parse_bool('0')); });
run_test('parse_bool("false")', function () { assert_equals(false, parse_bool('false')); });
run_test('parse_bool("no")', function () { assert_equals(false, parse_bool('no')); });
run_test('parse_bool("off")', function () { assert_equals(false, parse_bool('off')); });
run_test('parse_bool("")', function () { assert_equals(false, parse_bool('')); });
run_test('parse_bool("random")', function () { assert_equals(false, parse_bool('random')); });
run_test('parse_bool(1)', function () { assert_equals(true, parse_bool(1)); });
run_test('parse_bool(0)', function () { assert_equals(false, parse_bool(0)); });
run_test('parse_bool(2)', function () { assert_equals(false, parse_bool(2)); });
run_test('parse_bool(-1)', function () { assert_equals(false, parse_bool(-1)); });
run_test('parse_bool(null)', function () { assert_equals(false, parse_bool(null)); });
run_test('parse_bool([])', function () { assert_equals(false, parse_bool([])); });
run_test('parse_bool(new stdClass())', function () { assert_equals(false, parse_bool(new stdClass())); });
run_test('parse_bool(1.0)', function () { assert_equals(false, parse_bool(1.0)); });

// ── truncate_field ────────────────────────────────────────────────────────────
echo "\nRunning tests for truncate_field...\n";

run_test('truncate_field: shorter than max', function () {
    assert_equals('hello', truncate_field('hello', 10));
});
run_test('truncate_field: equal to max', function () {
    assert_equals('hello', truncate_field('hello', 5));
});
run_test('truncate_field: longer than max', function () {
    assert_equals('hello', truncate_field('hello world', 5));
});
run_test('truncate_field: empty string', function () {
    assert_equals('', truncate_field('', 10));
});
run_test('truncate_field: multibyte shorter than max', function () {
    assert_equals('café', truncate_field('café', 10));
});
run_test('truncate_field: multibyte truncation', function () {
    assert_equals('caf', truncate_field('café', 3));
});
run_test('truncate_field: emoji counts as 1 char', function () {
    assert_equals('👋', truncate_field('👋 world', 1));
});
run_test('truncate_field: zero length returns empty', function () {
    assert_equals('', truncate_field('anything', 0));
});

// ── normalize_review ──────────────────────────────────────────────────────────
echo "\nRunning tests for normalize_review...\n";

// Test 1: Happy Path
run_test('Happy Path', function () {
    $input = [
        'id' => 123,
        'name' => 'John Doe',
        'rating' => 4,
        'text' => 'Great service!',
        'date' => '2023-10-27T10:00:00+00:00',
        'verified' => true
    ];
    $result = normalize_review($input);
    assert_equals(123, $result['id']);
    assert_equals('John Doe', $result['name']);
    assert_equals(4, $result['rating']);
    assert_equals('Great service!', $result['text']);
    assert_equals('2023-10-27T10:00:00+00:00', $result['date']);
    assert_equals(true, $result['verified']);
});

// Test 2: Rating Logic - Lower Bound
run_test('Rating < 1 should be 1', function () {
    $input = ['rating' => 0];
    $result = normalize_review($input);
    assert_equals(1, $result['rating']);
});

run_test('Rating negative should be 1', function () {
    $input = ['rating' => -5];
    $result = normalize_review($input);
    assert_equals(1, $result['rating']);
});

// Test 3: Rating Logic - Upper Bound
run_test('Rating > 5 should be 5', function () {
    $input = ['rating' => 6];
    $result = normalize_review($input);
    assert_equals(5, $result['rating']);
});

run_test('Rating way over 5 should be 5', function () {
    $input = ['rating' => 100];
    $result = normalize_review($input);
    assert_equals(5, $result['rating']);
});

// Test 4: Rating Logic - Missing
run_test('Missing rating should be 1 (default logic)', function () {
    $input = [];
    $result = normalize_review($input);
    // Logic: $rating = isset ? ... : 0; if ($rating < 1) $rating = 1;
    assert_equals(1, $result['rating']);
});

// Test 5: Truncation - Name
run_test('Name truncation > 100 chars', function () {
    $longName = str_repeat('a', 105);
    $input = ['name' => $longName];
    $result = normalize_review($input);
    assert_equals(100, test_strlen($result['name']));
    assert_equals(substr($longName, 0, 100), $result['name']);
});

// Test 6: Truncation - Text
run_test('Text truncation > 2000 chars', function () {
    $longText = str_repeat('b', 2005);
    $input = ['text' => $longText];
    $result = normalize_review($input);
    assert_equals(2000, test_strlen($result['text']));
    assert_equals(substr($longText, 0, 2000), $result['text']);
});

// Test 7: Boolean Parsing - Verified
run_test('Verified "true" string', function () {
    $input = ['verified' => 'true'];
    $result = normalize_review($input);
    assert_equals(true, $result['verified']);
});

run_test('Verified "false" string', function () {
    $input = ['verified' => 'false'];
    $result = normalize_review($input);
    assert_equals(false, $result['verified']);
});

run_test('Verified "1" string', function () {
    $input = ['verified' => '1'];
    $result = normalize_review($input);
    assert_equals(true, $result['verified']);
});

run_test('Verified integer 1', function () {
    $input = ['verified' => 1];
    $result = normalize_review($input);
    assert_equals(true, $result['verified']);
});

run_test('Verified missing defaults to true', function () {
    $input = [];
    $result = normalize_review($input);
    assert_equals(true, $result['verified']);
});

// Test 8: Defaults - Missing ID
run_test('Missing ID generates one', function () {
    $input = [];
    $result = normalize_review($input);
    if (!is_int($result['id']) || $result['id'] <= 0) {
        throw new Exception("ID should be a positive integer, got " . var_export($result['id'], true));
    }
});

// Test 9: Defaults - Missing Date
run_test('Missing Date uses current date', function () {
    $input = [];
    $result = normalize_review($input);
    if (empty($result['date'])) {
        throw new Exception("Date should not be empty");
    }
    // Check format roughly (ISO 8601)
    if (strpos($result['date'], '-') === false || strpos($result['date'], ':') === false) {
        throw new Exception("Date format suspicious: " . $result['date']);
    }
});

// Test 10: XSS Handling (Sanitization happens on input)
run_test('HTML chars are sanitized (api-lib handles storage)', function () {
    $input = ['text' => '<script>alert(1)</script>'];
    $result = normalize_review($input);
    assert_equals('&lt;script&gt;alert(1)&lt;/script&gt;', $result['text']);
});

echo "\nResults: $passed passed, $failed failed.\n";
if ($failed > 0) {
    exit(1);
}
