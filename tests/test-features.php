<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/features.php';

function test_defaults()
{
    $flags = get_feature_flags();
    assert($flags['new_booking_ui'] === false, 'Default new_booking_ui should be false');
    assert($flags['admin_sony_ui'] === false, 'Default admin_sony_ui should be false');
    assert($flags['stripe_elements'] === false, 'Default stripe_elements should be false');
    assert($flags['dark_mode'] === false, 'Default dark_mode should be false');
    assert($flags['chatgpt_integration'] === false, 'Default chatgpt_integration should be false');
    echo "Defaults test passed.\n";
}

function test_env_override()
{
    putenv('FEATURE_NEW_BOOKING_UI=true');
    putenv('FEATURE_ADMIN_SONY_UI=1');
    putenv('FEATURE_DARK_MODE=1');
    putenv('FEATURE_STRIPE_ELEMENTS=on');
    putenv('FEATURE_CHATGPT_INTEGRATION=yes');

    $flags = get_feature_flags();
    assert($flags['new_booking_ui'] === true, 'FEATURE_NEW_BOOKING_UI override failed');
    assert($flags['admin_sony_ui'] === true, 'FEATURE_ADMIN_SONY_UI override failed');
    assert($flags['dark_mode'] === true, 'FEATURE_DARK_MODE override failed');
    assert($flags['stripe_elements'] === true, 'FEATURE_STRIPE_ELEMENTS override failed');
    assert($flags['chatgpt_integration'] === true, 'FEATURE_CHATGPT_INTEGRATION override failed');
    echo "Env override test passed.\n";

    // Clean up
    putenv('FEATURE_NEW_BOOKING_UI');
    putenv('FEATURE_ADMIN_SONY_UI');
    putenv('FEATURE_DARK_MODE');
    putenv('FEATURE_STRIPE_ELEMENTS');
    putenv('FEATURE_CHATGPT_INTEGRATION');
}

function test_feature_enabled()
{
    putenv('FEATURE_NEW_BOOKING_UI=true');
    assert(feature_enabled('new_booking_ui') === true, 'feature_enabled failed for true');
    putenv('FEATURE_NEW_BOOKING_UI=false');
    assert(feature_enabled('new_booking_ui') === false, 'feature_enabled failed for false');
    echo "feature_enabled test passed.\n";

    // Clean up
    putenv('FEATURE_NEW_BOOKING_UI');
}

test_defaults();
test_env_override();
test_feature_enabled();
