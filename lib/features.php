<?php

declare(strict_types=1);

/**
 * Feature flags configuration and helpers.
 */

class FeatureFlags
{
    private static $client = null;
    private static $useRedis = null;
    private static $filePath = null;
    private static $flags = null; // Local cache

    // Default flags configuration
    private static $defaults = [
        'new_booking_ui' => false,
        'admin_sony_ui' => false,
        'stripe_elements' => false,
        'dark_mode' => false,
        'chatgpt_integration' => false,
        'referral_program' => false,
    ];

    public static function reset(): void
    {
        self::$flags = null;
        self::$useRedis = null;
        self::$client = null;
    }

    private static function init(): void
    {
        if (self::$useRedis !== null) {
            return;
        }

        $host = getenv('PIELARMONIA_REDIS_HOST');
        if (is_string($host) && trim($host) !== '' && class_exists('Predis\Client')) {
            try {
                self::$client = new \Predis\Client([
                    'scheme' => 'tcp',
                    'host'   => trim($host),
                    'port'   => 6379,
                    'read_write_timeout' => 2,
                ]);
                self::$client->connect();
                self::$useRedis = true;
                return;
            } catch (Exception $e) {
                error_log('FeatureFlags: Redis connection failed, falling back to file. ' . $e->getMessage());
            }
        }

        self::$useRedis = false;
        self::$filePath = __DIR__ . '/../data/features.json';
        if (!is_dir(dirname(self::$filePath))) {
            @mkdir(dirname(self::$filePath), 0775, true);
        }
    }

    private static function loadFlags(): array
    {
        self::init();
        if (self::$flags !== null) {
            return self::$flags;
        }

        $stored = [];

        if (self::$useRedis) {
            try {
                $data = self::$client->get('features:config');
                if ($data) {
                    $stored = json_decode($data, true) ?? [];
                }
            } catch (Exception $e) {
                // Fail silently
            }
        } else {
            if (file_exists(self::$filePath)) {
                $content = @file_get_contents(self::$filePath);
                if ($content) {
                    $stored = json_decode($content, true) ?? [];
                }
            }
        }

        self::$flags = $stored;
        return $stored;
    }

    private static function saveFlags(array $flags): void
    {
        self::init();
        self::$flags = $flags;

        if (self::$useRedis) {
            try {
                self::$client->set('features:config', json_encode($flags));
            } catch (Exception $e) {
                // Log error
            }
        } else {
            $fp = @fopen(self::$filePath, 'c+');
            if ($fp && flock($fp, LOCK_EX)) {
                ftruncate($fp, 0);
                rewind($fp);
                fwrite($fp, json_encode($flags, JSON_PRETTY_PRINT));
                fflush($fp);
                flock($fp, LOCK_UN);
                fclose($fp);
            }
        }
    }

    public static function isEnabled(string $flag, ?string $identity = null): bool
    {
        // 1. Env Var Override
        $envKey = 'FEATURE_' . strtoupper($flag);
        $envVal = getenv($envKey);
        if ($envVal !== false && $envVal !== '') {
            return filter_var($envVal, FILTER_VALIDATE_BOOLEAN);
        }

        // 2. Load from Storage
        $stored = self::loadFlags();
        $config = $stored[$flag] ?? ['enabled' => self::$defaults[$flag] ?? false];

        // Ensure config is array if stored as bool (legacy/simple format)
        if (is_bool($config)) {
            $config = ['enabled' => $config];
        }

        if (!($config['enabled'] ?? false)) {
            return false;
        }

        // 3. Gradual Rollout
        if (isset($config['percentage'])) {
            $percentage = (int)$config['percentage'];
            if ($percentage >= 100) {
                return true;
            }
            if ($percentage <= 0) {
                return false;
            }

            if ($identity === null) {
                $identity = session_id();
                if ($identity === '') {
                    // Fallback to IP or random for public users
                    $identity = $_SERVER['REMOTE_ADDR'] ?? uniqid('', true);
                }
            }

            $hash = crc32($identity . $flag); // Salt with flag name
            return ($hash % 100) < $percentage;
        }

        return true;
    }

    public static function enable(string $flag): void
    {
        $flags = self::loadFlags();
        // Preserve existing config if array, else overwrite
        if (isset($flags[$flag]) && is_array($flags[$flag])) {
            $flags[$flag]['enabled'] = true;
        } else {
            $flags[$flag] = ['enabled' => true];
        }
        self::saveFlags($flags);
    }

    public static function disable(string $flag): void
    {
        $flags = self::loadFlags();
        if (isset($flags[$flag]) && is_array($flags[$flag])) {
            $flags[$flag]['enabled'] = false;
        } else {
            $flags[$flag] = ['enabled' => false];
        }
        self::saveFlags($flags);
    }

    public static function setPercentage(string $flag, int $percentage): void
    {
        $flags = self::loadFlags();
        if (!isset($flags[$flag]) || !is_array($flags[$flag])) {
            $flags[$flag] = ['enabled' => true];
        }
        $flags[$flag]['percentage'] = max(0, min(100, $percentage));
        $flags[$flag]['enabled'] = true; // Ensure enabled is true
        self::saveFlags($flags);
    }

    public static function getAll(): array
    {
        $allKeys = array_keys(self::$defaults);
        $stored = self::loadFlags();
        $storedKeys = array_keys($stored);
        $keys = array_unique(array_merge($allKeys, $storedKeys));

        $result = [];
        foreach ($keys as $key) {
            $result[$key] = self::isEnabled($key);
        }
        return $result;
    }
}

// Backward compatibility functions
function get_feature_flags(): array
{
    return FeatureFlags::getAll();
}

function feature_enabled(string $key): bool
{
    return FeatureFlags::isEnabled($key);
}
