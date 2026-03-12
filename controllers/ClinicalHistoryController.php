<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/clinical_history/bootstrap.php';

final class ClinicalHistoryController
{
    public static function sessionGet(array $context): void
    {
        $service = new ClinicalHistoryService();
        $result = self::readStore(static function (array $store) use ($service): array {
            return $service->getSession($store, $_GET, false);
        });

        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo cargar la sesion clinica'),
                'code' => (string) ($result['errorCode'] ?? 'clinical_history_error'),
            ], (int) ($result['statusCode'] ?? 500));
        }

        json_response([
            'ok' => true,
            'data' => $result['data'] ?? [],
        ], (int) ($result['statusCode'] ?? 200));
    }

    public static function sessionPost(array $context): void
    {
        $payload = require_json_body();
        $service = new ClinicalHistoryService();
        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->createOrResumeSession($store, $payload);
        });

        self::emitMutationResponse($result);
    }

    public static function messagePost(array $context): void
    {
        $payload = require_json_body();
        $service = new ClinicalHistoryService();
        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->handlePatientMessage($store, $payload);
        });

        self::emitMutationResponse($result);
    }

    public static function reviewGet(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $service = new ClinicalHistoryService();
        $result = self::readStore(static function (array $store) use ($service): array {
            return $service->getSession($store, $_GET, true);
        });

        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo cargar la revision clinica'),
                'code' => (string) ($result['errorCode'] ?? 'clinical_history_error'),
            ], (int) ($result['statusCode'] ?? 500));
        }

        json_response([
            'ok' => true,
            'data' => $result['data'] ?? [],
        ]);
    }

    public static function reviewPatch(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        require_csrf();

        $payload = require_json_body();
        $service = new ClinicalHistoryService();
        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->applyReview($store, $payload);
        });

        self::emitMutationResponse($result);
    }

    private static function mutateStore(callable $callback): array
    {
        $lockResult = with_store_lock(static function () use ($callback): array {
            $store = read_store();
            $result = $callback($store);
            if (($result['ok'] ?? false) !== true) {
                return $result;
            }

            $nextStore = isset($result['store']) && is_array($result['store']) ? $result['store'] : $store;
            if (!write_store($nextStore, false)) {
                return [
                    'ok' => false,
                    'statusCode' => 503,
                    'error' => 'No se pudo guardar la historia clinica',
                    'errorCode' => 'clinical_history_store_failed',
                ];
            }

            $result['store'] = $nextStore;
            return $result;
        });

        if (($lockResult['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => (int) ($lockResult['code'] ?? 503),
                'error' => (string) ($lockResult['error'] ?? 'Store lock failed'),
                'errorCode' => 'clinical_history_lock_failed',
            ];
        }

        return isset($lockResult['result']) && is_array($lockResult['result'])
            ? $lockResult['result']
            : [
                'ok' => false,
                'statusCode' => 500,
                'error' => 'Respuesta invalida de historia clinica',
                'errorCode' => 'clinical_history_internal_error',
            ];
    }

    private static function readStore(callable $callback): array
    {
        $lockResult = with_store_lock(static function () use ($callback): array {
            $store = read_store();
            $result = $callback($store);
            if (($result['ok'] ?? false) !== true) {
                return $result;
            }

            $nextStore = isset($result['store']) && is_array($result['store']) ? $result['store'] : $store;
            if (($result['mutated'] ?? false) === true && !write_store($nextStore, false)) {
                return [
                    'ok' => false,
                    'statusCode' => 503,
                    'error' => 'No se pudo guardar la historia clinica',
                    'errorCode' => 'clinical_history_store_failed',
                ];
            }

            $result['store'] = $nextStore;
            return $result;
        });

        if (($lockResult['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => (int) ($lockResult['code'] ?? 503),
                'error' => (string) ($lockResult['error'] ?? 'Store lock failed'),
                'errorCode' => 'clinical_history_lock_failed',
            ];
        }

        return isset($lockResult['result']) && is_array($lockResult['result'])
            ? $lockResult['result']
            : [
                'ok' => false,
                'statusCode' => 500,
                'error' => 'Respuesta invalida de historia clinica',
                'errorCode' => 'clinical_history_internal_error',
            ];
    }

    private static function emitMutationResponse(array $result): void
    {
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Error de historia clinica'),
                'code' => (string) ($result['errorCode'] ?? 'clinical_history_error'),
            ], (int) ($result['statusCode'] ?? 500));
        }

        $payload = [
            'ok' => true,
            'data' => $result['data'] ?? [],
        ];
        if (array_key_exists('replay', $result)) {
            $payload['replay'] = (bool) $result['replay'];
        }

        json_response($payload, (int) ($result['statusCode'] ?? 200));
    }
}
