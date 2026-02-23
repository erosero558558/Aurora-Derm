<?php

declare(strict_types=1);

// Mock environment for CLI test
if (php_sapi_name() === 'cli') {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    $_SERVER['HTTP_HOST'] = 'localhost';
}

// Enable a feature flag for testing
putenv('FEATURE_NEW_BOOKING_UI=true');

// Capture output of index.php
ob_start();
// We need to be in the root directory for relative paths in index.php to work
chdir(__DIR__ . '/../');
require 'index.php';
$output = ob_get_clean();

// Use DOMDocument to robustly parse HTML
$dom = new DOMDocument();
libxml_use_internal_errors(true); // Suppress HTML5 parsing warnings
$dom->loadHTML($output);
libxml_clear_errors();

$xpath = new DOMXPath($dom);
$scripts = $xpath->query('//script');

$configFound = false;

foreach ($scripts as $script) {
    $content = $script->textContent;
    if (strpos($content, 'window.Piel.config') !== false) {
        // Extract JSON using regex but more carefully, or just manual string extraction
        // Format: window.Piel.config = {...};
        if (preg_match('/window\.Piel\.config\s*=\s*(\{.*?\});/s', $content, $matches)) {
            $configJson = $matches[1];
            $config = json_decode($configJson, true);

            if ($config !== null) {
                $configFound = true;

                if (isset($config['features']) && isset($config['features']['new_booking_ui'])) {
                    if ($config['features']['new_booking_ui'] === true) {
                        echo "PASS: Feature flag 'new_booking_ui' is correctly injected as true.\n";
                        exit(0);
                    } else {
                        echo "FAIL: Feature flag 'new_booking_ui' is present but value is " . var_export($config['features']['new_booking_ui'], true) . "\n";
                        exit(1);
                    }
                } else {
                    echo "FAIL: 'features' key or 'new_booking_ui' flag missing in config.\n";
                    echo "Config found: " . print_r($config, true) . "\n";
                    exit(1);
                }
            }
        }
    }
}

if (!$configFound) {
    echo "FAIL: Could not find window.Piel.config injection in any script tag.\n";
    exit(1);
}
