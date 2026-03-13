<?php

declare(strict_types=1);

final class StorePersistence
{
    public static function ensureJsonStoreFile(): bool
    {
        $jsonPath = StorePaths::dataJsonPath();
        if (is_file($jsonPath)) {
            return is_readable($jsonPath);
        }

        $raw = json_encode(
            StorageConfig::defaultStorePayload(),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
        );
        if (!is_string($raw) || trim($raw) === '') {
            return false;
        }

        $encoded = StoreCrypto::encryptPayload($raw);
        return @file_put_contents($jsonPath, $encoded, LOCK_EX) !== false;
    }

    public static function readStoreJsonFallback(): array
    {
        if (!self::ensureJsonStoreFile()) {
            return self::hydratePatientFlowStore(
                StorageConfig::normalizeStorePayload(StorageConfig::defaultStorePayload())
            );
        }

        $raw = @file_get_contents(StorePaths::dataJsonPath());
        if (!is_string($raw) || trim($raw) === '') {
            return self::hydratePatientFlowStore(
                StorageConfig::normalizeStorePayload(StorageConfig::defaultStorePayload())
            );
        }

        $decoded = StoreCrypto::decryptPayload($raw);
        if ($decoded === '') {
            $decoded = $raw;
        }

        $data = json_decode($decoded, true);
        if (!is_array($data)) {
            return self::hydratePatientFlowStore(
                StorageConfig::normalizeStorePayload(StorageConfig::defaultStorePayload())
            );
        }

        return self::hydratePatientFlowStore(StorageConfig::normalizeStorePayload($data));
    }

    public static function writeStoreJsonFallback(array $store): bool
    {
        if (!StorageConfig::jsonFallbackEnabled()) {
            return false;
        }

        $store = self::hydratePatientFlowStore(StorageConfig::normalizeStorePayload($store));
        if (!self::ensureJsonStoreFile()) {
            return false;
        }

        $jsonPath = StorePaths::dataJsonPath();
        if (is_file($jsonPath)) {
            self::createStoreBackupLocked($jsonPath);
        }

        $raw = json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if (!is_string($raw) || trim($raw) === '') {
            return false;
        }

        $encoded = StoreCrypto::encryptPayload($raw);
        return @file_put_contents($jsonPath, $encoded, LOCK_EX) !== false;
    }

    public static function pruneBackupFiles(): void
    {
        $patterns = [
            StorePaths::backupDirPath() . DIRECTORY_SEPARATOR . 'store-*.sqlite',
            StorePaths::backupDirPath() . DIRECTORY_SEPARATOR . 'store-*.json',
        ];

        $files = [];
        foreach ($patterns as $pattern) {
            $matches = glob($pattern);
            if (!is_array($matches) || $matches === []) {
                continue;
            }
            $files = array_merge($files, $matches);
        }

        if (count($files) <= MAX_STORE_BACKUPS) {
            return;
        }

        sort($files, SORT_STRING);
        $toDelete = array_slice($files, 0, count($files) - MAX_STORE_BACKUPS);
        foreach ($toDelete as $file) {
            @unlink($file);
        }
    }

    public static function createStoreBackupLocked($sourcePath): void
    {
        if (!StorePaths::ensureBackupDir()) {
            error_log('Piel en Armonía: no se pudo crear el directorio de backups');
            return;
        }

        if (!file_exists((string) $sourcePath)) {
            return;
        }

        try {
            $suffix = bin2hex(random_bytes(3));
        } catch (Throwable $e) {
            $suffix = substr(md5((string) microtime(true)), 0, 6);
        }

        $extension = strtolower((string) pathinfo((string) $sourcePath, PATHINFO_EXTENSION));
        if ($extension === '') {
            $extension = 'sqlite';
        }
        if ($extension !== 'sqlite' && $extension !== 'json') {
            $extension = 'sqlite';
        }

        $filename = StorePaths::backupDirPath()
            . DIRECTORY_SEPARATOR
            . 'store-' . local_date('Ymd-His') . '-' . $suffix . '.' . $extension;
        if (!copy((string) $sourcePath, $filename)) {
            error_log('Piel en Armonía: no se pudo guardar backup de store.sqlite');
            return;
        }

        self::pruneBackupFiles();
    }

    public static function migrateJsonToSqlite(string $jsonPath, string $sqlitePath): bool
    {
        if (!file_exists($jsonPath)) {
            return false;
        }

        $raw = @file_get_contents($jsonPath);
        if (!is_string($raw) || $raw === '') {
            return false;
        }

        $decoded = StoreCrypto::decryptPayload($raw);
        if ($decoded === '') {
            $decoded = $raw;
        }

        if (substr($decoded, 0, 6) === 'ENCv1:') {
            error_log('Migration failed: could not decrypt store.json');
            return false;
        }

        $data = json_decode($decoded, true);
        if (!is_array($data)) {
            error_log('Migration failed: invalid JSON');
            return false;
        }
        $data = self::hydratePatientFlowStore(StorageConfig::normalizeStorePayload($data));

        $pdo = get_db_connection($sqlitePath);
        if (!$pdo) {
            return false;
        }

        ensure_db_schema();

        $pdo->beginTransaction();
        try {
            self::importJsonTable(
                $pdo,
                $data['appointments'] ?? [],
                "INSERT OR REPLACE INTO appointments (id, date, time, doctor, service, name, email, phone, status, paymentMethod, paymentStatus, paymentIntentId, rescheduleToken, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                static function (array $appt): array {
                    return [
                        $appt['id'],
                        $appt['date'] ?? '',
                        $appt['time'] ?? '',
                        $appt['doctor'] ?? '',
                        $appt['service'] ?? '',
                        $appt['name'] ?? '',
                        $appt['email'] ?? '',
                        $appt['phone'] ?? '',
                        $appt['status'] ?? 'confirmed',
                        $appt['paymentMethod'] ?? '',
                        $appt['paymentStatus'] ?? '',
                        $appt['paymentIntentId'] ?? '',
                        $appt['rescheduleToken'] ?? '',
                        json_encode($appt, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::importJsonTable(
                $pdo,
                $data['reviews'] ?? [],
                "INSERT OR REPLACE INTO reviews (id, name, rating, text, date, verified, json_data) VALUES (?, ?, ?, ?, ?, ?, ?)",
                static function (array $review): array {
                    return [
                        $review['id'],
                        $review['name'] ?? '',
                        $review['rating'] ?? 0,
                        $review['text'] ?? '',
                        $review['date'] ?? '',
                        isset($review['verified']) && $review['verified'] ? 1 : 0,
                        json_encode($review, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::importJsonTable(
                $pdo,
                $data['callbacks'] ?? [],
                "INSERT OR REPLACE INTO callbacks (id, telefono, preferencia, fecha, status, json_data) VALUES (?, ?, ?, ?, ?, ?)",
                static function (array $callback): array {
                    return [
                        $callback['id'],
                        $callback['telefono'] ?? '',
                        $callback['preferencia'] ?? '',
                        $callback['fecha'] ?? '',
                        $callback['status'] ?? 'pendiente',
                        json_encode($callback, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::importJsonTable(
                $pdo,
                $data['queue_tickets'] ?? [],
                "INSERT OR REPLACE INTO queue_tickets (id, ticketCode, dailySeq, queueType, appointmentId, patientInitials, phoneLast4, priorityClass, status, assignedConsultorio, createdAt, calledAt, completedAt, createdSource, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                static function (array $ticket): array {
                    return [
                        $ticket['id'],
                        $ticket['ticketCode'] ?? '',
                        $ticket['dailySeq'] ?? 0,
                        $ticket['queueType'] ?? 'walk_in',
                        $ticket['appointmentId'] ?? null,
                        $ticket['patientInitials'] ?? '',
                        $ticket['phoneLast4'] ?? '',
                        $ticket['priorityClass'] ?? 'walk_in',
                        $ticket['status'] ?? 'waiting',
                        $ticket['assignedConsultorio'] ?? null,
                        $ticket['createdAt'] ?? local_date('c'),
                        $ticket['calledAt'] ?? '',
                        $ticket['completedAt'] ?? '',
                        $ticket['createdSource'] ?? 'kiosk',
                        json_encode($ticket, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::importJsonTable(
                $pdo,
                $data['telemedicine_intakes'] ?? [],
                "INSERT OR REPLACE INTO telemedicine_intakes (id, appointmentId, channel, legacyService, requestedDate, requestedTime, doctor, patientEmail, patientPhone, status, suitability, reviewRequired, paymentStatus, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                static function (array $intake): array {
                    $patient = isset($intake['patient']) && is_array($intake['patient']) ? $intake['patient'] : [];
                    return [
                        $intake['id'],
                        $intake['linkedAppointmentId'] ?? null,
                        $intake['channel'] ?? '',
                        $intake['legacyService'] ?? '',
                        $intake['requestedDate'] ?? '',
                        $intake['requestedTime'] ?? '',
                        $intake['requestedDoctor'] ?? '',
                        $patient['email'] ?? '',
                        $patient['phone'] ?? '',
                        $intake['status'] ?? 'draft',
                        $intake['suitability'] ?? 'review_required',
                        isset($intake['reviewRequired']) && $intake['reviewRequired'] ? 1 : 0,
                        $intake['paymentContext']['status'] ?? '',
                        json_encode($intake, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::importJsonTable(
                $pdo,
                $data['clinical_uploads'] ?? [],
                "INSERT OR REPLACE INTO clinical_uploads (id, intakeId, appointmentId, kind, storageMode, privatePath, legacyPublicPath, mime, size, sha256, originalName, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                static function (array $upload): array {
                    return [
                        $upload['id'],
                        $upload['intakeId'] ?? null,
                        $upload['appointmentId'] ?? null,
                        $upload['kind'] ?? 'legacy_unclassified',
                        $upload['storageMode'] ?? 'staging_legacy',
                        $upload['privatePath'] ?? '',
                        $upload['legacyPublicPath'] ?? '',
                        $upload['mime'] ?? '',
                        $upload['size'] ?? 0,
                        $upload['sha256'] ?? '',
                        $upload['originalName'] ?? '',
                        json_encode($upload, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            if (isset($data['availability']) && is_array($data['availability'])) {
                $stmt = $pdo->prepare("INSERT OR REPLACE INTO availability (date, time, doctor) VALUES (?, ?, ?)");
                foreach ($data['availability'] as $date => $times) {
                    if (!is_array($times)) {
                        continue;
                    }
                    foreach ($times as $time) {
                        $stmt->execute([$date, $time, 'global']);
                    }
                }
            }

            $stmt = $pdo->prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)");
            if (isset($data['updatedAt'])) {
                $stmt->execute(['updatedAt', $data['updatedAt']]);
            }
            if (isset($data['createdAt'])) {
                $stmt->execute(['createdAt', $data['createdAt']]);
            }
            $stmt->execute([
                'queue_help_requests_json',
                json_encode($data['queue_help_requests'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
            $stmt->execute([
                'patient_cases_json',
                json_encode($data['patient_cases'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
            $stmt->execute([
                'patient_case_links_json',
                json_encode($data['patient_case_links'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
            $stmt->execute([
                'patient_case_timeline_events_json',
                json_encode($data['patient_case_timeline_events'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
            $stmt->execute([
                'patient_case_approvals_json',
                json_encode($data['patient_case_approvals'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);

            $pdo->commit();
            @rename($jsonPath, $jsonPath . '.migrated');
            return true;
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('Migration failed: ' . $e->getMessage());
            return false;
        }
    }

    public static function ensureDataFile(): bool
    {
        $dataDir = StorePaths::dataDirPath();
        $dbPath = StorePaths::dataFilePath();
        $jsonPath = StorePaths::dataJsonPath();

        if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true) && !is_dir($dataDir)) {
            error_log('Piel en Armonía: no se pudo crear el directorio de datos: ' . $dataDir);
            return false;
        }

        StorePaths::ensureDataHtaccess($dataDir);

        $storageMode = StorageConfig::backendMode();
        if ($storageMode === 'json_fallback') {
            if (self::ensureJsonStoreFile()) {
                StorageConfig::logOnce(
                    'storage_json_fallback_active',
                    'Piel en Armonia storage: SQLite unavailable, using JSON fallback store.'
                );
                return true;
            }

            StorageConfig::logOnce(
                'storage_json_fallback_init_failed',
                'Piel en Armonia storage: SQLite unavailable and JSON fallback initialization failed.'
            );
            return false;
        }

        if ($storageMode === 'unavailable') {
            StorageConfig::logOnce(
                'storage_unavailable',
                'Piel en Armonia storage: SQLite unavailable and JSON fallback disabled.'
            );
            return false;
        }

        $pdo = get_db_connection($dbPath);
        if ($pdo) {
            ensure_db_schema();
        } else {
            if (StorageConfig::jsonFallbackEnabled() && self::ensureJsonStoreFile()) {
                StorageConfig::logOnce(
                    'storage_sqlite_connect_fallback',
                    'Piel en Armonia storage: SQLite connection failed, using JSON fallback store.'
                );
                return true;
            }

            StorageConfig::logOnce(
                'storage_sqlite_connect_failed',
                'Piel en Armonia storage: SQLite connection failed and JSON fallback unavailable.'
            );
            return false;
        }

        if (file_exists($jsonPath) && !file_exists($dbPath . '.migrated_flag')) {
            self::migrateJsonToSqlite($jsonPath, $dbPath);
        }

        return true;
    }

    public static function readStore(): array
    {
        if (!self::ensureDataFile()) {
            return self::hydratePatientFlowStore(
                StorageConfig::normalizeStorePayload(StorageConfig::defaultStorePayload())
            );
        }

        $pdo = get_db_connection(StorePaths::dataFilePath());
        if (!$pdo) {
            return StorageConfig::jsonFallbackEnabled()
                ? self::readStoreJsonFallback()
                : self::hydratePatientFlowStore(StorageConfig::normalizeStorePayload(StorageConfig::defaultStorePayload()));
        }

        try {
            $store = [
                'appointments' => self::fetchJsonDataRows($pdo, 'appointments'),
                'callbacks' => self::fetchJsonDataRows($pdo, 'callbacks'),
                'reviews' => self::fetchJsonDataRows($pdo, 'reviews'),
                'queue_tickets' => self::fetchJsonDataRows($pdo, 'queue_tickets'),
                'queue_help_requests' => [],
                'patient_cases' => [],
                'patient_case_links' => [],
                'patient_case_timeline_events' => [],
                'patient_case_approvals' => [],
                'telemedicine_intakes' => self::fetchJsonDataRows($pdo, 'telemedicine_intakes'),
                'clinical_uploads' => self::fetchJsonDataRows($pdo, 'clinical_uploads'),
                'availability' => self::fetchAvailability($pdo),
                'updatedAt' => local_date('c'),
                'idx_appointments_date' => [],
            ];

            $stmt = $pdo->query("SELECT value FROM kv_store WHERE key = 'updatedAt'");
            $row = $stmt->fetch();
            if ($row) {
                $store['updatedAt'] = $row['value'];
            }

            $stmt = $pdo->query("SELECT value FROM kv_store WHERE key = 'queue_help_requests_json'");
            $row = $stmt->fetch();
            if ($row && is_string($row['value'] ?? null) && trim((string) $row['value']) !== '') {
                $decoded = json_decode((string) $row['value'], true);
                if (is_array($decoded)) {
                    $store['queue_help_requests'] = $decoded;
                }
            }

            $store['idx_appointments_date'] = build_appointment_index($store['appointments']);
            foreach ([
                'patient_cases' => 'patient_cases_json',
                'patient_case_links' => 'patient_case_links_json',
                'patient_case_timeline_events' => 'patient_case_timeline_events_json',
                'patient_case_approvals' => 'patient_case_approvals_json',
            ] as $storeKey => $kvKey) {
                $stmt = $pdo->prepare("SELECT value FROM kv_store WHERE key = ?");
                $stmt->execute([$kvKey]);
                $row = $stmt->fetch();
                if (!$row || !is_string($row['value'] ?? null) || trim((string) $row['value']) === '') {
                    continue;
                }
                $decoded = json_decode((string) $row['value'], true);
                if (is_array($decoded)) {
                    $store[$storeKey] = $decoded;
                }
            }

            return self::hydratePatientFlowStore(StorageConfig::normalizeStorePayload($store));
        } catch (PDOException $e) {
            error_log('Read Store Error: ' . $e->getMessage());
            return StorageConfig::jsonFallbackEnabled()
                ? self::readStoreJsonFallback()
                : self::hydratePatientFlowStore(StorageConfig::normalizeStorePayload(StorageConfig::defaultStorePayload()));
        }
    }

    public static function acquireStoreLock($fp, int $timeoutMs = STORE_LOCK_TIMEOUT_MS): bool
    {
        return true;
    }

    public static function withStoreLock(callable $callback): array
    {
        $lockFile = StorePaths::dataDirPath() . DIRECTORY_SEPARATOR . 'store.lock';
        $fp = @fopen($lockFile, 'c+');
        if (!is_resource($fp)) {
            return ['ok' => false, 'error' => 'No se pudo obtener lock de store', 'code' => 503];
        }

        $deadline = microtime(true) + (STORE_LOCK_TIMEOUT_MS / 1000.0);
        $locked = false;
        while (microtime(true) < $deadline) {
            if (flock($fp, LOCK_EX | LOCK_NB)) {
                $locked = true;
                break;
            }
            usleep(STORE_LOCK_RETRY_DELAY_US);
        }

        if (!$locked) {
            fclose($fp);
            return ['ok' => false, 'error' => 'Store ocupado, intenta de nuevo', 'code' => 503];
        }

        try {
            return ['ok' => true, 'result' => $callback()];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage(), 'code' => 500];
        } finally {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }

    public static function writeStore(array $store, bool $emitHttpErrors = true): bool
    {
        if (!self::ensureDataFile()) {
            if (self::writeStoreJsonFallback($store)) {
                return true;
            }
            return self::handleWriteFailure($emitHttpErrors, 'Storage error');
        }

        $store = self::hydratePatientFlowStore(StorageConfig::normalizeStorePayload($store));
        $dbPath = StorePaths::dataFilePath();
        $pdo = get_db_connection($dbPath);
        if (!$pdo) {
            if (self::writeStoreJsonFallback($store)) {
                return true;
            }
            return self::handleWriteFailure($emitHttpErrors, 'DB Connection error');
        }

        self::createStoreBackupLocked($dbPath);

        try {
            $pdo->beginTransaction();

            self::syncJsonTable(
                $pdo,
                'appointments',
                $store['appointments'],
                "INSERT OR REPLACE INTO appointments (id, date, time, doctor, service, name, email, phone, status, paymentMethod, paymentStatus, paymentIntentId, rescheduleToken, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                static function (array $appt): array {
                    return [
                        $appt['id'],
                        $appt['date'] ?? '',
                        $appt['time'] ?? '',
                        $appt['doctor'] ?? '',
                        $appt['service'] ?? '',
                        $appt['name'] ?? '',
                        $appt['email'] ?? '',
                        $appt['phone'] ?? '',
                        $appt['status'] ?? 'confirmed',
                        $appt['paymentMethod'] ?? '',
                        $appt['paymentStatus'] ?? '',
                        $appt['paymentIntentId'] ?? '',
                        $appt['rescheduleToken'] ?? '',
                        json_encode($appt, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::syncJsonTable(
                $pdo,
                'reviews',
                $store['reviews'],
                "INSERT OR REPLACE INTO reviews (id, name, rating, text, date, verified, json_data) VALUES (?, ?, ?, ?, ?, ?, ?)",
                static function (array $review): array {
                    return [
                        $review['id'],
                        $review['name'] ?? '',
                        $review['rating'] ?? 0,
                        $review['text'] ?? '',
                        $review['date'] ?? '',
                        isset($review['verified']) && $review['verified'] ? 1 : 0,
                        json_encode($review, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::syncJsonTable(
                $pdo,
                'callbacks',
                $store['callbacks'],
                "INSERT OR REPLACE INTO callbacks (id, telefono, preferencia, fecha, status, json_data) VALUES (?, ?, ?, ?, ?, ?)",
                static function (array $callback): array {
                    return [
                        $callback['id'],
                        $callback['telefono'] ?? '',
                        $callback['preferencia'] ?? '',
                        $callback['fecha'] ?? '',
                        $callback['status'] ?? 'pendiente',
                        json_encode($callback, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::syncJsonTable(
                $pdo,
                'queue_tickets',
                $store['queue_tickets'],
                "INSERT OR REPLACE INTO queue_tickets (id, ticketCode, dailySeq, queueType, appointmentId, patientInitials, phoneLast4, priorityClass, status, assignedConsultorio, createdAt, calledAt, completedAt, createdSource, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                static function (array $ticket): array {
                    return [
                        $ticket['id'],
                        $ticket['ticketCode'] ?? '',
                        $ticket['dailySeq'] ?? 0,
                        $ticket['queueType'] ?? 'walk_in',
                        $ticket['appointmentId'] ?? null,
                        $ticket['patientInitials'] ?? '',
                        $ticket['phoneLast4'] ?? '',
                        $ticket['priorityClass'] ?? 'walk_in',
                        $ticket['status'] ?? 'waiting',
                        $ticket['assignedConsultorio'] ?? null,
                        $ticket['createdAt'] ?? local_date('c'),
                        $ticket['calledAt'] ?? '',
                        $ticket['completedAt'] ?? '',
                        $ticket['createdSource'] ?? 'kiosk',
                        json_encode($ticket, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::syncJsonTable(
                $pdo,
                'telemedicine_intakes',
                $store['telemedicine_intakes'],
                "INSERT OR REPLACE INTO telemedicine_intakes (id, appointmentId, channel, legacyService, requestedDate, requestedTime, doctor, patientEmail, patientPhone, status, suitability, reviewRequired, paymentStatus, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                static function (array $intake): array {
                    $patient = isset($intake['patient']) && is_array($intake['patient']) ? $intake['patient'] : [];
                    return [
                        $intake['id'],
                        $intake['linkedAppointmentId'] ?? null,
                        $intake['channel'] ?? '',
                        $intake['legacyService'] ?? '',
                        $intake['requestedDate'] ?? '',
                        $intake['requestedTime'] ?? '',
                        $intake['requestedDoctor'] ?? '',
                        $patient['email'] ?? '',
                        $patient['phone'] ?? '',
                        $intake['status'] ?? 'draft',
                        $intake['suitability'] ?? 'review_required',
                        isset($intake['reviewRequired']) && $intake['reviewRequired'] ? 1 : 0,
                        $intake['paymentContext']['status'] ?? '',
                        json_encode($intake, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            self::syncJsonTable(
                $pdo,
                'clinical_uploads',
                $store['clinical_uploads'],
                "INSERT OR REPLACE INTO clinical_uploads (id, intakeId, appointmentId, kind, storageMode, privatePath, legacyPublicPath, mime, size, sha256, originalName, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                static function (array $upload): array {
                    return [
                        $upload['id'],
                        $upload['intakeId'] ?? null,
                        $upload['appointmentId'] ?? null,
                        $upload['kind'] ?? 'legacy_unclassified',
                        $upload['storageMode'] ?? 'staging_legacy',
                        $upload['privatePath'] ?? '',
                        $upload['legacyPublicPath'] ?? '',
                        $upload['mime'] ?? '',
                        $upload['size'] ?? 0,
                        $upload['sha256'] ?? '',
                        $upload['originalName'] ?? '',
                        json_encode($upload, JSON_UNESCAPED_UNICODE),
                    ];
                }
            );

            $pdo->exec("DELETE FROM availability");
            if (isset($store['availability']) && is_array($store['availability'])) {
                $stmtInsert = $pdo->prepare("INSERT INTO availability (date, time, doctor) VALUES (?, ?, ?)");
                foreach ($store['availability'] as $date => $times) {
                    if (!is_array($times)) {
                        continue;
                    }
                    foreach ($times as $time) {
                        $stmtInsert->execute([$date, $time, 'global']);
                    }
                }
            }

            $stmt = $pdo->prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)");
            $stmt->execute(['updatedAt', local_date('c')]);
            $stmt->execute([
                'queue_help_requests_json',
                json_encode($store['queue_help_requests'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
            $stmt->execute([
                'patient_cases_json',
                json_encode($store['patient_cases'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
            $stmt->execute([
                'patient_case_links_json',
                json_encode($store['patient_case_links'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
            $stmt->execute([
                'patient_case_timeline_events_json',
                json_encode($store['patient_case_timeline_events'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
            $stmt->execute([
                'patient_case_approvals_json',
                json_encode($store['patient_case_approvals'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);

            $pdo->commit();
            return true;
        } catch (PDOException $e) {
            $pdo->rollBack();
            error_log('Write Store Error: ' . $e->getMessage());
            if (self::writeStoreJsonFallback($store)) {
                return true;
            }
            return self::handleWriteFailure($emitHttpErrors, 'Write error');
        }
    }

    private static function importJsonTable(PDO $pdo, array $records, string $sql, callable $mapper): void
    {
        $stmt = $pdo->prepare($sql);
        foreach ($records as $record) {
            if (!is_array($record) || !isset($record['id'])) {
                continue;
            }
            $stmt->execute($mapper($record));
        }
    }

    private static function fetchJsonDataRows(PDO $pdo, string $table): array
    {
        $rows = [];
        $stmt = $pdo->query("SELECT json_data FROM {$table}");
        while ($row = $stmt->fetch()) {
            $data = json_decode((string) ($row['json_data'] ?? ''), true);
            if (is_array($data)) {
                $rows[] = $data;
            }
        }
        return $rows;
    }

    private static function fetchAvailability(PDO $pdo): array
    {
        $availability = [];
        $stmt = $pdo->query("SELECT date, time FROM availability");
        while ($row = $stmt->fetch()) {
            $date = (string) ($row['date'] ?? '');
            $time = (string) ($row['time'] ?? '');
            if (!isset($availability[$date])) {
                $availability[$date] = [];
            }
            $availability[$date][] = $time;
        }
        return $availability;
    }

    private static function hydratePatientFlowStore(array $store): array
    {
        if (!class_exists('PatientCaseService')) {
            return $store;
        }

        try {
            $service = new PatientCaseService();
            return $service->hydrateStore($store);
        } catch (Throwable $e) {
            error_log('Patient case hydration error: ' . $e->getMessage());
            return $store;
        }
    }

    private static function syncJsonTable(PDO $pdo, string $table, array $records, string $upsertSql, callable $mapper): void
    {
        $existingIds = $pdo->query("SELECT id FROM {$table}")->fetchAll(PDO::FETCH_COLUMN);
        $existingIds = array_flip(is_array($existingIds) ? $existingIds : []);
        $incomingIds = [];
        $stmtUpsert = $pdo->prepare($upsertSql);

        foreach ($records as $record) {
            if (!is_array($record) || !isset($record['id'])) {
                continue;
            }

            $id = $record['id'];
            $incomingIds[$id] = true;
            $stmtUpsert->execute($mapper($record));
        }

        $toDelete = array_diff_key($existingIds, $incomingIds);
        if ($toDelete === []) {
            return;
        }

        $keys = array_keys($toDelete);
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $stmtDelete = $pdo->prepare("DELETE FROM {$table} WHERE id IN ({$placeholders})");
        $stmtDelete->execute($keys);
    }

    private static function handleWriteFailure(bool $emitHttpErrors, string $error): bool
    {
        if ($emitHttpErrors && function_exists('json_response')) {
            json_response(['ok' => false, 'error' => $error], 500);
        }
        return false;
    }
}
