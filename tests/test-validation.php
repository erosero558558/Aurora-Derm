<?php

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/validation.php';

function report_assertion(bool $condition, string $passMessage, string $failMessage, int &$failures): void
{
    if ($condition) {
        echo "[PASS] {$passMessage}\n";
        return;
    }

    echo "[FAIL] {$failMessage}\n";
    $failures++;
}

$failures = 0;
$futureDate = date('Y-m-d', strtotime('+2 days'));

// Mock availability
$availability = [
    $futureDate => ['09:00', '10:00']
];

// Test case 1: Valid appointment
$payload = [
    'name' => 'John Doe',
    'email' => 'john@example.com',
    'phone' => '0991234567',
    'privacyConsent' => true,
    'date' => $futureDate,
    'time' => '09:00'
];

$result = validate_appointment_payload($payload, $availability);
report_assertion(
    $result['ok'],
    'Valid appointment',
    'Valid appointment: ' . ($result['error'] ?? 'unknown error'),
    $failures
);

// Test case 2: Missing name
$payload2 = $payload;
$payload2['name'] = '';
$result = validate_appointment_payload($payload2, $availability);
report_assertion(
    !$result['ok'] && strpos((string) ($result['error'] ?? ''), 'Nombre') !== false,
    'Missing name detected',
    'Missing name check failed',
    $failures
);

// Test case 3: Invalid email
$payload3 = $payload;
$payload3['email'] = 'invalid-email';
$result = validate_appointment_payload($payload3, $availability);
report_assertion(
    !$result['ok'] && strpos((string) ($result['error'] ?? ''), 'email') !== false,
    'Invalid email detected',
    'Invalid email check failed',
    $failures
);

// Test case 4: Slot unavailable
$payload4 = $payload;
$payload4['time'] = '11:00'; // Not in availability
$result = validate_appointment_payload($payload4, $availability);
report_assertion(
    !$result['ok'] && strpos((string) ($result['error'] ?? ''), 'horario no está disponible') !== false,
    'Unavailable slot detected',
    'Unavailable slot check failed',
    $failures
);

// Test case 5: Past date
$payload5 = $payload;
$payload5['date'] = '2020-01-01';
$result = validate_appointment_payload($payload5, $availability);
report_assertion(
    !$result['ok'] && strpos((string) ($result['error'] ?? ''), 'fecha pasada') !== false,
    'Past date detected',
    'Past date check failed: ' . ($result['ok'] ? 'OK' : (string) ($result['error'] ?? 'unknown error')),
    $failures
);

exit($failures > 0 ? 1 : 0);
