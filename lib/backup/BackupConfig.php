<?php

declare(strict_types=1);

final class BackupConfig
{
    public static function receiverStorageRoot(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . 'offsite-receiver';
    }

    public static function receiverChecksumRequired(): bool
    {
        $raw = getenv('PIELARMONIA_BACKUP_RECEIVER_REQUIRE_CHECKSUM');
        if (!is_string($raw) || trim($raw) === '') {
            return true;
        }

        return parse_bool($raw);
    }

    public static function receiverRetentionDays(): int
    {
        $raw = getenv('PIELARMONIA_BACKUP_RECEIVER_RETENTION_DAYS');
        $days = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : BACKUP_RECEIVER_RETENTION_DAYS_DEFAULT;
        if ($days < 1) {
            $days = 1;
        }
        if ($days > BACKUP_RECEIVER_RETENTION_DAYS_MAX) {
            $days = BACKUP_RECEIVER_RETENTION_DAYS_MAX;
        }
        return $days;
    }

    public static function receiverCleanupMaxFiles(): int
    {
        $raw = getenv('PIELARMONIA_BACKUP_RECEIVER_CLEANUP_MAX_FILES');
        $maxFiles = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : BACKUP_RECEIVER_CLEANUP_MAX_FILES_DEFAULT;
        if ($maxFiles < 50) {
            $maxFiles = 50;
        }
        if ($maxFiles > 10000) {
            $maxFiles = 10000;
        }
        return $maxFiles;
    }

    public static function healthMaxAgeHours(): int
    {
        $raw = getenv('PIELARMONIA_BACKUP_MAX_AGE_HOURS');
        $hours = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : BACKUP_HEALTH_DEFAULT_MAX_AGE_HOURS;
        if ($hours < 1) {
            $hours = 1;
        }
        if ($hours > 168) {
            $hours = 168;
        }
        return $hours;
    }

    public static function offsiteTimeoutSeconds(): int
    {
        $raw = getenv('PIELARMONIA_BACKUP_OFFSITE_TIMEOUT_SECONDS');
        $seconds = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : BACKUP_OFFSITE_TIMEOUT_SECONDS;
        if ($seconds < BACKUP_OFFSITE_MIN_TIMEOUT_SECONDS) {
            $seconds = BACKUP_OFFSITE_MIN_TIMEOUT_SECONDS;
        }
        if ($seconds > BACKUP_OFFSITE_MAX_TIMEOUT_SECONDS) {
            $seconds = BACKUP_OFFSITE_MAX_TIMEOUT_SECONDS;
        }
        return $seconds;
    }

    public static function firstNonEmptyString(array $values): string
    {
        foreach ($values as $value) {
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }
        return '';
    }

    public static function offsiteTargetUrl(): string
    {
        return self::firstNonEmptyString([
            getenv('PIELARMONIA_BACKUP_OFFSITE_URL'),
            getenv('PIELARMONIA_BACKUP_WEBHOOK_URL'),
        ]);
    }

    public static function localReplicaEnabled(): bool
    {
        $raw = getenv('PIELARMONIA_BACKUP_LOCAL_REPLICA');
        if (!is_string($raw) || trim($raw) === '') {
            return true;
        }
        return parse_bool($raw);
    }

    public static function localReplicaDir(): string
    {
        return backup_dir_path() . DIRECTORY_SEPARATOR . BACKUP_LOCAL_REPLICA_DIRNAME;
    }

    public static function replicaMode(): string
    {
        if (self::offsiteTargetUrl() !== '') {
            return 'remote';
        }
        if (self::localReplicaEnabled()) {
            return 'local';
        }
        return 'none';
    }

    public static function offsiteToken(): string
    {
        return self::firstNonEmptyString([
            getenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN'),
            getenv('PIELARMONIA_BACKUP_WEBHOOK_TOKEN'),
        ]);
    }

    public static function offsiteTokenHeader(): string
    {
        $header = self::firstNonEmptyString([
            getenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER'),
            getenv('PIELARMONIA_BACKUP_WEBHOOK_TOKEN_HEADER'),
        ]);

        return $header !== '' ? $header : 'Authorization';
    }

    public static function offsiteConfigured(): bool
    {
        return self::replicaMode() !== 'none';
    }

    public static function autoRefreshEnabled(): bool
    {
        $raw = getenv('PIELARMONIA_BACKUP_AUTO_REFRESH');
        if (!is_string($raw) || trim($raw) === '') {
            return true;
        }
        return parse_bool($raw);
    }

    public static function autoRefreshIntervalSeconds(): int
    {
        $raw = getenv('PIELARMONIA_BACKUP_AUTO_REFRESH_INTERVAL_SECONDS');
        $seconds = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : 600;
        if ($seconds < 300) {
            $seconds = 300;
        }
        if ($seconds > 604800) {
            $seconds = 604800;
        }
        return $seconds;
    }

    public static function autoRefreshMarkerPath(): string
    {
        return backup_dir_path() . DIRECTORY_SEPARATOR . 'backup-auto-refresh.marker';
    }
}
