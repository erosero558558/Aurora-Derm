<?php

$inputFile = __DIR__ . '/../index.html';
$outputJson = __DIR__ . '/../content/index.json';

if (!file_exists($inputFile)) {
    die("Error: index.html not found at $inputFile\n");
}

$html = file_get_contents($inputFile);
$dom = new DOMDocument();
libxml_use_internal_errors(true);
// Force UTF-8 loading
$dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
libxml_clear_errors();

$xpath = new DOMXPath($dom);

$sectionsToExtract = [
    'showcase',
    'servicios',
    'telemedicina',
    'tarifario',
    'equipo',
    'galeria',
    'consultorio',
    'resenas',
    'citas',
    'videoModal',
    'paymentModal',
    'successModal',
    'rescheduleModal',
    'reviewModal',
    'chatbotWidget',
    'cookieBanner'
];

$extractedContent = [];
$existingContent = [];
$runtimeSectionIds = [
    'videoModal',
    'paymentModal',
    'successModal',
    'rescheduleModal',
    'reviewModal',
    'chatbotWidget',
    'cookieBanner',
];
$modified = false;

if (file_exists($outputJson)) {
    $decoded = json_decode((string) file_get_contents($outputJson), true);
    if (is_array($decoded)) {
        $existingContent = $decoded;
    }
}

foreach ($sectionsToExtract as $id) {
    $element = $dom->getElementById($id);
    if ($element) {
        // Extract inner HTML
        $innerHTML = '';
        foreach ($element->childNodes as $child) {
            $innerHTML .= $dom->saveHTML($child);
        }

        // Clean up artifacts if any (like xml declaration)
        $innerHTML = str_replace('<?xml encoding="UTF-8">', '', $innerHTML);

        $innerHTML = trim($innerHTML);

        // If the source HTML already contains deferred placeholders, preserve the
        // last non-empty runtime payload instead of overwriting it with blanks.
        if (
            $innerHTML === '' &&
            in_array($id, $runtimeSectionIds, true) &&
            isset($existingContent[$id]) &&
            trim((string) $existingContent[$id]) !== ''
        ) {
            $innerHTML = trim((string) $existingContent[$id]);
        }

        $extractedContent[$id] = $innerHTML;

        // Empty the element content but keep attributes
        while ($element->hasChildNodes()) {
            $element->removeChild($element->firstChild);
        }

        // Add a marker class or attribute if needed, but the ID is enough
        $element->setAttribute('class', $element->getAttribute('class') . ' deferred-content');

        $modified = true;
        echo "Extracted content for #$id\n";
    } else {
        echo "Warning: Element #$id not found in index.html\n";
    }
}

if ($modified) {
    // Save JSON
    if (file_put_contents($outputJson, json_encode($extractedContent, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))) {
        echo "Saved extracted content to $outputJson\n";
    } else {
        die("Error saving JSON\n");
    }

    // Save HTML
    $newHtml = $dom->saveHTML();
    // Remove the XML declaration added by saveHTML/loadHTML hack
    $newHtml = str_replace('<?xml encoding="UTF-8">', '', $newHtml);

    // Fix doctype if missing (DOMDocument sometimes messes it up)
    if (strpos($newHtml, '<!doctype html>') === false && strpos($newHtml, '<!DOCTYPE html>') === false) {
        $newHtml = "<!doctype html>\n" . $newHtml;
    }

    // Backup original
    copy($inputFile, $inputFile . '.bak');

    if (file_put_contents($inputFile, $newHtml)) {
        echo "Updated index.html (backup saved as index.html.bak)\n";
    } else {
        die("Error saving HTML\n");
    }
} else {
    echo "No modifications made.\n";
}
