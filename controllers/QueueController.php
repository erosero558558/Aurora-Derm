<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/QueueService.php';
require_once __DIR__ . '/../lib/QueueSurfaceStatusStore.php';
require_once __DIR__ . '/../lib/TicketPrinter.php';

class QueueController
{
    public static function state(array $context): void
    {
        $service = new QueueService();
        $state = $service->getQueueState($context['store'] ?? []);
        json_response([
            'ok' => true,
            'data' => $state['data'] ?? [],
        ]);
    }

    public static function checkin(array $context): void
    {
        $payload = require_json_body();
        $service = new QueueService();

        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->checkInAppointment($store, $payload, 'kiosk');
        });

        if (($result['ok'] ?? false) !== true) {
            self::emitError($result);
        }

        $ticket = is_array($result['ticket'] ?? null) ? $result['ticket'] : [];
        $print = TicketPrinter::fromEnv()->printQueueTicket($ticket);

        json_response([
            'ok' => true,
            'data' => $ticket,
            'replay' => (bool) ($result['replay'] ?? false),
            'printed' => (bool) ($print['printed'] ?? false),
            'print' => [
                'ok' => (bool) ($print['ok'] ?? false),
                'errorCode' => (string) ($print['errorCode'] ?? ''),
                'message' => (string) ($print['message'] ?? ''),
            ],
        ], (bool) ($result['replay'] ?? false) ? 200 : 201);
    }

    public static function ticket(array $context): void
    {
        $payload = require_json_body();
        $service = new QueueService();

        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->createWalkInTicket($store, $payload, 'kiosk');
        });

        if (($result['ok'] ?? false) !== true) {
            self::emitError($result);
        }

        $ticket = is_array($result['ticket'] ?? null) ? $result['ticket'] : [];
        $print = TicketPrinter::fromEnv()->printQueueTicket($ticket);

        json_response([
            'ok' => true,
            'data' => $ticket,
            'printed' => (bool) ($print['printed'] ?? false),
            'print' => [
                'ok' => (bool) ($print['ok'] ?? false),
                'errorCode' => (string) ($print['errorCode'] ?? ''),
                'message' => (string) ($print['message'] ?? ''),
            ],
        ], 201);
    }

    public static function callNext(array $context): void
    {
        $payload = require_json_body();
        $consultorio = isset($payload['consultorio']) ? (int) $payload['consultorio'] : (isset($payload['room']) ? (int) $payload['room'] : 0);
        $service = new QueueService();

        $result = self::mutateStore(static function (array $store) use ($service, $consultorio): array {
            return $service->callNext($store, $consultorio);
        });

        if (($result['ok'] ?? false) !== true) {
            self::emitError($result);
        }

        $state = $service->getQueueState($result['store'] ?? []);
        json_response([
            'ok' => true,
            'data' => [
                'ticket' => $result['ticket'] ?? null,
                'queueState' => $state['data'] ?? [],
            ],
        ]);
    }

    public static function patchTicket(array $context): void
    {
        $payload = require_json_body();
        $service = new QueueService();

        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->patchTicket($store, $payload);
        });

        if (($result['ok'] ?? false) !== true) {
            self::emitError($result);
        }

        $state = $service->getQueueState($result['store'] ?? []);
        json_response([
            'ok' => true,
            'data' => [
                'ticket' => $result['ticket'] ?? null,
                'queueState' => $state['data'] ?? [],
            ],
        ]);
    }

    public static function reprint(array $context): void
    {
        $payload = require_json_body();
        $ticketId = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($ticketId <= 0) {
            json_response([
                'ok' => false,
                'error' => 'id de ticket invalido',
                'code' => 'queue_bad_request',
            ], 400);
        }

        $service = new QueueService();
        $store = is_array($context['store'] ?? null) ? $context['store'] : read_store();
        $ticket = $service->findTicketById($store, $ticketId);
        if (!is_array($ticket)) {
            json_response([
                'ok' => false,
                'error' => 'Ticket no encontrado',
                'code' => 'queue_ticket_not_found',
            ], 404);
        }

        $print = TicketPrinter::fromEnv()->printQueueTicket($ticket);
        $statusCode = (bool) ($print['ok'] ?? false) || (bool) ($print['printed'] ?? false) ? 200 : 503;
        json_response([
            'ok' => (bool) ($print['ok'] ?? false),
            'data' => [
                'ticket' => $ticket,
            ],
            'printed' => (bool) ($print['printed'] ?? false),
            'print' => [
                'ok' => (bool) ($print['ok'] ?? false),
                'errorCode' => (string) ($print['errorCode'] ?? ''),
                'message' => (string) ($print['message'] ?? ''),
            ],
        ], $statusCode);
    }

    public static function surfaceHeartbeat(array $context): void
    {
        $payload = require_json_body();
        $record = QueueSurfaceStatusStore::writeHeartbeat(
            is_array($payload) ? $payload : []
        );

        json_response([
            'ok' => true,
            'data' => $record,
        ]);
    }

    /**
     * @return array
     */
    private static function mutateStore(callable $mutation): array
    {
        $lockResult = with_store_lock(static function () use ($mutation): array {
            $store = read_store();
            $result = $mutation($store);

            if (($result['ok'] ?? false) !== true) {
                return $result;
            }

            $nextStore = is_array($result['store'] ?? null) ? $result['store'] : $store;
            if (!write_store($nextStore, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo guardar estado de turnero',
                    'status' => 503,
                    'errorCode' => 'queue_store_failed',
                ];
            }

            $result['store'] = $nextStore;
            return $result;
        });

        if (($lockResult['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'error' => (string) ($lockResult['error'] ?? 'Store lock failed'),
                'status' => (int) ($lockResult['code'] ?? 503),
                'errorCode' => 'queue_lock_failed',
            ];
        }

        $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : [];
        if ($result === []) {
            return [
                'ok' => false,
                'error' => 'Respuesta invalida de turnero',
                'status' => 500,
                'errorCode' => 'queue_internal_error',
            ];
        }
        return $result;
    }

    private static function emitError(array $result): void
    {
        json_response([
            'ok' => false,
            'error' => (string) ($result['error'] ?? 'Error de turnero'),
            'code' => (string) ($result['errorCode'] ?? 'queue_error'),
        ], (int) ($result['status'] ?? 500));
    }
}
