<?php

declare(strict_types=1);

require_once __DIR__ . '/lib/common.php';
require_once __DIR__ . '/lib/business.php';
require_once __DIR__ . '/lib/AppConfig.php';

if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    try {
        require_once __DIR__ . '/vendor/autoload.php';
    } catch (Throwable $autoloadError) {
        error_log('Piel en Armonia: Composer autoload no disponible en pagos (' . $autoloadError->getMessage() . ')');
    }
}

const TRANSFER_PROOF_MAX_BYTES = AppConfig::TRANSFER_PROOF_MAX_BYTES;

function payment_currency(): string
{
    return AppConfig::getPaymentCurrency();
}

function payment_stripe_secret_key(): string
{
    $raw = getenv('PIELARMONIA_STRIPE_SECRET_KEY');
    return is_string($raw) ? trim($raw) : '';
}

function payment_stripe_publishable_key(): string
{
    $raw = getenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY');
    return is_string($raw) ? trim($raw) : '';
}

function payment_stripe_webhook_secret(): string
{
    $raw = getenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET');
    return is_string($raw) ? trim($raw) : '';
}

function payment_gateway_enabled(): bool
{
    if (!class_exists('\Stripe\StripeClient')) {
        return false;
    }
    return payment_stripe_secret_key() !== '' && payment_stripe_publishable_key() !== '';
}

function stripe_verify_webhook_signature(string $payload, string $sigHeader, string $secret): array
{
    if (!class_exists('\Stripe\Webhook')) {
        throw new RuntimeException('Stripe SDK no disponible en el servidor.');
    }

    try {
        $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, $secret);
        return $event->toArray();
    } catch (\UnexpectedValueException $e) {
        throw new RuntimeException('Payload de webhook invalido.');
    } catch (\Stripe\Exception\SignatureVerificationException $e) {
        throw new RuntimeException('Firma de webhook no coincide.');
    }
}

function payment_expected_amount_cents(string $service, ?string $date = null, ?string $time = null, ?string $tenantId = null): int
{
    $subtotal = get_service_price_amount($service, $date, $time, $tenantId);
    // Usa la tasa especifica del servicio en lugar de la global
    $taxRate = function_exists('get_service_tax_rate') ? get_service_tax_rate($service, $tenantId) : get_vat_rate($tenantId);
    $total = $subtotal + ($subtotal * $taxRate);
    return (int) round($total * 100);
}

function payment_build_idempotency_key(string $prefix, string $seed): string
{
    $safePrefix = preg_replace('/[^a-z0-9_-]/i', '-', $prefix);
    if (!is_string($safePrefix) || trim($safePrefix) === '') {
        $safePrefix = 'pay';
    }
    return strtolower($safePrefix) . '-' . substr(hash('sha256', $seed), 0, 48);
}

function stripe_create_payment_intent(array $appointment, string $idempotencyKey = ''): array
{
    if (!class_exists('\Stripe\StripeClient')) {
        throw new RuntimeException('Stripe SDK no disponible en el servidor.');
    }

    $secret = payment_stripe_secret_key();
    if ($secret === '') {
        throw new RuntimeException('La pasarela de pagos no esta configurada.');
    }

    $service = (string) ($appointment['service'] ?? '');
    $date = (string) ($appointment['date'] ?? '');
    $time = (string) ($appointment['time'] ?? '');
    $amountCents = payment_expected_amount_cents($service, $date, $time);
    if ($amountCents <= 0) {
        throw new RuntimeException('No se pudo calcular el monto del pago.');
    }

    $email = trim((string) ($appointment['email'] ?? ''));
    $metadata = [
        'site' => 'pielarmonia.com',
        'service' => $service,
        'doctor' => (string) ($appointment['doctor'] ?? ''),
        'date' => (string) ($appointment['date'] ?? ''),
        'time' => (string) ($appointment['time'] ?? ''),
        'name' => (string) ($appointment['name'] ?? ''),
        'phone' => (string) ($appointment['phone'] ?? ''),
    ];

    $params = [
        'amount' => $amountCents,
        'currency' => strtolower(payment_currency()),
        'automatic_payment_methods' => ['enabled' => true],
        'description' => 'Reserva de cita - ' . AppConfig::BRAND_NAME,
        'metadata' => $metadata,
    ];
    if ($email !== '') {
        $params['receipt_email'] = $email;
    }

    $options = [];
    if ($idempotencyKey !== '') {
        $options['idempotency_key'] = $idempotencyKey;
    }

    try {
        $stripe = new \Stripe\StripeClient($secret);
        $intent = $stripe->paymentIntents->create($params, $options);
        return $intent->toArray();
    } catch (\Stripe\Exception\ApiErrorException $e) {
        throw new RuntimeException($e->getMessage());
    }
}

function stripe_create_checkout_session(
    array $appointment,
    string $successUrl,
    string $cancelUrl,
    array $metadata = [],
    string $idempotencyKey = ''
): array {
    if (!class_exists('\Stripe\StripeClient')) {
        throw new RuntimeException('Stripe SDK no disponible en el servidor.');
    }

    $secret = payment_stripe_secret_key();
    if ($secret === '') {
        throw new RuntimeException('La pasarela de pagos no esta configurada.');
    }

    $service = (string) ($appointment['service'] ?? '');
    $date = (string) ($appointment['date'] ?? '');
    $time = (string) ($appointment['time'] ?? '');
    $amountCents = payment_expected_amount_cents($service, $date, $time);
    if ($amountCents <= 0) {
        throw new RuntimeException('No se pudo calcular el monto del pago.');
    }

    $successUrl = trim($successUrl);
    $cancelUrl = trim($cancelUrl);
    if ($successUrl === '' || $cancelUrl === '') {
        throw new RuntimeException('Faltan URLs de retorno para el checkout.');
    }

    $email = trim((string) ($appointment['email'] ?? ''));
    $descriptionParts = [];
    if ($date !== '') {
        $descriptionParts[] = $date;
    }
    if ($time !== '') {
        $descriptionParts[] = $time;
    }
    if (trim((string) ($appointment['doctor'] ?? '')) !== '') {
        $descriptionParts[] = trim((string) $appointment['doctor']);
    }

    $stripeMetadata = payment_normalize_stripe_metadata(array_merge([
        'site' => 'pielarmonia.com',
        'service' => $service,
        'doctor' => (string) ($appointment['doctor'] ?? ''),
        'date' => $date,
        'time' => $time,
        'name' => (string) ($appointment['name'] ?? ''),
        'phone' => (string) ($appointment['phone'] ?? ''),
    ], $metadata));

    $params = [
        'mode' => 'payment',
        'success_url' => $successUrl,
        'cancel_url' => $cancelUrl,
        'line_items' => [[
            'quantity' => 1,
            'price_data' => [
                'currency' => strtolower(payment_currency()),
                'unit_amount' => $amountCents,
                'product_data' => [
                    'name' => get_service_label($service) . ' - ' . AppConfig::BRAND_NAME,
                    'description' => implode(' | ', array_filter($descriptionParts)),
                ],
            ],
        ]],
        'metadata' => $stripeMetadata,
        'payment_intent_data' => [
            'metadata' => $stripeMetadata,
        ],
    ];
    if ($email !== '') {
        $params['customer_email'] = $email;
    }

    $clientReferenceId = trim((string) ($metadata['wa_draft_id'] ?? ($metadata['client_reference_id'] ?? '')));
    if ($clientReferenceId !== '') {
        $params['client_reference_id'] = substr($clientReferenceId, 0, 200);
    }

    $options = [];
    if ($idempotencyKey !== '') {
        $options['idempotency_key'] = $idempotencyKey;
    }

    try {
        $stripe = new \Stripe\StripeClient($secret);
        $session = $stripe->checkout->sessions->create($params, $options);
        return $session->toArray();
    } catch (\Stripe\Exception\ApiErrorException $e) {
        throw new RuntimeException($e->getMessage());
    }
}

function stripe_get_payment_intent(string $paymentIntentId): array
{
    if (!class_exists('\Stripe\StripeClient')) {
        throw new RuntimeException('Stripe SDK no disponible en el servidor.');
    }

    $secret = payment_stripe_secret_key();
    if ($secret === '') {
        throw new RuntimeException('La pasarela de pagos no esta configurada.');
    }

    $id = trim($paymentIntentId);
    if ($id === '') {
        throw new RuntimeException('paymentIntentId es obligatorio.');
    }

    try {
        $stripe = new \Stripe\StripeClient($secret);
        $intent = $stripe->paymentIntents->retrieve($id);
        return $intent->toArray();
    } catch (\Stripe\Exception\ApiErrorException $e) {
        throw new RuntimeException($e->getMessage());
    }
}

function payment_normalize_stripe_metadata(array $metadata): array
{
    $normalized = [];
    foreach ($metadata as $key => $value) {
        if (!is_scalar($value) && $value !== null) {
            continue;
        }

        $safeKey = preg_replace('/[^A-Za-z0-9_]/', '_', (string) $key);
        if (!is_string($safeKey)) {
            continue;
        }

        $safeKey = trim($safeKey, '_');
        if ($safeKey === '') {
            continue;
        }

        $safeValue = trim((string) ($value ?? ''));
        if ($safeValue === '') {
            continue;
        }

        $normalized[substr($safeKey, 0, 40)] = substr($safeValue, 0, 500);
    }

    return $normalized;
}

function transfer_proof_upload_dir(): string
{
    return AppConfig::getTransferProofUploadDir();
}

function transfer_proof_public_base_url(): string
{
    return AppConfig::getTransferProofPublicBaseUrl();
}

function ensure_transfer_proof_dir(): bool
{
    $dir = transfer_proof_upload_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }

    $htaccessPath = $dir . DIRECTORY_SEPARATOR . '.htaccess';
    if (!is_file($htaccessPath)) {
        @file_put_contents($htaccessPath, "Options -Indexes\n<FilesMatch \"\\.(php|phtml|phar)$\">\n  Require all denied\n</FilesMatch>\n");
    }

    return true;
}

function save_transfer_proof_upload(array $file): array
{
    if (!ensure_transfer_proof_dir()) {
        throw new RuntimeException('No se pudo preparar el almacenamiento de comprobantes.');
    }

    $error = isset($file['error']) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;
    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo subir el comprobante. Codigo: ' . $error);
    }

    $tmpName = isset($file['tmp_name']) ? (string) $file['tmp_name'] : '';
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        throw new RuntimeException('El archivo recibido no es valido.');
    }

    $size = isset($file['size']) ? (int) $file['size'] : 0;
    if ($size <= 0) {
        throw new RuntimeException('El comprobante esta vacio.');
    }
    if ($size > TRANSFER_PROOF_MAX_BYTES) {
        throw new RuntimeException('El comprobante supera 5 MB.');
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? (string) finfo_file($finfo, $tmpName) : '';
    if ($finfo) {
        finfo_close($finfo);
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    ];
    if (!isset($allowed[$mime])) {
        throw new RuntimeException('Formato no permitido. Usa JPG, PNG, WEBP o PDF.');
    }

    try {
        $suffix = bin2hex(random_bytes(6));
    } catch (Throwable $e) {
        $suffix = substr(md5((string) microtime(true)), 0, 12);
    }

    $extension = $allowed[$mime];
    $filename = 'proof-' . local_date('Ymd-His') . '-' . $suffix . '.' . $extension;
    $diskPath = transfer_proof_upload_dir() . DIRECTORY_SEPARATOR . $filename;
    if (!@move_uploaded_file($tmpName, $diskPath)) {
        throw new RuntimeException('No se pudo guardar el comprobante.');
    }

    $originalName = isset($file['name']) ? (string) $file['name'] : $filename;
    $safeOriginal = preg_replace('/[^a-zA-Z0-9._ -]/', '_', basename($originalName));
    if (!is_string($safeOriginal) || $safeOriginal === '') {
        $safeOriginal = $filename;
    }

    $publicBase = transfer_proof_public_base_url();
    $publicUrl = $publicBase . '/' . rawurlencode($filename);
    $publicPath = preg_replace('#^https?://[^/]+#i', '', $publicBase);
    if (!is_string($publicPath)) {
        $publicPath = '/uploads/transfer-proofs';
    }
    $trimmedPublicPath = trim($publicPath, '/');
    $logicalPath = ($trimmedPublicPath !== '' ? '/' . $trimmedPublicPath : '') . '/' . $filename;
    $sha256 = @hash_file('sha256', $diskPath);
    if (!is_string($sha256)) {
        $sha256 = '';
    }

    return [
        'path' => $logicalPath,
        'url' => $publicUrl,
        'name' => $safeOriginal,
        'originalName' => $originalName,
        'mime' => $mime,
        'size' => $size,
        'sha256' => $sha256,
        'diskPath' => $diskPath,
    ];
}
