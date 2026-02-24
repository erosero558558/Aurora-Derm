<?php

declare(strict_types=1);

/**
 * Shared helpers for lightweight JSON API persistence.
 */

// Autoloader de Composer (para PHPMailer y otras dependencias)
$autoloadFile = __DIR__ . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
if (is_file($autoloadFile)) {
    try {
        require_once $autoloadFile;
    } catch (Throwable $autoloadError) {
        error_log('Piel en Armonia: composer autoload skipped - ' . $autoloadError->getMessage());
    }
}

// Cargar variables de entorno si existe env.php
$envFile = __DIR__ . DIRECTORY_SEPARATOR . 'env.php';
if (is_file($envFile)) {
    try {
        require_once $envFile;
    } catch (Throwable $envError) {
        error_log('Piel en Armonia: env.php skipped - ' . $envError->getMessage());
    }
}

// Cargar librerias modularizadas
require_once __DIR__ . '/lib/common.php';
require_once __DIR__ . '/lib/captcha.php';
require_once __DIR__ . '/lib/logger.php';
require_once __DIR__ . '/lib/metrics.php';
require_once __DIR__ . '/lib/features.php';
require_once __DIR__ . '/lib/validation.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/security.php';
require_once __DIR__ . '/lib/models.php';
require_once __DIR__ . '/lib/business.php';
require_once __DIR__ . '/lib/storage.php';
require_once __DIR__ . '/lib/calendar/runtime.php';
require_once __DIR__ . '/lib/backup.php';
require_once __DIR__ . '/lib/audit.php';
require_once __DIR__ . '/lib/figo_utils.php';
require_once __DIR__ . '/lib/figo_queue.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/email.php';
require_once __DIR__ . '/lib/ratelimit.php';
require_once __DIR__ . '/lib/security.php';

$eventSetupLoaded = false;
$eventSetupFile = __DIR__ . '/lib/event_setup.php';
if (is_file($eventSetupFile) && PHP_VERSION_ID >= 70400) {
    try {
        require_once $eventSetupFile;
        $eventSetupLoaded = function_exists('get_event_dispatcher');
    } catch (Throwable $eventSetupError) {
        error_log('Piel en Armonia: event_setup disabled - ' . $eventSetupError->getMessage());
    }
}

if (!$eventSetupLoaded && !function_exists('get_event_dispatcher')) {
    function get_event_dispatcher()
    {
        static $nullDispatcher = null;
        if (!is_object($nullDispatcher)) {
            $nullDispatcher = new class {
                public function addListener(string $eventName, callable $listener): void
                {
                }

                public function dispatch($event)
                {
                    return $event;
                }
            };
        }
        return $nullDispatcher;
    }
}
