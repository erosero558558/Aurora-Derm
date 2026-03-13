<?php

// bin/verify-gate.php

$domain = 'https://pielarmonia.com';
$checks = [];
$failures = 0;
$diagnosticsToken = trim((string) (getenv('PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN') ?: getenv('PIELARMONIA_CRON_SECRET') ?: ''));

function check($name, $callback)
{
    global $checks, $failures;
    echo "Checking $name... ";
    try {
        $result = $callback();
        if ($result === true) {
            echo "\033[32mOK\033[0m\n"; // Green OK
            $checks[$name] = 'OK';
        } else {
            echo "\033[31mFAIL\033[0m\n"; // Red FAIL
            $checks[$name] = 'FAIL';
            $failures++;
        }
    } catch (Exception $e) {
        echo "\033[31mERROR: " . $e->getMessage() . "\033[0m\n";
        $checks[$name] = 'ERROR';
        $failures++;
    }
}

function diagnostics_headers(): array
{
    global $diagnosticsToken;

    $headers = [
        'User-Agent: PielArmoniaGateCheck/1.0',
    ];

    if ($diagnosticsToken === '') {
        return $headers;
    }

    $headerName = trim((string) (getenv('PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_HEADER') ?: 'Authorization'));
    $prefix = trim((string) (getenv('PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_PREFIX') ?: 'Bearer'));
    $headerValue = $prefix !== '' ? ($prefix . ' ' . $diagnosticsToken) : $diagnosticsToken;
    $headers[] = $headerName . ': ' . $headerValue;

    return $headers;
}

function fetch($url, array $headers = [])
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    if ($headers === []) {
        curl_setopt($ch, CURLOPT_USERAGENT, 'PielArmoniaGateCheck/1.0');
    } else {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        throw new Exception("Curl error: $error");
    }

    return ['code' => $httpCode, 'body' => $response];
}

function fetchHeaders($url, array $headers = [])
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_NOBODY, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    if ($headers === []) {
        curl_setopt($ch, CURLOPT_USERAGENT, 'PielArmoniaGateCheck/1.0');
    } else {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $headerSize);
    curl_close($ch);
    return $headers;
}

echo "== Verifying Gate: Prod Strict ==\n";
echo "Domain: $domain\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

// 1. Check Homepage
check('Homepage (200 OK)', function () use ($domain) {
    $res = fetch($domain . '/');
    return $res['code'] === 200;
});

// 2. Check Security Headers
check('Security Headers', function () use ($domain) {
    $headers = fetchHeaders($domain . '/');
    $required = ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy'];
    foreach ($required as $h) {
        if (stripos($headers, $h) === false) {
            // Fallback: check for meta tag in body if header missing
            $res = fetch($domain . '/');
            if (stripos($res['body'], "http-equiv=\"$h\"") !== false || stripos($res['body'], "http-equiv='$h'") !== false) {
                continue;
            }
            echo " (Missing $h) ";
            return false;
        }
    }
    return true;
});

// 3. Check Health API
check('Health API (200 OK & JSON)', function () use ($domain) {
    global $diagnosticsToken;
    $resource = $diagnosticsToken !== '' ? 'health-diagnostics' : 'health';
    $res = fetch($domain . '/api.php?resource=' . $resource, diagnostics_headers());
    if ($res['code'] !== 200) {
        echo " (HTTP " . $res['code'] . ") ";
        return false;
    }
    $json = json_decode($res['body'], true);
    if (!$json) {
        echo " (Invalid JSON) ";
        return false;
    }

    $requiredFields = ['timingMs', 'version', 'dataDirWritable'];
    if ($resource === 'health-diagnostics') {
        $requiredFields = array_merge($requiredFields, [
            'storeEncrypted',
            'storeEncryptionConfigured',
            'storeEncryptionRequired',
            'storeEncryptionStatus',
            'storeEncryptionCompliant',
            'checks',
        ]);
    }
    foreach ($requiredFields as $f) {
        if (!isset($json[$f])) {
            echo " (Missing field: $f) ";
            return false;
        }
    }

    if ($resource === 'health-diagnostics' && !isset($json['checks']['backup']['ok'])) {
        echo " (Backup check missing) ";
        return false;
    }

    return true;
});

// 4. Check Figo Chat
check('Figo Chat (200 OK)', function () use ($domain) {
    $res = fetch($domain . '/figo-chat.php');
    if ($res['code'] !== 200) {
        return false;
    }
    $json = json_decode($res['body'], true);
    return isset($json['mode']);
});

// 5. Check Assets (Hash Match)
// We need to find the assets referenced in the remote index.html
$indexRes = fetch($domain . '/');
if ($indexRes['code'] === 200) {
    $remoteIndex = $indexRes['body'];

    // Extract script.js
    if (preg_match('/<script[^>]+src="([^"]*script\.js[^"]*)"/', $remoteIndex, $matches)) {
        $scriptUrl = $matches[1];
        // Handle relative URL
        if (strpos($scriptUrl, 'http') !== 0) {
            $scriptUrl = $domain . '/' . ltrim($scriptUrl, '/');
        }

        check('Asset Hash: script.js', function () use ($scriptUrl) {
            if (!file_exists('script.js')) {
                echo " (Local file missing) ";
                return false;
            }

            // Normalize local file (CRLF -> LF)
            $localContent = file_get_contents('script.js');
            $localContent = str_replace(["\r\n", "\r"], "\n", $localContent);
            $localHash = hash('sha256', $localContent);

            $res = fetch($scriptUrl);
            if ($res['code'] !== 200) {
                echo " (Remote fetch failed) ";
                return false;
            }

            $remoteContent = $res['body'];
            $remoteContent = str_replace(["\r\n", "\r"], "\n", $remoteContent);
            $remoteHash = hash('sha256', $remoteContent);

            if ($localHash !== $remoteHash) {
                echo " (Hash mismatch. Local: " . substr($localHash, 0, 8) . ", Remote: " . substr($remoteHash, 0, 8) . ") ";
                return false;
            }
            return true;
        });
    } else {
        echo "WARNING: script.js not found in remote index.html\n";
    }

    // Extract styles.css
    if (preg_match('/<link[^>]+href="([^"]*styles\.css[^"]*)"/', $remoteIndex, $matches)) {
        $styleUrl = $matches[1];
        if (strpos($styleUrl, 'http') !== 0) {
            $styleUrl = $domain . '/' . ltrim($styleUrl, '/');
        }

        check('Asset Hash: styles.css', function () use ($styleUrl) {
            if (!file_exists('styles.css')) {
                echo " (Local file missing) ";
                return false;
            }

            $localContent = file_get_contents('styles.css');
            $localContent = str_replace(["\r\n", "\r"], "\n", $localContent);
            $localHash = hash('sha256', $localContent);

            $res = fetch($styleUrl);
            if ($res['code'] !== 200) {
                return false;
            }

            $remoteContent = $res['body'];
            $remoteContent = str_replace(["\r\n", "\r"], "\n", $remoteContent);
            $remoteHash = hash('sha256', $remoteContent);

            if ($localHash !== $remoteHash) {
                echo " (Hash mismatch) ";
                return false;
            }
            return true;
        });
    }
}

if ($failures > 0) {
    echo "\n\033[31mGate Verification FAILED with $failures errors.\033[0m\n";
    exit(1);
} else {
    echo "\n\033[32mGate Verification PASSED.\033[0m\n";
    exit(0);
}
