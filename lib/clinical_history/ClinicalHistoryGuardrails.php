<?php

declare(strict_types=1);

final class ClinicalHistoryGuardrails
{
    public static function computeMissingFields(array $draft): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $intake = $draft['intake'];
        $facts = $intake['datosPaciente'] ?? [];

        $fields = [];
        if (ClinicalHistoryRepository::trimString($intake['motivoConsulta'] ?? '') === '') {
            $fields[] = 'motivoConsulta';
        }
        if (ClinicalHistoryRepository::trimString($intake['enfermedadActual'] ?? '') === '') {
            $fields[] = 'enfermedadActual';
        }
        if (ClinicalHistoryRepository::trimString($intake['antecedentes'] ?? '') === '') {
            $fields[] = 'antecedentes';
        }
        if (ClinicalHistoryRepository::trimString($intake['alergias'] ?? '') === '') {
            $fields[] = 'alergias';
        }
        if (ClinicalHistoryRepository::trimString($intake['medicacionActual'] ?? '') === '') {
            $fields[] = 'medicacionActual';
        }
        if (($facts['edadAnios'] ?? null) === null) {
            $fields[] = 'datosPaciente.edadAnios';
        }
        if (($facts['pesoKg'] ?? null) === null) {
            $fields[] = 'datosPaciente.pesoKg';
        }

        return ClinicalHistoryRepository::normalizeStringList($fields);
    }

    public static function questionForField(string $field): string
    {
        $map = [
            'motivoConsulta' => 'Cuentame cual es el motivo principal de consulta hoy.',
            'enfermedadActual' => 'Desde cuando empezo y como ha evolucionado lo que te preocupa?',
            'antecedentes' => 'Tienes antecedentes medicos o dermatologicos importantes?',
            'alergias' => 'Tienes alergias a medicamentos, alimentos o productos?',
            'medicacionActual' => 'Estas usando algun medicamento, crema o tratamiento actualmente?',
            'datosPaciente.edadAnios' => 'Que edad tiene el paciente?',
            'datosPaciente.pesoKg' => 'Cuanto pesa aproximadamente en kg?',
        ];

        return $map[$field] ?? 'Que otro detalle importante deberiamos agregar a tu historia clinica?';
    }

    public static function nextQuestion(array $draft, array $questionHistory, string $proposedQuestion = '', array $proposedMissingFields = []): array
    {
        $missingFields = $proposedMissingFields !== []
            ? ClinicalHistoryRepository::normalizeStringList($proposedMissingFields)
            : self::computeMissingFields($draft);
        $history = ClinicalHistoryRepository::normalizeStringList($questionHistory);

        foreach ($missingFields as $fieldKey) {
            if (!in_array($fieldKey, $history, true)) {
                return [
                    'fieldKey' => $fieldKey,
                    'question' => self::sanitizePatientText(self::questionForField($fieldKey)),
                ];
            }
        }

        $fallbackField = $missingFields[0] ?? '';
        $fallbackQuestion = ClinicalHistoryRepository::trimString($proposedQuestion);
        if ($fallbackQuestion === '' && $fallbackField !== '') {
            $fallbackQuestion = self::questionForField($fallbackField);
        }

        return [
            'fieldKey' => $fallbackField,
            'question' => self::sanitizePatientText($fallbackQuestion),
        ];
    }

    public static function sanitizePatientText(string $text): string
    {
        $text = trim($text);
        if ($text === '') {
            return '';
        }

        $dangerPatterns = [
            '/\b(?:cie|icd)[\s\-]*10\b/i',
            '/\b[A-TV-Z][0-9]{2}(?:\.[0-9A-Z]+)?\b/',
            '/\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|g|gr|ml|mL|ui|u\/kg|mg\/kg)\b/i',
            '/\b(?:dosis|posologia|tratamiento|receta|diagnostico|diagnostico probable|prescribir|indicado)\b/i',
        ];

        foreach ($dangerPatterns as $pattern) {
            if (preg_match($pattern, $text) === 1) {
                return 'Gracias, ya registre esta informacion en tu historia clinica.';
            }
        }

        return $text;
    }

    public static function heuristicEnvelopeFromText(array $session, array $draft, string $messageText, string $reason = 'fallback'): array
    {
        $messageText = trim($messageText);
        $patch = self::extractHeuristicPatch($messageText);
        $draftPreview = ClinicalHistoryRepository::adminDraft($draft);
        $mergedDraft = self::applyPatchToDraft($draftPreview, $patch);
        $missingFields = self::computeMissingFields($mergedDraft);
        $question = self::nextQuestion($mergedDraft, $session['questionHistory'] ?? [], '', $missingFields);

        return [
            'reply' => 'Gracias, ya registre esta informacion en tu historia clinica.',
            'nextQuestion' => $question['question'],
            'intakePatch' => $patch,
            'missingFields' => $missingFields,
            'redFlags' => self::detectRedFlags($messageText),
            'clinicianDraft' => [
                'resumen' => '',
                'preguntasFaltantes' => $missingFields,
                'cie10Sugeridos' => [],
                'tratamientoBorrador' => '',
                'posologiaBorrador' => [
                    'texto' => '',
                    'baseCalculo' => '',
                    'pesoKg' => $patch['datosPaciente']['pesoKg'] ?? null,
                    'edadAnios' => $patch['datosPaciente']['edadAnios'] ?? null,
                    'units' => '',
                    'ambiguous' => true,
                ],
            ],
            'requiresHumanReview' => true,
            'confidence' => 0.38,
            'meta' => [
                'reason' => $reason,
            ],
        ];
    }

    public static function applyEnvelope(array $session, array $draft, array $envelope, array $aiMeta = []): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $normalizedEnvelope = self::normalizeEnvelope($envelope);
        $draft = self::applyPatchToDraft($draft, $normalizedEnvelope['intakePatch']);

        $missingFields = self::computeMissingFields($draft);
        if ($normalizedEnvelope['missingFields'] !== []) {
            $missingFields = ClinicalHistoryRepository::normalizeStringList(array_merge($missingFields, $normalizedEnvelope['missingFields']));
        }

        $latestUserMessage = '';
        for ($index = count($session['transcript'] ?? []) - 1; $index >= 0; $index--) {
            $item = $session['transcript'][$index] ?? null;
            if (!is_array($item)) {
                continue;
            }
            if (($item['role'] ?? '') === 'user') {
                $latestUserMessage = ClinicalHistoryRepository::trimString($item['content'] ?? '');
                break;
            }
        }

        $redFlags = ClinicalHistoryRepository::normalizeStringList(array_merge(
            $normalizedEnvelope['redFlags'],
            self::detectRedFlags($latestUserMessage)
        ));

        $draft['intake']['preguntasFaltantes'] = $missingFields;
        $draft['clinicianDraft'] = self::mergeClinicianDraft($draft['clinicianDraft'] ?? [], $normalizedEnvelope['clinicianDraft'], $missingFields);
        if ($draft['clinicianDraft']['resumen'] === '' && $draft['intake']['resumenClinico'] !== '') {
            $draft['clinicianDraft']['resumen'] = $draft['intake']['resumenClinico'];
        }
        if ($draft['intake']['resumenClinico'] === '' && $draft['clinicianDraft']['resumen'] !== '') {
            $draft['intake']['resumenClinico'] = $draft['clinicianDraft']['resumen'];
        }

        $question = self::nextQuestion($draft, $session['questionHistory'] ?? [], $normalizedEnvelope['nextQuestion'], $missingFields);
        $reply = self::sanitizePatientText($normalizedEnvelope['reply']);
        if ($reply === '') {
            $reply = 'Gracias, ya registre esta informacion en tu historia clinica.';
        }

        $reviewReasons = [];
        $facts = $draft['intake']['datosPaciente'] ?? [];
        $allergies = ClinicalHistoryRepository::trimString($draft['intake']['alergias'] ?? '');
        $confidence = ClinicalHistoryRepository::normalizeConfidence($normalizedEnvelope['confidence']);
        $requiresHumanReview = (bool) ($normalizedEnvelope['requiresHumanReview'] ?? false);

        if (($facts['edadAnios'] ?? null) !== null && (int) ($facts['edadAnios'] ?? 0) < 18) {
            $requiresHumanReview = true;
            $reviewReasons[] = 'pediatric_case';
        }
        if (($facts['embarazo'] ?? null) === true) {
            $requiresHumanReview = true;
            $reviewReasons[] = 'pregnancy';
        }
        if ($allergies !== '') {
            $requiresHumanReview = true;
            $reviewReasons[] = 'allergies_present';
        }
        if ($redFlags !== []) {
            $requiresHumanReview = true;
            $reviewReasons[] = 'red_flags_present';
        }
        if ($confidence < 0.65) {
            $requiresHumanReview = true;
            $reviewReasons[] = 'low_confidence';
        }
        if (($aiMeta['mode'] ?? 'fallback') !== 'live') {
            $requiresHumanReview = true;
            $reviewReasons[] = 'ai_fallback';
        }

        $dosage = isset($draft['clinicianDraft']['posologiaBorrador']) && is_array($draft['clinicianDraft']['posologiaBorrador'])
            ? $draft['clinicianDraft']['posologiaBorrador']
            : [];
        $doseText = ClinicalHistoryRepository::trimString($dosage['texto'] ?? '');
        $doseWeight = $dosage['pesoKg'] ?? ($facts['pesoKg'] ?? null);
        $doseAge = $dosage['edadAnios'] ?? ($facts['edadAnios'] ?? null);
        $doseAmbiguous = (bool) ($dosage['ambiguous'] ?? true);
        if ($doseText !== '' && ($doseAmbiguous || $doseWeight === null || $doseAge === null)) {
            $requiresHumanReview = true;
            $reviewReasons[] = 'dose_ambiguous';
        }

        $draft['confidence'] = $confidence;
        $draft['requiresHumanReview'] = $requiresHumanReview;
        $draft['reviewStatus'] = $requiresHumanReview ? 'review_required' : 'ready_for_review';
        $draft['reviewReasons'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
            $draft['reviewReasons'] ?? [],
            $reviewReasons
        ));
        $draft['status'] = $requiresHumanReview ? 'review_required' : 'draft_ready';
        $draft['updatedAt'] = local_date('c');
        $draft['version'] = max(1, (int) ($draft['version'] ?? 1)) + 1;
        $draft['lastAiEnvelope'] = [
            'reply' => $reply,
            'nextQuestion' => $question['question'],
            'intakePatch' => $normalizedEnvelope['intakePatch'],
            'missingFields' => $missingFields,
            'redFlags' => $redFlags,
            'clinicianDraft' => $draft['clinicianDraft'],
            'requiresHumanReview' => $requiresHumanReview,
            'confidence' => $confidence,
            'aiMeta' => $aiMeta,
        ];

        return [
            'draft' => $draft,
            'publicResponse' => [
                'reply' => $reply,
                'nextQuestion' => $question['question'],
                'intakePatch' => self::patientSafePatch($normalizedEnvelope['intakePatch']),
                'missingFields' => $missingFields,
                'requiresHumanReview' => $requiresHumanReview,
                'reviewStatus' => $draft['reviewStatus'],
            ],
            'questionFieldKey' => $question['fieldKey'],
            'internalEnvelope' => $draft['lastAiEnvelope'],
            'redFlags' => $redFlags,
        ];
    }

    public static function normalizeEnvelope(array $envelope): array
    {
        $patch = isset($envelope['intakePatch']) && is_array($envelope['intakePatch']) ? $envelope['intakePatch'] : [];
        $clinicianDraft = isset($envelope['clinicianDraft']) && is_array($envelope['clinicianDraft'])
            ? $envelope['clinicianDraft']
            : [];

        return [
            'reply' => ClinicalHistoryRepository::trimString($envelope['reply'] ?? ''),
            'nextQuestion' => ClinicalHistoryRepository::trimString($envelope['nextQuestion'] ?? ''),
            'intakePatch' => self::normalizePatch($patch),
            'missingFields' => ClinicalHistoryRepository::normalizeStringList($envelope['missingFields'] ?? []),
            'redFlags' => ClinicalHistoryRepository::normalizeStringList($envelope['redFlags'] ?? []),
            'clinicianDraft' => ClinicalHistoryRepository::normalizeClinicianDraft($clinicianDraft),
            'requiresHumanReview' => (bool) ($envelope['requiresHumanReview'] ?? false),
            'confidence' => ClinicalHistoryRepository::normalizeConfidence($envelope['confidence'] ?? 0),
        ];
    }

    public static function normalizePatch(array $patch): array
    {
        $normalized = [];
        foreach (['motivoConsulta', 'enfermedadActual', 'antecedentes', 'alergias', 'medicacionActual', 'resumenClinico', 'tratamientoBorrador'] as $field) {
            if (array_key_exists($field, $patch)) {
                $normalized[$field] = ClinicalHistoryRepository::trimString($patch[$field]);
            }
        }
        if (array_key_exists('rosRedFlags', $patch)) {
            $normalized['rosRedFlags'] = ClinicalHistoryRepository::normalizeStringList($patch['rosRedFlags']);
        }
        if (array_key_exists('adjuntos', $patch)) {
            $normalized['adjuntos'] = ClinicalHistoryRepository::normalizeAttachmentList($patch['adjuntos']);
        }
        if (array_key_exists('cie10Sugeridos', $patch)) {
            $normalized['cie10Sugeridos'] = ClinicalHistoryRepository::normalizeStringList($patch['cie10Sugeridos']);
        }
        if (array_key_exists('preguntasFaltantes', $patch)) {
            $normalized['preguntasFaltantes'] = ClinicalHistoryRepository::normalizeStringList($patch['preguntasFaltantes']);
        }
        if (array_key_exists('datosPaciente', $patch)) {
            $normalized['datosPaciente'] = ClinicalHistoryRepository::normalizePatientFacts($patch['datosPaciente']);
        }
        if (array_key_exists('posologiaBorrador', $patch) && is_array($patch['posologiaBorrador'])) {
            $posologia = $patch['posologiaBorrador'];
            $normalized['posologiaBorrador'] = [
                'texto' => ClinicalHistoryRepository::trimString($posologia['texto'] ?? ''),
                'baseCalculo' => ClinicalHistoryRepository::trimString($posologia['baseCalculo'] ?? ''),
                'pesoKg' => ClinicalHistoryRepository::nullableFloat($posologia['pesoKg'] ?? null),
                'edadAnios' => ClinicalHistoryRepository::nullablePositiveInt($posologia['edadAnios'] ?? null),
                'units' => ClinicalHistoryRepository::trimString($posologia['units'] ?? ''),
                'ambiguous' => array_key_exists('ambiguous', $posologia) ? (bool) $posologia['ambiguous'] : true,
            ];
        }
        return $normalized;
    }

    public static function detectRedFlags(string $messageText): array
    {
        $text = strtolower(trim($messageText));
        if ($text === '') {
            return [];
        }

        $signals = [
            'dolor_pecho' => ['dolor en el pecho', 'dolor pecho'],
            'disnea' => ['falta de aire', 'no puedo respirar', 'dificultad para respirar'],
            'sangrado' => ['sangrado abundante', 'sangrado', 'hemorragia'],
            'fiebre_alta' => ['fiebre alta', '39', '40 grados'],
            'anafilaxia' => ['hinchazon de labios', 'hinchazon de lengua', 'reaccion alergica grave'],
            'embarazo' => ['embarazada', 'embarazo'],
        ];

        $detected = [];
        foreach ($signals as $code => $patterns) {
            foreach ($patterns as $pattern) {
                if (strpos($text, $pattern) !== false) {
                    $detected[] = $code;
                    break;
                }
            }
        }

        return ClinicalHistoryRepository::normalizeStringList($detected);
    }

    public static function extractHeuristicPatch(string $messageText): array
    {
        $patch = [
            'motivoConsulta' => '',
            'enfermedadActual' => '',
            'antecedentes' => '',
            'alergias' => '',
            'medicacionActual' => '',
            'rosRedFlags' => self::detectRedFlags($messageText),
            'datosPaciente' => [
                'edadAnios' => null,
                'pesoKg' => null,
                'sexoBiologico' => '',
                'embarazo' => null,
            ],
        ];

        $normalized = trim($messageText);
        if ($normalized !== '') {
            $patch['motivoConsulta'] = substr($normalized, 0, 220);
            $patch['enfermedadActual'] = substr($normalized, 0, 500);
        }

        if (preg_match('/(\d{1,2})\s*(?:anos|a\\x{00F1}os)/iu', $messageText, $matches) === 1) {
            $patch['datosPaciente']['edadAnios'] = (int) $matches[1];
        }
        if (preg_match('/(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|kilos?)/iu', $messageText, $matches) === 1) {
            $patch['datosPaciente']['pesoKg'] = (float) str_replace(',', '.', $matches[1]);
        }
        if (preg_match('/\b(?:alergia|alergico|alergica|alergias)\b/iu', $messageText) === 1) {
            $patch['alergias'] = substr($normalized, 0, 220);
        }
        if (preg_match('/\b(?:tomo|usa|usando|medicamento|crema|tratamiento actual)\b/iu', $messageText) === 1) {
            $patch['medicacionActual'] = substr($normalized, 0, 220);
        }
        if (preg_match('/\b(?:embarazada|embarazo)\b/iu', $messageText) === 1) {
            $patch['datosPaciente']['embarazo'] = true;
        }
        if (preg_match('/\b(?:masculino|hombre|varon)\b/iu', $messageText) === 1) {
            $patch['datosPaciente']['sexoBiologico'] = 'masculino';
        } elseif (preg_match('/\b(?:femenino|mujer)\b/iu', $messageText) === 1) {
            $patch['datosPaciente']['sexoBiologico'] = 'femenino';
        }

        return self::normalizePatch($patch);
    }

    public static function patientSafePatch(array $patch): array
    {
        $safe = self::normalizePatch($patch);
        unset($safe['resumenClinico'], $safe['cie10Sugeridos'], $safe['tratamientoBorrador'], $safe['posologiaBorrador']);
        return $safe;
    }

    public static function applyPatchToDraft(array $draft, array $patch): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $patch = self::normalizePatch($patch);

        foreach (['motivoConsulta', 'enfermedadActual', 'antecedentes', 'alergias', 'medicacionActual', 'resumenClinico', 'tratamientoBorrador'] as $field) {
            $value = ClinicalHistoryRepository::trimString($patch[$field] ?? '');
            if ($value !== '') {
                $draft['intake'][$field] = $value;
            }
        }

        if (isset($patch['rosRedFlags'])) {
            $draft['intake']['rosRedFlags'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
                $draft['intake']['rosRedFlags'] ?? [],
                $patch['rosRedFlags']
            ));
        }
        if (isset($patch['cie10Sugeridos'])) {
            $draft['intake']['cie10Sugeridos'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
                $draft['intake']['cie10Sugeridos'] ?? [],
                $patch['cie10Sugeridos']
            ));
        }
        if (isset($patch['preguntasFaltantes'])) {
            $draft['intake']['preguntasFaltantes'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
                $draft['intake']['preguntasFaltantes'] ?? [],
                $patch['preguntasFaltantes']
            ));
        }
        if (isset($patch['adjuntos'])) {
            $draft['intake']['adjuntos'] = ClinicalHistoryRepository::normalizeAttachmentList(array_merge(
                $draft['intake']['adjuntos'] ?? [],
                $patch['adjuntos']
            ));
        }
        if (isset($patch['datosPaciente']) && is_array($patch['datosPaciente'])) {
            $draft['intake']['datosPaciente'] = array_merge(
                $draft['intake']['datosPaciente'] ?? [],
                array_filter($patch['datosPaciente'], static function ($value): bool {
                    if ($value === null) {
                        return false;
                    }
                    if (is_string($value) && trim($value) === '') {
                        return false;
                    }
                    return true;
                })
            );
        }
        if (isset($patch['posologiaBorrador']) && is_array($patch['posologiaBorrador'])) {
            $draft['intake']['posologiaBorrador'] = array_merge(
                $draft['intake']['posologiaBorrador'] ?? [],
                $patch['posologiaBorrador']
            );
        }

        return $draft;
    }

    private static function mergeClinicianDraft(array $current, array $incoming, array $missingFields): array
    {
        $current = ClinicalHistoryRepository::normalizeClinicianDraft($current);
        $incoming = ClinicalHistoryRepository::normalizeClinicianDraft($incoming);

        if ($incoming['resumen'] !== '') {
            $current['resumen'] = $incoming['resumen'];
        }
        if ($incoming['tratamientoBorrador'] !== '') {
            $current['tratamientoBorrador'] = $incoming['tratamientoBorrador'];
        }
        $current['preguntasFaltantes'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
            $current['preguntasFaltantes'] ?? [],
            $incoming['preguntasFaltantes'] ?? [],
            $missingFields
        ));
        $current['cie10Sugeridos'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
            $current['cie10Sugeridos'] ?? [],
            $incoming['cie10Sugeridos'] ?? []
        ));
        $current['posologiaBorrador'] = array_merge(
            $current['posologiaBorrador'] ?? [],
            $incoming['posologiaBorrador'] ?? []
        );

        return $current;
    }
}
