<?php

declare(strict_types=1);

$action = strtolower(trim((string) ($_GET['action'] ?? '')));

header('Content-Type: application/json; charset=utf-8');

function google_stub_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function google_stub_decode_token(string $token): array
{
    $normalized = strtr($token, '-_', '+/');
    $padding = strlen($normalized) % 4;
    if ($padding > 0) {
        $normalized .= str_repeat('=', 4 - $padding);
    }

    $decoded = base64_decode($normalized, true);
    if (!is_string($decoded) || $decoded === '') {
        return [];
    }

    $payload = json_decode($decoded, true);
    return is_array($payload) ? $payload : [];
}

if ($action === 'token') {
    $grantType = strtolower(trim((string) ($_POST['grant_type'] ?? 'authorization_code')));
    if ($grantType === 'refresh_token') {
        $refreshToken = trim((string) ($_POST['refresh_token'] ?? ''));
        if ($refreshToken === '' || $refreshToken === 'bad-refresh-token') {
            google_stub_json([
                'error' => 'invalid_grant',
                'error_description' => 'Refresh token rejected by stub.',
            ], 400);
        }

        google_stub_json([
            'access_token' => 'stub-access-token-refresh',
            'expires_in' => 3600,
            'token_type' => 'Bearer',
        ]);
    }

    $code = trim((string) ($_POST['code'] ?? ''));
    if ($code === '' || $code === 'bad-code') {
        google_stub_json([
            'error' => 'invalid_grant',
            'error_description' => 'Authorization code rejected by stub.',
        ], 400);
    }

    $parts = explode('|', $code);
    $nonce = trim((string) ($parts[0] ?? ''));
    $email = trim((string) ($parts[1] ?? 'operator@example.com'));
    $sub = trim((string) ($parts[2] ?? 'google-sub-test'));
    $emailVerifiedRaw = strtolower(trim((string) ($parts[3] ?? 'true')));
    $emailVerified = in_array($emailVerifiedRaw, ['1', 'true', 'yes'], true);
    $refreshToken = trim((string) ($parts[4] ?? 'stub-refresh-token'));
    $aud = trim((string) (getenv('PIELARMONIA_GOOGLE_OAUTH_CLIENT_ID') ?: ''));

    $idToken = rtrim(strtr(base64_encode(json_encode([
        'aud' => $aud,
        'iss' => 'https://accounts.google.com',
        'nonce' => $nonce,
        'email' => $email,
        'sub' => $sub,
        'email_verified' => $emailVerified,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');

    google_stub_json([
        'access_token' => 'stub-access-token',
        'expires_in' => 3600,
        'id_token' => $idToken,
        'refresh_token' => $refreshToken,
        'token_type' => 'Bearer',
    ]);
}

if ($action === 'tokeninfo') {
    $token = trim((string) ($_GET['id_token'] ?? ''));
    $decoded = google_stub_decode_token($token);
    if ($decoded === []) {
        google_stub_json([
            'error' => 'invalid_token',
        ], 400);
    }

    google_stub_json($decoded);
}

google_stub_json([
    'error' => 'unknown_action',
], 404);
