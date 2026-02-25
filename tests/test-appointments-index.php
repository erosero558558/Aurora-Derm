<?php

// tests/test-indexing.php

// Mock the environment
$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-' . uniqid();
putenv("PIELARMONIA_DATA_DIR=$tempDir");

// We need to disable output buffering or error handling that might interfere
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../api-lib.php';

echo "Testing appointment indexing...\n";

function cleanup_test_dir(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }

    // Windows can keep SQLite file handles a bit longer; retry cleanup briefly.
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $allDeleted = true;
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($files as $fileinfo) {
            $path = $fileinfo->getRealPath();
            if ($path === false) {
                continue;
            }
            clearstatcache(true, $path);
            $ok = $fileinfo->isDir() ? @rmdir($path) : @unlink($path);
            if (!$ok && file_exists($path)) {
                $allDeleted = false;
            }
        }

        clearstatcache(true, $dir);
        if (@rmdir($dir) || !is_dir($dir)) {
            return;
        }

        if ($allDeleted) {
            usleep(100000);
        } else {
            usleep(200000);
        }
    }

    throw new RuntimeException("Failed to cleanup test directory: {$dir}");
}

// Ensure clean state
if (file_exists($tempDir)) {
    cleanup_test_dir($tempDir);
}
mkdir($tempDir);

// 1. Write store with appointments (without index initially, to simulate old data or verify rebuild)
$initialAppointments = [
    ['id' => 1, 'date' => '2023-10-27', 'time' => '10:00', 'doctor' => 'rosero', 'status' => 'confirmed'],
    ['id' => 2, 'date' => '2023-10-27', 'time' => '11:00', 'doctor' => 'narvaez', 'status' => 'confirmed'],
    ['id' => 3, 'date' => '2023-10-28', 'time' => '09:00', 'doctor' => 'rosero', 'status' => 'cancelled'],
];

$store = read_store();
$store['appointments'] = $initialAppointments;
write_store($store);

// 2. Read store and verify index exists
$storeRead = read_store();
if (!isset($storeRead['idx_appointments_date'])) {
    echo "[FAIL] Index 'idx_appointments_date' missing after write_store.\n";
    exit(1);
}

$index = $storeRead['idx_appointments_date'];
if (!is_array($index)) {
    echo "[FAIL] Index is not an array.\n";
    exit(1);
}

// Verify content of index
if (!isset($index['2023-10-27']) || count($index['2023-10-27']) !== 2) {
    echo "[FAIL] Index for 2023-10-27 incorrect. Expected 2, got " . (isset($index['2023-10-27']) ? count($index['2023-10-27']) : 0) . "\n";
    print_r($index);
    exit(1);
}

echo "[PASS] Index created correctly.\n";

// 3. Test appointment_slot_taken with index
// checking 10:00 on 2023-10-27
// Note: This assumes appointment_slot_taken has been updated to accept the index as the last argument
$taken = appointment_slot_taken($storeRead['appointments'], '2023-10-27', '10:00', null, '', $index);
if (!$taken) {
    echo "[FAIL] appointment_slot_taken (with index) failed to find existing slot.\n";
    exit(1);
}

// checking 12:00 on 2023-10-27 (free)
$taken = appointment_slot_taken($storeRead['appointments'], '2023-10-27', '12:00', null, '', $index);
if ($taken) {
    echo "[FAIL] appointment_slot_taken (with index) found non-existent slot.\n";
    exit(1);
}

echo "[PASS] appointment_slot_taken uses index correctly.\n";

// 4. Update store and verify index update
$storeRead['appointments'][] = ['id' => 4, 'date' => '2023-10-29', 'time' => '15:00', 'doctor' => 'rosero', 'status' => 'confirmed'];
write_store($storeRead);

$storeUpdated = read_store();
$newIndex = $storeUpdated['idx_appointments_date'];

if (!isset($newIndex['2023-10-29'])) {
    echo "[FAIL] Index not updated for new date.\n";
    exit(1);
}

echo "[PASS] Index updated correctly.\n";

// Cleanup
if (function_exists('close_db_connection')) {
    close_db_connection();
}
cleanup_test_dir($tempDir);

echo "All tests passed.\n";
