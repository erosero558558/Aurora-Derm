<?php

declare(strict_types=1);

/**
 * Scheduled tasks for Piel en Armonia.
 *
 * Usage:
 *   GET /cron.php?action=reminders&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=backup-health&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=backup-offsite&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=ai-queue-worker&token=YOUR_CRON_SECRET
 *
 * Suggested cron jobs (America/Guayaquil):
 *   0 18 * * * curl -s "https://pielarmonia.com/cron.php?action=reminders&token=YOUR_CRON_SECRET"
 *   10 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET"
 *   20 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&token=YOUR_CRON_SECRET"
 *   * * * * * curl -s "https://pielarmonia.com/cron.php?action=ai-queue-worker&token=YOUR_CRON_SECRET"
 */

require_once __DIR__ . '/api-lib.php';

apply_security_headers(false);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function cron_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function cron_extract_token(): string
{
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? trim((string) $_SERVER['HTTP_AUTHORIZATION']) : '';
    if ($authHeader !== '') {
        if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches) === 1) {
            return trim((string) ($matches[1] ?? ''));
        }
        return $authHeader;
    }

    $headerToken = isset($_SERVER['HTTP_X_CRON_TOKEN']) ? trim((string) $_SERVER['HTTP_X_CRON_TOKEN']) : '';
    if ($headerToken !== '') {
        return $headerToken;
    }

    return trim((string) ($_GET['token'] ?? ''));
}

$secret = getenv('PIELARMONIA_CRON_SECRET');
if (!is_string($secret) || $secret === '') {
    cron_json(['ok' => false, 'error' => 'CRON_SECRET no configurado'], 500);
}

$token = cron_extract_token();
if (!hash_equals($secret, $token)) {
    cron_json(['ok' => false, 'error' => 'Token invalido'], 403);
}

$action = trim((string) ($_GET['action'] ?? ''));

if ($action === 'reminders') {
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    $store = read_store();
    $sent = 0;
    $skipped = 0;
    $failed = 0;

    foreach ($store['appointments'] as &$appt) {
        $status = (string) ($appt['status'] ?? '');
        $date = (string) ($appt['date'] ?? '');
        $reminderSent = trim((string) ($appt['reminderSentAt'] ?? ''));

        if ($status !== 'confirmed' || $date !== $tomorrow || $reminderSent !== '') {
            $skipped++;
            continue;
        }

        if (maybe_send_reminder_email($appt)) {
            $appt['reminderSentAt'] = local_date('c');
            $sent++;
        } else {
            $failed++;
        }
    }
    unset($appt);

    if ($sent > 0) {
        write_store($store);
    }

    cron_json([
        'ok' => true,
        'action' => 'reminders',
        'date' => $tomorrow,
        'sent' => $sent,
        'skipped' => $skipped,
        'failed' => $failed
    ]);
}

if ($action === 'backup-health') {
    if (!function_exists('backup_latest_status')) {
        cron_json([
            'ok' => false,
            'action' => 'backup-health',
            'error' => 'Modulo de backup no disponible'
        ], 500);
    }

    $rawMaxAge = isset($_GET['maxAgeHours']) ? (int) $_GET['maxAgeHours'] : 0;
    $maxAgeHours = $rawMaxAge > 0 ? $rawMaxAge : backup_health_max_age_hours();

    $status = backup_latest_status($maxAgeHours);
    $status['offsiteConfigured'] = backup_offsite_configured();
    $status['replicaMode'] = function_exists('backup_replica_mode') ? backup_replica_mode() : 'none';
    $status['timestamp'] = local_date('c');

    audit_log_event(
        ($status['ok'] ?? false) ? 'cron.backup_health.ok' : 'cron.backup_health.warn',
        [
            'ok' => (bool) ($status['ok'] ?? false),
            'reason' => (string) ($status['reason'] ?? ''),
            'count' => (int) ($status['count'] ?? 0),
            'latestAgeHours' => $status['latestAgeHours'] ?? null,
            'maxAgeHours' => (int) ($status['maxAgeHours'] ?? $maxAgeHours),
            'offsiteConfigured' => (bool) $status['offsiteConfigured'],
            'replicaMode' => (string) ($status['replicaMode'] ?? 'none')
        ]
    );

    cron_json([
        'ok' => (bool) ($status['ok'] ?? false),
        'action' => 'backup-health',
        'data' => $status
    ], ($status['ok'] ?? false) ? 200 : 503);
}

if ($action === 'backup-offsite') {
    if (!function_exists('backup_create_offsite_snapshot') || !function_exists('backup_upload_file')) {
        cron_json([
            'ok' => false,
            'action' => 'backup-offsite',
            'error' => 'Modulo de backup no disponible'
        ], 500);
    }

    $dryRun = parse_bool($_GET['dryRun'] ?? false);
    $snapshot = backup_create_offsite_snapshot();

    if (($snapshot['ok'] ?? false) !== true) {
        audit_log_event('cron.backup_offsite.fail', [
            'reason' => (string) ($snapshot['reason'] ?? 'snapshot_failed')
        ]);

        cron_json([
            'ok' => false,
            'action' => 'backup-offsite',
            'error' => 'No se pudo crear snapshot de backup',
            'data' => $snapshot
        ], 500);
    }

    $snapshotSummary = [
        'createdAt' => (string) ($snapshot['createdAt'] ?? local_date('c')),
        'file' => (string) ($snapshot['file'] ?? ''),
        'gzipFile' => (string) ($snapshot['gzipFile'] ?? ''),
        'sizeBytes' => (int) ($snapshot['sizeBytes'] ?? 0),
        'sha256' => (string) ($snapshot['sha256'] ?? ''),
        'counts' => isset($snapshot['counts']) && is_array($snapshot['counts']) ? $snapshot['counts'] : []
    ];

    $replicaMode = function_exists('backup_replica_mode') ? backup_replica_mode() : 'none';
    if ($dryRun) {
        audit_log_event('cron.backup_offsite.dry_run', [
            'file' => $snapshotSummary['file'],
            'sizeBytes' => $snapshotSummary['sizeBytes'],
            'offsiteConfigured' => backup_offsite_configured(),
            'replicaMode' => $replicaMode
        ]);

        cron_json([
            'ok' => true,
            'action' => 'backup-offsite',
            'dryRun' => true,
            'offsiteConfigured' => backup_offsite_configured(),
            'replicaMode' => $replicaMode,
            'snapshot' => $snapshotSummary
        ]);
    }

    if ($replicaMode === 'none') {
        audit_log_event('cron.backup_offsite.warn', [
            'reason' => 'offsite_not_configured',
            'file' => $snapshotSummary['file'],
            'replicaMode' => 'none'
        ]);

        cron_json([
            'ok' => false,
            'action' => 'backup-offsite',
            'error' => 'No hay destino de replica configurado',
            'snapshot' => $snapshotSummary
        ], 503);
    }

    $replicaMetadata = [
        'source' => 'pielarmonia',
        'storeEncrypted' => store_file_is_encrypted(),
        'dataDir' => basename((string) data_dir_path()),
        'snapshotCreatedAt' => (string) ($snapshot['createdAt'] ?? local_date('c')),
        'snapshotSha256' => (string) ($snapshot['sha256'] ?? ''),
        'runtimeVersion' => app_runtime_version()
    ];

    $upload = $replicaMode === 'remote'
        ? backup_upload_file((string) $snapshot['uploadPath'], $replicaMetadata)
        : backup_replicate_local_file((string) $snapshot['uploadPath'], $replicaMetadata);

    $uploadOk = (bool) ($upload['ok'] ?? false);
    audit_log_event($uploadOk ? 'cron.backup_offsite.ok' : 'cron.backup_offsite.fail', [
        'replicaMode' => $replicaMode,
        'status' => (int) ($upload['status'] ?? 0),
        'reason' => (string) ($upload['reason'] ?? ''),
        'file' => $snapshotSummary['file']
    ]);

    cron_json([
        'ok' => $uploadOk,
        'action' => 'backup-offsite',
        'replicaMode' => $replicaMode,
        'snapshot' => $snapshotSummary,
        'upload' => $upload
    ], $uploadOk ? 200 : 502);
}

if ($action === 'ai-queue-worker') {
    if (!figo_queue_enabled()) {
        cron_json([
            'ok' => false,
            'action' => 'ai-queue-worker',
            'error' => 'FIGO_PROVIDER_MODE no esta en openclaw_queue'
        ], 503);
    }

    $maxJobs = isset($_GET['maxJobs']) ? (int) $_GET['maxJobs'] : null;
    $timeBudgetMs = isset($_GET['timeBudgetMs']) ? (int) $_GET['timeBudgetMs'] : null;
    $result = figo_queue_process_worker($maxJobs, $timeBudgetMs, true);

    $statusCode = ($result['ok'] ?? false) ? 200 : 503;
    cron_json([
        'ok' => (bool) ($result['ok'] ?? false),
        'action' => 'ai-queue-worker',
        'processed' => (int) ($result['processed'] ?? 0),
        'completed' => (int) ($result['completed'] ?? 0),
        'failed' => (int) ($result['failed'] ?? 0),
        'remaining' => (int) ($result['remaining'] ?? 0),
        'expired' => (int) ($result['expired'] ?? 0),
        'deleted' => (int) ($result['deleted'] ?? 0),
        'durationMs' => (int) ($result['durationMs'] ?? 0),
        'reason' => isset($result['reason']) ? (string) $result['reason'] : '',
        'timestamp' => gmdate('c')
    ], $statusCode);
}

cron_json(['ok' => false, 'error' => 'Accion no valida'], 400);
