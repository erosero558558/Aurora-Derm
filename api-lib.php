<?php

declare(strict_types=1);

/**
 * Shared helpers for lightweight JSON API persistence.
 */

// Autoloader de Composer (para PHPMailer y otras dependencias)
$autoloadFile = __DIR__ . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
if (is_file($autoloadFile)) {
    require_once $autoloadFile;
}

// Cargar variables de entorno si existe env.php
$envFile = __DIR__ . DIRECTORY_SEPARATOR . 'env.php';
if (is_file($envFile)) {
    require_once $envFile;
}

// Cargar librerias modularizadas
require_once __DIR__ . '/lib/common.php';
require_once __DIR__ . '/lib/logger.php';
require_once __DIR__ . '/lib/metrics.php';
require_once __DIR__ . '/lib/features.php';
require_once __DIR__ . '/lib/validation.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/security.php';
require_once __DIR__ . '/lib/models.php';
require_once __DIR__ . '/lib/business.php';
require_once __DIR__ . '/lib/storage.php';
require_once __DIR__ . '/lib/calendar/GoogleTokenProvider.php';
require_once __DIR__ . '/lib/calendar/GoogleCalendarClient.php';
require_once __DIR__ . '/lib/calendar/CalendarAvailabilityService.php';
require_once __DIR__ . '/lib/calendar/CalendarBookingService.php';
require_once __DIR__ . '/lib/backup.php';
require_once __DIR__ . '/lib/audit.php';
require_once __DIR__ . '/lib/figo_queue.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/email.php';
require_once __DIR__ . '/lib/ratelimit.php';
require_once __DIR__ . '/lib/security.php';
require_once __DIR__ . '/lib/event_setup.php';
