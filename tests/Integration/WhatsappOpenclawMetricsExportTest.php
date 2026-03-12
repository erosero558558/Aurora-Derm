<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class WhatsappOpenclawMetricsExportTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'wa-metrics-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED=true');
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_MODE=live');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN=test-wa-bridge-token');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_STALE_AFTER_SECONDS=900');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/SystemController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_SKIP_ENV_FILE',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED',
            'PIELARMONIA_WHATSAPP_OPENCLAW_MODE',
            'PIELARMONIA_WHATSAPP_BRIDGE_TOKEN',
            'PIELARMONIA_WHATSAPP_BRIDGE_STALE_AFTER_SECONDS',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testMetricsExportsWhatsappOpenclawOperationalGauges(): void
    {
        $store = \read_store();
        $store['appointments'] = [];
        \write_store($store, false);

        $repository = \whatsapp_openclaw_repository();
        $conversation = $repository->saveConversation([
            'id' => 'wa:593981110555',
            'phone' => '593981110555',
            'status' => 'booked',
            'updatedAt' => \local_date('c'),
            'lastIntent' => 'booking_card',
            'outboundPending' => 1,
            'messageCount' => 2,
        ]);
        $repository->saveBookingDraft([
            'conversationId' => (string) ($conversation['id'] ?? 'wa:593981110555'),
            'phone' => '593981110555',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => date('Y-m-d', strtotime('+2 days')),
            'time' => '10:00',
            'name' => 'Metricas WhatsApp',
            'email' => 'metricas@example.com',
            'status' => 'booked',
            'appointmentId' => 991,
            'paymentMethod' => 'card',
            'paymentStatus' => 'paid',
            'paymentSessionId' => 'cs_metrics_001',
            'paymentIntentId' => 'pi_metrics_001',
        ]);
        $repository->saveSlotHold([
            'conversationId' => (string) ($conversation['id'] ?? 'wa:593981110555'),
            'phone' => '593981110555',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'date' => date('Y-m-d', strtotime('+2 days')),
            'time' => '10:00',
            'paymentMethod' => 'card',
            'status' => 'active',
            'expiresAt' => date('c', time() + 600),
        ]);
        $repository->rememberInboundMessage([
            'eventId' => 'wa-metrics-inbound-001',
            'providerMessageId' => 'wamid-metrics-inbound-001',
            'conversationId' => (string) ($conversation['id'] ?? 'wa:593981110555'),
            'phone' => '593981110555',
            'text' => 'Quiero reservar consulta con tarjeta',
            'createdAt' => \local_date('c'),
        ]);
        $repository->enqueueOutbox([
            'conversationId' => (string) ($conversation['id'] ?? 'wa:593981110555'),
            'phone' => '593981110555',
            'type' => 'text',
            'text' => 'Tu checkout sigue pendiente',
        ]);
        $repository->enqueueOutbox([
            'conversationId' => (string) ($conversation['id'] ?? 'wa:593981110555'),
            'phone' => '593981110555',
            'type' => 'text',
            'text' => 'No pude entregar este mensaje',
            'status' => 'failed',
        ]);
        $repository->touchBridgeStatus('inbound');

        ob_start();
        \SystemController::metrics(['store' => \read_store()]);
        $output = (string) ob_get_clean();

        $this->assertStringContainsString('pielarmonia_whatsapp_openclaw_mode{mode="live"} 1', $output);
        $this->assertStringContainsString('pielarmonia_whatsapp_bridge_mode{mode="online"} 1', $output);
        $this->assertStringContainsString('pielarmonia_whatsapp_outbox_pending_total 1', $output);
        $this->assertStringContainsString('pielarmonia_whatsapp_conversations_active_total 1', $output);
        $this->assertStringContainsString('pielarmonia_whatsapp_slot_holds_alive_total 1', $output);
        $this->assertStringContainsString('pielarmonia_whatsapp_bookings_closed_total 1', $output);
        $this->assertStringContainsString('pielarmonia_whatsapp_payments_started_total 1', $output);
        $this->assertStringContainsString('pielarmonia_whatsapp_payments_completed_total 1', $output);
        $this->assertStringContainsString('pielarmonia_whatsapp_delivery_failures_total 1', $output);
        $this->assertStringContainsString('pielarmonia_whatsapp_automation_success_rate 1', $output);
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $entries = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($entries as $entry) {
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }

        @rmdir($dir);
    }
}
