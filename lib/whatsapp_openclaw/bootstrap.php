<?php

declare(strict_types=1);

require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Repository.php';
require_once __DIR__ . '/SlotHoldService.php';
require_once __DIR__ . '/PlannerClient.php';
require_once __DIR__ . '/ConversationOrchestrator.php';

function whatsapp_openclaw_normalize_phone(string $value): string
{
    $digits = preg_replace('/\D+/', '', $value);
    if (!is_string($digits)) {
        return '';
    }

    $digits = ltrim($digits, '0');
    if ($digits === '') {
        return '';
    }

    return $digits;
}

function whatsapp_openclaw_repository(): WhatsappOpenclawRepository
{
    static $repository = null;
    static $repositoryKey = '';
    $currentKey = trim((string) (getenv('PIELARMONIA_DATA_DIR') ?: ''));
    if ($currentKey === '') {
        $currentKey = data_dir_path();
    }
    if (!$repository instanceof WhatsappOpenclawRepository || $repositoryKey !== $currentKey) {
        $repository = new WhatsappOpenclawRepository($currentKey . DIRECTORY_SEPARATOR . 'whatsapp-openclaw');
        $repositoryKey = $currentKey;
    }
    return $repository;
}

function whatsapp_openclaw_slot_hold_service(): WhatsappOpenclawSlotHoldService
{
    static $service = null;
    static $serviceKey = '';
    $currentKey = trim((string) (getenv('PIELARMONIA_DATA_DIR') ?: ''));
    if ($currentKey === '') {
        $currentKey = data_dir_path();
    }
    if (!$service instanceof WhatsappOpenclawSlotHoldService || $serviceKey !== $currentKey) {
        $service = new WhatsappOpenclawSlotHoldService(
            whatsapp_openclaw_repository(),
            CalendarBookingService::fromEnv()
        );
        $serviceKey = $currentKey;
    }
    return $service;
}

function whatsapp_openclaw_planner_client(): WhatsappOpenclawPlannerClient
{
    static $planner = null;
    if (!$planner instanceof WhatsappOpenclawPlannerClient) {
        $planner = new WhatsappOpenclawPlannerClient();
    }
    return $planner;
}

function whatsapp_openclaw_orchestrator(): WhatsappOpenclawConversationOrchestrator
{
    static $orchestrator = null;
    static $orchestratorKey = '';
    $currentKey = trim((string) (getenv('PIELARMONIA_DATA_DIR') ?: ''));
    if ($currentKey === '') {
        $currentKey = data_dir_path();
    }
    if (!$orchestrator instanceof WhatsappOpenclawConversationOrchestrator || $orchestratorKey !== $currentKey) {
        $orchestrator = new WhatsappOpenclawConversationOrchestrator(
            whatsapp_openclaw_repository(),
            whatsapp_openclaw_planner_client(),
            whatsapp_openclaw_slot_hold_service()
        );
        $orchestratorKey = $currentKey;
    }
    return $orchestrator;
}

function whatsapp_openclaw_health_snapshot(array $store = []): array
{
    return whatsapp_openclaw_repository()->buildHealthSnapshot($store);
}

function whatsapp_openclaw_render_prometheus_metrics(array $store = []): string
{
    $snapshot = whatsapp_openclaw_health_snapshot($store);
    $output = '';

    foreach (['disabled', 'dry_run', 'live_allowlist', 'live'] as $mode) {
        $output .= "\n# TYPE pielarmonia_whatsapp_openclaw_mode gauge";
        $output .= "\npielarmonia_whatsapp_openclaw_mode{mode=\"" . $mode . "\"} " . (($snapshot['configuredMode'] ?? '') === $mode ? 1 : 0);
    }

    foreach (['online', 'offline', 'degraded', 'pending', 'disabled'] as $mode) {
        $output .= "\n# TYPE pielarmonia_whatsapp_bridge_mode gauge";
        $output .= "\npielarmonia_whatsapp_bridge_mode{mode=\"" . $mode . "\"} " . (($snapshot['bridgeMode'] ?? '') === $mode ? 1 : 0);
    }

    foreach (
        [
            'pendingOutbox' => 'pielarmonia_whatsapp_outbox_pending_total',
            'activeConversations' => 'pielarmonia_whatsapp_conversations_active_total',
            'aliveHolds' => 'pielarmonia_whatsapp_slot_holds_alive_total',
            'bookingsClosed' => 'pielarmonia_whatsapp_bookings_closed_total',
            'paymentsStarted' => 'pielarmonia_whatsapp_payments_started_total',
            'paymentsCompleted' => 'pielarmonia_whatsapp_payments_completed_total',
            'deliveryFailures' => 'pielarmonia_whatsapp_delivery_failures_total',
        ] as $field => $metricName
    ) {
        $output .= "\n# TYPE " . $metricName . " gauge";
        $output .= "\n" . $metricName . ' ' . (int) ($snapshot[$field] ?? 0);
    }

    $output .= "\n# TYPE pielarmonia_whatsapp_automation_success_rate gauge";
    $output .= "\npielarmonia_whatsapp_automation_success_rate " . (float) ($snapshot['automationSuccessRate'] ?? 0.0) . "\n";

    return $output;
}
