<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../tests/helpers/StripeMock.php';

/**
 * @runInSeparateProcess
 */
final class WhatsappOpenclawControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS']);
        $_GET = [];
        $_POST = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'wa-openclaw-' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED=true');
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_MODE=live');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN=test-wa-bridge-token');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_HEADER=Authorization');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_PREFIX=Bearer');
        putenv('PIELARMONIA_WHATSAPP_BRIDGE_STALE_AFTER_SECONDS=900');
        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_mock');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_test_mock');
        putenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET=whsec_mock');
        putenv('PIELARMONIA_WHATSAPP_PAYMENT_CANCEL_URL=https://pielarmonia.test/reservar');
        putenv('PIELARMONIA_WHATSAPP_PAYMENT_SUCCESS_URL=https://pielarmonia.test/gracias');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../payment-lib.php';
        require_once __DIR__ . '/../../controllers/HealthController.php';
        require_once __DIR__ . '/../../controllers/PaymentController.php';
        require_once __DIR__ . '/../../controllers/WhatsappOpenclawController.php';

        $date = date('Y-m-d', strtotime('+2 days'));
        $store = read_store();
        $store['appointments'] = [];
        $store['callbacks'] = [];
        $store['reviews'] = [];
        $store['availability'] = [
            $date => ['10:00', '10:30', '11:00'],
        ];
        write_store($store, false);
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
            'PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_HEADER',
            'PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_PREFIX',
            'PIELARMONIA_WHATSAPP_BRIDGE_STALE_AFTER_SECONDS',
            'PIELARMONIA_STRIPE_SECRET_KEY',
            'PIELARMONIA_STRIPE_PUBLISHABLE_KEY',
            'PIELARMONIA_STRIPE_WEBHOOK_SECRET',
            'PIELARMONIA_WHATSAPP_PAYMENT_CANCEL_URL',
            'PIELARMONIA_WHATSAPP_PAYMENT_SUCCESS_URL',
        ] as $key) {
            putenv($key);
        }

        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RAW_BODY'], $GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS']);
        $_GET = [];
        $_POST = [];
        $_SERVER = [];

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testInboundQueuesReplyBooksCashAppointmentAndUpdatesHealth(): void
    {
        $date = date('Y-m-d', strtotime('+2 days'));
        $payload = [
            'eventId' => 'evt-001',
            'providerMessageId' => 'wamid-001',
            'phone' => '+593981110123',
            'profileName' => 'Ana Perez',
            'text' => 'Hola, quiero una consulta el ' . $date . ' a las 10:00, soy Ana Perez, mi correo es ana@example.com, autorizo datos y pago en efectivo',
        ];

        $inbound = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::inbound([]),
            'POST',
            $payload,
            ['HTTP_AUTHORIZATION' => 'Bearer test-wa-bridge-token']
        );

        self::assertSame(202, $inbound['status']);
        self::assertTrue((bool) ($inbound['payload']['ok'] ?? false));
        self::assertSame('processed', (string) ($inbound['payload']['status'] ?? ''));
        self::assertSame('booking_cash', (string) ($inbound['payload']['data']['plan']['intent'] ?? ''));
        self::assertSame(1, count($inbound['payload']['data']['queuedOutbox'] ?? []));
        self::assertSame('booked', (string) ($inbound['payload']['data']['draft']['status'] ?? ''));
        self::assertGreaterThan(0, (int) ($inbound['payload']['data']['draft']['appointmentId'] ?? 0));

        $outbox = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::outbox([]),
            'GET',
            null,
            ['HTTP_AUTHORIZATION' => 'Bearer test-wa-bridge-token']
        );

        self::assertSame(200, $outbox['status']);
        self::assertTrue((bool) ($outbox['payload']['ok'] ?? false));
        self::assertSame(1, (int) ($outbox['payload']['data']['count'] ?? 0));
        self::assertStringContainsString('Listo.', (string) ($outbox['payload']['data']['items'][0]['text'] ?? ''));

        $ack = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::ack([]),
            'POST',
            [
                'id' => (string) ($outbox['payload']['data']['items'][0]['id'] ?? ''),
                'status' => 'acked',
                'providerMessageId' => 'wamid-out-001',
            ],
            ['HTTP_AUTHORIZATION' => 'Bearer test-wa-bridge-token']
        );

        self::assertSame(200, $ack['status']);
        self::assertTrue((bool) ($ack['payload']['ok'] ?? false));
        self::assertSame('acked', (string) ($ack['payload']['data']['status'] ?? ''));

        $health = $this->captureResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
            ]);
        });

        self::assertSame(200, $health['status']);
        self::assertTrue((bool) ($health['payload']['ok'] ?? false));
        self::assertSame('live', (string) ($health['payload']['checks']['whatsappOpenclaw']['configuredMode'] ?? ''));
        self::assertSame('online', (string) ($health['payload']['checks']['whatsappOpenclaw']['bridgeMode'] ?? ''));
        self::assertSame(1, (int) ($health['payload']['checks']['whatsappOpenclaw']['bookingsClosed'] ?? 0));
    }

    public function testDuplicateInboundIsIdempotentAndDoesNotDuplicateOutbox(): void
    {
        $date = date('Y-m-d', strtotime('+2 days'));
        $payload = [
            'eventId' => 'evt-duplicate',
            'providerMessageId' => 'wamid-duplicate',
            'phone' => '+593981110999',
            'text' => 'Consulta el ' . $date . ' a las 10:30, soy Maria Gomez, mi correo es maria@example.com, autorizo datos y pago en efectivo',
        ];

        $first = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::inbound([]),
            'POST',
            $payload,
            ['HTTP_AUTHORIZATION' => 'Bearer test-wa-bridge-token']
        );
        $second = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::inbound([]),
            'POST',
            $payload,
            ['HTTP_AUTHORIZATION' => 'Bearer test-wa-bridge-token']
        );

        self::assertSame(202, $first['status']);
        self::assertSame(200, $second['status']);
        self::assertSame('duplicate', (string) ($second['payload']['status'] ?? ''));

        $outbox = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::outbox([]),
            'GET',
            null,
            ['HTTP_AUTHORIZATION' => 'Bearer test-wa-bridge-token']
        );

        self::assertSame(1, (int) ($outbox['payload']['data']['count'] ?? 0));
    }

    public function testCardCheckoutCompletesViaWebhookAndQueuesConfirmation(): void
    {
        $date = date('Y-m-d', strtotime('+2 days'));
        $payload = [
            'eventId' => 'evt-card-001',
            'providerMessageId' => 'wamid-card-001',
            'phone' => '+593981119991',
            'profileName' => 'Lucia Card',
            'text' => 'Hola, quiero una consulta el ' . $date . ' a las 11:00, soy Lucia Card, mi correo es lucia@example.com, autorizo datos y pago con tarjeta',
        ];

        $inbound = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::inbound([]),
            'POST',
            $payload,
            ['HTTP_AUTHORIZATION' => 'Bearer test-wa-bridge-token']
        );

        self::assertSame(202, $inbound['status']);
        self::assertSame('booking_card', (string) ($inbound['payload']['data']['plan']['intent'] ?? ''));
        self::assertSame('awaiting_payment', (string) ($inbound['payload']['data']['draft']['status'] ?? ''));
        self::assertStringStartsWith('cs_mock_', (string) ($inbound['payload']['data']['draft']['paymentSessionId'] ?? ''));
        self::assertStringContainsString(
            'https://checkout.stripe.test/session/',
            (string) ($inbound['payload']['data']['draft']['paymentSessionUrl'] ?? '')
        );

        $GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS']['pi_mock_whatsapp_card_001'] = [
            'amount' => \payment_expected_amount_cents('consulta', $date, '11:00'),
            'amount_received' => \payment_expected_amount_cents('consulta', $date, '11:00'),
            'currency' => strtolower(\payment_currency()),
        ];

        $webhookPayload = [
            'id' => 'evt_stripe_checkout_001',
            'type' => 'checkout.session.completed',
            'data' => [
                'object' => [
                    'id' => (string) ($inbound['payload']['data']['draft']['paymentSessionId'] ?? ''),
                    'payment_status' => 'paid',
                    'payment_intent' => 'pi_mock_whatsapp_card_001',
                    'metadata' => [
                        'source' => 'whatsapp_openclaw',
                        'wa_conversation_id' => (string) ($inbound['payload']['data']['conversation']['id'] ?? ''),
                        'wa_draft_id' => (string) ($inbound['payload']['data']['draft']['id'] ?? ''),
                        'wa_hold_id' => (string) ($inbound['payload']['data']['draft']['holdId'] ?? ''),
                        'wa_phone' => '593981119991',
                    ],
                ],
            ],
        ];

        $webhook = $this->captureResponse(
            static fn () => \PaymentController::webhook([]),
            'POST',
            null,
            ['HTTP_STRIPE_SIGNATURE' => 'valid_signature'],
            json_encode($webhookPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );

        self::assertSame(200, $webhook['status']);
        self::assertTrue((bool) ($webhook['payload']['ok'] ?? false));

        $store = \read_store();
        self::assertCount(1, $store['appointments']);
        self::assertSame('card', (string) ($store['appointments'][0]['paymentMethod'] ?? ''));
        self::assertSame('paid', (string) ($store['appointments'][0]['paymentStatus'] ?? ''));
        self::assertSame('pi_mock_whatsapp_card_001', (string) ($store['appointments'][0]['paymentIntentId'] ?? ''));

        $outbox = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::outbox([]),
            'GET',
            null,
            ['HTTP_AUTHORIZATION' => 'Bearer test-wa-bridge-token']
        );

        self::assertSame(2, (int) ($outbox['payload']['data']['count'] ?? 0));
        $texts = array_map(
            static fn (array $item): string => (string) ($item['text'] ?? ''),
            is_array($outbox['payload']['data']['items'] ?? null) ? $outbox['payload']['data']['items'] : []
        );
        self::assertTrue($this->arrayContainsSubstring($texts, 'Completa el pago seguro aqui:'));
        self::assertTrue($this->arrayContainsSubstring($texts, 'Pago confirmado con tarjeta.'));

        $health = $this->captureResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
            ]);
        });

        self::assertSame(1, (int) ($health['payload']['checks']['whatsappOpenclaw']['paymentsStarted'] ?? 0));
        self::assertSame(1, (int) ($health['payload']['checks']['whatsappOpenclaw']['paymentsCompleted'] ?? 0));
        self::assertSame(1, (int) ($health['payload']['checks']['whatsappOpenclaw']['bookingsClosed'] ?? 0));
    }

    public function testOpsSnapshotIncludesActionableQueuesAndHolds(): void
    {
        $date = date('Y-m-d', strtotime('+2 days'));
        $repository = \whatsapp_openclaw_repository();

        $conversation = $repository->saveConversation([
            'id' => 'wa:593981110777',
            'phone' => '593981110777',
            'status' => 'awaiting_payment',
        ]);
        $hold = $repository->saveSlotHold([
            'conversationId' => $conversation['id'],
            'phone' => '593981110777',
            'doctor' => 'rosero',
            'doctorRequested' => 'rosero',
            'service' => 'consulta',
            'date' => $date,
            'time' => '11:00',
            'paymentMethod' => 'card',
            'ttlSeconds' => 900,
            'status' => 'active',
            'expiresAt' => date('c', time() + 900),
        ]);
        $repository->saveBookingDraft([
            'conversationId' => $conversation['id'],
            'phone' => '593981110777',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => $date,
            'time' => '11:00',
            'name' => 'Ops Snapshot',
            'email' => 'snapshot@example.com',
            'status' => 'awaiting_payment',
            'holdId' => (string) ($hold['id'] ?? ''),
            'paymentMethod' => 'card',
            'paymentStatus' => 'checkout_pending',
            'paymentSessionId' => 'cs_ops_snapshot_001',
            'paymentSessionUrl' => 'https://checkout.stripe.test/session/cs_ops_snapshot_001',
        ]);
        $repository->enqueueOutbox([
            'conversationId' => $conversation['id'],
            'phone' => '593981110777',
            'type' => 'text',
            'text' => 'Mensaje fallido',
            'status' => 'failed',
            'error' => 'bridge_down',
        ]);
        $repository->enqueueOutbox([
            'conversationId' => $conversation['id'],
            'phone' => '593981110777',
            'type' => 'text',
            'text' => 'Mensaje pendiente',
            'status' => 'pending',
        ]);
        $repository->touchBridgeStatus('inbound');

        $response = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::ops([
                'isAdmin' => true,
                'store' => \read_store(),
            ])
        );

        self::assertSame(200, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));
        self::assertSame(1, count($response['payload']['data']['pendingCheckouts'] ?? []));
        self::assertSame('cs_ops_snapshot_001', (string) ($response['payload']['data']['pendingCheckouts'][0]['paymentSessionId'] ?? ''));
        self::assertSame(1, count($response['payload']['data']['activeHolds'] ?? []));
        self::assertSame(1, count($response['payload']['data']['failedOutboxItems'] ?? []));
        self::assertSame('failed', (string) ($response['payload']['data']['failedOutboxItems'][0]['status'] ?? ''));
        self::assertSame(1, count($response['payload']['data']['pendingOutboxItems'] ?? []));
    }

    public function testOpsCanRequeueFailedOutboxRecord(): void
    {
        $repository = \whatsapp_openclaw_repository();
        $record = $repository->enqueueOutbox([
            'conversationId' => 'wa:593981110888',
            'phone' => '593981110888',
            'type' => 'text',
            'text' => 'Reintentar',
            'status' => 'failed',
            'error' => 'delivery_timeout',
        ]);

        $this->enableAdminCsrf();
        $response = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::ops([
                'isAdmin' => true,
                'store' => \read_store(),
            ]),
            'POST',
            [
                'action' => 'requeue_outbox',
                'id' => (string) ($record['id'] ?? ''),
            ]
        );

        self::assertSame(200, $response['status']);
        self::assertSame('requeued', (string) ($response['payload']['data']['status'] ?? ''));

        $updated = $repository->getOutboxRecord((string) ($record['id'] ?? ''));
        self::assertSame('pending', (string) ($updated['status'] ?? ''));
        self::assertSame('', (string) ($updated['error'] ?? ''));
        self::assertSame(1, (int) ($updated['requeueCount'] ?? 0));
    }

    public function testOpsCanExpireCheckoutManually(): void
    {
        $date = date('Y-m-d', strtotime('+2 days'));
        $payload = [
            'eventId' => 'evt-card-ops-expire',
            'providerMessageId' => 'wamid-card-ops-expire',
            'phone' => '+593981119001',
            'profileName' => 'Manual Expire',
            'text' => 'Hola, quiero una consulta el ' . $date . ' a las 11:00, soy Manual Expire, mi correo es manual@example.com, autorizo datos y pago con tarjeta',
        ];

        $inbound = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::inbound([]),
            'POST',
            $payload,
            ['HTTP_AUTHORIZATION' => 'Bearer test-wa-bridge-token']
        );

        $conversationId = (string) ($inbound['payload']['data']['conversation']['id'] ?? '');
        $phone = '593981119001';

        $this->enableAdminCsrf();
        $ops = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::ops([
                'isAdmin' => true,
                'store' => \read_store(),
            ]),
            'POST',
            [
                'action' => 'expire_checkout',
                'conversationId' => $conversationId,
            ]
        );

        self::assertSame(200, $ops['status']);
        self::assertSame('expired', (string) ($ops['payload']['data']['status'] ?? ''));

        $draft = \whatsapp_openclaw_repository()->getBookingDraft($conversationId, $phone);
        $hold = \whatsapp_openclaw_repository()->getSlotHold((string) ($draft['holdId'] ?? ''));
        self::assertSame('checkout_expired', (string) ($draft['status'] ?? ''));
        self::assertSame('checkout_expired', (string) ($draft['paymentStatus'] ?? ''));
        self::assertSame('released', (string) ($hold['status'] ?? ''));

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        $texts = array_map(
            static fn (array $item): string => (string) ($item['text'] ?? ''),
            $outbox
        );
        self::assertSame(2, count($outbox));
        self::assertTrue($this->arrayContainsSubstring($texts, 'El enlace de pago expiro'));
    }

    public function testOpsSweepStaleExpiresOnlyDraftsWithInactiveHold(): void
    {
        $date = date('Y-m-d', strtotime('+2 days'));
        $repository = \whatsapp_openclaw_repository();

        $staleConversation = $repository->saveConversation([
            'id' => 'wa:593981119111',
            'phone' => '593981119111',
            'status' => 'awaiting_payment',
        ]);
        $staleHold = $repository->saveSlotHold([
            'conversationId' => $staleConversation['id'],
            'phone' => '593981119111',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'date' => $date,
            'time' => '10:00',
            'paymentMethod' => 'card',
            'ttlSeconds' => 900,
            'status' => 'active',
            'expiresAt' => date('c', time() - 120),
        ]);
        $repository->saveBookingDraft([
            'conversationId' => $staleConversation['id'],
            'phone' => '593981119111',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => $date,
            'time' => '10:00',
            'status' => 'awaiting_payment',
            'holdId' => (string) ($staleHold['id'] ?? ''),
            'paymentMethod' => 'card',
            'paymentStatus' => 'checkout_pending',
            'paymentSessionId' => 'cs_ops_stale_001',
            'paymentSessionUrl' => 'https://checkout.stripe.test/session/cs_ops_stale_001',
        ]);

        $activeConversation = $repository->saveConversation([
            'id' => 'wa:593981119222',
            'phone' => '593981119222',
            'status' => 'awaiting_payment',
        ]);
        $activeHold = $repository->saveSlotHold([
            'conversationId' => $activeConversation['id'],
            'phone' => '593981119222',
            'doctor' => 'narvaez',
            'service' => 'consulta',
            'date' => $date,
            'time' => '10:30',
            'paymentMethod' => 'card',
            'ttlSeconds' => 900,
            'status' => 'active',
            'expiresAt' => date('c', time() + 900),
        ]);
        $repository->saveBookingDraft([
            'conversationId' => $activeConversation['id'],
            'phone' => '593981119222',
            'service' => 'consulta',
            'doctor' => 'narvaez',
            'date' => $date,
            'time' => '10:30',
            'status' => 'awaiting_payment',
            'holdId' => (string) ($activeHold['id'] ?? ''),
            'paymentMethod' => 'card',
            'paymentStatus' => 'checkout_pending',
            'paymentSessionId' => 'cs_ops_stale_002',
            'paymentSessionUrl' => 'https://checkout.stripe.test/session/cs_ops_stale_002',
        ]);

        $this->enableAdminCsrf();
        $response = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::ops([
                'isAdmin' => true,
                'store' => \read_store(),
            ]),
            'POST',
            [
                'action' => 'sweep_stale',
                'limit' => 10,
            ]
        );

        self::assertSame(200, $response['status']);
        self::assertSame('swept', (string) ($response['payload']['data']['status'] ?? ''));
        self::assertSame(1, (int) ($response['payload']['data']['expiredCount'] ?? 0));
        self::assertSame(1, (int) ($response['payload']['data']['expiredHolds'] ?? 0));
        self::assertSame(1, count($response['payload']['data']['items'] ?? []));

        $staleDraft = $repository->getBookingDraft($staleConversation['id'], '593981119111');
        $freshDraft = $repository->getBookingDraft($activeConversation['id'], '593981119222');
        $staleHoldAfter = $repository->getSlotHold((string) ($staleDraft['holdId'] ?? ''));

        self::assertSame('checkout_expired', (string) ($staleDraft['status'] ?? ''));
        self::assertSame('awaiting_payment', (string) ($freshDraft['status'] ?? ''));
        self::assertSame('expired', (string) ($staleHoldAfter['status'] ?? ''));
    }

    public function testOpsCanReleaseNonCardHoldAndNotify(): void
    {
        $date = date('Y-m-d', strtotime('+2 days'));
        $repository = \whatsapp_openclaw_repository();

        $conversation = $repository->saveConversation([
            'id' => 'wa:593981119333',
            'phone' => '593981119333',
            'status' => 'active',
        ]);
        $hold = $repository->saveSlotHold([
            'conversationId' => $conversation['id'],
            'phone' => '593981119333',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'date' => $date,
            'time' => '09:30',
            'paymentMethod' => 'cash',
            'ttlSeconds' => 900,
            'status' => 'active',
            'expiresAt' => date('c', time() + 900),
        ]);
        $repository->saveBookingDraft([
            'conversationId' => $conversation['id'],
            'phone' => '593981119333',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => $date,
            'time' => '09:30',
            'status' => 'collecting',
            'holdId' => (string) ($hold['id'] ?? ''),
            'paymentMethod' => 'cash',
        ]);

        $this->enableAdminCsrf();
        $response = $this->captureResponse(
            static fn () => \WhatsappOpenclawController::ops([
                'isAdmin' => true,
                'store' => \read_store(),
            ]),
            'POST',
            [
                'action' => 'release_hold',
                'holdId' => (string) ($hold['id'] ?? ''),
                'reason' => 'manual_cleanup',
                'notify' => true,
            ]
        );

        self::assertSame(200, $response['status']);
        self::assertSame('released', (string) ($response['payload']['data']['status'] ?? ''));

        $holdAfter = $repository->getSlotHold((string) ($hold['id'] ?? ''));
        $draftAfter = $repository->getBookingDraft($conversation['id'], '593981119333');
        $outbox = $repository->listPendingOutbox(10);
        $texts = array_map(
            static fn (array $item): string => (string) ($item['text'] ?? ''),
            $outbox
        );

        self::assertSame('released', (string) ($holdAfter['status'] ?? ''));
        self::assertSame('collecting', (string) ($draftAfter['status'] ?? ''));
        self::assertTrue($this->arrayContainsSubstring($texts, 'Liberé el horario temporal'));
    }

    /**
     * @param callable():void $callable
     * @param array<string,mixed>|null $body
     * @param array<string,string> $serverOverrides
     * @return array{payload:array<string,mixed>,status:int}
     */
    private function captureResponse(
        callable $callable,
        string $method = 'GET',
        ?array $body = null,
        array $serverOverrides = [],
        ?string $rawBody = null
    ): array
    {
        $_SERVER['REQUEST_METHOD'] = strtoupper($method);
        foreach ($serverOverrides as $key => $value) {
            $_SERVER[$key] = $value;
        }

        if ($body !== null) {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }

        if ($rawBody !== null) {
            $GLOBALS['__TEST_RAW_BODY'] = $rawBody;
        } else {
            unset($GLOBALS['__TEST_RAW_BODY']);
        }

        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => is_array($exception->payload) ? $exception->payload : [],
                'status' => (int) $exception->status,
            ];
        }
    }

    /**
     * @param list<string> $items
     */
    private function arrayContainsSubstring(array $items, string $needle): bool
    {
        foreach ($items as $item) {
            if (strpos($item, $needle) !== false) {
                return true;
            }
        }

        return false;
    }

    private function enableAdminCsrf(): void
    {
        $_SESSION = is_array($_SESSION ?? null) ? $_SESSION : [];
        $_SESSION['csrf_token'] = 'csrf-wa-ops';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-wa-ops';
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
