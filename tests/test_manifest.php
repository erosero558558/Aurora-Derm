<?php

// tests/test_manifest.php

echo "Testing Manifest existence and validity...\n";

$manifestPath = __DIR__ . '/../manifest.json';

if (!file_exists($manifestPath)) {
    echo "FAILED: manifest.json not found.\n";
    exit(1);
}

$content = file_get_contents($manifestPath);
$json = json_decode($content, true);

if ($json === null) {
    echo "FAILED: manifest.json is not valid JSON.\n";
    exit(1);
}

if (!isset($json['name']) || strpos($json['name'], 'Aurora Derm') === false) {
    echo "FAILED: manifest.json 'name' is incorrect.\n";
    exit(1);
}

if (!isset($json['icons']) || count($json['icons']) < 2) {
    echo "FAILED: manifest.json icons missing.\n";
    exit(1);
}

echo "PASSED: Manifest is valid.\n";
exit(0);
