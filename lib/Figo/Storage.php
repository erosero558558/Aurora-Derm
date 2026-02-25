<?php

declare(strict_types=1);

require_once __DIR__ . '/../storage.php';
require_once __DIR__ . '/Config.php';

class FigoStorage
{
    public static function getBaseDir(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . 'ai-queue';
    }

    public static function getJobsDir(): string
    {
        return self::getBaseDir() . DIRECTORY_SEPARATOR . 'jobs';
    }

    public static function getLocksDir(): string
    {
        return self::getBaseDir() . DIRECTORY_SEPARATOR . 'locks';
    }

    public static function getWorkerMetaPath(): string
    {
        return self::getBaseDir() . DIRECTORY_SEPARATOR . 'worker-meta.json';
    }

    public static function getGatewayStatusPath(): string
    {
        return self::getBaseDir() . DIRECTORY_SEPARATOR . 'gateway-status.json';
    }

    public static function ensureDirs(): bool
    {
        $dirs = [self::getBaseDir(), self::getJobsDir(), self::getLocksDir()];
        foreach ($dirs as $dir) {
            if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
                return false;
            }
            ensure_data_htaccess($dir);
        }
        return true;
    }

    public static function isValidJobId(string $jobId): bool
    {
        return preg_match('/^[a-f0-9]{24,64}$/', $jobId) === 1;
    }

    public static function generateJobId(): string
    {
        try {
            return bin2hex(random_bytes(16));
        } catch (Throwable $e) {
            return substr(sha1((string) microtime(true) . (string) mt_rand()), 0, 32);
        }
    }

    public static function getJobPath(string $jobId): string
    {
        if (!self::isValidJobId($jobId)) {
            return '';
        }
        return self::getJobsDir() . DIRECTORY_SEPARATOR . $jobId . '.json';
    }

    public static function readJsonFile(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    public static function writeJsonFile(string $path, array $data): bool
    {
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($json)) {
            return false;
        }
        return @file_put_contents($path, $json, LOCK_EX) !== false;
    }

    public static function readJob(string $jobId): ?array
    {
        $path = self::getJobPath($jobId);
        if ($path === '') {
            return null;
        }
        return self::readJsonFile($path);
    }

    public static function writeJob(array $job): bool
    {
        if (!self::ensureDirs()) {
            return false;
        }

        $jobId = isset($job['jobId']) ? (string) $job['jobId'] : '';
        $path = self::getJobPath($jobId);
        if ($path === '') {
            return false;
        }

        return self::writeJsonFile($path, $job);
    }

    public static function writeWorkerMeta(array $meta): void
    {
        if (!self::ensureDirs()) {
            return;
        }
        $current = self::readJsonFile(self::getWorkerMetaPath());
        if (!is_array($current)) {
            $current = [];
        }
        $next = array_merge($current, $meta);
        $next['updatedAt'] = gmdate('c');
        self::writeJsonFile(self::getWorkerMetaPath(), $next);
    }

    public static function readWorkerMeta(): array
    {
        $meta = self::readJsonFile(self::getWorkerMetaPath());
        return is_array($meta) ? $meta : [];
    }

    public static function writeGatewayStatus(array $status): void
    {
        if (!self::ensureDirs()) {
            return;
        }
        self::writeJsonFile(self::getGatewayStatusPath(), [
            'updatedAt' => gmdate('c'),
            'status' => $status
        ]);
    }

    public static function readGatewayStatus(): array
    {
        $raw = self::readJsonFile(self::getGatewayStatusPath());
        if (!is_array($raw)) {
            return [];
        }
        return isset($raw['status']) && is_array($raw['status']) ? $raw['status'] : [];
    }

    public static function acquireLock(string $name, int $timeoutMs = 800)
    {
        if (!self::ensureDirs()) {
            return null;
        }

        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $name);
        if (!is_string($safeName) || $safeName === '') {
            $safeName = 'lock';
        }
        $path = self::getLocksDir() . DIRECTORY_SEPARATOR . $safeName . '.lock';
        $fp = @fopen($path, 'c+');
        if ($fp === false) {
            return null;
        }

        $start = (int) floor(microtime(true) * 1000);
        do {
            if (@flock($fp, LOCK_EX | LOCK_NB)) {
                return $fp;
            }
            usleep(25000);
            $elapsed = (int) floor(microtime(true) * 1000) - $start;
        } while ($elapsed < max(0, $timeoutMs));

        @fclose($fp);
        return null;
    }

    public static function releaseLock($handle): void
    {
        if (!is_resource($handle)) {
            return;
        }
        @flock($handle, LOCK_UN);
        @fclose($handle);
    }
}
