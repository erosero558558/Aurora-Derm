<?php

declare(strict_types=1);

if (!defined('TESTING_ENV')) {
    define('TESTING_ENV', true);
}

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../controllers/SystemController.php';

function assert_true($condition, string $message): void
{
    if ($condition !== true) {
        echo "FAIL: {$message}\n";
        exit(1);
    }
    echo "PASS: {$message}\n";
}

function run_features_request(): array
{
    FeatureFlags::reset();
    $GLOBALS['__TEST_RESPONSE'] = null;

    try {
        SystemController::features(['store' => []]);
        echo "FAIL: expected TestingExitException from json_response\n";
        exit(1);
    } catch (TestingExitException $e) {
        $response = $GLOBALS['__TEST_RESPONSE'] ?? null;
        if (!is_array($response)) {
            echo "FAIL: missing __TEST_RESPONSE payload\n";
            exit(1);
        }
        return $response;
    }
}

putenv('FEATURE_ADMIN_SONY_UI');
putenv('FEATURE_NEW_BOOKING_UI');
putenv('FEATURE_STRIPE_ELEMENTS');
putenv('FEATURE_DARK_MODE');
putenv('FEATURE_CHATGPT_INTEGRATION');
putenv('FEATURE_REFERRAL_PROGRAM');

$response = run_features_request();
$payload = $response['payload'] ?? [];
$data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

assert_true(($payload['ok'] ?? false) === true, 'features endpoint returns ok=true');
assert_true(array_key_exists('admin_sony_ui', $data), 'features endpoint includes admin_sony_ui key');
assert_true(is_bool($data['admin_sony_ui'] ?? null), 'admin_sony_ui is boolean');
assert_true(array_key_exists('new_booking_ui', $data), 'features endpoint includes new_booking_ui key');

putenv('FEATURE_ADMIN_SONY_UI=1');
$responseEnabled = run_features_request();
$enabledData = $responseEnabled['payload']['data'] ?? [];
assert_true(($enabledData['admin_sony_ui'] ?? false) === true, 'FEATURE_ADMIN_SONY_UI=1 is reflected in features endpoint');

putenv('FEATURE_ADMIN_SONY_UI');
FeatureFlags::reset();

echo "All tests passed.\n";
