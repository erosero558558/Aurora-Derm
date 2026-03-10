<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

$dataDir = sys_get_temp_dir() . '/pielarmonia-test-critical-' . uniqid();
$cookieFile = sys_get_temp_dir() . '/cookie-' . uniqid() . '.txt';
$server = [];
$conflictDate = date('Y-m-d', strtotime('+3 days'));
$rescheduleDate = date('Y-m-d', strtotime('+4 days'));
$cancelDate = date('Y-m-d', strtotime('+5 days'));

ensure_clean_directory($dataDir);
file_put_contents(
    $dataDir . '/store.json',
    json_encode(
        [
            'appointments' => [],
            'availability' => [
                $conflictDate => ['10:00'],
                $rescheduleDate => ['10:00', '11:00'],
                $cancelDate => ['10:00'],
            ],
            'reviews' => [],
            'callbacks' => [],
            'updatedAt' => date('c'),
            'createdAt' => date('c'),
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
    )
);
$server = start_test_php_server([
    'docroot' => __DIR__ . '/..',
    'env' => [
        'PIELARMONIA_DATA_DIR' => $dataDir,
        'PIELARMONIA_ADMIN_PASSWORD' => 'secret',
        'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
    ],
    'startup_timeout_ms' => 12000,
]);
$baseUrl = $server['base_url'] . '/api.php';
$adminUrl = $server['base_url'] . '/admin-auth.php';

echo "Starting server on {$server['base_url']} with data dir $dataDir...\n";

// Helper for requests with cookies
function http_request($method, $url, $data = null, $cookies = null, $headers = [])
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $reqHeaders = ['Content-Type: application/json'];
    if (!empty($headers)) {
        $reqHeaders = array_merge($reqHeaders, $headers);
    }

    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);

    if ($cookies) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookies);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookies);
    }
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => json_decode($response, true)];
}

try {
    // 1. Conflict Handling (Waitlist)
    run_test('E2E: Conflict Handling', function () use ($baseUrl, $conflictDate) {
        $date = $conflictDate;
        $time = '10:00';

        // Create first appointment
        $payload1 = [
            'name' => 'User A',
            'email' => 'a@example.com',
            'phone' => '0990000001',
            'date' => $date,
            'time' => $time,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];
        $res1 = http_request('POST', "$baseUrl?resource=appointments", $payload1);

        if ($res1['code'] !== 201) {
            echo "Create 1 Failed: " . json_encode($res1['body']) . "\n";
        }
        assert_equals(201, $res1['code'], 'First booking failed');

        // Create second appointment (same slot)
        $payload2 = [
            'name' => 'User B',
            'email' => 'b@example.com',
            'phone' => '0990000002',
            'date' => $date,
            'time' => $time,
            'service' => 'consulta',
            'doctor' => 'rosero', // Same doctor
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];
        $res2 = http_request('POST', "$baseUrl?resource=appointments", $payload2);
        assert_equals(409, $res2['code'], 'Expected Conflict (409) for double booking');
    });

    // 2. Reschedule Flow
    run_test('E2E: Reschedule Flow', function () use ($baseUrl, $rescheduleDate) {
        $date = $rescheduleDate;
        $time1 = '10:00';
        $time2 = '11:00';

        // Create appointment
        $payload = [
            'name' => 'Reschedule User',
            'email' => 'reschedule@example.com',
            'phone' => '0990000003',
            'date' => $date,
            'time' => $time1,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];
        $res = http_request('POST', "$baseUrl?resource=appointments", $payload);
        assert_equals(201, $res['code']);

        $appt = $res['body']['data'];
        $token = $appt['rescheduleToken'] ?? null;
        assert_true(!empty($token), 'Reschedule token missing');

        // Check availability of old slot (should be taken)
        $resSlot = http_request('GET', "$baseUrl?resource=booked-slots&date=$date");
        assert_contains($time1, json_encode($resSlot['body']['data']), 'Old slot should be taken');

        // Reschedule
        $reschedulePayload = [
            'token' => $token,
            'date' => $date,
            'time' => $time2
        ];
        $resReschedule = http_request('PATCH', "$baseUrl?resource=reschedule", $reschedulePayload);

        if ($resReschedule['code'] !== 200) {
            echo "Reschedule Failed: " . json_encode($resReschedule['body']) . "\n";
        }
        assert_equals(200, $resReschedule['code'], 'Reschedule failed');

        // Verify old slot free, new slot taken
        $resSlot2 = http_request('GET', "$baseUrl?resource=booked-slots&date=$date");
        $slots = $resSlot2['body']['data'];
        assert_false(in_array($time1, $slots), 'Old slot should be free');
        assert_true(in_array($time2, $slots), 'New slot should be taken');
    });

    // 3. Admin Cancellation
    run_test('E2E: Admin Cancellation', function () use ($baseUrl, $adminUrl, $cookieFile, $cancelDate) {
        $date = $cancelDate;
        $time = '10:00';

        // Create appointment
        $payload = [
            'name' => 'Cancel User',
            'email' => 'cancel@example.com',
            'phone' => '0990000004',
            'date' => $date,
            'time' => $time,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];
        $res = http_request('POST', "$baseUrl?resource=appointments", $payload);
        assert_equals(201, $res['code']);
        $apptId = $res['body']['data']['id'];

        // Verify taken
        $resSlot = http_request('GET', "$baseUrl?resource=booked-slots&date=$date");
        assert_contains($time, json_encode($resSlot['body']['data']));

        // Login Admin
        $loginPayload = ['password' => 'secret'];
        $resLogin = http_request('POST', "$adminUrl?action=login", $loginPayload, $cookieFile);

        if ($resLogin['code'] !== 200) {
            echo "Login Failed: " . json_encode($resLogin['body']) . "\n";
        }
        assert_equals(200, $resLogin['code'], 'Admin login failed');
        assert_true($resLogin['body']['ok'], 'Admin login not ok');

        $csrfToken = $resLogin['body']['csrfToken'] ?? '';
        assert_true(!empty($csrfToken), 'CSRF token missing');

        // Cancel Appointment (Admin)
        $cancelPayload = ['id' => $apptId, 'status' => 'cancelled'];
        // Use cookieFile AND CSRF Header
        $resCancel = http_request('PATCH', "$baseUrl?resource=appointments", $cancelPayload, $cookieFile, ['X-CSRF-Token: ' . $csrfToken]);

        if ($resCancel['code'] !== 200) {
            echo "Cancel Failed: " . json_encode($resCancel['body']) . "\n";
        }
        assert_equals(200, $resCancel['code'], 'Admin cancel failed');

        // Verify free
        $resSlot2 = http_request('GET', "$baseUrl?resource=booked-slots&date=$date");
        $slots = $resSlot2['body']['data'];
        assert_false(in_array($time, $slots), 'Cancelled slot should be free');
    });

} catch (Throwable $e) {
    echo "Test Failed: " . $e->getMessage() . "\n";
    $test_failed++;
} finally {
    // Cleanup
    echo "Stopping server...\n";
    stop_test_php_server($server);

    if (file_exists($cookieFile)) {
        unlink($cookieFile);
    }

    delete_path_recursive($dataDir);
}

print_test_summary();
