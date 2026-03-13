<?php

// Router for PHP built-in server during tests

// Skip if run in CLI (this file is not a unit test)
if (php_sapi_name() === 'cli') {
    exit(0);
}

// Skip static assets
if (preg_match('/\.(?:png|jpg|jpeg|gif|css|js|html|ico)$/', $_SERVER["REQUEST_URI"])) {
    return false;
}

// Set up test environment
$tempDataDir = __DIR__ . '/temp_data';
if (!is_dir($tempDataDir)) {
    mkdir($tempDataDir, 0777, true);
}

// Force data directory to temp dir
putenv('PIELARMONIA_DATA_DIR=' . $tempDataDir);
putenv('PIELARMONIA_ADMIN_PASSWORD=secret');
putenv('PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY=legacy_password');
// Also define constant just in case, though putenv should work for data_dir_path()
if (!defined('DATA_DIR')) {
    define('DATA_DIR', $tempDataDir);
}

// Route api.php requests
if (strpos($_SERVER['REQUEST_URI'], '/api.php') === 0) {
    // Determine the script file path relative to document root
    // But since we are in a router, we just include the file.
    // The current working directory for `php -S` is usually where it was started.
    // We assume it's started from repo root.
    chdir(__DIR__ . '/..');
    require 'api.php';
    exit;
}

// Default behavior for other requests (e.g. admin-auth.php)
// If we need to support them, we might need to route them too.
// For now, only api.php is critical for the test.
return false;
