<?php

declare(strict_types=1);

/**
 * Database abstraction layer using PDO.
 */

if (!function_exists('db_parse_bool_env')) {
    function db_parse_bool_env($value): bool
    {
        $normalized = strtolower(trim((string) $value));
        return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
    }
}

if (!function_exists('db_log_once')) {
    function db_log_once(string $key, string $message): void
    {
        static $seen = [];
        if (isset($seen[$key])) {
            return;
        }
        $seen[$key] = true;
        error_log($message);
    }
}

if (!function_exists('db_force_sqlite_unavailable')) {
    function db_force_sqlite_unavailable(): bool
    {
        $raw = getenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE');
        if (!is_string($raw) || trim($raw) === '') {
            return false;
        }
        return db_parse_bool_env($raw);
    }
}

if (!function_exists('db_sqlite_driver_available')) {
    function db_sqlite_driver_available(): bool
    {
        static $available = null;
        if (is_bool($available)) {
            return $available;
        }

        if (db_force_sqlite_unavailable()) {
            $available = false;
            return $available;
        }

        if (!class_exists('PDO') || !extension_loaded('pdo_sqlite')) {
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
}

function get_db_connection(?string $dbPath = null, bool $reset = false): ?PDO
{
    static $pdo = null;
    if ($reset) {
        $pdo = null;
        return null;
    }
    if ($pdo !== null) {
        return $pdo;
    }

    // Try SQLite if path provided
    if ($dbPath !== null) {
        if (!db_sqlite_driver_available()) {
            db_log_once(
                'sqlite_driver_unavailable',
                'Piel en Armonia DB: SQLite driver unavailable; fallback storage required.'
            );
            return null;
        }

        try {
            $dsn = "sqlite:" . $dbPath;
            $pdo = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            // Optimize SQLite
            // $pdo->exec('PRAGMA journal_mode = WAL;'); // Disabled to simplify file-based backups
            $pdo->exec('PRAGMA synchronous = NORMAL;');
            return $pdo;
        } catch (PDOException $e) {
            $reason = trim($e->getMessage());
            $reasonKey = $reason === '' ? 'unknown' : md5($reason);
            db_log_once(
                'sqlite_connect_error_' . $reasonKey,
                'Piel en Armonia DB: SQLite connection error: ' . $reason
            );
            return null;
        }
    }

    // Try Environment Variables (MySQL)
    $host = getenv('PIELARMONIA_DB_HOST');
    $name = getenv('PIELARMONIA_DB_NAME');
    $user = getenv('PIELARMONIA_DB_USER');
    $pass = getenv('PIELARMONIA_DB_PASS');

    if (is_string($host) && is_string($name) && is_string($user) && is_string($pass) &&
        $host !== '' && $name !== '' && $user !== '') {
        try {
            $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            return $pdo;
        } catch (PDOException $e) {
            error_log('Piel en Armonía DB Connection Error: Could not connect to database.');
            return null;
        }
    }

    return null;
}

/**
 * Executes a prepared statement securely.
 *
 * @param string $sql SQL query with placeholders (?)
 * @param array $params Parameters to bind
 * @return array|int|bool Result set (array), affected rows (int for INSERT/UPDATE/DELETE), or false on failure.
 */
function db_query(string $sql, array $params = [])
{
    $pdo = get_db_connection();
    if ($pdo === null) {
        return false;
    }

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $trimmedSql = strtoupper(trim($sql));
        if (strpos($trimmedSql, 'SELECT') === 0 || strpos($trimmedSql, 'SHOW') === 0 || strpos($trimmedSql, 'DESCRIBE') === 0 || strpos($trimmedSql, 'PRAGMA') === 0) {
            return $stmt->fetchAll();
        }

        return $stmt->rowCount();
    } catch (PDOException $e) {
        error_log('Piel en Armonía DB Query Error: ' . $e->getMessage());
        return false;
    }
}

function close_db_connection(): void
{
    get_db_connection(null, true);
}

function ensure_db_schema(): void
{
    $pdo = get_db_connection();
    if ($pdo === null) {
        return;
    }

    $queries = [
        "CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            doctor TEXT,
            service TEXT,
            name TEXT,
            email TEXT,
            phone TEXT,
            status TEXT DEFAULT 'confirmed',
            paymentMethod TEXT,
            paymentStatus TEXT,
            paymentIntentId TEXT,
            rescheduleToken TEXT,
            json_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY,
            name TEXT,
            rating INTEGER,
            text TEXT,
            date TEXT,
            verified INTEGER DEFAULT 0,
            json_data TEXT
        )",
        "CREATE TABLE IF NOT EXISTS callbacks (
            id INTEGER PRIMARY KEY,
            telefono TEXT,
            preferencia TEXT,
            fecha TEXT,
            status TEXT DEFAULT 'pendiente',
            json_data TEXT
        )",
        "CREATE TABLE IF NOT EXISTS availability (
            date TEXT,
            time TEXT,
            doctor TEXT,
            PRIMARY KEY (date, time, doctor)
        )",
        "CREATE TABLE IF NOT EXISTS queue_tickets (
            id INTEGER PRIMARY KEY,
            ticketCode TEXT NOT NULL,
            dailySeq INTEGER NOT NULL,
            queueType TEXT NOT NULL,
            appointmentId INTEGER NULL,
            patientInitials TEXT,
            phoneLast4 TEXT,
            priorityClass TEXT NOT NULL,
            status TEXT NOT NULL,
            assignedConsultorio INTEGER NULL,
            createdAt TEXT NOT NULL,
            calledAt TEXT NULL,
            completedAt TEXT NULL,
            createdSource TEXT NOT NULL,
            json_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date)",
        "CREATE INDEX IF NOT EXISTS idx_appointments_email ON appointments(email)",
        "CREATE INDEX IF NOT EXISTS idx_appointments_rescheduleToken ON appointments(rescheduleToken)",
        "CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating)",
        "CREATE INDEX IF NOT EXISTS idx_queue_tickets_status ON queue_tickets(status)",
        "CREATE INDEX IF NOT EXISTS idx_queue_tickets_createdAt ON queue_tickets(createdAt)",
        "CREATE INDEX IF NOT EXISTS idx_queue_tickets_dailySeq ON queue_tickets(dailySeq)",
        "CREATE TABLE IF NOT EXISTS cron_failures (
            id INTEGER PRIMARY KEY,
            task_name TEXT,
            payload TEXT,
            attempt_count INTEGER DEFAULT 0,
            next_retry_at DATETIME,
            last_error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE INDEX IF NOT EXISTS idx_cron_failures_retry ON cron_failures(next_retry_at)"
    ];

    foreach ($queries as $sql) {
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
            error_log('Piel en Armonía Schema Error: ' . $e->getMessage());
        }
    }
}
