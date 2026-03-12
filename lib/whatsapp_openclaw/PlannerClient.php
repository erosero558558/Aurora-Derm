<?php

declare(strict_types=1);

final class WhatsappOpenclawPlannerClient
{
    public function plan(array $conversation, array $draft, array $event): array
    {
        $remote = $this->planWithGateway($conversation, $draft, $event);
        if (is_array($remote)) {
            return $remote;
        }

        return $this->heuristicPlan($conversation, $draft, $event);
    }

    private function planWithGateway(array $conversation, array $draft, array $event): ?array
    {
        $endpoint = WhatsappOpenclawConfig::gatewayEndpoint();
        if ($endpoint === '' || !function_exists('curl_init')) {
            return null;
        }

        $payload = [
            'channel' => 'whatsapp',
            'conversation' => $conversation,
            'draft' => $draft,
            'event' => $event,
            'responseFormat' => 'json',
            'model' => WhatsappOpenclawConfig::gatewayModel(),
        ];

        $headers = ['Content-Type: application/json'];
        $apiKey = WhatsappOpenclawConfig::gatewayApiKey();
        if ($apiKey !== '') {
            $headerName = WhatsappOpenclawConfig::gatewayKeyHeader();
            $prefix = trim(WhatsappOpenclawConfig::gatewayKeyPrefix());
            $headerValue = $prefix !== '' ? $prefix . ' ' . $apiKey : $apiKey;
            $headers[] = $headerName . ': ' . $headerValue;
        }

        $ch = curl_init($endpoint);
        if ($ch === false) {
            return null;
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if (!is_string($raw) || $raw === '' || $status < 200 || $status >= 300) {
            return null;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return null;
        }

        $plan = isset($decoded['data']) && is_array($decoded['data']) ? $decoded['data'] : $decoded;
        if (!isset($plan['intent']) || !is_string($plan['intent'])) {
            return null;
        }

        $plan['source'] = 'gateway';
        $plan['draftPatch'] = is_array($plan['draftPatch'] ?? null) ? $plan['draftPatch'] : [];
        $plan['reply'] = trim((string) ($plan['reply'] ?? ''));
        return $plan;
    }

    private function heuristicPlan(array $conversation, array $draft, array $event): array
    {
        $text = trim((string) ($event['text'] ?? ''));
        $normalized = $this->normalize($text);
        $draftPatch = [
            'phone' => whatsapp_openclaw_normalize_phone((string) ($event['phone'] ?? ($draft['phone'] ?? ''))),
        ];

        $email = $this->extractEmail($text);
        if ($email !== '') {
            $draftPatch['email'] = $email;
        }

        $name = $this->extractName($text);
        if ($name !== '') {
            $draftPatch['name'] = $name;
        }

        $service = $this->resolveService($normalized);
        if ($service !== '') {
            $draftPatch['service'] = $service;
        }

        $doctor = $this->resolveDoctor($normalized);
        if ($doctor !== '') {
            $draftPatch['doctor'] = $doctor;
        }

        $date = $this->extractDate($text);
        if ($date !== '') {
            $draftPatch['date'] = $date;
        }

        $time = $this->extractTime($text);
        if ($time !== '') {
            $draftPatch['time'] = $time;
        }

        $paymentMethod = $this->resolvePaymentMethod($normalized);
        if ($paymentMethod !== '') {
            $draftPatch['paymentMethod'] = $paymentMethod;
        }

        if ($this->hasConsent($normalized)) {
            $draftPatch['privacyConsent'] = true;
            $draftPatch['privacyConsentAt'] = local_date('c');
        }

        $mediaProofRefs = [];
        foreach ((array) ($event['media'] ?? []) as $media) {
            if (!is_array($media)) {
                continue;
            }
            $mediaProofRefs[] = [
                'url' => (string) ($media['url'] ?? ''),
                'mime' => (string) ($media['mime'] ?? ''),
                'name' => (string) ($media['name'] ?? ''),
                'providerMediaId' => (string) ($media['id'] ?? ''),
            ];
        }
        if ($mediaProofRefs !== []) {
            $draftPatch['mediaProofRefs'] = $mediaProofRefs;
        }

        $state = array_merge($draft, $draftPatch);
        $intent = 'booking_collect';
        $reply = 'Cuéntame qué servicio necesitas y la fecha u hora que te conviene.';

        if ($this->containsAny($normalized, ['cancelar', 'cancela', 'anular'])) {
            $intent = 'cancel';
            $reply = 'Puedo ayudarte a cancelar tu cita si confirmas que quieres hacerlo desde este número.';
        } elseif ($this->containsAny($normalized, ['reprogram', 'mover', 'cambiar hora', 'cambiar cita'])) {
            $intent = 'reschedule';
            $reply = 'Puedo reprogramar tu cita. Envíame la nueva fecha y hora en formato YYYY-MM-DD y HH:MM.';
        } elseif ($this->containsAny($normalized, ['precio', 'costo', 'cuanto', 'servicio', 'tratamiento'])) {
            $intent = 'faq';
            $reply = $this->buildFaqReply($state);
        } elseif ($this->containsAny($normalized, ['disponible', 'horario', 'agenda', 'hora', 'fecha']) || $date !== '' || $time !== '') {
            $intent = 'availability';
            $reply = 'Voy a revisar la disponibilidad real y te propongo los horarios más cercanos.';
        }

        $serviceReady = trim((string) ($state['service'] ?? '')) !== '';
        $dateReady = trim((string) ($state['date'] ?? '')) !== '';
        $timeReady = trim((string) ($state['time'] ?? '')) !== '';
        $nameReady = trim((string) ($state['name'] ?? '')) !== '';
        $emailReady = trim((string) ($state['email'] ?? '')) !== '';
        $consentReady = ($state['privacyConsent'] ?? false) === true;
        $paymentReady = trim((string) ($state['paymentMethod'] ?? '')) !== '';

        if ($serviceReady || $dateReady || $timeReady || $paymentReady) {
            $intent = 'booking_collect';
            $missing = [];
            if (!$serviceReady) {
                $missing[] = 'servicio';
            }
            if (!$dateReady) {
                $missing[] = 'fecha';
            }
            if (!$timeReady) {
                $missing[] = 'hora';
            }
            if (!$nameReady) {
                $missing[] = 'nombre completo';
            }
            if (!$emailReady) {
                $missing[] = 'email';
            }
            if (!$consentReady) {
                $missing[] = 'consentimiento de datos';
            }
            if (!$paymentReady) {
                $missing[] = 'metodo de pago';
            }

            if ($missing !== []) {
                $reply = 'Para avanzar me falta: ' . implode(', ', $missing) . '.';
            }

            $paymentMethod = strtolower(trim((string) ($state['paymentMethod'] ?? '')));
            if ($missing === [] && $paymentMethod === 'card') {
                $intent = 'booking_card';
                $reply = 'Perfecto. Voy a apartar ese horario y enviarte un checkout seguro para completar el pago.';
            } elseif ($missing === [] && $paymentMethod === 'cash') {
                $intent = 'booking_cash';
                $reply = 'Perfecto. Voy a reservar tu cita para pago en consultorio.';
            } elseif ($missing === [] && $paymentMethod === 'transfer') {
                $hasProof = !empty($state['mediaProofRefs']);
                if ($hasProof) {
                    $intent = 'booking_transfer';
                    $reply = 'Recibido. Voy a registrar tu comprobante y dejar la cita pendiente de verificación.';
                } else {
                    $intent = 'booking_collect';
                    $reply = 'Para transferencia necesito que me envíes el comprobante por este chat.';
                }
            }
        }

        return [
            'source' => 'heuristic',
            'intent' => $intent,
            'reply' => $reply,
            'draftPatch' => $draftPatch,
        ];
    }

    private function buildFaqReply(array $state): string
    {
        $service = trim((string) ($state['service'] ?? ''));
        if ($service !== '' && get_service_config($service) !== null) {
            $label = get_service_label($service);
            $total = get_service_total_price($service);
            return $label . ' tiene un valor referencial de $' . number_format((float) $total, 2) . '. Si quieres, también reviso horarios disponibles.';
        }

        $parts = [];
        foreach (array_keys(get_services_config()) as $slug) {
            $parts[] = get_service_label($slug) . ' $' . number_format((float) get_service_total_price($slug), 2);
            if (count($parts) >= 4) {
                break;
            }
        }
        return 'Puedo ayudarte con ' . implode(', ', $parts) . '. Dime cuál te interesa y te comparto horarios.';
    }

    private function extractEmail(string $text): string
    {
        return preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $text, $matches) === 1
            ? strtolower(trim((string) ($matches[0] ?? '')))
            : '';
    }

    private function extractName(string $text): string
    {
        if (preg_match('/(?:soy|mi nombre es|nombre:)\s+([a-záéíóúñ ]{4,80})/iu', $text, $matches) === 1) {
            return trim((string) ($matches[1] ?? ''));
        }
        return '';
    }

    private function extractDate(string $text): string
    {
        if (preg_match('/\b(\d{4}-\d{2}-\d{2})\b/', $text, $matches) === 1) {
            return (string) ($matches[1] ?? '');
        }
        return '';
    }

    private function extractTime(string $text): string
    {
        if (preg_match('/\b(\d{2}:\d{2})\b/', $text, $matches) === 1) {
            return (string) ($matches[1] ?? '');
        }
        return '';
    }

    private function resolveService(string $text): string
    {
        foreach (
            [
                'consulta' => ['consulta', 'presencial'],
                'telefono' => ['telefono', 'telef'],
                'video' => ['video', 'virtual'],
                'laser' => ['laser'],
                'rejuvenecimiento' => ['rejuvenecimiento'],
                'acne' => ['acne'],
                'cancer' => ['cancer'],
            ] as $service => $tokens
        ) {
            if ($this->containsAny($text, $tokens)) {
                return $service;
            }
        }
        return '';
    }

    private function resolveDoctor(string $text): string
    {
        if ($this->containsAny($text, ['rosero', 'javier'])) {
            return 'rosero';
        }
        if ($this->containsAny($text, ['narvaez', 'carolina'])) {
            return 'narvaez';
        }
        if ($this->containsAny($text, ['cualquiera', 'indiferente', 'el primero disponible'])) {
            return 'indiferente';
        }
        return '';
    }

    private function resolvePaymentMethod(string $text): string
    {
        if ($this->containsAny($text, ['tarjeta', 'card', 'credito', 'debito'])) {
            return 'card';
        }
        if ($this->containsAny($text, ['transferencia', 'transfer'])) {
            return 'transfer';
        }
        if ($this->containsAny($text, ['efectivo', 'cash'])) {
            return 'cash';
        }
        return '';
    }

    private function hasConsent(string $text): bool
    {
        return $this->containsAny($text, ['acepto datos', 'autorizo datos', 'consiento', 'acepto el tratamiento']);
    }

    private function containsAny(string $text, array $tokens): bool
    {
        foreach ($tokens as $token) {
            if (str_contains($text, $token)) {
                return true;
            }
        }
        return false;
    }

    private function normalize(string $value): string
    {
        $value = function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
        return strtr($value, [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ñ' => 'n',
        ]);
    }
}
