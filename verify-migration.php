<?php

require_once __DIR__ . '/lib/storage.php';

// Setup temp env
$testDir = sys_get_temp_dir() . '/migration-test-' . uniqid();
mkdir($testDir);
putenv("PIELARMONIA_DATA_DIR=$testDir");

// Create mock store.json
$store = [
    'appointments' => [
        [
            'id' => 12345, // Int
            'date' => '2026-03-01',
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'status' => 'confirmed'
        ],
        [
            'id' => '67890', // String (should be handled?)
            'date' => '2026-03-02',
            'time' => '11:00',
            'doctor' => 'narvaez',
            'service' => 'laser',
            'status' => 'confirmed'
        ]
    ],
    'reviews' => [],
    'callbacks' => [],
    'availability' => [],
    'updatedAt' => date('c')
];

$jsonPath = $testDir . '/store.json';
file_put_contents($jsonPath, json_encode($store));

echo "Running migration test in $testDir...\n";

// Trigger migration (ensure_data_file calls it if sqlite missing but json present)
// Or call directly
$sqlitePath = $testDir . '/store.sqlite';
$res = migrate_json_to_sqlite($jsonPath, $sqlitePath);

if ($res) {
    echo "Migration Success!\n";
    // Check DB
    $pdo = new PDO('sqlite:' . $sqlitePath);
    $count = $pdo->query("SELECT count(*) FROM appointments")->fetchColumn();
    echo "Appointments count: $count\n";
    if ($count == 2) {
        echo "VERIFICATION PASSED\n";
    } else {
        echo "VERIFICATION FAILED: Count mismatch\n";
    }
} else {
    echo "Migration FAILED.\n";
}

// Cleanup
@unlink($jsonPath);
@unlink($jsonPath . '.migrated');
@unlink($sqlitePath);
@rmdir($testDir);
