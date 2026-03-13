<?php

declare(strict_types=1);

final class StorageConfig
{
    private static function runtimeEnvironment(): string
    {
        $candidates = [
            getenv('PIELARMONIA_APP_ENV'),
            getenv('PIELARMONIA_ENV'),
            getenv('APP_ENV'),
            getenv('PIELARMONIA_SENTRY_ENV'),
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return strtolower(trim($candidate));
            }
        }

        return 'unknown';
    }

    public static function sqliteAvailable(): bool
    {
        static $available = null;
        static $lastForcedUnavailable = null;
        $forcedUnavailable = getenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE');
        $forcedUnavailableEnabled = is_string($forcedUnavailable)
            && trim($forcedUnavailable) !== ''
            && parse_bool($forcedUnavailable);
        if ($lastForcedUnavailable !== $forcedUnavailableEnabled) {
            $available = null;
            $lastForcedUnavailable = $forcedUnavailableEnabled;
        }

        if (is_bool($available)) {
            return $available;
        }

        if ($forcedUnavailableEnabled) {
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
            'patient_cases' => [],
            'patient_case_links' => [],
            'patient_case_timeline_events' => [],
            'patient_case_approvals' => [],
            'telemedicine_intakes' => [],
            'clinical_uploads' => [],
            'clinical_history_sessions' => [],
            'clinical_history_drafts' => [],
            'clinical_history_events' => [],
            'case_media_proposals' => [],
            'case_media_publications' => [],
            'case_media_events' => [],
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
        $patientCases = isset($store['patient_cases']) && is_array($store['patient_cases'])
            ? $store['patient_cases']
            : [];
        $patientCaseLinks = isset($store['patient_case_links']) && is_array($store['patient_case_links'])
            ? $store['patient_case_links']
            : [];
        $patientCaseTimelineEvents = isset($store['patient_case_timeline_events']) && is_array($store['patient_case_timeline_events'])
            ? $store['patient_case_timeline_events']
            : [];
        $patientCaseApprovals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
            ? $store['patient_case_approvals']
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
        $caseMediaProposals = isset($store['case_media_proposals']) && is_array($store['case_media_proposals'])
            ? $store['case_media_proposals']
            : [];
        $caseMediaPublications = isset($store['case_media_publications']) && is_array($store['case_media_publications'])
            ? $store['case_media_publications']
            : [];
        $caseMediaEvents = isset($store['case_media_events']) && is_array($store['case_media_events'])
            ? $store['case_media_events']
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
        $caseMediaProposals = self::normalizeStoreRecordsWithNumericId($caseMediaProposals, 'case_media_proposals');
        $caseMediaPublications = self::normalizeStoreRecordsWithNumericId($caseMediaPublications, 'case_media_publications');
        $caseMediaEvents = self::normalizeStoreRecordsWithNumericId($caseMediaEvents, 'case_media_events');

        return [
            'appointments' => array_values($appointments),
            'callbacks' => array_values($callbacks),
            'reviews' => array_values($reviews),
            'queue_tickets' => array_values($queueTickets),
            'queue_help_requests' => array_values($queueHelpRequests),
            'patient_cases' => array_values($patientCases),
            'patient_case_links' => array_values($patientCaseLinks),
            'patient_case_timeline_events' => array_values($patientCaseTimelineEvents),
            'patient_case_approvals' => array_values($patientCaseApprovals),
            'telemedicine_intakes' => array_values($telemedicineIntakes),
            'clinical_uploads' => array_values($clinicalUploads),
            'clinical_history_sessions' => array_values($clinicalHistorySessions),
            'clinical_history_drafts' => array_values($clinicalHistoryDrafts),
            'clinical_history_events' => array_values($clinicalHistoryEvents),
            'case_media_proposals' => array_values($caseMediaProposals),
            'case_media_publications' => array_values($caseMediaPublications),
            'case_media_events' => array_values($caseMediaEvents),
            'availability' => $availability,
            'updatedAt' => $updatedAt,
            'idx_appointments_date' => build_appointment_index($appointments),
        ];
    }

    public static function storeFileIsEncrypted(): bool
    {
        $jsonPath = StorePaths::dataJsonPath();
        if (!is_file($jsonPath) || !is_readable($jsonPath)) {
            return false;
        }

        $raw = @file_get_contents($jsonPath, false, null, 0, 16);
        if (!is_string($raw) || $raw === '') {
            return false;
        }

        return substr($raw, 0, 6) === 'ENCv1:';
    }

    public static function encryptionConfigured(): bool
    {
        return StoreCrypto::hasEncryptionKey();
    }

    public static function encryptionRequired(): bool
    {
        $explicit = getenv('PIELARMONIA_REQUIRE_DATA_ENCRYPTION');
        if (is_string($explicit) && trim($explicit) !== '') {
            return parse_bool($explicit);
        }

        return in_array(self::runtimeEnvironment(), ['production', 'prod', 'live'], true);
    }

    public static function encryptionStatus(): string
    {
        if (self::backendMode() !== 'json_fallback') {
            return 'not_applicable';
        }

        if (self::storeFileIsEncrypted()) {
            return 'encrypted';
        }

        if (self::encryptionConfigured()) {
            return 'configured_but_plaintext';
        }

        return 'plaintext';
    }

    public static function encryptionCompliant(): bool
    {
        if (!self::encryptionRequired()) {
            return true;
        }

        if (self::backendMode() !== 'json_fallback') {
            return true;
        }

        return self::encryptionConfigured() && self::storeFileIsEncrypted();
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
