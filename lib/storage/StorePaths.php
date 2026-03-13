<?php

declare(strict_types=1);

final class StorePaths
{
    private static function resolveCacheKey(): string
    {
        $parts = [
            getenv('PIELARMONIA_DATA_DIR'),
            getenv('PIELARMONIA_HOME_DIR'),
            getenv('HOME'),
            getenv('USERPROFILE'),
            getenv('HOMEDRIVE'),
            getenv('HOMEPATH'),
        ];

        return implode('|', array_map(
            static fn ($value): string => is_string($value) ? trim($value) : '',
            $parts
        ));
    }

    public static function dataHomeDirCandidate(): string
    {
        $home = '';
        $homeCandidates = [
            getenv('PIELARMONIA_HOME_DIR'),
            getenv('HOME'),
            getenv('USERPROFILE'),
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

    public static function dataDirCandidates(): array
    {
        $candidates = [];

        $envDir = getenv('PIELARMONIA_DATA_DIR');
        if (is_string($envDir) && trim($envDir) !== '') {
            $candidates[] = [
                'source' => 'env',
                'path' => trim($envDir),
            ];
        }

        $candidates[] = [
            'source' => 'project',
            'path' => DATA_DIR,
        ];
        $candidates[] = [
            'source' => 'parent',
            'path' => dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data',
        ];

        $homeCandidate = self::dataHomeDirCandidate();
        if ($homeCandidate !== '') {
            $candidates[] = [
                'source' => 'home',
                'path' => $homeCandidate,
            ];
        }

        $candidates[] = [
            'source' => 'tmp',
            'path' => sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-data',
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
                'path' => $path,
            ];
        }

        return $normalized;
    }

    public static function resolveDataDir(): array
    {
        static $resolved = null;
        static $cacheKey = null;
        $currentCacheKey = self::resolveCacheKey();
        if ($cacheKey !== $currentCacheKey) {
            $resolved = null;
            $cacheKey = $currentCacheKey;
        }

        if (is_array($resolved) && isset($resolved['path'], $resolved['source'])) {
            return $resolved;
        }

        foreach (self::dataDirCandidates() as $candidate) {
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
                    'source' => $source,
                ];
                return $resolved;
            }
        }

        $resolved = [
            'path' => DATA_DIR,
            'source' => 'fallback',
        ];
        return $resolved;
    }

    public static function dataDirPath(): string
    {
        $resolved = self::resolveDataDir();
        return (string) ($resolved['path'] ?? DATA_DIR);
    }

    public static function dataDirSource(): string
    {
        $resolved = self::resolveDataDir();
        return (string) ($resolved['source'] ?? 'unknown');
    }

    public static function dataFilePath(): string
    {
        return self::dataDirPath() . DIRECTORY_SEPARATOR . 'store.sqlite';
    }

    public static function dataJsonPath(): string
    {
        return self::dataDirPath() . DIRECTORY_SEPARATOR . 'store.json';
    }

    public static function dataDirWritable(): bool
    {
        $dir = self::dataDirPath();
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
                return false;
            }
        }

        return @is_writable($dir);
    }

    public static function backupDirPath(): string
    {
        return self::dataDirPath() . DIRECTORY_SEPARATOR . 'backups';
    }

    public static function clinicalMediaDirPath(): string
    {
        return self::dataDirPath() . DIRECTORY_SEPARATOR . 'clinical-media';
    }

    public static function auditLogFilePath(): string
    {
        return self::dataDirPath() . DIRECTORY_SEPARATOR . 'audit.log';
    }

    public static function ensureDataHtaccess(string $dir): void
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

    public static function ensureBackupDir(): bool
    {
        $backupDir = self::backupDirPath();
        if (is_dir($backupDir)) {
            return true;
        }

        return @mkdir($backupDir, 0775, true) || is_dir($backupDir);
    }

    public static function ensureClinicalMediaDir(): bool
    {
        $dir = self::clinicalMediaDirPath();
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }

        self::ensureDataHtaccess($dir);
        return true;
    }
}
