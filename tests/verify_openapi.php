<?php

declare(strict_types=1);

function verify_openapi(string $filepath): void
{
    if (!file_exists($filepath)) {
        echo "Error: OpenAPI file not found at $filepath\n";
        exit(1);
    }

    $content = file_get_contents($filepath);
    if ($content === false) {
        echo "Error: Could not read OpenAPI file at $filepath\n";
        exit(1);
    }

    $requiredStrings = [
        'openapi: 3.0.0',
        'info:',
        'title: Piel en Armonía API',
        'paths:',
        '/appointments:',
        '/booked-slots:',
        '/reschedule:',
        '/availability:',
        '/payment-config:',
        '/payment-intent:',
        '/payment-verify:',
        '/transfer-proof:',
        '/stripe-webhook:',
        'components:',
        'schemas:',
        'Appointment:',
        'NewAppointment:',
    ];

    $missing = [];
    foreach ($requiredStrings as $str) {
        if (strpos($content, $str) === false) {
            $missing[] = $str;
        }
    }

    if (count($missing) > 0) {
        echo "Error: OpenAPI file is missing required definitions:\n";
        foreach ($missing as $m) {
            echo " - $m\n";
        }
        exit(1);
    }

    // Basic indentation check (YAML relies on indentation)
    // Check if lines start with spaces or tabs (no mix usually, but just ensure non-empty lines have structure)
    $lines = explode("\n", $content);
    $lineCount = 0;
    foreach ($lines as $line) {
        $lineCount++;
        if (trim($line) === '') {
            continue;
        }
        // Very basic check: ensure no tab characters at start if using spaces
        if (preg_match('/^\t/', $line)) {
             echo "Error: Line $lineCount starts with a tab character, which is not allowed in YAML.\n";
             exit(1);
        }
    }

    echo "OpenAPI documentation verification passed.\n";
}

$docsPath = __DIR__ . '/../docs/openapi.yaml';
verify_openapi($docsPath);
