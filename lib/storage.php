<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/business.php';
require_once __DIR__ . '/db.php';

/**
 * Storage and file system operations using SQLite.
 */

if (!defined('DATA_DIR')) {
    define('DATA_DIR', __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'data');
}
if (!defined('DATA_FILE')) {
    define('DATA_FILE', DATA_DIR . DIRECTORY_SEPARATOR . 'store.sqlite');
}
if (!defined('BACKUP_DIR')) {
    define('BACKUP_DIR', DATA_DIR . DIRECTORY_SEPARATOR . 'backups');
}
if (!defined('MAX_STORE_BACKUPS')) {
    define('MAX_STORE_BACKUPS', 30);
}
if (!defined('STORE_LOCK_TIMEOUT_MS')) {
    define('STORE_LOCK_TIMEOUT_MS', 1800);
}
if (!defined('STORE_LOCK_RETRY_DELAY_US')) {
    define('STORE_LOCK_RETRY_DELAY_US', 25000);
}

function storage_sqlite_available(): bool
{
    static $available = null;
    if (is_bool($available)) {
        return $available;
    }

    if (!class_exists('PDO')) {
        $available = false;
        return $available;
    }

    try {
        $drivers = PDO::getAvailableDrivers();
        $available = is_array($drivers) && in_array('sqlite', $drivers, true);
    } catch (Throwable $e) {
        $available = false;
    }

    return $available;
}

function storage_default_store_payload(): array
{
    return [
        'appointments' => [],
        'callbacks' => [],
        'reviews' => [],
        'availability' => [],
        'updatedAt' => local_date('c')
    ];
}

function normalize_store_payload($rawStore): array
{
    $store = is_array($rawStore) ? $rawStore : [];

    $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
    $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
    $reviews = isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
    $availability = isset($store['availability']) && is_array($store['availability']) ? $store['availability'] : [];
    $updatedAt = isset($store['updatedAt']) && is_string($store['updatedAt']) && trim($store['updatedAt']) !== ''
        ? trim($store['updatedAt'])
        : local_date('c');

    return [
        'appointments' => array_values($appointments),
        'callbacks' => array_values($callbacks),
        'reviews' => array_values($reviews),
        'availability' => $availability,
        'updatedAt' => $updatedAt,
        'idx_appointments_date' => build_appointment_index($appointments)
    ];
}

function data_home_dir_candidate(): string
{
    $home = '';
    $homeCandidates = [
        getenv('PIELARMONIA_HOME_DIR'),
        getenv('HOME'),
        getenv('USERPROFILE')
    ];

    foreach ($homeCandidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            $home = trim($candidate);
            break;
        }
    }

    if ($home === '') {
        $homeDrive = getenv('HOMEDRIVE');
        $homePath = getenv('HOMEPATH');
        if (is_string($homeDrive) && is_string($homePath) && trim($homeDrive . $homePath) !== '') {
            $home = trim($homeDrive . $homePath);
        }
    }

    if ($home === '') {
        return '';
    }

    $home = rtrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $home), DIRECTORY_SEPARATOR);
    if ($home === '') {
        return '';
    }

    return $home . DIRECTORY_SEPARATOR . 'pielarmonia-data';
}

function data_dir_candidates(): array
{
    $candidates = [];

    $envDir = getenv('PIELARMONIA_DATA_DIR');
    if (is_string($envDir) && trim($envDir) !== '') {
        $candidates[] = [
            'source' => 'env',
            'path' => trim($envDir)
        ];
    }

    $candidates[] = [
        'source' => 'project',
        'path' => DATA_DIR
    ];
    $candidates[] = [
        'source' => 'parent',
        'path' => dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data'
    ];

    $homeCandidate = data_home_dir_candidate();
    if ($homeCandidate !== '') {
        $candidates[] = [
            'source' => 'home',
            'path' => $homeCandidate
        ];
    }

    $candidates[] = [
        'source' => 'tmp',
        'path' => sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-data'
    ];

    $normalized = [];
    $seen = [];
    foreach ($candidates as $candidate) {
        $path = rtrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, (string) ($candidate['path'] ?? '')), DIRECTORY_SEPARATOR);
        $source = (string) ($candidate['source'] ?? 'unknown');
        if ($path === '') {
            continue;
        }
        $key = strtolower($path);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $normalized[] = [
            'source' => $source,
            'path' => $path
        ];
    }

    return $normalized;
}

function resolve_data_dir(): array
{
    static $resolved = null;
    if (is_array($resolved) && isset($resolved['path'], $resolved['source'])) {
        return $resolved;
    }

    foreach (data_dir_candidates() as $candidate) {
        $path = (string) ($candidate['path'] ?? '');
        $source = (string) ($candidate['source'] ?? 'unknown');
        if ($path === '') {
            continue;
        }

        if (!@is_dir($path)) {
            if (!@mkdir($path, 0775, true) && !@is_dir($path)) {
                continue;
            }
        }

        if (!@is_writable($path)) {
            @chmod($path, 0775);
        }

        if (@is_writable($path)) {
            $resolved = [
                'path' => $path,
                'source' => $source
            ];
            return $resolved;
        }
    }

    $resolved = [
        'path' => DATA_DIR,
        'source' => 'fallback'
    ];
    return $resolved;
}

function data_dir_path(): string
{
    $resolved = resolve_data_dir();
    return (string) ($resolved['path'] ?? DATA_DIR);
}

function data_dir_source(): string
{
    $resolved = resolve_data_dir();
    return (string) ($resolved['source'] ?? 'unknown');
}

function data_file_path(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'store.sqlite';
}

function data_json_path(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'store.json';
}

function data_dir_writable(): bool
{
    $dir = data_dir_path();

    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }
    }

    return @is_writable($dir);
}

function backup_dir_path(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'backups';
}

function audit_log_file_path(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'audit.log';
}

function store_file_is_encrypted(): bool
{
    return false;
}

function storage_json_fallback_enabled(): bool
{
    $raw = getenv('PIELARMONIA_STORAGE_JSON_FALLBACK');
    if (!is_string($raw) || trim($raw) === '') {
        return true;
    }
    return parse_bool($raw);
}

function ensure_json_store_file(): bool
{
    $jsonPath = data_json_path();
    if (is_file($jsonPath)) {
        return is_readable($jsonPath);
    }

    $payload = storage_default_store_payload();
    $raw = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (!is_string($raw) || trim($raw) === '') {
        return false;
    }

    $encoded = data_encrypt_payload($raw);
    return @file_put_contents($jsonPath, $encoded, LOCK_EX) !== false;
}

function read_store_json_fallback(): array
{
    if (!ensure_json_store_file()) {
        return normalize_store_payload(storage_default_store_payload());
    }

    $raw = @file_get_contents(data_json_path());
    if (!is_string($raw) || trim($raw) === '') {
        return normalize_store_payload(storage_default_store_payload());
    }

    $decoded = data_decrypt_payload($raw);
    if ($decoded === '') {
        $decoded = $raw;
    }

    $data = json_decode($decoded, true);
    if (!is_array($data)) {
        return normalize_store_payload(storage_default_store_payload());
    }

    return normalize_store_payload($data);
}

function write_store_json_fallback(array $store): bool
{
    if (!storage_json_fallback_enabled()) {
        return false;
    }

    $store = normalize_store_payload($store);
    if (!ensure_json_store_file()) {
        return false;
    }

    $jsonPath = data_json_path();
    if (is_file($jsonPath)) {
        create_store_backup_locked($jsonPath);
    }

    $raw = json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (!is_string($raw) || trim($raw) === '') {
        return false;
    }

    $encoded = data_encrypt_payload($raw);
    return @file_put_contents($jsonPath, $encoded, LOCK_EX) !== false;
}

// Encryption functions retained for legacy support if needed, but not used for SQLite directly
function data_encrypt_payload(string $plain): string
{
    return $plain;
}

function data_encryption_key(): string
{
    static $resolved = null;
    if (is_string($resolved)) {
        return $resolved;
    }

    $candidates = [
        getenv('PIELARMONIA_DATA_ENCRYPTION_KEY'),
        getenv('PIELARMONIA_DATA_KEY')
    ];

    $raw = '';
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            $raw = trim($candidate);
            break;
        }
    }

    if ($raw === '') {
        $resolved = '';
        return $resolved;
    }

    if (strpos($raw, 'base64:') === 0) {
        $decoded = base64_decode(substr($raw, 7), true);
        if (is_string($decoded) && $decoded !== '') {
            $raw = $decoded;
        }
    }

    if (strlen($raw) !== 32) {
        $raw = hash('sha256', $raw, true);
    }

    $resolved = substr($raw, 0, 32);
    return $resolved;
}

function data_decrypt_payload(string $raw): string
{
    if (substr($raw, 0, 6) !== 'ENCv1:') {
        return $raw;
    }

    $key = data_encryption_key();
    if ($key === '') {
        return '';
    }

    if (!function_exists('openssl_decrypt')) {
        return '';
    }

    $encoded = substr($raw, 6);
    $packed = base64_decode($encoded, true);
    if (!is_string($packed) || strlen($packed) <= 28) {
        return '';
    }

    $iv = substr($packed, 0, 12);
    $tag = substr($packed, 12, 16);
    $cipher = substr($packed, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if (!is_string($plain)) {
        return '';
    }

    return $plain;
}

function ensure_data_htaccess(string $dir): void
{
    $htaccess = $dir . DIRECTORY_SEPARATOR . '.htaccess';
    if (file_exists($htaccess)) {
        return;
    }
    $rules = "# Bloquear acceso publico a datos sensibles\n";
    $rules .= "Order deny,allow\nDeny from all\n";
    $rules .= "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n";
    @file_put_contents($htaccess, $rules, LOCK_EX);
}

function ensure_backup_dir(): bool
{
    $backupDir = backup_dir_path();
    if (is_dir($backupDir)) {
        return true;
    }
    return @mkdir($backupDir, 0775, true) || is_dir($backupDir);
}

function prune_backup_files(): void
{
    $patterns = [
        backup_dir_path() . DIRECTORY_SEPARATOR . 'store-*.sqlite',
        backup_dir_path() . DIRECTORY_SEPARATOR . 'store-*.json'
    ];

    $files = [];
    foreach ($patterns as $pattern) {
        $matches = glob($pattern);
        if (!is_array($matches) || $matches === []) {
            continue;
        }
        $files = array_merge($files, $matches);
    }

    if (!is_array($files) || count($files) <= MAX_STORE_BACKUPS) {
        return;
    }

    sort($files, SORT_STRING);
    $toDelete = array_slice($files, 0, count($files) - MAX_STORE_BACKUPS);
    foreach ($toDelete as $file) {
        @unlink($file);
    }
}

function create_store_backup_locked($sourcePath): void
{
    if (!ensure_backup_dir()) {
        error_log('Piel en Armonía: no se pudo crear el directorio de backups');
        return;
    }

    if (!file_exists($sourcePath)) {
        return;
    }

    try {
        $suffix = bin2hex(random_bytes(3));
    } catch (Throwable $e) {
        $suffix = substr(md5((string) microtime(true)), 0, 6);
    }

    $extension = strtolower((string) pathinfo((string) $sourcePath, PATHINFO_EXTENSION));
    if ($extension === '') {
        $extension = 'sqlite';
    }
    if ($extension !== 'sqlite' && $extension !== 'json') {
        $extension = 'sqlite';
    }

    $filename = backup_dir_path() . DIRECTORY_SEPARATOR . 'store-' . local_date('Ymd-His') . '-' . $suffix . '.' . $extension;
    if (!copy($sourcePath, $filename)) {
        error_log('Piel en Armonía: no se pudo guardar backup de store.sqlite');
        return;
    }

    prune_backup_files();
}

function migrate_json_to_sqlite(string $jsonPath, string $sqlitePath): bool
{
    if (!file_exists($jsonPath)) {
        return false;
    }

    $raw = @file_get_contents($jsonPath);
    if ($raw === false || $raw === '') {
        return false;
    }

    $decoded = data_decrypt_payload((string)$raw);
    if ($decoded === '') {
        $decoded = (string)$raw; // Try as plain JSON
    }

    if (substr($decoded, 0, 6) === 'ENCv1:') {
        // Failed decryption
        error_log('Migration failed: could not decrypt store.json');
        return false;
    }

    $data = json_decode($decoded, true);
    if (!is_array($data)) {
        error_log('Migration failed: invalid JSON');
        return false;
    }

    $pdo = get_db_connection($sqlitePath);
    if (!$pdo) {
        return false;
    }

    ensure_db_schema();

    $pdo->beginTransaction();
    try {
        // Appointments
        if (isset($data['appointments']) && is_array($data['appointments'])) {
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO appointments (id, date, time, doctor, service, name, email, phone, status, paymentMethod, paymentStatus, paymentIntentId, rescheduleToken, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($data['appointments'] as $appt) {
                if (!isset($appt['id'])) {
                    continue;
                }
                $stmt->execute([
                    (int) $appt['id'],
                    $appt['date'] ?? '',
                    $appt['time'] ?? '',
                    $appt['doctor'] ?? '',
                    $appt['service'] ?? '',
                    $appt['name'] ?? '',
                    $appt['email'] ?? '',
                    $appt['phone'] ?? '',
                    $appt['status'] ?? 'confirmed',
                    $appt['paymentMethod'] ?? '',
                    $appt['paymentStatus'] ?? '',
                    $appt['paymentIntentId'] ?? '',
                    $appt['rescheduleToken'] ?? '',
                    json_encode($appt, JSON_UNESCAPED_UNICODE)
                ]);
            }
        }

        // Reviews
        if (isset($data['reviews']) && is_array($data['reviews'])) {
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO reviews (id, name, rating, text, date, verified, json_data) VALUES (?, ?, ?, ?, ?, ?, ?)");
            foreach ($data['reviews'] as $review) {
                if (!isset($review['id'])) {
                    continue;
                }
                $stmt->execute([
                    (int) $review['id'],
                    $review['name'] ?? '',
                    $review['rating'] ?? 0,
                    $review['text'] ?? '',
                    $review['date'] ?? '',
                    isset($review['verified']) && $review['verified'] ? 1 : 0,
                    json_encode($review, JSON_UNESCAPED_UNICODE)
                ]);
            }
        }

        // Callbacks
        if (isset($data['callbacks']) && is_array($data['callbacks'])) {
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO callbacks (id, telefono, preferencia, fecha, status, json_data) VALUES (?, ?, ?, ?, ?, ?)");
            foreach ($data['callbacks'] as $cb) {
                if (!isset($cb['id'])) {
                    continue;
                }
                $stmt->execute([
                    (int) $cb['id'],
                    $cb['telefono'] ?? '',
                    $cb['preferencia'] ?? '',
                    $cb['fecha'] ?? '',
                    $cb['status'] ?? 'pendiente',
                    json_encode($cb, JSON_UNESCAPED_UNICODE)
                ]);
            }
        }

        // Availability
        if (isset($data['availability']) && is_array($data['availability'])) {
            $stmt = $pdo->prepare("INSERT OR REPLACE INTO availability (date, time, doctor) VALUES (?, ?, ?)");
            foreach ($data['availability'] as $date => $times) {
                if (!is_array($times)) {
                    continue;
                }
                foreach ($times as $time) {
                    $stmt->execute([$date, $time, 'global']);
                }
            }
        }

        // Metadata
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)");
        if (isset($data['updatedAt'])) {
            $stmt->execute(['updatedAt', $data['updatedAt']]);
        }
        if (isset($data['createdAt'])) {
            $stmt->execute(['createdAt', $data['createdAt']]);
        }

        $pdo->commit();

        // Rename json file to avoid re-migration
        @rename($jsonPath, $jsonPath . '.migrated');

        return true;
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('Migration failed: ' . $e->getMessage());
        return false;
    }
}

function ensure_data_file(): bool
{
    $dataDir = data_dir_path();
    $dbPath = data_file_path();
    $jsonPath = data_json_path();

    if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true) && !is_dir($dataDir)) {
        error_log('Piel en Armonía: no se pudo crear el directorio de datos: ' . $dataDir);
        return false;
    }

    ensure_data_htaccess($dataDir);

    // Ensure schema exists
    $pdo = get_db_connection($dbPath);
    if ($pdo) {
        ensure_db_schema();
    } else {
        error_log('Piel en Armonia: no se pudo conectar a SQLite: ' . $dbPath);
        if (storage_json_fallback_enabled() && ensure_json_store_file()) {
            return true;
        }
        return false;
    }

    // Check for migration
    if (file_exists($jsonPath) && !file_exists($dbPath . '.migrated_flag')) {
        // We check if DB is empty or just force migration if json exists?
        // Better: if json exists and we haven't migrated yet.
        // migrate_json_to_sqlite renames json file, so checking file_exists($jsonPath) is enough
        migrate_json_to_sqlite($jsonPath, $dbPath);
    }

    return true;
}

function read_store(): array
{
    if (!ensure_data_file()) {
        return normalize_store_payload(storage_default_store_payload());
    }

    $pdo = get_db_connection(data_file_path());
    if (!$pdo) {
        return storage_json_fallback_enabled()
            ? read_store_json_fallback()
            : normalize_store_payload(storage_default_store_payload());
    }

    try {
        $store = [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'updatedAt' => local_date('c'),
            'idx_appointments_date' => []
        ];

        // Fetch Appointments
        $stmt = $pdo->query("SELECT json_data FROM appointments");
        while ($row = $stmt->fetch()) {
            $data = json_decode($row['json_data'], true);
            if (is_array($data)) {
                $store['appointments'][] = $data;
            }
        }

        // Fetch Reviews
        $stmt = $pdo->query("SELECT json_data FROM reviews");
        while ($row = $stmt->fetch()) {
            $data = json_decode($row['json_data'], true);
            if (is_array($data)) {
                $store['reviews'][] = $data;
            }
        }

        // Fetch Callbacks
        $stmt = $pdo->query("SELECT json_data FROM callbacks");
        while ($row = $stmt->fetch()) {
            $data = json_decode($row['json_data'], true);
            if (is_array($data)) {
                $store['callbacks'][] = $data;
            }
        }

        // Fetch Availability
        $stmt = $pdo->query("SELECT date, time FROM availability");
        while ($row = $stmt->fetch()) {
            $date = $row['date'];
            $time = $row['time'];
            if (!isset($store['availability'][$date])) {
                $store['availability'][$date] = [];
            }
            $store['availability'][$date][] = $time;
        }

        // Fetch Metadata
        $stmt = $pdo->query("SELECT value FROM kv_store WHERE key = 'updatedAt'");
        $row = $stmt->fetch();
        if ($row) {
            $store['updatedAt'] = $row['value'];
        }

        // Build index
        $store['idx_appointments_date'] = build_appointment_index($store['appointments']);

        return $store;
    } catch (PDOException $e) {
        error_log('Read Store Error: ' . $e->getMessage());
        return storage_json_fallback_enabled()
            ? read_store_json_fallback()
            : normalize_store_payload(storage_default_store_payload());
    }
}

function acquire_store_lock($fp, int $timeoutMs = STORE_LOCK_TIMEOUT_MS): bool
{
    // Deprecated with SQLite, kept for compatibility if needed by external callers
    return true;
}

function write_store(array $store, bool $emitHttpErrors = true): bool
{
    if (!ensure_data_file()) {
        if (write_store_json_fallback($store)) {
            return true;
        }
        if ($emitHttpErrors && function_exists('json_response')) {
            json_response(['ok' => false, 'error' => 'Storage error'], 500);
        }
        return false;
    }

    $store = normalize_store_payload($store);
    $dbPath = data_file_path();
    $pdo = get_db_connection($dbPath);
    if (!$pdo) {
        if (write_store_json_fallback($store)) {
            return true;
        }
        if ($emitHttpErrors && function_exists('json_response')) {
            json_response(['ok' => false, 'error' => 'DB Connection error'], 500);
        }
        return false;
    }

    // Backup
    create_store_backup_locked($dbPath);

    try {
        $pdo->beginTransaction();

        $updatedAt = local_date('c');

        // Sync Appointments
        // Strategy: Get all IDs.
        $existingIds = $pdo->query("SELECT id FROM appointments")->fetchAll(PDO::FETCH_COLUMN);
        $existingIds = array_flip($existingIds); // id => index

        $incomingIds = [];
        $stmtUpsert = $pdo->prepare("INSERT OR REPLACE INTO appointments (id, date, time, doctor, service, name, email, phone, status, paymentMethod, paymentStatus, paymentIntentId, rescheduleToken, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        foreach ($store['appointments'] as $appt) {
            if (!isset($appt['id'])) {
                continue;
            }
            $id = (int) $appt['id'];
            $incomingIds[$id] = true;

            $stmtUpsert->execute([
                $id,
                $appt['date'] ?? '',
                $appt['time'] ?? '',
                $appt['doctor'] ?? '',
                $appt['service'] ?? '',
                $appt['name'] ?? '',
                $appt['email'] ?? '',
                $appt['phone'] ?? '',
                $appt['status'] ?? 'confirmed',
                $appt['paymentMethod'] ?? '',
                $appt['paymentStatus'] ?? '',
                $appt['paymentIntentId'] ?? '',
                $appt['rescheduleToken'] ?? '',
                json_encode($appt, JSON_UNESCAPED_UNICODE)
            ]);
        }

        // Delete missing
        $toDelete = array_diff_key($existingIds, $incomingIds);
        if (!empty($toDelete)) {
            $idsToDelete = implode(',', array_keys($toDelete));
            $pdo->exec("DELETE FROM appointments WHERE id IN ($idsToDelete)");
        }

        // Sync Reviews
        $existingIds = $pdo->query("SELECT id FROM reviews")->fetchAll(PDO::FETCH_COLUMN);
        $existingIds = array_flip($existingIds);
        $incomingIds = [];
        $stmtUpsert = $pdo->prepare("INSERT OR REPLACE INTO reviews (id, name, rating, text, date, verified, json_data) VALUES (?, ?, ?, ?, ?, ?, ?)");

        foreach ($store['reviews'] as $review) {
            if (!isset($review['id'])) {
                continue;
            }
            $id = (int) $review['id'];
            $incomingIds[$id] = true;
            $stmtUpsert->execute([
                $id,
                $review['name'] ?? '',
                $review['rating'] ?? 0,
                $review['text'] ?? '',
                $review['date'] ?? '',
                isset($review['verified']) && $review['verified'] ? 1 : 0,
                json_encode($review, JSON_UNESCAPED_UNICODE)
            ]);
        }
        $toDelete = array_diff_key($existingIds, $incomingIds);
        if (!empty($toDelete)) {
            $idsToDelete = implode(',', array_keys($toDelete));
            $pdo->exec("DELETE FROM reviews WHERE id IN ($idsToDelete)");
        }

        // Sync Callbacks
        $existingIds = $pdo->query("SELECT id FROM callbacks")->fetchAll(PDO::FETCH_COLUMN);
        $existingIds = array_flip($existingIds);
        $incomingIds = [];
        $stmtUpsert = $pdo->prepare("INSERT OR REPLACE INTO callbacks (id, telefono, preferencia, fecha, status, json_data) VALUES (?, ?, ?, ?, ?, ?)");

        foreach ($store['callbacks'] as $cb) {
            if (!isset($cb['id'])) {
                continue;
            }
            $id = (int) $cb['id'];
            $incomingIds[$id] = true;
            $stmtUpsert->execute([
                $id,
                $cb['telefono'] ?? '',
                $cb['preferencia'] ?? '',
                $cb['fecha'] ?? '',
                $cb['status'] ?? 'pendiente',
                json_encode($cb, JSON_UNESCAPED_UNICODE)
            ]);
        }
        $toDelete = array_diff_key($existingIds, $incomingIds);
        if (!empty($toDelete)) {
            $idsToDelete = implode(',', array_keys($toDelete));
            $pdo->exec("DELETE FROM callbacks WHERE id IN ($idsToDelete)");
        }

        // Sync Availability (Full Replace)
        $pdo->exec("DELETE FROM availability");
        $stmtInsert = $pdo->prepare("INSERT INTO availability (date, time, doctor) VALUES (?, ?, ?)");
        if (isset($store['availability']) && is_array($store['availability'])) {
            foreach ($store['availability'] as $date => $times) {
                if (!is_array($times)) {
                    continue;
                }
                foreach ($times as $time) {
                    $stmtInsert->execute([$date, $time, 'global']);
                }
            }
        }

        // Metadata
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)");
        $stmt->execute(['updatedAt', $updatedAt]);

        $pdo->commit();
        return true;
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('Write Store Error: ' . $e->getMessage());
        if (write_store_json_fallback($store)) {
            return true;
        }
        if ($emitHttpErrors && function_exists('json_response')) {
            json_response(['ok' => false, 'error' => 'Write error'], 500);
        }
        return false;
    }
}

