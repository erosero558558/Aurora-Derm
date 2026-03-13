<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/business.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/PatientCaseService.php';
require_once __DIR__ . '/storage/StorageConfig.php';
require_once __DIR__ . '/storage/StorePaths.php';
require_once __DIR__ . '/storage/StoreCrypto.php';
require_once __DIR__ . '/storage/StorePersistence.php';

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

if (!function_exists('storage_sqlite_available')) {
    function storage_sqlite_available(): bool
    {
        return StorageConfig::sqliteAvailable();
    }
}

if (!function_exists('storage_log_once')) {
    function storage_log_once(string $key, string $message): void
    {
        StorageConfig::logOnce($key, $message);
    }
}

if (!function_exists('storage_default_store_payload')) {
    function storage_default_store_payload(): array
    {
        return StorageConfig::defaultStorePayload();
    }
}

if (!function_exists('normalize_store_records_with_numeric_id')) {
    function normalize_store_records_with_numeric_id(array $records, string $namespace): array
    {
        return StorageConfig::normalizeStoreRecordsWithNumericId($records, $namespace);
    }
}

if (!function_exists('normalize_store_payload')) {
    function normalize_store_payload($rawStore): array
    {
        return StorageConfig::normalizeStorePayload($rawStore);
    }
}

if (!function_exists('data_home_dir_candidate')) {
    function data_home_dir_candidate(): string
    {
        return StorePaths::dataHomeDirCandidate();
    }
}

if (!function_exists('data_dir_candidates')) {
    function data_dir_candidates(): array
    {
        return StorePaths::dataDirCandidates();
    }
}

if (!function_exists('resolve_data_dir')) {
    function resolve_data_dir(): array
    {
        return StorePaths::resolveDataDir();
    }
}

if (!function_exists('data_dir_path')) {
    function data_dir_path(): string
    {
        return StorePaths::dataDirPath();
    }
}

if (!function_exists('data_dir_source')) {
    function data_dir_source(): string
    {
        return StorePaths::dataDirSource();
    }
}

if (!function_exists('data_file_path')) {
    function data_file_path(): string
    {
        return StorePaths::dataFilePath();
    }
}

if (!function_exists('data_json_path')) {
    function data_json_path(): string
    {
        return StorePaths::dataJsonPath();
    }
}

if (!function_exists('data_dir_writable')) {
    function data_dir_writable(): bool
    {
        return StorePaths::dataDirWritable();
    }
}

if (!function_exists('backup_dir_path')) {
    function backup_dir_path(): string
    {
        return StorePaths::backupDirPath();
    }
}

if (!function_exists('clinical_media_dir_path')) {
    function clinical_media_dir_path(): string
    {
        return StorePaths::clinicalMediaDirPath();
    }
}

if (!function_exists('audit_log_file_path')) {
    function audit_log_file_path(): string
    {
        return StorePaths::auditLogFilePath();
    }
}

if (!function_exists('store_file_is_encrypted')) {
    function store_file_is_encrypted(): bool
    {
        return StorageConfig::storeFileIsEncrypted();
    }
}

if (!function_exists('storage_encryption_configured')) {
    function storage_encryption_configured(): bool
    {
        return StorageConfig::encryptionConfigured();
    }
}

if (!function_exists('storage_encryption_required')) {
    function storage_encryption_required(): bool
    {
        return StorageConfig::encryptionRequired();
    }
}

if (!function_exists('storage_encryption_status')) {
    function storage_encryption_status(): string
    {
        return StorageConfig::encryptionStatus();
    }
}

if (!function_exists('storage_encryption_compliant')) {
    function storage_encryption_compliant(): bool
    {
        return StorageConfig::encryptionCompliant();
    }
}

if (!function_exists('storage_backend_mode')) {
    function storage_backend_mode(): string
    {
        return StorageConfig::backendMode();
    }
}

if (!function_exists('storage_json_fallback_enabled')) {
    function storage_json_fallback_enabled(): bool
    {
        return StorageConfig::jsonFallbackEnabled();
    }
}

if (!function_exists('ensure_json_store_file')) {
    function ensure_json_store_file(): bool
    {
        return StorePersistence::ensureJsonStoreFile();
    }
}

if (!function_exists('read_store_json_fallback')) {
    function read_store_json_fallback(): array
    {
        return StorePersistence::readStoreJsonFallback();
    }
}

if (!function_exists('write_store_json_fallback')) {
    function write_store_json_fallback(array $store): bool
    {
        return StorePersistence::writeStoreJsonFallback($store);
    }
}

if (!function_exists('data_encrypt_payload')) {
    function data_encrypt_payload(string $plain): string
    {
        return StoreCrypto::encryptPayload($plain);
    }
}

if (!function_exists('data_encryption_key')) {
    function data_encryption_key(): string
    {
        return StoreCrypto::encryptionKey();
    }
}

if (!function_exists('data_decrypt_payload')) {
    function data_decrypt_payload(string $raw): string
    {
        return StoreCrypto::decryptPayload($raw);
    }
}

if (!function_exists('ensure_data_htaccess')) {
    function ensure_data_htaccess(string $dir): void
    {
        StorePaths::ensureDataHtaccess($dir);
    }
}

if (!function_exists('ensure_backup_dir')) {
    function ensure_backup_dir(): bool
    {
        return StorePaths::ensureBackupDir();
    }
}

if (!function_exists('ensure_clinical_media_dir')) {
    function ensure_clinical_media_dir(): bool
    {
        return StorePaths::ensureClinicalMediaDir();
    }
}

if (!function_exists('prune_backup_files')) {
    function prune_backup_files(): void
    {
        StorePersistence::pruneBackupFiles();
    }
}

if (!function_exists('create_store_backup_locked')) {
    function create_store_backup_locked($sourcePath): void
    {
        StorePersistence::createStoreBackupLocked($sourcePath);
    }
}

if (!function_exists('migrate_json_to_sqlite')) {
    function migrate_json_to_sqlite(string $jsonPath, string $sqlitePath): bool
    {
        return StorePersistence::migrateJsonToSqlite($jsonPath, $sqlitePath);
    }
}

if (!function_exists('ensure_data_file')) {
    function ensure_data_file(): bool
    {
        return StorePersistence::ensureDataFile();
    }
}

if (!function_exists('read_store')) {
    function read_store(): array
    {
        return StorePersistence::readStore();
    }
}

if (!function_exists('acquire_store_lock')) {
    function acquire_store_lock($fp, int $timeoutMs = STORE_LOCK_TIMEOUT_MS): bool
    {
        return StorePersistence::acquireStoreLock($fp, $timeoutMs);
    }
}

if (!function_exists('with_store_lock')) {
    function with_store_lock(callable $callback): array
    {
        return StorePersistence::withStoreLock($callback);
    }
}

if (!function_exists('write_store')) {
    function write_store(array $store, bool $emitHttpErrors = true): bool
    {
        return StorePersistence::writeStore($store, $emitHttpErrors);
    }
}
