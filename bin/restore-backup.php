<?php

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    die('This script must be run from the command line.');
}

// Load dependencies manually to avoid api-lib.php side effects (json_response)
require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../lib/business.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/backup.php';

function usage()
{
    echo "Usage: php bin/restore-backup.php <backup_file_path> [--force]\n";
    echo "  <backup_file_path>: Path to the backup file (JSON).\n";
    echo "  --force: Skip confirmation prompt (use with caution).\n";
    exit(1);
}

// Parse arguments
$args = array_slice($argv, 1);
if (empty($args)) {
    usage();
}

// Check if running as root
if (function_exists('posix_getuid') && posix_getuid() === 0) {
    echo "WARNING: You are running this script as root.\n";
    echo "The restored file may have incorrect ownership (root:root).\n";
    echo "Please ensure the web server (e.g., www-data) can write to the data file after restoration.\n";
    echo "Consider running as: sudo -u www-data php bin/restore-backup.php ...\n\n";
    if (!in_array('--force', $args)) {
        echo "Press Enter to continue or Ctrl+C to abort...";
        fgets(fopen("php://stdin", "r"));
    }
}

$backupPath = $args[0];
$force = in_array('--force', $args);

if (!file_exists($backupPath)) {
    echo "Error: Backup file not found: $backupPath\n";
    exit(1);
}

if (!is_readable($backupPath)) {
    echo "Error: Backup file not readable: $backupPath\n";
    exit(1);
}

echo "Validating backup file...\n";
$content = file_get_contents($backupPath);
if ($content === false) {
    echo "Error: Could not read backup file.\n";
    exit(1);
}

// Decode and validate payload
$decoded = backup_decode_store_payload($content);
if (!($decoded['ok'] ?? false)) {
    echo "Error: Invalid backup file format or content.\n";
    echo "Reason: " . ($decoded['reason'] ?? 'unknown') . "\n";
    if (!empty($decoded['issues'])) {
        echo "Issues: " . implode(', ', $decoded['issues']) . "\n";
    }
    exit(1);
}

$data = $decoded['data'];
$counts = $decoded['counts'] ?? [];

echo "Backup valid. Contains:\n";
foreach ($counts as $key => $count) {
    echo "  - " . ucfirst($key) . ": $count\n";
}

if (!$force) {
    echo "\nWARNING: This will OVERWRITE the current database.\n";
    echo "Are you sure you want to proceed? (yes/no): ";
    $handle = fopen("php://stdin", "r");
    $line = fgets($handle);
    if (trim(strtolower($line)) !== 'yes') {
        echo "Restore cancelled.\n";
        exit(0);
    }
}

echo "Creating safety backup of current store...\n";
$currentStorePath = data_file_path();
if (function_exists('close_db_connection')) {
    close_db_connection();
}
if (file_exists($currentStorePath)) {
    $safetyBackupPath = $currentStorePath . '.pre-restore-' . date('Ymd-His') . '.bak';
    if (!copy($currentStorePath, $safetyBackupPath)) {
        echo "Error: Could not create safety backup. Aborting.\n";
        exit(1);
    }
    echo "Safety backup created at: $safetyBackupPath\n";

    // Unlink the current store to ensure fresh creation if it was corrupted
    if (!unlink($currentStorePath)) {
        echo "Warning: Could not delete current store file before restore.\n";
    }
} else {
    echo "No existing store found. Skipping safety backup.\n";
}

echo "Restoring data...\n";
// write_store handles encryption and locking
// It also creates a backup in backups/ directory before overwriting.

// Ensure clean state if DB is corrupted
$targetPath = data_file_path();
if (file_exists($targetPath)) {
    @unlink($targetPath);
}

write_store($data);

// Verify restore
$restored = read_store();
$restoredCounts = [
    'appointments' => count($restored['appointments'] ?? []),
    'callbacks' => count($restored['callbacks'] ?? []),
    'reviews' => count($restored['reviews'] ?? []),
    'availability' => count($restored['availability'] ?? [])
];

$mismatch = false;
foreach ($counts as $key => $count) {
    if (($restoredCounts[$key] ?? 0) !== $count) {
        $mismatch = true;
        echo "Warning: Restored count for $key mismatch. Expected: $count, Got: " . ($restoredCounts[$key] ?? 0) . "\n";
    }
}

if ($mismatch) {
    echo "Restore completed with WARNINGS. Please verify data.\n";
    exit(1);
} else {
    echo "Restore completed successfully.\n";
    exit(0);
}
