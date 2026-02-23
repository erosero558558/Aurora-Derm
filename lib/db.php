<?php

declare(strict_types=1);

/**
 * Database abstraction layer using PDO.
 */

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
            error_log('Piel en Armonía SQLite Error: ' . $e->getMessage());
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
            id TEXT PRIMARY KEY,
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
            id TEXT PRIMARY KEY,
            name TEXT,
            rating INTEGER,
            text TEXT,
            date TEXT,
            verified INTEGER DEFAULT 0,
            json_data TEXT
        )",
        "CREATE TABLE IF NOT EXISTS callbacks (
            id TEXT PRIMARY KEY,
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
        "CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date)",
        "CREATE INDEX IF NOT EXISTS idx_appointments_email ON appointments(email)",
        "CREATE INDEX IF NOT EXISTS idx_appointments_rescheduleToken ON appointments(rescheduleToken)",
        "CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating)"
    ];

    foreach ($queries as $sql) {
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
            error_log('Piel en Armonía Schema Error: ' . $e->getMessage());
        }
    }
}
