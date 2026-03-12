<?php

declare(strict_types=1);

final class ClinicalHistoryAIService
{
    public function requestEnvelope(array $session, array $draft, string $messageText, array $payload = []): array
    {
        $fake = $this->readFakeResponse();
        if ($fake !== null) {
            return [
                'mode' => 'live',
                'provider' => 'test_fake',
                'envelope' => ClinicalHistoryGuardrails::normalizeEnvelope($fake),
            ];
        }

        if (!figo_queue_enabled()) {
            return [
                'mode' => 'fallback',
                'provider' => 'local_fallback',
                'reason' => 'provider_mode_disabled',
                'envelope' => ClinicalHistoryGuardrails::heuristicEnvelopeFromText($session, $draft, $messageText, 'provider_mode_disabled'),
            ];
        }

        $bridgePayload = [
            'model' => 'clinical-intake',
            'messages' => $this->buildMessages($session, $draft, $messageText),
            'max_tokens' => 1400,
            'temperature' => 0.2,
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'metadata' => [
                'source' => 'clinical_intake',
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'surface' => (string) ($session['surface'] ?? ''),
            ],
        ];

        $bridgeResult = figo_queue_bridge_result($bridgePayload);
        $bridgeResponse = isset($bridgeResult['payload']) && is_array($bridgeResult['payload'])
            ? $bridgeResult['payload']
            : [];

        if (isset($bridgeResponse['choices'][0]['message']['content']) && is_string($bridgeResponse['choices'][0]['message']['content'])) {
            $parsed = $this->decodeEnvelope((string) $bridgeResponse['choices'][0]['message']['content']);
            if ($parsed !== null) {
                return [
                    'mode' => 'live',
                    'provider' => 'openclaw_queue',
                    'jobId' => (string) ($bridgeResponse['jobId'] ?? ''),
                    'envelope' => ClinicalHistoryGuardrails::normalizeEnvelope($parsed),
                ];
            }
        }

        $reason = (string) ($bridgeResponse['reason'] ?? $bridgeResponse['errorCode'] ?? 'queue_bridge_unavailable');
        $mode = (string) ($bridgeResponse['mode'] ?? 'fallback');
        if ($mode !== 'queued') {
            $mode = 'fallback';
        }

        return [
            'mode' => $mode,
            'provider' => 'openclaw_queue',
            'reason' => $reason,
            'jobId' => (string) ($bridgeResponse['jobId'] ?? ''),
            'pollAfterMs' => isset($bridgeResponse['pollAfterMs']) && is_numeric($bridgeResponse['pollAfterMs'])
                ? (int) $bridgeResponse['pollAfterMs']
                : 0,
            'envelope' => ClinicalHistoryGuardrails::heuristicEnvelopeFromText($session, $draft, $messageText, $reason),
        ];
    }

    public function envelopeFromCompletion(array $completion): ?array
    {
        if (!isset($completion['choices'][0]['message']['content']) || !is_string($completion['choices'][0]['message']['content'])) {
            return null;
        }

        $parsed = $this->decodeEnvelope((string) $completion['choices'][0]['message']['content']);
        return is_array($parsed) ? ClinicalHistoryGuardrails::normalizeEnvelope($parsed) : null;
    }

    private function buildMessages(array $session, array $draft, string $messageText): array
    {
        $messages = [[
            'role' => 'system',
            'content' => $this->buildSystemPrompt(),
        ]];

        $recentTranscript = array_slice(is_array($session['transcript'] ?? null) ? $session['transcript'] : [], -6);
        foreach ($recentTranscript as $item) {
            if (!is_array($item)) {
                continue;
            }

            $role = in_array(($item['role'] ?? ''), ['system', 'user', 'assistant'], true)
                ? (string) $item['role']
                : 'user';
            $content = ClinicalHistoryRepository::trimString($item['content'] ?? '');
            if ($content === '') {
                continue;
            }

            $messages[] = [
                'role' => $role,
                'content' => $content,
            ];
        }

        $context = [
            'session' => [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'surface' => (string) ($session['surface'] ?? ''),
                'appointmentId' => $session['appointmentId'] ?? null,
            ],
            'patient' => $session['patient'] ?? [],
            'draft' => [
                'intake' => $draft['intake'] ?? [],
                'clinicianDraft' => $draft['clinicianDraft'] ?? [],
                'reviewStatus' => $draft['reviewStatus'] ?? '',
                'requiresHumanReview' => $draft['requiresHumanReview'] ?? true,
            ],
            'newPatientMessage' => trim($messageText),
        ];

        $messages[] = [
            'role' => 'user',
            'content' => 'Contexto clinico actual en JSON: ' . json_encode(
                $context,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            ),
        ];

        return $messages;
    }

    private function buildSystemPrompt(): string
    {
        return implode("\n", [
            'Eres el motor de historia clinica conversacional para Piel en Armonia.',
            'Objetivo paciente: responder con tono empatico, breve y natural, y hacer solo una pregunta concreta por turno.',
            'Objetivo medico: sintetizar anamnesis estructurada, preguntas faltantes, red flags, CIE-10 sugeridos, tratamiento borrador y posologia con incertidumbre explicita.',
            'Nunca expongas diagnostico, tratamiento, dosis ni CIE-10 en los campos reply ni nextQuestion.',
            'Devuelve solo JSON valido, sin markdown, sin texto adicional.',
            'Usa exactamente esta forma:',
            '{"reply":"","nextQuestion":"","intakePatch":{"motivoConsulta":"","enfermedadActual":"","antecedentes":"","alergias":"","medicacionActual":"","rosRedFlags":[],"adjuntos":[],"resumenClinico":"","cie10Sugeridos":[],"tratamientoBorrador":"","posologiaBorrador":{"texto":"","baseCalculo":"","pesoKg":null,"edadAnios":null,"units":"","ambiguous":true},"preguntasFaltantes":[],"datosPaciente":{"edadAnios":null,"pesoKg":null,"sexoBiologico":"","embarazo":null}},"missingFields":[],"redFlags":[],"clinicianDraft":{"resumen":"","preguntasFaltantes":[],"cie10Sugeridos":[],"tratamientoBorrador":"","posologiaBorrador":{"texto":"","baseCalculo":"","pesoKg":null,"edadAnios":null,"units":"","ambiguous":true}},"requiresHumanReview":false,"confidence":0.0}',
        ]);
    }

    private function readFakeResponse(): ?array
    {
        $raw = getenv('PIELARMONIA_CLINICAL_HISTORY_FAKE_RESPONSE');
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function decodeEnvelope(string $content): ?array
    {
        $content = trim($content);
        if ($content === '') {
            return null;
        }

        $decoded = json_decode($content, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $content = preg_replace('/^```(?:json)?/i', '', $content);
        $content = preg_replace('/```$/', '', (string) $content);
        $decoded = json_decode(trim((string) $content), true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $start = strpos((string) $content, '{');
        $end = strrpos((string) $content, '}');
        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        $slice = substr((string) $content, $start, ($end - $start + 1));
        $decoded = json_decode($slice, true);
        return is_array($decoded) ? $decoded : null;
    }
}
