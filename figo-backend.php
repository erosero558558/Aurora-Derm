<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/lib/figo_utils.php';

apply_security_headers(false);

/**
 * Figo backend local:
 * - Web chat mode: receives OpenAI-style payload and returns chat.completion
 * - Telegram webhook mode: receives Telegram updates and replies as bot
 */

function figo_backend_normalize_text(string $text): string
{
    $text = strtolower(trim($text));
    if ($text === '') {
        return '';
    }

    if (function_exists('iconv')) {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if (is_string($ascii) && $ascii !== '') {
            $text = $ascii;
        }
    }

    $text = preg_replace('/\s+/', ' ', $text);
    return is_string($text) ? $text : '';
}

function figo_backend_contains_any(string $text, array $patterns): bool
{
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $text) === 1) {
            return true;
        }
    }
    return false;
}

function figo_backend_is_clinic_scope(string $normalizedText): bool
{
    if ($normalizedText === '') {
        return true;
    }

    return figo_backend_contains_any($normalizedText, [
        '/\bpiel\b/',
        '/\bdermat/',
        '/\bacne\b/',
        '/\bconsulta\b/',
        '/\bcita\b/',
        '/\bagendar\b/',
        '/\breservar\b/',
        '/\bdoctor\b/',
        '/\bdoctora\b/',
        '/\brosero\b/',
        '/\bnarvaez\b/',
        '/\bprecio\b/',
        '/\bcosto\b/',
        '/\bpago\b/',
        '/\btransferencia\b/',
        '/\btarjeta\b/',
        '/\bwhatsapp\b/',
        '/\btelefono\b/',
        '/\bubicacion\b/',
        '/\bdireccion\b/',
        '/\bhorario\b/',
        '/\blaser\b/',
        '/\brejuvenec/',
        '/\bcancer\b/',
        '/\bservicio\b/',
        '/\btratamiento\b/'
    ]);
}

function figo_backend_should_fast_local_response(string $normalizedText): bool
{
    if ($normalizedText === '') {
        return true;
    }

    if (preg_match('/^(hola|buenos dias|buenas tardes|buenas noches|hi|hello|gracias|ok|vale|listo|perfecto|genial)$/', $normalizedText) === 1) {
        return true;
    }

    if (figo_backend_contains_any($normalizedText, [
        '/\bping\b/',
        '/\blatencia\b/',
        '/\bprueba\b/',
        '/\btest\b/'
    ])) {
        return true;
    }

    $isOutOfScope = figo_backend_contains_any($normalizedText, [
        '/\bcapital\b/',
        '/\bpresidente\b/',
        '/\bdeporte\b/',
        '/\bfutbol\b/',
        '/\bpartido\b/',
        '/\bclima\b/',
        '/\btemperatura\b/',
        '/\bnoticia\b/',
        '/\bhistoria\b/',
        '/\bgeografia\b/',
        '/\bmatematica\b/',
        '/\bprogramacion\b/',
        '/\bcodigo\b/',
        '/\btraduce\b/',
        '/\btraduccion\b/',
        '/\bpelicula\b/',
        '/\bmusica\b/',
        '/\bbitcoin\b/',
        '/\bcriptomoneda\b/',
        '/\bpolitica\b/'
    ]);

    if ($isOutOfScope && !figo_backend_is_clinic_scope($normalizedText)) {
        return true;
    }

    return false;
}

function figo_backend_last_user_message(array $messages): string
{
    for ($i = count($messages) - 1; $i >= 0; $i--) {
        $msg = $messages[$i] ?? null;
        if (is_array($msg) && (($msg['role'] ?? '') === 'user') && is_string($msg['content'] ?? null)) {
            return trim((string) $msg['content']);
        }
    }
    return '';
}

function figo_backend_internal_token(): string
{
    $fileConfig = api_figo_read_config();
    return api_first_non_empty([
        getenv('FIGO_INTERNAL_TOKEN'),
        getenv('FIGO_CHAT_INTERNAL_TOKEN'),
        $fileConfig['internalToken'] ?? null
    ]);
}

function figo_backend_internal_token_header(): string
{
    $fileConfig = api_figo_read_config();
    $header = api_first_non_empty([
        getenv('FIGO_INTERNAL_TOKEN_HEADER'),
        $fileConfig['internalTokenHeader'] ?? null
    ]);

    return $header !== '' ? $header : 'X-Figo-Internal-Token';
}

function figo_backend_request_header_value(string $headerName): string
{
    $headerName = trim($headerName);
    if ($headerName === '') {
        return '';
    }

    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $name => $value) {
                if (is_string($name) && strcasecmp($name, $headerName) === 0) {
                    return is_string($value) ? trim($value) : '';
                }
            }
        }
    }

    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $headerName));
    if (isset($_SERVER[$serverKey]) && is_string($_SERVER[$serverKey])) {
        return trim((string) $_SERVER[$serverKey]);
    }

    return '';
}

function figo_backend_read_internal_request_token(): string
{
    $headerName = figo_backend_internal_token_header();
    $raw = figo_backend_request_header_value($headerName);
    if ($raw !== '') {
        if (strcasecmp($headerName, 'Authorization') === 0) {
            if (preg_match('/^\s*Bearer\s+(.+)\s*$/i', $raw, $matches) === 1) {
                return trim((string) $matches[1]);
            }
            return '';
        }
        return $raw;
    }

    // Fallback defensivo para infraestructura legacy.
    $legacyRaw = figo_backend_request_header_value('X-Figo-Internal-Token');
    if ($legacyRaw !== '') {
        return $legacyRaw;
    }

    $authRaw = figo_backend_request_header_value('Authorization');
    if ($authRaw !== '' && preg_match('/^\s*Bearer\s+(.+)\s*$/i', $authRaw, $matches) === 1) {
        return trim((string) $matches[1]);
    }

    return '';
}

function figo_backend_limit_text(string $text, int $maxLength = 900): string
{
    $clean = trim(preg_replace('/\s+/', ' ', $text) ?? '');
    if ($clean === '') {
        return '';
    }

    if ($maxLength <= 0) {
        return $clean;
    }

    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($clean, 'UTF-8') > $maxLength) {
            return rtrim((string) mb_substr($clean, 0, $maxLength, 'UTF-8')) . '...';
        }
        return $clean;
    }

    if (strlen($clean) > $maxLength) {
        return rtrim(substr($clean, 0, $maxLength)) . '...';
    }

    return $clean;
}

function figo_backend_prepare_ai_context_messages(array $rawMessages): array
{
    $prepared = [];
    foreach ($rawMessages as $msg) {
        if (!is_array($msg)) {
            continue;
        }

        $role = strtolower(trim((string) ($msg['role'] ?? '')));
        if (!in_array($role, ['user', 'assistant'], true)) {
            continue;
        }

        $content = isset($msg['content']) && is_string($msg['content'])
            ? figo_backend_limit_text((string) $msg['content'], 700)
            : '';
        if ($content === '') {
            continue;
        }

        $prepared[] = [
            'role' => $role,
            'content' => $content
        ];
    }

    if (count($prepared) > 6) {
        $prepared = array_slice($prepared, -6);
    }

    return $prepared;
}

function figo_backend_ai_endpoint_host(): string
{
    $endpoint = api_figo_env_ai_endpoint();
    if ($endpoint === '') {
        return '';
    }
    $parts = @parse_url($endpoint);
    if (!is_array($parts)) {
        return '';
    }
    return isset($parts['host']) ? strtolower((string) $parts['host']) : '';
}

function figo_backend_ai_provider(): string
{
    $host = figo_backend_ai_endpoint_host();
    if ($host === '') {
        return 'none';
    }

    if (strpos($host, 'moonshot.ai') !== false || strpos($host, 'kimi.com') !== false) {
        return 'kimi';
    }
    if (strpos($host, 'openrouter.ai') !== false) {
        return 'openrouter';
    }
    if (strpos($host, 'openai.com') !== false) {
        return 'openai';
    }

    return 'openai_compatible';
}

function figo_backend_probe_ai_endpoint(int $timeoutSeconds = 3): ?bool
{
    $endpoint = api_figo_env_ai_endpoint();
    if ($endpoint === '') {
        return null;
    }

    if (!function_exists('curl_init') || !function_exists('curl_setopt_array') || !function_exists('curl_exec')) {
        return null;
    }

    $timeout = max(1, min(6, $timeoutSeconds));
    $ch = curl_init($endpoint);
    if ($ch === false) {
        return null;
    }

    curl_setopt_array($ch, [
        CURLOPT_NOBODY => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => $timeout,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ]);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $status === 0) {
        return false;
    }

    return $status < 500;
}

function figo_backend_ai_system_prompt(): string
{
    return "Eres Figo, asistente virtual amigable de la clínica dermatológica \"Piel en Armonía\" en Quito, Ecuador.\n"
        . "Eres conversacional y natural. Puedes hablar de cualquier tema de forma amena, pero tu especialidad es la clínica.\n"
        . "Cuando pregunten sobre la clínica, da información precisa:\n"
        . "- Consulta presencial: \$40 (IVA 0%) | Telefónica: \$25 (IVA 0%) | Video: \$30 (IVA 0%)\n"
        . "- Acné: desde \$80 (IVA 0%) | Láser: desde \$172.50 (IVA 15% incl.) | Rejuvenecimiento: desde \$138 (IVA 15% incl.)\n"
        . "- Detección cáncer de piel: desde \$70 (IVA 0%)\n"
        . "- Dirección: Valparaíso 13-183 y Sodiro, Consultorio Dr. Celio Caiza, Quito\n"
        . "- Horario: L-V 9:00-18:00, Sáb 9:00-13:00\n"
        . "- WhatsApp: +593 98 245 3672\n"
        . "- Doctores: Dr. Javier Rosero (dermatólogo clínico), Dra. Carolina Narváez (estética/láser)\n"
        . "- Web: https://pielarmonia.com\n"
        . "Responde en español. Sé conciso (2-4 oraciones para temas generales, más detalle para temas de la clínica).";
}

function figo_backend_extract_ai_content(array $decoded, string $raw): ?string
{
    if (isset($decoded['choices'][0]['message']['content']) && is_string($decoded['choices'][0]['message']['content'])) {
        $content = trim($decoded['choices'][0]['message']['content']);
        return $content !== '' ? $content : null;
    }

    if (isset($decoded['choices'][0]['text']) && is_string($decoded['choices'][0]['text'])) {
        $content = trim($decoded['choices'][0]['text']);
        return $content !== '' ? $content : null;
    }

    if (isset($decoded['content']) && is_array($decoded['content']) && isset($decoded['content'][0]['text']) && is_string($decoded['content'][0]['text'])) {
        $content = trim($decoded['content'][0]['text']);
        return $content !== '' ? $content : null;
    }

    if (isset($decoded['candidates'][0]['content']['parts'][0]['text']) && is_string($decoded['candidates'][0]['content']['parts'][0]['text'])) {
        $content = trim($decoded['candidates'][0]['content']['parts'][0]['text']);
        return $content !== '' ? $content : null;
    }

    foreach (['reply', 'response', 'text', 'answer', 'content', 'output'] as $key) {
        if (isset($decoded[$key]) && is_string($decoded[$key]) && trim($decoded[$key]) !== '') {
            return trim($decoded[$key]);
        }
    }

    $fallbackRaw = trim($raw);
    if ($fallbackRaw !== '' && strpos($fallbackRaw, '<') === false) {
        return $fallbackRaw;
    }

    return null;
}

function figo_backend_ai_response(string $userMessage, array $contextMessages = [], int $requestedMaxTokens = 0, ?float $requestedTemperature = null): ?string
{
    $endpoint = api_figo_env_ai_endpoint();
    if ($endpoint === '') {
        return null;
    }

    $messages = [['role' => 'system', 'content' => figo_backend_ai_system_prompt()]];

    $preparedContext = figo_backend_prepare_ai_context_messages($contextMessages);
    if ($preparedContext !== []) {
        foreach ($preparedContext as $msg) {
            $messages[] = $msg;
        }
        $lastRole = (string) ($preparedContext[count($preparedContext) - 1]['role'] ?? '');
        if ($lastRole !== 'user' && trim($userMessage) !== '') {
            $messages[] = ['role' => 'user', 'content' => figo_backend_limit_text($userMessage, 700)];
        }
    } else {
        $messages[] = ['role' => 'user', 'content' => $userMessage];
    }

    $maxTokens = api_figo_env_ai_max_tokens();
    if ($requestedMaxTokens > 0) {
        $requestedMaxTokens = max(64, min(1200, $requestedMaxTokens));
        $maxTokens = min($maxTokens, $requestedMaxTokens);
    }

    $temperature = 0.7;
    if ($requestedTemperature !== null) {
        $temperature = max(0.0, min(1.0, $requestedTemperature));
    }

    $payload = json_encode([
        'model' => api_figo_env_ai_model(),
        'messages' => $messages,
        'max_tokens' => $maxTokens,
        'temperature' => $temperature
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if (!is_string($payload)) {
        return null;
    }

    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    $apiKey = api_figo_env_ai_key();
    if ($apiKey !== '') {
        $keyHeader = api_figo_env_ai_key_header();
        if (strcasecmp($keyHeader, 'Authorization') === 0) {
            $prefix = api_figo_env_ai_key_prefix();
            $authValue = $apiKey;
            if ($prefix !== '' && stripos($authValue, $prefix . ' ') !== 0) {
                $authValue = $prefix . ' ' . $authValue;
            }
            $headers[] = 'Authorization: ' . $authValue;
        } else {
            $headers[] = $keyHeader . ': ' . $apiKey;
        }
    }

    $ch = curl_init($endpoint);
    if ($ch === false) {
        return null;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => api_figo_env_ai_timeout_seconds(),
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ]);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!is_string($raw) || $status >= 400) {
        return null;
    }

    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        return figo_backend_extract_ai_content($decoded, $raw);
    }

    $plain = trim($raw);
    return $plain !== '' ? $plain : null;
}

function figo_backend_ai_unavailable_message(): string
{
    return 'Figo IA no esta disponible en este momento. '
        . 'Para atencion inmediata, escribe a WhatsApp +593 98 245 3672.';
}

function figo_backend_answer(string $userMessage): string
{
    $normalized = figo_backend_normalize_text($userMessage);

    if ($normalized === '') {
        return 'Hola, soy Figo de Piel en Armonia. Puedo ayudarte con servicios, precios, pagos y reservas. En que te ayudo?';
    }

    if (
        figo_backend_contains_any($normalized, [
            '/\bcapital\b/',
            '/\bpresidente\b/',
            '/\bdeporte\b/',
            '/\bfutbol\b/',
            '/\bpartido\b/',
            '/\bclima\b/',
            '/\bnoticia\b/',
            '/\bhistoria\b/',
            '/\bgeografia\b/',
            '/\bmatematica\b/',
            '/\bprogramacion\b/',
            '/\bcodigo\b/',
            '/\btraduce\b/',
            '/\btraduccion\b/',
            '/\bpelicula\b/',
            '/\bmusica\b/',
            '/\bbitcoin\b/',
            '/\bcriptomoneda\b/',
            '/\bpolitica\b/'
        ]) && !figo_backend_is_clinic_scope($normalized)
    ) {
        return "Puedo ayudarte solo con temas de Piel en Armonia: servicios, precios, pagos, horarios y reservas.\n"
            . "Si quieres, te guio para agendar cita o elegir tratamiento.\n"
            . "Atencion inmediata: WhatsApp +593 98 245 3672.";
    }

    if (figo_backend_contains_any($normalized, [
        '/\bpago\b/',
        '/\bpagar\b/',
        '/\btarjeta\b/',
        '/\btransferencia\b/',
        '/\befectivo\b/',
        '/\bfactura\b/',
        '/\bcomprobante\b/'
    ])) {
        return "Para pagar en la web:\n"
            . "1) Completa el formulario en Reservar Cita.\n"
            . "2) Se abre el modal de pago automaticamente.\n"
            . "3) Elige tarjeta, transferencia o efectivo.\n"
            . "4) Confirma y la cita queda registrada.\n\n"
            . "Si eliges transferencia, sube comprobante y numero de referencia.\n"
            . "Soporte inmediato: WhatsApp +593 98 245 3672.";
    }

    if (figo_backend_contains_any($normalized, [
        '/\bcita\b/',
        '/\bagendar\b/',
        '/\breservar\b/',
        '/\bturno\b/',
        '/\bhora\b/'
    ])) {
        return "Para reservar:\n"
            . "1) Elige servicio y doctor.\n"
            . "2) Selecciona fecha y hora.\n"
            . "3) Completa tus datos.\n"
            . "4) Continua al pago y confirma.\n\n"
            . "Tambien puedes reservar por WhatsApp: https://wa.me/593982453672";
    }

    if (figo_backend_contains_any($normalized, [
        '/\bservicio\b/',
        '/\btratamiento\b/',
        '/\bofrecen\b/',
        '/\bhacen\b/'
    ])) {
        return "Servicios principales:\n"
            . "- Consulta Dermatológica: \$40 (IVA 0%)\n"
            . "- Consulta Telefónica: \$25 (IVA 0%)\n"
            . "- Video Consulta: \$30 (IVA 0%)\n"
            . "- Tratamiento de Acné: desde \$80 (IVA 0%)\n"
            . "- Rejuvenecimiento: desde \$138 (IVA 15% incl.)\n"
            . "- Láser Dermatológico: desde \$172.50 (IVA 15% incl.)\n"
            . "- Detección de Cáncer de Piel: desde \$70 (IVA 0%)";
    }

    if (figo_backend_contains_any($normalized, [
        '/\bprecio\b/',
        '/\bcosto\b/',
        '/\bvalor\b/',
        '/\btarifa\b/',
        '/\bcuanto\b/'
    ])) {
        return "Precios (IVA incluido donde aplica):\n"
            . "- Consulta Dermatológica: \$40 (IVA 0%)\n"
            . "- Consulta Telefónica: \$25 (IVA 0%)\n"
            . "- Video Consulta: \$30 (IVA 0%)\n"
            . "- Láser: desde \$172.50 (IVA 15% incl.)\n"
            . "- Rejuvenecimiento: desde \$138 (IVA 15% incl.)\n"
            . "- Acné: desde \$80 (IVA 0%)";
    }

    if (figo_backend_contains_any($normalized, [
        '/\bubicacion\b/',
        '/\bdireccion\b/',
        '/\bdonde\b/',
        '/\bhorario\b/'
    ])) {
        return "Estamos en Quito, Ecuador.\n"
            . "Dirección: Valparaíso 13-183 y Sodiro, Consultorio Dr. Celio Caiza.\n"
            . "Horario: Lunes a Viernes 09:00-18:00, Sábados 09:00-13:00.\n"
            . "Teléfono/WhatsApp: +593 98 245 3672.";
    }

    return "Gracias por escribirme. Soy Figo de Piel en Armonia y estoy para ayudarte.\n"
        . "Puedo darte informacion sobre servicios dermatologicos, precios, citas, pagos, horarios y ubicacion.\n"
        . "Si necesitas atencion directa: WhatsApp +593 98 245 3672.";
}

function figo_backend_compose_response(string $userMessage, array $messages = [], int $requestedMaxTokens = 0, ?float $requestedTemperature = null): array
{
    $aiConfigured = api_figo_env_ai_endpoint() !== '';
    $allowFallback = api_figo_env_allow_local_fallback();
    $aiProvider = figo_backend_ai_provider();
    $normalizedUserMessage = figo_backend_normalize_text($userMessage);

    if (figo_backend_should_fast_local_response($normalizedUserMessage)) {
        return [
            'ok' => true,
            'mode' => 'local',
            'provider' => 'pattern_matching',
            'reason' => 'fast_local_scope_guard',
            'content' => figo_backend_answer($userMessage),
            'status' => 200
        ];
    }

    $aiContent = null;
    if ($aiConfigured) {
        $aiContent = figo_backend_ai_response(
            $userMessage,
            $messages,
            $requestedMaxTokens,
            $requestedTemperature
        );
    }

    if (is_string($aiContent) && trim($aiContent) !== '') {
        return [
            'ok' => true,
            'mode' => 'ai',
            'provider' => $aiProvider,
            'reason' => '',
            'content' => trim($aiContent),
            'status' => 200
        ];
    }

    if (!$allowFallback) {
        return [
            'ok' => false,
            'mode' => 'unavailable',
            'provider' => $aiConfigured ? $aiProvider : 'none',
            'reason' => $aiConfigured ? 'ai_upstream_unavailable' : 'ai_not_configured',
            'content' => figo_backend_ai_unavailable_message(),
            'status' => 503
        ];
    }

    return [
        'ok' => true,
        'mode' => 'local',
        'provider' => 'pattern_matching',
        'reason' => $aiConfigured ? 'ai_fallback_local' : 'ai_not_configured',
        'content' => figo_backend_answer($userMessage),
        'status' => 200
    ];
}

function figo_backend_telegram_token(): string
{
    $candidates = [
        getenv('FIGO_TELEGRAM_BOT_TOKEN'),
        getenv('TELEGRAM_BOT_TOKEN'),
        getenv('FIGO_CHAT_TOKEN')
    ];
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }
    return '';
}

function figo_backend_telegram_chat_id(): string
{
    $candidates = [
        getenv('FIGO_TELEGRAM_CHAT_ID'),
        getenv('TELEGRAM_CHAT_ID')
    ];
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }
    return '';
}

function figo_backend_telegram_webhook_secret(): string
{
    $secret = getenv('FIGO_TELEGRAM_WEBHOOK_SECRET');
    return is_string($secret) ? trim($secret) : '';
}

function figo_backend_telegram_api_request(string $token, string $method, array $payload): array
{
    if ($token === '' || $method === '') {
        return ['ok' => false, 'error' => 'invalid_token_or_method'];
    }

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        return ['ok' => false, 'error' => 'payload_encode_failed'];
    }

    $url = 'https://api.telegram.org/bot' . $token . '/' . $method;
    $ch = curl_init($url);
    if ($ch === false) {
        return ['ok' => false, 'error' => 'curl_init_failed'];
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json'
        ],
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ]);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if (!is_string($raw) || $status >= 400) {
        return [
            'ok' => false,
            'error' => 'telegram_http_error',
            'status' => $status,
            'curl' => $curlErr
        ];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'telegram_invalid_json'];
    }

    return $decoded;
}

function figo_backend_telegram_send_message(string $token, string $chatId, string $text): bool
{
    if ($token === '' || $chatId === '' || trim($text) === '') {
        return false;
    }

    $resp = figo_backend_telegram_api_request($token, 'sendMessage', [
        'chat_id' => $chatId,
        'text' => $text,
        'disable_web_page_preview' => true
    ]);

    return (($resp['ok'] ?? false) === true);
}

function figo_backend_is_telegram_update(array $payload): bool
{
    return isset($payload['update_id']) && (is_int($payload['update_id']) || ctype_digit((string) $payload['update_id']));
}

function figo_backend_validate_telegram_secret(): bool
{
    $expected = figo_backend_telegram_webhook_secret();
    if ($expected === '') {
        return true;
    }

    $received = isset($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'])
        ? trim((string) $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'])
        : '';

    return $received !== '' && hash_equals($expected, $received);
}

function figo_backend_handle_telegram_update(array $update, string $telegramToken): void
{
    if (!figo_backend_validate_telegram_secret()) {
        json_response([
            'ok' => false,
            'error' => 'invalid_telegram_secret'
        ], 403);
    }

    if ($telegramToken === '') {
        json_response([
            'ok' => false,
            'error' => 'telegram_token_missing'
        ], 503);
    }

    $msg = $update['message'] ?? null;
    if (!is_array($msg)) {
        json_response(['ok' => true, 'handled' => false]);
    }

    $chat = $msg['chat'] ?? null;
    $chatId = is_array($chat) && isset($chat['id']) ? (string) $chat['id'] : '';
    $text = isset($msg['text']) && is_string($msg['text']) ? trim((string) $msg['text']) : '';

    if ($chatId === '') {
        json_response(['ok' => true, 'handled' => false]);
    }

    if ($text === '/start') {
        $welcome = "Hola, soy Figo de Piel en Armonia.\n"
            . "Te ayudo con servicios, precios, pagos y reservas.\n"
            . "Escribe tu consulta y te respondo.";
        figo_backend_telegram_send_message($telegramToken, $chatId, $welcome);
        json_response(['ok' => true, 'handled' => true]);
    }

    if ($text === '') {
        figo_backend_telegram_send_message($telegramToken, $chatId, 'Escribeme tu consulta en texto para poder ayudarte.');
        json_response(['ok' => true, 'handled' => true]);
    }

    $result = figo_backend_compose_response($text, [['role' => 'user', 'content' => $text]]);
    $answer = isset($result['content']) && is_string($result['content']) ? $result['content'] : figo_backend_ai_unavailable_message();
    figo_backend_telegram_send_message($telegramToken, $chatId, $answer);
    json_response([
        'ok' => true,
        'handled' => true,
        'mode' => isset($result['mode']) ? (string) $result['mode'] : 'local',
        'provider' => isset($result['provider']) ? (string) $result['provider'] : 'pattern_matching',
        'reason' => isset($result['reason']) ? (string) $result['reason'] : ''
    ]);
}

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
api_apply_cors(['GET', 'POST', 'OPTIONS'], ['Content-Type', 'Authorization', 'X-Telegram-Bot-Api-Secret-Token'], true);

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

header('Content-Type: application/json; charset=utf-8');

$telegramToken = figo_backend_telegram_token();
$telegramConfigured = $telegramToken !== '';
$telegramChatId = figo_backend_telegram_chat_id();
$telegramChatConfigured = $telegramChatId !== '';

if ($method === 'GET') {
    $aiEndpoint = api_figo_env_ai_endpoint();
    $fileConfig = api_figo_read_config();
    $configSource = isset($fileConfig['__source']) && is_string($fileConfig['__source'])
        ? basename((string) $fileConfig['__source'])
        : 'environment';
    json_response([
        'ok' => true,
        'service' => 'figo-backend',
        'mode' => $aiEndpoint !== '' ? 'ai' : 'local',
        'provider' => $aiEndpoint !== '' ? figo_backend_ai_provider() : 'pattern_matching',
        'aiProvider' => figo_backend_ai_provider(),
        'aiConfigured' => $aiEndpoint !== '',
        'aiModel' => api_figo_env_ai_model(),
        'aiEndpointHost' => figo_backend_ai_endpoint_host(),
        'aiUpstreamReachable' => figo_backend_probe_ai_endpoint(3),
        'allowLocalFallback' => api_figo_env_allow_local_fallback(),
        'internalTokenRequired' => figo_backend_internal_token() !== '',
        'internalTokenHeader' => figo_backend_internal_token_header(),
        'configSource' => $configSource,
        'telegramConfigured' => $telegramConfigured,
        'telegramChatConfigured' => $telegramChatConfigured,
        'telegramForwardWebMessages' => false,
        'webhookSecretConfigured' => figo_backend_telegram_webhook_secret() !== '',
        'timestamp' => gmdate('c')
    ]);
}

if ($method !== 'POST') {
    json_response([
        'ok' => false,
        'error' => 'Metodo no permitido'
    ], 405);
}

require_rate_limit('figo-backend', 30, 60);
$payload = require_json_body();

if (figo_backend_is_telegram_update($payload)) {
    figo_backend_handle_telegram_update($payload, $telegramToken);
}

$requiredInternalToken = figo_backend_internal_token();
if ($requiredInternalToken !== '') {
    $requestToken = figo_backend_read_internal_request_token();
    if ($requestToken === '' || !hash_equals($requiredInternalToken, $requestToken)) {
        json_response([
            'ok' => false,
            'error' => 'Unauthorized',
            'code' => 'invalid_internal_token'
        ], 401);
    }
}

$messages = isset($payload['messages']) && is_array($payload['messages'])
    ? $payload['messages']
    : [];
if ($messages === []) {
    json_response([
        'ok' => false,
        'error' => 'messages required'
    ], 400);
}

$model = isset($payload['model']) && is_string($payload['model']) && trim($payload['model']) !== ''
    ? trim($payload['model'])
    : 'figo-assistant';
$requestedMaxTokens = isset($payload['max_tokens']) ? (int) $payload['max_tokens'] : 0;
$requestedTemperature = isset($payload['temperature']) ? (float) $payload['temperature'] : null;

$userMessage = figo_backend_last_user_message($messages);
$responsePlan = figo_backend_compose_response(
    $userMessage,
    $messages,
    $requestedMaxTokens,
    $requestedTemperature
);
$content = isset($responsePlan['content']) && is_string($responsePlan['content']) ? $responsePlan['content'] : figo_backend_ai_unavailable_message();
$provider = isset($responsePlan['provider']) ? (string) $responsePlan['provider'] : 'pattern_matching';
$mode = isset($responsePlan['mode']) ? (string) $responsePlan['mode'] : 'local';
$reason = isset($responsePlan['reason']) ? (string) $responsePlan['reason'] : '';
$allowLocalFallback = api_figo_env_allow_local_fallback();
$aiConfigured = api_figo_env_ai_endpoint() !== '';

if (($responsePlan['ok'] ?? false) !== true) {
    json_response([
        'ok' => false,
        'error' => $content,
        'reason' => $reason,
        'mode' => $mode,
        'provider' => $provider,
        'aiConfigured' => $aiConfigured,
        'allowLocalFallback' => $allowLocalFallback
    ], (int) ($responsePlan['status'] ?? 503));
}

if (false && $telegramConfigured && $telegramChatConfigured) {
    $telegramText = "Nuevo mensaje web (Piel en Armonia)\n"
        . "Paciente: " . ($userMessage === '' ? '[vacio]' : $userMessage) . "\n"
        . "Respuesta: " . $content . "\n"
        . "Hora: " . gmdate('Y-m-d H:i:s') . ' UTC';
    figo_backend_telegram_send_message($telegramToken, $telegramChatId, $telegramText);
}

try {
    $id = 'figo-local-' . bin2hex(random_bytes(8));
} catch (Throwable $e) {
    $id = 'figo-local-' . substr(md5((string) microtime(true)), 0, 16);
}

json_response([
    'id' => $id,
    'object' => 'chat.completion',
    'created' => time(),
    'model' => $model,
    'choices' => [[
        'index' => 0,
        'message' => [
            'role' => 'assistant',
            'content' => $content
        ],
        'finish_reason' => 'stop'
    ]],
    'mode' => $mode,
    'provider' => $provider,
    'reason' => $reason,
    'aiConfigured' => $aiConfigured,
    'allowLocalFallback' => $allowLocalFallback,
    'telegramConfigured' => $telegramConfigured,
    'telegramChatConfigured' => $telegramChatConfigured
]);
