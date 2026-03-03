<?php

declare(strict_types=1);

require_once __DIR__ . '/backup/BackupConfig.php';
require_once __DIR__ . '/backup/BackupCrypto.php';
require_once __DIR__ . '/backup/BackupHealthService.php';
require_once __DIR__ . '/backup/BackupReplicationService.php';

if (!defined('BACKUP_HEALTH_DEFAULT_MAX_AGE_HOURS')) {
    define('BACKUP_HEALTH_DEFAULT_MAX_AGE_HOURS', 24);
}
if (!defined('BACKUP_OFFSITE_TIMEOUT_SECONDS')) {
    define('BACKUP_OFFSITE_TIMEOUT_SECONDS', 20);
}
if (!defined('BACKUP_OFFSITE_MIN_TIMEOUT_SECONDS')) {
    define('BACKUP_OFFSITE_MIN_TIMEOUT_SECONDS', 5);
}
if (!defined('BACKUP_OFFSITE_MAX_TIMEOUT_SECONDS')) {
    define('BACKUP_OFFSITE_MAX_TIMEOUT_SECONDS', 120);
}
if (!defined('BACKUP_LOCAL_REPLICA_DIRNAME')) {
    define('BACKUP_LOCAL_REPLICA_DIRNAME', 'offsite-local');
}
if (!defined('BACKUP_RECEIVER_RETENTION_DAYS_DEFAULT')) {
    define('BACKUP_RECEIVER_RETENTION_DAYS_DEFAULT', 30);
}
if (!defined('BACKUP_RECEIVER_RETENTION_DAYS_MAX')) {
    define('BACKUP_RECEIVER_RETENTION_DAYS_MAX', 3650);
}
if (!defined('BACKUP_RECEIVER_CLEANUP_MAX_FILES_DEFAULT')) {
    define('BACKUP_RECEIVER_CLEANUP_MAX_FILES_DEFAULT', 500);
}
if (!defined('BACKUP_RECEIVER_ENVELOPE_PREFIX')) {
    define('BACKUP_RECEIVER_ENVELOPE_PREFIX', 'BKPv1:');
}
if (!defined('BACKUP_RECEIVER_ENCRYPTION_ALGO')) {
    define('BACKUP_RECEIVER_ENCRYPTION_ALGO', 'aes-256-cbc');
}

if (!function_exists('backup_receiver_storage_root')) {
    function backup_receiver_storage_root(): string
    {
        return BackupConfig::receiverStorageRoot();
    }
}

if (!function_exists('backup_receiver_checksum_required')) {
    function backup_receiver_checksum_required(): bool
    {
        return BackupConfig::receiverChecksumRequired();
    }
}

if (!function_exists('backup_receiver_retention_days')) {
    function backup_receiver_retention_days(): int
    {
        return BackupConfig::receiverRetentionDays();
    }
}

if (!function_exists('backup_receiver_cleanup_max_files')) {
    function backup_receiver_cleanup_max_files(): int
    {
        return BackupConfig::receiverCleanupMaxFiles();
    }
}

if (!function_exists('backup_receiver_normalize_sha256')) {
    function backup_receiver_normalize_sha256(string $value): string
    {
        return BackupCrypto::receiverNormalizeSha256($value);
    }
}

if (!function_exists('backup_receiver_checksum_matches')) {
    function backup_receiver_checksum_matches(string $provided, string $computed): bool
    {
        return BackupCrypto::receiverChecksumMatches($provided, $computed);
    }
}

if (!function_exists('backup_receiver_encryption_key')) {
    function backup_receiver_encryption_key(): string
    {
        return BackupCrypto::receiverEncryptionKey();
    }
}

if (!function_exists('backup_receiver_encrypt_payload')) {
    function backup_receiver_encrypt_payload(string $plain): array
    {
        return BackupCrypto::receiverEncryptPayload($plain);
    }
}

if (!function_exists('backup_receiver_decrypt_payload')) {
    function backup_receiver_decrypt_payload(string $encoded): array
    {
        return BackupCrypto::receiverDecryptPayload($encoded);
    }
}

if (!function_exists('backup_receiver_verify_stored_file')) {
    function backup_receiver_verify_stored_file(string $path): array
    {
        return BackupCrypto::receiverVerifyStoredFile($path);
    }
}

if (!function_exists('backup_receiver_cleanup_retention')) {
    function backup_receiver_cleanup_retention(string $storageRoot): array
    {
        return BackupHealthService::receiverCleanupRetention($storageRoot);
    }
}

if (!function_exists('backup_health_max_age_hours')) {
    function backup_health_max_age_hours(): int
    {
        return BackupConfig::healthMaxAgeHours();
    }
}

if (!function_exists('backup_offsite_timeout_seconds')) {
    function backup_offsite_timeout_seconds(): int
    {
        return BackupConfig::offsiteTimeoutSeconds();
    }
}

if (!function_exists('backup_first_non_empty_string')) {
    function backup_first_non_empty_string(array $values): string
    {
        return BackupConfig::firstNonEmptyString($values);
    }
}

if (!function_exists('backup_offsite_target_url')) {
    function backup_offsite_target_url(): string
    {
        return BackupConfig::offsiteTargetUrl();
    }
}

if (!function_exists('backup_local_replica_enabled')) {
    function backup_local_replica_enabled(): bool
    {
        return BackupConfig::localReplicaEnabled();
    }
}

if (!function_exists('backup_local_replica_dir')) {
    function backup_local_replica_dir(): string
    {
        return BackupConfig::localReplicaDir();
    }
}

if (!function_exists('backup_replica_mode')) {
    function backup_replica_mode(): string
    {
        return BackupConfig::replicaMode();
    }
}

if (!function_exists('backup_offsite_token')) {
    function backup_offsite_token(): string
    {
        return BackupConfig::offsiteToken();
    }
}

if (!function_exists('backup_offsite_token_header')) {
    function backup_offsite_token_header(): string
    {
        return BackupConfig::offsiteTokenHeader();
    }
}

if (!function_exists('backup_offsite_configured')) {
    function backup_offsite_configured(): bool
    {
        return BackupConfig::offsiteConfigured();
    }
}

if (!function_exists('backup_auto_refresh_enabled')) {
    function backup_auto_refresh_enabled(): bool
    {
        return BackupConfig::autoRefreshEnabled();
    }
}

if (!function_exists('backup_auto_refresh_interval_seconds')) {
    function backup_auto_refresh_interval_seconds(): int
    {
        return BackupConfig::autoRefreshIntervalSeconds();
    }
}

if (!function_exists('backup_auto_refresh_marker_path')) {
    function backup_auto_refresh_marker_path(): string
    {
        return BackupConfig::autoRefreshMarkerPath();
    }
}

if (!function_exists('backup_auto_refresh_last_attempt_age_seconds')) {
    function backup_auto_refresh_last_attempt_age_seconds(): ?int
    {
        return BackupHealthService::autoRefreshLastAttemptAgeSeconds();
    }
}

if (!function_exists('backup_auto_refresh_touch_marker')) {
    function backup_auto_refresh_touch_marker(): void
    {
        BackupHealthService::autoRefreshTouchMarker();
    }
}

if (!function_exists('backup_auto_refresh_try_create')) {
    function backup_auto_refresh_try_create(): array
    {
        return BackupHealthService::autoRefreshTryCreate();
    }
}

if (!function_exists('backup_create_initial_seed_if_missing')) {
    function backup_create_initial_seed_if_missing(): array
    {
        return BackupHealthService::createInitialSeedIfMissing();
    }
}

if (!function_exists('backup_list_files')) {
    function backup_list_files(int $limit = 0): array
    {
        return BackupHealthService::listFiles($limit);
    }
}

if (!function_exists('backup_validate_store_shape')) {
    function backup_validate_store_shape(array $data): array
    {
        return BackupHealthService::validateStoreShape($data);
    }
}

if (!function_exists('backup_decode_store_payload')) {
    function backup_decode_store_payload(string $raw): array
    {
        return BackupHealthService::decodeStorePayload($raw);
    }
}

if (!function_exists('backup_validate_file')) {
    function backup_validate_file(string $path): array
    {
        return BackupHealthService::validateFile($path);
    }
}

if (!function_exists('backup_validate_file_fast')) {
    function backup_validate_file_fast(string $path): array
    {
        return BackupHealthService::validateFileFast($path);
    }
}

if (!function_exists('backup_latest_status_internal')) {
    function backup_latest_status_internal(?int $maxAgeHours, callable $validator): array
    {
        return BackupHealthService::latestStatusInternal($maxAgeHours, $validator);
    }
}

if (!function_exists('backup_latest_status')) {
    function backup_latest_status(?int $maxAgeHours = null): array
    {
        return BackupHealthService::latestStatus($maxAgeHours);
    }
}

if (!function_exists('backup_latest_status_fast')) {
    function backup_latest_status_fast(?int $maxAgeHours = null): array
    {
        return BackupHealthService::latestStatusFast($maxAgeHours);
    }
}

if (!function_exists('backup_create_offsite_snapshot')) {
    function backup_create_offsite_snapshot(): array
    {
        return BackupReplicationService::createOffsiteSnapshot();
    }
}

if (!function_exists('backup_upload_file')) {
    function backup_upload_file(string $filePath, array $metadata = []): array
    {
        return BackupReplicationService::uploadFile($filePath, $metadata);
    }
}

if (!function_exists('backup_replicate_local_file')) {
    function backup_replicate_local_file(string $filePath, array $metadata = []): array
    {
        return BackupReplicationService::replicateLocalFile($filePath, $metadata);
    }
}
