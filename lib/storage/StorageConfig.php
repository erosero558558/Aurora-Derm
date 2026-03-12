<?php

declare(strict_types=1);

final class StorageConfig
{
    public static function sqliteAvailable(): bool
    {
        static $available = null;
        if (is_bool($available)) {
            return $available;
        }

        $forcedUnavailable = getenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE');
        if (is_string($forcedUnavailable) && trim($forcedUnavailable) !== '' && parse_bool($forcedUnavailable)) {
            $available = false;
            return $available;
        }

        if (function_exists('db_sqlite_driver_available')) {
            $available = db_sqlite_driver_available();
            return $available;
        }

        if (!class_exists('PDO')) {
            $available = false;
            return $available;
        }

        try {
            $drivers = PDO::getAvailableDrivers();
            $available = is_array($drivers) && in_array('sqlite', $drivers, true);
        } catch (Throwable $e) {
            $available = false;
        }

        return $available;
    }

    public static function logOnce(string $key, string $message): void
    {
        static $seen = [];
        if (isset($seen[$key])) {
            return;
        }

        $seen[$key] = true;
        error_log($message);
    }

    public static function defaultStorePayload(): array
    {
        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'queue_tickets' => [],
            'queue_help_requests' => [],
            'telemedicine_intakes' => [],
            'clinical_uploads' => [],
            'clinical_history_sessions' => [],
            'clinical_history_drafts' => [],
            'clinical_history_events' => [],
            'availability' => [],
            'updatedAt' => local_date('c'),
        ];
    }

    public static function normalizeStoreRecordsWithNumericId(array $records, string $namespace): array
    {
        $normalized = [];
        $seen = [];

        foreach ($records as $index => $record) {
            if (!is_array($record)) {
                continue;
            }

            $rawId = $record['id'] ?? null;
            $id = 0;
            if (is_int($rawId) && $rawId > 0) {
                $id = $rawId;
            } elseif (is_string($rawId) && preg_match('/^\d+$/', $rawId)) {
                $id = (int) $rawId;
            }

            if ($id <= 0) {
                $seed = implode('|', [
                    $namespace,
                    is_scalar($rawId) ? (string) $rawId : '',
                    isset($record['date']) ? (string) $record['date'] : '',
                    isset($record['time']) ? (string) $record['time'] : '',
                    isset($record['email']) ? (string) $record['email'] : '',
                    (string) $index,
                ]);
                $id = (int) sprintf('%u', crc32($seed));
                if ($id <= 0) {
                    $fallbackIndex = (is_int($index) || (is_string($index) && preg_match('/^\d+$/', $index)))
                        ? (int) $index
                        : count($normalized);
                    $id = $fallbackIndex + 1;
                }
            }

            while (isset($seen[$id])) {
                $id++;
            }

            $seen[$id] = true;
            $record['id'] = $id;
            $normalized[] = $record;
        }

        return $normalized;
    }

    public static function normalizeStorePayload($rawStore): array
    {
        $store = is_array($rawStore) ? $rawStore : [];

        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
        $reviews = isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
        $queueTickets = isset($store['queue_tickets']) && is_array($store['queue_tickets']) ? $store['queue_tickets'] : [];
        $queueHelpRequests = isset($store['queue_help_requests']) && is_array($store['queue_help_requests'])
            ? $store['queue_help_requests']
            : [];
        $telemedicineIntakes = isset($store['telemedicine_intakes']) && is_array($store['telemedicine_intakes'])
            ? $store['telemedicine_intakes']
            : [];
        $clinicalUploads = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
            ? $store['clinical_uploads']
            : [];
        $clinicalHistorySessions = isset($store['clinical_history_sessions']) && is_array($store['clinical_history_sessions'])
            ? $store['clinical_history_sessions']
            : [];
        $clinicalHistoryDrafts = isset($store['clinical_history_drafts']) && is_array($store['clinical_history_drafts'])
            ? $store['clinical_history_drafts']
            : [];
        $clinicalHistoryEvents = isset($store['clinical_history_events']) && is_array($store['clinical_history_events'])
            ? $store['clinical_history_events']
            : [];
        $availability = isset($store['availability']) && is_array($store['availability']) ? $store['availability'] : [];
        $updatedAt = isset($store['updatedAt']) && is_string($store['updatedAt']) && trim($store['updatedAt']) !== ''
            ? trim($store['updatedAt'])
            : local_date('c');

        $appointments = self::normalizeStoreRecordsWithNumericId($appointments, 'appointments');
        $callbacks = self::normalizeStoreRecordsWithNumericId($callbacks, 'callbacks');
        $reviews = self::normalizeStoreRecordsWithNumericId($reviews, 'reviews');
        $queueTickets = self::normalizeStoreRecordsWithNumericId($queueTickets, 'queue_tickets');
        $queueHelpRequests = self::normalizeStoreRecordsWithNumericId($queueHelpRequests, 'queue_help_requests');
        $telemedicineIntakes = self::normalizeStoreRecordsWithNumericId($telemedicineIntakes, 'telemedicine_intakes');
        $clinicalUploads = self::normalizeStoreRecordsWithNumericId($clinicalUploads, 'clinical_uploads');
        $clinicalHistorySessions = self::normalizeStoreRecordsWithNumericId($clinicalHistorySessions, 'clinical_history_sessions');
        $clinicalHistoryDrafts = self::normalizeStoreRecordsWithNumericId($clinicalHistoryDrafts, 'clinical_history_drafts');
        $clinicalHistoryEvents = self::normalizeStoreRecordsWithNumericId($clinicalHistoryEvents, 'clinical_history_events');

        return [
            'appointments' => array_values($appointments),
            'callbacks' => array_values($callbacks),
            'reviews' => array_values($reviews),
            'queue_tickets' => array_values($queueTickets),
            'queue_help_requests' => array_values($queueHelpRequests),
            'telemedicine_intakes' => array_values($telemedicineIntakes),
            'clinical_uploads' => array_values($clinicalUploads),
            'clinical_history_sessions' => array_values($clinicalHistorySessions),
            'clinical_history_drafts' => array_values($clinicalHistoryDrafts),
            'clinical_history_events' => array_values($clinicalHistoryEvents),
            'availability' => $availability,
            'updatedAt' => $updatedAt,
            'idx_appointments_date' => build_appointment_index($appointments),
        ];
    }

    public static function storeFileIsEncrypted(): bool
    {
        return false;
    }

    public static function backendMode(): string
    {
        if (self::sqliteAvailable()) {
            return 'sqlite';
        }

        return self::jsonFallbackEnabled() ? 'json_fallback' : 'unavailable';
    }

    public static function jsonFallbackEnabled(): bool
    {
        $raw = getenv('PIELARMONIA_STORAGE_JSON_FALLBACK');
        if (!is_string($raw) || trim($raw) === '') {
            return true;
        }

        return parse_bool($raw);
    }
}
