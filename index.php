<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

if (!headers_sent()) {
    header('Content-Type: text/html; charset=UTF-8');
    apply_security_headers(true);
}

$indexPath = __DIR__ . DIRECTORY_SEPARATOR . 'index.html';
if (!is_file($indexPath)) {
    http_response_code(500);
    echo 'index.html no disponible';
    exit;
}

$indexHtml = @file_get_contents($indexPath);
if (!is_string($indexHtml) || $indexHtml === '') {
    http_response_code(500);
    echo 'No se pudo cargar index.html';
    exit;
}

// --- Server-Side Rendering (SSR) of Content ---
$contentFile = __DIR__ . '/content/es.json';
if (is_file($contentFile)) {
    $contentJson = file_get_contents($contentFile);
    $content = json_decode($contentJson, true);

    if (is_array($content) && class_exists('DOMDocument') && class_exists('DOMXPath')) {
        try {
            // Use DOMDocument to inject content
            $dom = new DOMDocument();
            // Suppress warnings for HTML5 tags
            libxml_use_internal_errors(true);
            // Force UTF-8
            $dom->loadHTML('<?xml encoding="UTF-8">' . $indexHtml, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
            libxml_clear_errors();

            $xpath = new DOMXPath($dom);
            $nodes = $xpath->query('//*[@data-i18n]');

            foreach ($nodes as $node) {
                $key = $node->getAttribute('data-i18n');
                if (isset($content[$key])) {
                    $text = $content[$key];

                    if ($node->nodeName === 'input' || $node->nodeName === 'textarea') {
                        $node->setAttribute('placeholder', $text);
                    } else {
                        // Use fragment to support HTML in content (like <br>)
                        $fragment = $dom->createDocumentFragment();
                        if (@$fragment->appendXML($text)) {
                            $node->nodeValue = ''; // Clear existing
                            $node->appendChild($fragment);
                        } else {
                            // Fallback to text if XML parsing fails
                            $node->nodeValue = $text;
                        }
                    }
                }
            }

            // Inject content payload for client-side hydration
            $head = $dom->getElementsByTagName('head')->item(0);
            if ($head) {
                $script = $dom->createElement('script');
                $script->textContent = 'window.PIEL_CONTENT = ' . $contentJson . ';';
                $head->appendChild($script);

                $captchaProvider = function_exists('captcha_get_provider') ? captcha_get_provider() : null;
                $captchaSiteKey = function_exists('captcha_get_site_key') ? captcha_get_site_key() : null;
                $captchaScriptUrl = function_exists('captcha_get_script_url') ? captcha_get_script_url() : null;

                $runtimeConfig = [
                    'captcha' => [
                        'provider' => $captchaProvider,
                        'siteKey' => $captchaSiteKey,
                        'scriptUrl' => $captchaScriptUrl,
                    ],
                    'features' => FeatureFlags::getAll(),
                ];

                $runtimeJson = json_encode(
                    $runtimeConfig,
                    JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP
                );
                if (is_string($runtimeJson)) {
                    $configScript = $dom->createElement('script');
                    $configScript->textContent = 'window.Piel = window.Piel || {}; window.Piel.config = ' . $runtimeJson . ';';
                    $head->appendChild($configScript);
                }
            }

            $indexHtml = $dom->saveHTML();

            // Cleanup artifacts from DOMDocument loadHTML hack
            $indexHtml = str_replace('<?xml encoding="UTF-8">', '', $indexHtml);
        } catch (Throwable $e) {
            error_log('Piel en Armonia SSR fallback: ' . $e->getMessage());
        }
    }
}
// ----------------------------------------------

$assetVersion = '';
if (preg_match('#script\.js\?v=([^"&\']+)#i', $indexHtml, $versionMatch)) {
    $assetVersion = rawurlencode((string) $versionMatch[1]);
}
if ($assetVersion === '') {
    $assetVersion = rawurlencode(app_runtime_version());
}
$bootstrapScriptUrl = 'js/bootstrap-inline-engine.js?v=' . $assetVersion;
$bootstrapScriptTag = '<script src="' . $bootstrapScriptUrl . '" defer></script>';

// Elimina bootstrap inline legado para reducir superficie CSP.
$inlineBootstrapPattern = '#<script>\s*const\s+DEFERRED_STYLESHEET_URL[\s\S]*?</script>#i';
$indexHtml = (string) preg_replace($inlineBootstrapPattern, '', $indexHtml, 1);

// Remueve tags bootstrap existentes para evitar duplicados y cache stale.
$bootstrapTagPattern = '#\s*<script[^>]+src=["\']js/bootstrap-inline-engine\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>#i';
$indexHtml = (string) preg_replace($bootstrapTagPattern, '', $indexHtml);

// Fuerza versionado del bundle principal para invalidar cache en cada deploy.
$mainScriptPattern = '#<script([^>]+src=["\'])script\.js(?:\?[^"\']*)?(["\'][^>]*)></script>#i';
$mainScriptReplacement = '<script$1script.js?v=' . $assetVersion . '$2></script>';
$indexHtml = (string) preg_replace($mainScriptPattern, $mainScriptReplacement, $indexHtml, 1);

// Inyecta bootstrap antes del script principal (idempotente tras limpieza).
$mainScriptInsertPattern = '#<script[^>]+src=["\']script\.js(?:\?[^"\']*)?["\'][^>]*></script>#i';
$mainScriptInsertCount = 0;
$indexHtml = (string) preg_replace(
    $mainScriptInsertPattern,
    $bootstrapScriptTag . "\n    \$0",
    $indexHtml,
    1,
    $mainScriptInsertCount
);

if ($mainScriptInsertCount === 0) {
    $indexHtml = (string) preg_replace(
        '#</body>#i',
        '    ' . $bootstrapScriptTag . "\n</body>",
        $indexHtml,
        1
    );
}

// Prepare HTTP/2 Server Push (Preload) headers
$preloadLinks = [];

// 1. Critical CSS (styles.css) - Extract from HTML to get version
if (preg_match('/href=["\'](styles\.css[^"\']*)["\']/i', $indexHtml, $matches)) {
    $preloadLinks[] = "<{$matches[1]}>; rel=preload; as=style";
}

// 2. Critical Image (hero-woman.jpg) - LCP
$preloadLinks[] = "</images/optimized/hero-woman.jpg>; rel=preload; as=image";

// 3. Critical JS (bootstrap-inline-engine.js) - Versioned
$preloadLinks[] = "<{$bootstrapScriptUrl}>; rel=preload; as=script";

// 4. Main JS (script.js) - Versioned
$preloadLinks[] = "<script.js?v={$assetVersion}>; rel=preload; as=script";

if (!empty($preloadLinks)) {
    header('Link: ' . implode(', ', $preloadLinks), false);
}

echo $indexHtml;
