<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class AdminAgentControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SESSION = [];
        $_SERVER = [
            'REMOTE_ADDR' => '127.0.0.1',
            'REQUEST_METHOD' => 'GET',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'admin-agent-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_ADMIN_AGENT_EXTERNAL_ALLOWLIST=whatsapp,email');
        putenv('PIELARMONIA_ADMIN_AGENT_EXTERNAL_TEMPLATE_ALLOWLIST=seguimiento_callback,seguimiento_operativo');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/AdminAgentController.php';

        \ensure_data_file();
        $availabilityDayOne = date('Y-m-d', strtotime('+2 day'));
        $availabilityDayTwo = date('Y-m-d', strtotime('+4 day'));
        $this->seedStore([
            'callbacks' => [
                [
                    'id' => 901,
                    'telefono' => '+593981110901',
                    'preferencia' => 'seguimiento botox',
                    'fecha' => gmdate('c', time() - 3600),
                    'status' => 'pending',
                ],
                [
                    'id' => 902,
                    'telefono' => '+593981110902',
                    'preferencia' => 'agenda acne',
                    'fecha' => gmdate('c', time() - 1800),
                    'status' => 'pending',
                ],
            ],
            'appointments' => [
                [
                    'id' => 701,
                    'name' => 'Ana Test',
                    'date' => gmdate('Y-m-d', strtotime('+1 day')),
                    'time' => '10:00',
                    'status' => 'confirmed',
                    'paymentStatus' => 'pending_transfer_review',
                ],
            ],
            'reviews' => [
                [
                    'id' => 801,
                    'name' => 'Paciente Feliz',
                    'rating' => 5,
                    'comment' => 'Muy buena atención',
                    'createdAt' => date('c'),
                ],
                [
                    'id' => 802,
                    'name' => 'Paciente Inquieto',
                    'rating' => 2,
                    'comment' => 'La espera fue larga',
                    'createdAt' => date('c', strtotime('-2 day')),
                ],
                [
                    'id' => 803,
                    'name' => 'Paciente Antiguo',
                    'rating' => 4,
                    'comment' => 'Todo bien',
                    'createdAt' => date('c', strtotime('-45 day')),
                ],
            ],
            'availability' => [
                $availabilityDayOne => ['09:00', '10:30', '16:00'],
                $availabilityDayTwo => ['11:15'],
            ],
            'queue_tickets' => [
                [
                    'id' => 501,
                    'ticketCode' => 'A-501',
                    'queueType' => 'appointment',
                    'patientInitials' => 'EP',
                    'priorityClass' => 'appt_overdue',
                    'status' => 'waiting',
                    'assignedConsultorio' => null,
                    'createdAt' => date('c', strtotime('-35 minute')),
                ],
                [
                    'id' => 502,
                    'ticketCode' => 'W-502',
                    'queueType' => 'walk_in',
                    'patientInitials' => 'JP',
                    'priorityClass' => 'walk_in',
                    'status' => 'waiting',
                    'assignedConsultorio' => null,
                    'createdAt' => date('c', strtotime('-10 minute')),
                ],
            ],
            'queue_help_requests' => [
                [
                    'id' => 601,
                    'ticketId' => 501,
                    'ticketCode' => 'A-501',
                    'patientInitials' => 'EP',
                    'reason' => 'special_priority',
                    'status' => 'pending',
                    'source' => 'ops',
                    'createdAt' => date('c', strtotime('-8 minute')),
                    'updatedAt' => date('c', strtotime('-8 minute')),
                ],
            ],
        ]);
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        putenv('PIELARMONIA_ADMIN_AGENT_EXTERNAL_ALLOWLIST');
        putenv('PIELARMONIA_ADMIN_AGENT_EXTERNAL_TEMPLATE_ALLOWLIST');
        putenv('PIELARMONIA_ADMIN_AGENT_RELAY_MOCK_RESPONSE');
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SESSION = [];
        $_SERVER = [];

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testSessionStartAndTurnReturnCallbacksSummaryInDegradedMode(): void
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'context' => [
                'section' => 'callbacks',
                'selectedEntity' => [
                    'type' => 'callback',
                    'id' => 901,
                    'label' => 'Lead 901',
                ],
            ],
        ], JSON_UNESCAPED_UNICODE);

        $start = $this->captureResponse(static function (): void {
            \AdminAgentController::start([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(201, $start['status']);
        self::assertTrue((bool) ($start['payload']['ok'] ?? false));
        $sessionId = (string) ($start['payload']['data']['session']['sessionId'] ?? '');
        self::assertNotSame('', $sessionId);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $sessionId,
            'message' => 'Resume los callbacks pendientes',
            'context' => [
                'section' => 'callbacks',
            ],
        ], JSON_UNESCAPED_UNICODE);

        $turn = $this->captureResponse(static function (): void {
            \AdminAgentController::turn([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $turn['status']);
        self::assertTrue((bool) ($turn['payload']['ok'] ?? false));
        self::assertSame(
            'callbacks.list',
            (string) ($turn['payload']['data']['turn']['toolPlan'][0]['tool'] ?? '')
        );
        self::assertSame(
            'completed',
            (string) ($turn['payload']['data']['session']['toolCalls'][0]['status'] ?? '')
        );
        self::assertSame(
            'disabled',
            (string) ($turn['payload']['data']['session']['health']['relay']['mode'] ?? '')
        );
        self::assertStringContainsString(
            'Operando en modo degradado',
            (string) ($turn['payload']['data']['turn']['finalAnswer'] ?? '')
        );
    }

    public function testInternalMutationPersistsAndExternalActionNeedsApproval(): void
    {
        $sessionId = $this->startCallbacksSession(902);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $sessionId,
            'message' => 'Marca como sin respuesta el 902',
            'context' => [
                'section' => 'callbacks',
                'selectedEntity' => [
                    'type' => 'callback',
                    'id' => 902,
                    'label' => 'Lead 902',
                ],
            ],
        ], JSON_UNESCAPED_UNICODE);

        $internalTurn = $this->captureResponse(static function (): void {
            \AdminAgentController::turn([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $internalTurn['status']);
        self::assertTrue((bool) ($internalTurn['payload']['data']['refreshRecommended'] ?? false));
        self::assertSame(
            'callbacks.set_outcome',
            (string) ($internalTurn['payload']['data']['turn']['toolPlan'][0]['tool'] ?? '')
        );

        $store = \read_store();
        self::assertSame(
            'sin_respuesta',
            (string) ($store['callbacks'][1]['leadOps']['outcome'] ?? '')
        );

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $sessionId,
            'message' => 'Manda un whatsapp al 902 para seguimiento',
            'context' => [
                'section' => 'callbacks',
                'selectedEntity' => [
                    'type' => 'callback',
                    'id' => 902,
                    'label' => 'Lead 902',
                ],
            ],
        ], JSON_UNESCAPED_UNICODE);

        $externalTurn = $this->captureResponse(static function (): void {
            \AdminAgentController::turn([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $externalTurn['status']);
        self::assertTrue((bool) ($externalTurn['payload']['data']['turn']['requiresApproval'] ?? false));
        self::assertSame(
            'waiting_approval',
            (string) ($externalTurn['payload']['data']['session']['toolCalls'][1]['status'] ?? '')
        );

        $approvalId = (string) ($externalTurn['payload']['data']['session']['approvals'][0]['approvalId'] ?? '');
        self::assertNotSame('', $approvalId);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $sessionId,
            'approvalId' => $approvalId,
        ], JSON_UNESCAPED_UNICODE);

        $approve = $this->captureResponse(static function (): void {
            \AdminAgentController::approve([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $approve['status']);
        self::assertSame(
            'completed',
            (string) ($approve['payload']['data']['toolCall']['status'] ?? '')
        );
        self::assertSame(
            'queued',
            (string) ($approve['payload']['data']['toolCall']['result']['outbox']['status'] ?? '')
        );
        self::assertContains(
            'agent.external_dispatched',
            array_map(
                static fn (array $event): string => (string) ($event['event'] ?? ''),
                $approve['payload']['data']['session']['events'] ?? []
            )
        );

        $_GET = ['sessionId' => $sessionId];
        $status = $this->captureResponse(static function (): void {
            \AdminAgentController::status([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'GET');

        self::assertSame(200, $status['status']);
        self::assertSame(
            'whatsapp',
            (string) ($status['payload']['data']['outbox'][0]['channel'] ?? '')
        );
        self::assertSame(
            'seguimiento_callback',
            (string) ($status['payload']['data']['outbox'][0]['template'] ?? '')
        );
        self::assertSame(
            1,
            (int) ($status['payload']['data']['health']['counts']['outboxQueued'] ?? 0)
        );

        $_GET = ['sessionId' => $sessionId];
        $events = $this->captureResponse(static function (): void {
            \AdminAgentController::events([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'GET');

        self::assertSame(200, $events['status']);
        self::assertSame(
            $sessionId,
            (string) ($events['payload']['data']['session']['sessionId'] ?? '')
        );
        self::assertSame(
            'queued',
            (string) ($events['payload']['data']['outbox'][0]['status'] ?? '')
        );
        self::assertNotSame(
            '',
            (string) ($events['payload']['data']['syncAt'] ?? '')
        );
    }

    public function testRestrictedPaymentIntentIsBlocked(): void
    {
        $sessionId = $this->startCallbacksSession(901);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $sessionId,
            'message' => 'Cobra la tarjeta del paciente',
            'context' => [
                'section' => 'appointments',
            ],
        ], JSON_UNESCAPED_UNICODE);

        $turn = $this->captureResponse(static function (): void {
            \AdminAgentController::turn([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $turn['status']);
        self::assertSame(
            'blocked',
            (string) ($turn['payload']['data']['turn']['status'] ?? '')
        );
        self::assertSame(
            'restricted.payments.update',
            (string) ($turn['payload']['data']['turn']['toolPlan'][0]['tool'] ?? '')
        );
        self::assertSame(
            'blocked',
            (string) ($turn['payload']['data']['session']['toolCalls'][0]['status'] ?? '')
        );
        self::assertStringContainsString(
            'bloquee',
            strtolower((string) ($turn['payload']['data']['turn']['finalAnswer'] ?? ''))
        );
    }

    public function testReviewsAndAvailabilityToolsReturnExpectedPlans(): void
    {
        $reviewsSessionId = $this->startAgentSession([
            'section' => 'reviews',
            'selectedEntity' => [
                'type' => 'review',
                'id' => 802,
                'label' => 'Review 802',
            ],
        ]);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $reviewsSessionId,
            'message' => 'Resume las reseñas negativas recientes',
            'context' => [
                'section' => 'reviews',
            ],
        ], JSON_UNESCAPED_UNICODE);

        $reviewsTurn = $this->captureResponse(static function (): void {
            \AdminAgentController::turn([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $reviewsTurn['status']);
        self::assertSame(
            'reviews.summary',
            (string) ($reviewsTurn['payload']['data']['turn']['toolPlan'][0]['tool'] ?? '')
        );
        self::assertSame(
            'reviews.list',
            (string) ($reviewsTurn['payload']['data']['turn']['toolPlan'][1]['tool'] ?? '')
        );
        self::assertSame(
            'completed',
            (string) ($reviewsTurn['payload']['data']['session']['toolCalls'][1]['status'] ?? '')
        );

        $availabilityDate = date('Y-m-d', strtotime('+2 day'));
        $availabilitySessionId = $this->startAgentSession([
            'section' => 'availability',
            'selectedEntity' => [
                'type' => 'availability_day',
                'id' => 0,
                'label' => $availabilityDate,
            ],
        ]);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $availabilitySessionId,
            'message' => 'Revisa horarios del ' . $availabilityDate,
            'context' => [
                'section' => 'availability',
                'selectedEntity' => [
                    'type' => 'availability_day',
                    'id' => 0,
                    'label' => $availabilityDate,
                ],
            ],
        ], JSON_UNESCAPED_UNICODE);

        $availabilityTurn = $this->captureResponse(static function (): void {
            \AdminAgentController::turn([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $availabilityTurn['status']);
        self::assertSame(
            'ui.select_availability_date',
            (string) ($availabilityTurn['payload']['data']['turn']['toolPlan'][0]['tool'] ?? '')
        );
        self::assertSame(
            'availability.day_summary',
            (string) ($availabilityTurn['payload']['data']['turn']['toolPlan'][1]['tool'] ?? '')
        );
        self::assertSame(
            'ui.select_availability_date',
            (string) ($availabilityTurn['payload']['data']['clientActions'][0]['tool'] ?? '')
        );
        self::assertSame(
            $availabilityDate,
            (string) ($availabilityTurn['payload']['data']['session']['toolCalls'][1]['result']['date'] ?? '')
        );
    }

    public function testQueueSummaryFilterAndCallNextAreAudited(): void
    {
        $sessionId = $this->startAgentSession([
            'section' => 'queue',
            'selectedEntity' => [
                'type' => 'queue_ticket',
                'id' => 501,
                'label' => 'A-501',
            ],
        ]);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $sessionId,
            'message' => 'Resume el turnero actual',
            'context' => [
                'section' => 'queue',
            ],
        ], JSON_UNESCAPED_UNICODE);

        $summaryTurn = $this->captureResponse(static function (): void {
            \AdminAgentController::turn([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $summaryTurn['status']);
        self::assertSame(
            'queue.summary',
            (string) ($summaryTurn['payload']['data']['turn']['toolPlan'][0]['tool'] ?? '')
        );
        self::assertStringContainsString(
            'Turnero',
            (string) ($summaryTurn['payload']['data']['session']['toolCalls'][0]['result']['summary'] ?? '')
        );

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $sessionId,
            'message' => 'riesgo SLA del turnero',
            'context' => [
                'section' => 'queue',
            ],
        ], JSON_UNESCAPED_UNICODE);

        $filterTurn = $this->captureResponse(static function (): void {
            \AdminAgentController::turn([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $filterTurn['status']);
        self::assertSame(
            'ui.set_section_filter',
            (string) ($filterTurn['payload']['data']['turn']['toolPlan'][0]['tool'] ?? '')
        );
        self::assertSame(
            'queue.list_tickets',
            (string) ($filterTurn['payload']['data']['turn']['toolPlan'][1]['tool'] ?? '')
        );
        self::assertSame(
            'ui.set_section_filter',
            (string) ($filterTurn['payload']['data']['clientActions'][0]['tool'] ?? '')
        );

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $sessionId,
            'message' => 'Llama el siguiente turno en C1',
            'context' => [
                'section' => 'queue',
            ],
        ], JSON_UNESCAPED_UNICODE);

        $callTurn = $this->captureResponse(static function (): void {
            \AdminAgentController::turn([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $callTurn['status']);
        self::assertTrue((bool) ($callTurn['payload']['data']['turn']['requiresApproval'] ?? false));
        self::assertSame(
            'queue.call_next',
            (string) ($callTurn['payload']['data']['turn']['toolPlan'][0]['tool'] ?? '')
        );

        $approvalId = (string) ($callTurn['payload']['data']['session']['approvals'][0]['approvalId'] ?? '');
        self::assertNotSame('', $approvalId);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'sessionId' => $sessionId,
            'approvalId' => $approvalId,
        ], JSON_UNESCAPED_UNICODE);

        $approve = $this->captureResponse(static function (): void {
            \AdminAgentController::approve([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        self::assertSame(200, $approve['status']);
        self::assertSame(
            'completed',
            (string) ($approve['payload']['data']['toolCall']['status'] ?? '')
        );
        self::assertSame(
            'A-501',
            (string) ($approve['payload']['data']['toolCall']['result']['ticket']['ticketCode'] ?? '')
        );

        $store = \read_store();
        $calledTickets = array_values(array_filter(
            $store['queue_tickets'] ?? [],
            static fn (array $ticket): bool => (int) ($ticket['id'] ?? 0) === 501
        ));
        self::assertSame('called', (string) ($calledTickets[0]['status'] ?? ''));
        self::assertContains(
            'agent.approval_granted',
            array_map(
                static fn (array $event): string => (string) ($event['event'] ?? ''),
                $approve['payload']['data']['session']['events'] ?? []
            )
        );
    }

    private function startCallbacksSession(int $callbackId): string
    {
        return $this->startAgentSession([
            'section' => 'callbacks',
            'selectedEntity' => [
                'type' => 'callback',
                'id' => $callbackId,
                'label' => 'Lead ' . $callbackId,
            ],
        ]);
    }

    /**
     * @param array<string,mixed> $context
     */
    private function startAgentSession(array $context): string
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'context' => $context,
        ], JSON_UNESCAPED_UNICODE);

        $start = $this->captureResponse(static function (): void {
            \AdminAgentController::start([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        }, 'POST');

        return (string) ($start['payload']['data']['session']['sessionId'] ?? '');
    }

    /**
     * @param array<string,mixed> $partialStore
     */
    private function seedStore(array $partialStore): void
    {
        $store = \read_store();
        $store['callbacks'] = isset($partialStore['callbacks']) && is_array($partialStore['callbacks'])
            ? $partialStore['callbacks']
            : [];
        $store['appointments'] = isset($partialStore['appointments']) && is_array($partialStore['appointments'])
            ? $partialStore['appointments']
            : [];
        $store['reviews'] = isset($partialStore['reviews']) && is_array($partialStore['reviews'])
            ? $partialStore['reviews']
            : [];
        $store['availability'] = isset($partialStore['availability']) && is_array($partialStore['availability'])
            ? $partialStore['availability']
            : [];
        $store['queue_tickets'] = isset($partialStore['queue_tickets']) && is_array($partialStore['queue_tickets'])
            ? $partialStore['queue_tickets']
            : [];
        $store['queue_help_requests'] = isset($partialStore['queue_help_requests']) && is_array($partialStore['queue_help_requests'])
            ? $partialStore['queue_help_requests']
            : [];
        \write_store($store, false);
    }

    /**
     * @param callable():void $callable
     * @return array{payload:array<string,mixed>,status:int}
     */
    private function captureResponse(callable $callable, string $method = 'GET'): array
    {
        $_SERVER['REQUEST_METHOD'] = strtoupper($method);

        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $e) {
            return [
                'payload' => is_array($e->payload) ? $e->payload : [],
                'status' => (int) $e->status,
            ];
        } finally {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }
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
