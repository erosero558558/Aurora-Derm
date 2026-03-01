<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/features.php';

function assert_true($condition, $message = '')
{
    if ($condition !== true) {
        echo "FAIL: $message\n";
        exit(1);
    }
    echo "PASS: $message\n";
}

function assert_false($condition, $message = '')
{
    if ($condition !== false) {
        echo "FAIL: $message\n";
        exit(1);
    }
    echo "PASS: $message\n";
}

// Reset environment
putenv('FEATURE_NEW_BOOKING_UI');
putenv('FEATURE_ADMIN_SONY_UI');
$dataFile = __DIR__ . '/../data/features.json';
if (file_exists($dataFile)) {
    unlink($dataFile);
}

echo "Testing FeatureFlags class...\n";

// 1. Test Defaults
// The class must be defined in lib/features.php
// We expect FeatureFlags class to exist.
if (!class_exists('FeatureFlags')) {
    echo "FAIL: FeatureFlags class not found.\n";
    exit(1);
}

// Ensure clean state
FeatureFlags::reset();

assert_false(FeatureFlags::isEnabled('new_booking_ui'), 'Default new_booking_ui should be false');
assert_false(FeatureFlags::isEnabled('admin_sony_ui'), 'Default admin_sony_ui should be false');

// 2. Test Enable
FeatureFlags::enable('new_booking_ui');
assert_true(FeatureFlags::isEnabled('new_booking_ui'), 'new_booking_ui should be enabled after enable()');

// 3. Test Disable
FeatureFlags::disable('new_booking_ui');
assert_false(FeatureFlags::isEnabled('new_booking_ui'), 'new_booking_ui should be disabled after disable()');

// 4. Test Percentage
FeatureFlags::setPercentage('new_booking_ui', 100);
assert_true(FeatureFlags::isEnabled('new_booking_ui', 'user1'), '100% rollout should be enabled for user1');
assert_true(FeatureFlags::isEnabled('new_booking_ui', 'user2'), '100% rollout should be enabled for user2');

FeatureFlags::setPercentage('new_booking_ui', 0);
assert_false(FeatureFlags::isEnabled('new_booking_ui', 'user1'), '0% rollout should be disabled for user1');

// 5. Test Env Var Override
// Set to 0% (disabled) in storage from previous step.
putenv('FEATURE_NEW_BOOKING_UI=true');
assert_true(FeatureFlags::isEnabled('new_booking_ui'), 'Env var=true should override 0% rollout');

putenv('FEATURE_NEW_BOOKING_UI=false');
FeatureFlags::enable('new_booking_ui'); // Enable in storage
assert_false(FeatureFlags::isEnabled('new_booking_ui'), 'Env var=false should override enabled storage');

// Cleanup
putenv('FEATURE_NEW_BOOKING_UI');
putenv('FEATURE_ADMIN_SONY_UI');
if (file_exists($dataFile)) {
    unlink($dataFile);
}

echo "All tests passed.\n";
