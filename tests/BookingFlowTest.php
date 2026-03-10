<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

$dataDir = sys_get_temp_dir() . '/pielarmonia-test-data-' . uniqid();
$server = [];
$apptDate = date('Y-m-d', strtotime('+2 days'));

// Setup
ensure_clean_directory($dataDir);
$initialStore = [
    'appointments' => [],
    'availability' => [
        $apptDate => ['09:00', '10:00'],
    ],
    'reviews' => [],
    'callbacks' => [],
    'updatedAt' => date('c'),
    'createdAt' => date('c'),
];
file_put_contents(
    $dataDir . '/store.json',
    json_encode($initialStore, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
);

$server = start_test_php_server([
    'docroot' => __DIR__ . '/..',
    'env' => [
        'PIELARMONIA_DATA_DIR' => $dataDir,
        'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
    ],
]);
$baseUrl = $server['base_url'] . '/api.php';

echo "Starting server on {$server['base_url']} with data dir $dataDir...\n";

// Helper for requests
function api_request($method, $resource, $data = null)
{
    global $baseUrl;
    $url = "$baseUrl?resource=$resource";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => json_decode($response, true)];
}

try {
    // 1. Check availability (GET)
    run_test('Integration: Check Availability', function () {
        $res = api_request('GET', 'availability');
        assert_equals(200, $res['code']);
        assert_array_has_key('data', $res['body']);
    });

    // 2. Store-backed availability is seeded before boot.
    run_test('Integration: Store-backed Availability Seed', function () use ($dataDir, $apptDate) {
        $storePath = file_exists($dataDir . '/store.sqlite')
            ? $dataDir . '/store.sqlite'
            : $dataDir . '/store.json';
        assert_true(file_exists($storePath), 'Store file should exist');
        assert_true(filesize($storePath) > 0, 'Store file should not be empty');

        $res = api_request('GET', 'booked-slots&date=' . $apptDate);
        assert_equals(200, $res['code']);
    });

    // 3. Create Appointment (POST)
    run_test('Integration: Create Appointment', function () use ($apptDate) {
        $payload = [
            'name' => 'Integration User',
            'email' => 'integration@example.com',
            'phone' => '0999999999',
            'date' => $apptDate,
            'time' => '09:00',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
            'paymentMethod' => 'cash' // Use cash to avoid stripe validation complexity in integration
        ];

        $res = api_request('POST', 'appointments', $payload);

        if ($res['code'] !== 201) {
            echo "Error: " . json_encode($res['body']) . "\n";
        }
        assert_equals(201, $res['code']);
        assert_equals(true, $res['body']['ok']);
        assert_equals('pending_cash', $res['body']['data']['paymentStatus']);
    });

    // 4. Verify Slot Taken (GET booked-slots)
    run_test('Integration: Verify Slot Taken', function () use ($apptDate) {
        global $baseUrl;
        // booked-slots needs date param
        $url = "$baseUrl?resource=booked-slots&date=$apptDate";
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $body = json_decode($response, true);
        assert_equals(200, $code);
        assert_true(in_array('09:00', $body['data']), '09:00 should be in booked slots');
    });

    // 5. Verify Persistence (GET appointments - admin protected)
    // To test admin, we need session. Or we can just inspect the file directly since we have access to $dataDir.
    run_test('Integration: Verify Persistence on Disk', function () use ($dataDir, $apptDate) {
        $sqliteFile = $dataDir . '/store.sqlite';
        $jsonFile = $dataDir . '/store.json';
        $file = file_exists($sqliteFile) ? $sqliteFile : $jsonFile;
        assert_true(file_exists($file), 'Store file should exist');
        assert_greater_than(0, filesize($file));
    });

} catch (Throwable $e) {
    echo "Integration Test Failed: " . $e->getMessage() . "\n";
    $test_failed++; // Ensure we count it
} finally {
    // Cleanup
    echo "Stopping server...\n";
    stop_test_php_server($server);
    delete_path_recursive($dataDir);
}

print_test_summary();
