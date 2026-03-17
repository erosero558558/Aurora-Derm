<?php

declare(strict_types=1);

/**
 * Agent governance validator.
 *
 * Validates:
 * - AGENTS.md as canonical policy marker.
 * - CLAUDE.md references AGENTS.md as source of truth.
 * - AGENT_BOARD.yaml shape and allowed values.
 * - AGENT_HANDOFFS.yaml schema and handoff constraints.
 * - governance-policy.json schema and thresholds.
 * - Codex mirror integrity between PLAN_MAESTRO_CODEX_2026.md and AGENT_BOARD.yaml.
 * - No duplicate task_id between derived queues.
 * - No critical-scope task assigned to disallowed executor.
 */

$root = dirname(__DIR__);
$agentsPath = $root . '/AGENTS.md';
$claudePath = $root . '/CLAUDE.md';
$boardPath = $root . '/AGENT_BOARD.yaml';
$handoffsPath = $root . '/AGENT_HANDOFFS.yaml';
$signalsPath = $root . '/AGENT_SIGNALS.yaml';
$jobsPath = $root . '/AGENT_JOBS.yaml';
$governancePolicyPath = $root . '/governance-policy.json';
$julesPath = $root . '/JULES_TASKS.md';
$kimiPath = $root . '/KIMI_TASKS.md';
$codexPlanPath = $root . '/PLAN_MAESTRO_CODEX_2026.md';

$errors = [];

function readFileStrict(string $path, array &$errors): string
{
    if (!is_file($path)) {
        $errors[] = "No existe archivo requerido: {$path}";
        return '';
    }

    $content = @file_get_contents($path);
    if ($content === false) {
        $errors[] = "No se pudo leer archivo requerido: {$path}";
        return '';
    }

    return str_replace("\r\n", "\n", $content);
}

function parseInlineArray(string $value): array
{
    $trimmed = trim($value);
    if ($trimmed === '[]' || $trimmed === '') {
        return [];
    }
    if ($trimmed[0] !== '[' || substr($trimmed, -1) !== ']') {
        return [trim($trimmed, "\"' ")];
    }

    $inner = trim(substr($trimmed, 1, -1));
    if ($inner === '') {
        return [];
    }

    $parts = str_getcsv($inner, ',', '"', '\\');
    $out = [];
    foreach ($parts as $part) {
        $clean = trim($part, " \t\n\r\0\x0B\"'");
        if ($clean !== '') {
            $out[] = $clean;
        }
    }

    return $out;
}

function parseScalar(string $raw)
{
    $value = trim($raw);
    if ($value === '') {
        return '';
    }
    if ($value === 'true') {
        return true;
    }
    if ($value === 'false') {
        return false;
    }
    if ($value === '[]') {
        return [];
    }
    if ($value[0] === '[' && substr($value, -1) === ']') {
        return parseInlineArray($value);
    }
    if ($value[0] === '"' && substr($value, -1) === '"') {
        return str_replace('\"', '"', substr($value, 1, -1));
    }

    return $value;
}

function parseBooleanLike($value, bool $fallback = false): bool
{
    if (is_bool($value)) {
        return $value;
    }
    $raw = strtolower(trim((string) $value));
    if ($raw === '') {
        return $fallback;
    }
    if (in_array($raw, ['true', '1', 'yes', 'y', 'si', 's', 'on'], true)) {
        return true;
    }
    if (in_array($raw, ['false', '0', 'no', 'n', 'off'], true)) {
        return false;
    }
    return $fallback;
}

function normalizeOptionalToken(string $value): string
{
    return strtolower(trim($value));
}

/**
 * @return array{version:mixed, policy:array<string,mixed>, strategy:array<string,mixed>, tasks:array<int,array<string,mixed>>}
 */
function parseBoardYaml(string $content): array
{
    $lines = explode("\n", $content);
    $board = [
        'version' => 1,
        'policy' => [],
        'strategy' => ['active' => null, 'next' => null],
        'tasks' => [],
    ];

    $inPolicy = false;
    $inStrategy = false;
    $inStrategyRecord = false;
    $strategyRecordKey = null;
    $inStrategySubfronts = false;
    $strategySubfront = null;
    $inTasks = false;
    $task = null;

    foreach ($lines as $lineRaw) {
        $line = str_replace("\t", '    ', $lineRaw);
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        if ($trimmed === 'policy:') {
            if (
                is_array($strategySubfront) &&
                is_string($strategyRecordKey) &&
                is_array($board['strategy'][$strategyRecordKey] ?? null) &&
                is_array($board['strategy'][$strategyRecordKey]['subfronts'] ?? null)
            ) {
                $board['strategy'][$strategyRecordKey]['subfronts'][] = $strategySubfront;
                $strategySubfront = null;
            }
            $inPolicy = true;
            $inStrategy = false;
            $inStrategyRecord = false;
            $strategyRecordKey = null;
            $inStrategySubfronts = false;
            $inTasks = false;
            continue;
        }

        if ($trimmed === 'strategy:') {
            $inPolicy = false;
            $inStrategy = true;
            $inStrategyRecord = false;
            $strategyRecordKey = null;
            $inStrategySubfronts = false;
            $inTasks = false;
            $board['strategy'] = ['active' => null, 'next' => null];
            continue;
        }

        if ($trimmed === 'tasks:') {
            if (
                is_array($strategySubfront) &&
                is_string($strategyRecordKey) &&
                is_array($board['strategy'][$strategyRecordKey] ?? null) &&
                is_array($board['strategy'][$strategyRecordKey]['subfronts'] ?? null)
            ) {
                $board['strategy'][$strategyRecordKey]['subfronts'][] = $strategySubfront;
                $strategySubfront = null;
            }
            $inPolicy = false;
            $inStrategy = false;
            $inStrategyRecord = false;
            $strategyRecordKey = null;
            $inStrategySubfronts = false;
            $inTasks = true;
            if (is_array($task)) {
                $board['tasks'][] = $task;
                $task = null;
            }
            continue;
        }

        if (!$inPolicy && !$inTasks && preg_match('/^version:\s*(.+)$/', $line, $m) === 1) {
            $board['version'] = parseScalar((string) $m[1]);
            continue;
        }

        if ($inPolicy && preg_match('/^\s{2}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1) {
            $board['policy'][(string) $m[1]] = parseScalar((string) $m[2]);
            continue;
        }

        if ($inStrategy) {
            if (preg_match('/^\s{2}(active|next):\s*(.*)$/', $line, $m) === 1) {
                $value = trim((string) $m[1]);
                if (
                    is_array($strategySubfront) &&
                    is_string($strategyRecordKey) &&
                    is_array($board['strategy'][$strategyRecordKey] ?? null) &&
                    is_array($board['strategy'][$strategyRecordKey]['subfronts'] ?? null)
                ) {
                    $board['strategy'][$strategyRecordKey]['subfronts'][] = $strategySubfront;
                    $strategySubfront = null;
                }
                $strategyRecordKey = trim((string) $m[1]);
                $value = trim((string) $m[2]);
                $inStrategyRecord = true;
                $inStrategySubfronts = false;
                $strategySubfront = null;
                $board['strategy'][$strategyRecordKey] = $value === 'null' ? null : ['subfronts' => []];
                continue;
            }

            if (
                $inStrategyRecord &&
                is_string($strategyRecordKey) &&
                is_array($board['strategy'][$strategyRecordKey] ?? null) &&
                trim($line) === 'subfronts:'
            ) {
                $inStrategySubfronts = true;
                if (!is_array($board['strategy'][$strategyRecordKey]['subfronts'] ?? null)) {
                    $board['strategy'][$strategyRecordKey]['subfronts'] = [];
                }
                continue;
            }

            if (
                $inStrategySubfronts &&
                is_string($strategyRecordKey) &&
                is_array($board['strategy'][$strategyRecordKey] ?? null)
            ) {
                if (preg_match('/^\s{6}-\s+([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1) {
                    if (is_array($strategySubfront)) {
                        $board['strategy'][$strategyRecordKey]['subfronts'][] = $strategySubfront;
                    }
                    $strategySubfront = [(string) $m[1] => parseScalar((string) $m[2])];
                    continue;
                }
                if (
                    is_array($strategySubfront) &&
                    preg_match('/^\s{8}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
                ) {
                    $strategySubfront[(string) $m[1]] = parseScalar((string) $m[2]);
                    continue;
                }
            }

            if (
                $inStrategyRecord &&
                is_string($strategyRecordKey) &&
                is_array($board['strategy'][$strategyRecordKey] ?? null) &&
                preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
            ) {
                $board['strategy'][$strategyRecordKey][(string) $m[1]] = parseScalar((string) $m[2]);
            }
            continue;
        }

        if ($inTasks && preg_match('/^\s{2}-\s+id:\s*(.+)$/', $line, $m) === 1) {
            if (is_array($task)) {
                $board['tasks'][] = $task;
            }
            $task = ['id' => parseScalar((string) $m[1])];
            continue;
        }

        if (
            $inTasks &&
            is_array($task) &&
            preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
        ) {
            $task[(string) $m[1]] = parseScalar((string) $m[2]);
        }
    }

    if (is_array($task)) {
        $board['tasks'][] = $task;
    }

    if (
        is_array($strategySubfront) &&
        is_string($strategyRecordKey) &&
        is_array($board['strategy'][$strategyRecordKey] ?? null) &&
        is_array($board['strategy'][$strategyRecordKey]['subfronts'] ?? null)
    ) {
        $board['strategy'][$strategyRecordKey]['subfronts'][] = $strategySubfront;
    }

    return $board;
}

/**
 * @return array<int,array<string,string>>
 */
function parseTaskBlocks(string $content): array
{
    $tasks = [];
    if (
        preg_match_all('/<!-- TASK\n([\s\S]*?)-->([\s\S]*?)<!-- \/TASK -->/m', $content, $matches, PREG_SET_ORDER) !== 1 &&
        empty($matches)
    ) {
        return $tasks;
    }

    foreach ($matches as $match) {
        $meta = [];
        $metaBlock = $match[1] ?? '';
        foreach (explode("\n", (string) $metaBlock) as $line) {
            if (preg_match('/^([\w-]+):\s*(.*)$/', trim($line), $m) === 1) {
                $meta[(string) $m[1]] = (string) $m[2];
            }
        }
        if (!empty($meta)) {
            $taskId = trim((string) ($meta['task_id'] ?? ''));
            if ($taskId === '' || preg_match('/^AG-\d+$/', $taskId) !== 1) {
                continue;
            }
            $tasks[] = $meta;
        }
    }

    return $tasks;
}

/**
 * @return array{version:mixed, handoffs:array<int,array<string,mixed>>}
 */
function parseHandoffsYaml(string $content): array
{
    $lines = explode("\n", $content);
    $data = [
        'version' => 1,
        'handoffs' => [],
    ];
    $inHandoffs = false;
    $handoff = null;

    foreach ($lines as $lineRaw) {
        $line = str_replace("\t", '    ', $lineRaw);
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        if (!$inHandoffs && preg_match('/^version:\s*(.+)$/', $line, $m) === 1) {
            $data['version'] = parseScalar((string) $m[1]);
            continue;
        }

        if ($trimmed === 'handoffs:') {
            $inHandoffs = true;
            if (is_array($handoff)) {
                $data['handoffs'][] = $handoff;
                $handoff = null;
            }
            continue;
        }

        if (!$inHandoffs) {
            continue;
        }

        if (preg_match('/^\s{2}-\s+id:\s*(.+)$/', $line, $m) === 1) {
            if (is_array($handoff)) {
                $data['handoffs'][] = $handoff;
            }
            $handoff = ['id' => parseScalar((string) $m[1])];
            continue;
        }

        if (
            is_array($handoff) &&
            preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
        ) {
            $handoff[(string) $m[1]] = parseScalar((string) $m[2]);
        }
    }

    if (is_array($handoff)) {
        $data['handoffs'][] = $handoff;
    }

    foreach ($data['handoffs'] as &$item) {
        if (!is_array($item['files'] ?? null)) {
            $item['files'] = isset($item['files']) ? [(string) $item['files']] : [];
        }
        $item['status'] = strtolower(trim((string) ($item['status'] ?? '')));
    }
    unset($item);

    return $data;
}

/**
 * @return array{version:mixed, updated_at:mixed, signals:array<int,array<string,mixed>>}
 */
function parseSignalsYaml(string $content): array
{
    $lines = explode("\n", $content);
    $data = [
        'version' => 1,
        'updated_at' => '',
        'signals' => [],
    ];
    $inSignals = false;
    $signal = null;

    foreach ($lines as $lineRaw) {
        $line = str_replace("\t", '    ', $lineRaw);
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        if (!$inSignals && preg_match('/^version:\s*(.+)$/', $line, $m) === 1) {
            $data['version'] = parseScalar((string) $m[1]);
            continue;
        }

        if (!$inSignals && preg_match('/^updated_at:\s*(.+)$/', $line, $m) === 1) {
            $data['updated_at'] = parseScalar((string) $m[1]);
            continue;
        }

        if ($trimmed === 'signals:') {
            $inSignals = true;
            if (is_array($signal)) {
                $data['signals'][] = $signal;
                $signal = null;
            }
            continue;
        }

        if (!$inSignals) {
            continue;
        }

        if (preg_match('/^\s{2}-\s+id:\s*(.+)$/', $line, $m) === 1) {
            if (is_array($signal)) {
                $data['signals'][] = $signal;
            }
            $signal = ['id' => parseScalar((string) $m[1])];
            continue;
        }

        if (
            is_array($signal) &&
            preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
        ) {
            $signal[(string) $m[1]] = parseScalar((string) $m[2]);
        }
    }

    if (is_array($signal)) {
        $data['signals'][] = $signal;
    }

    foreach ($data['signals'] as &$item) {
        if (!is_array($item['labels'] ?? null)) {
            $item['labels'] = isset($item['labels']) ? [(string) $item['labels']] : [];
        }
        $item['status'] = strtolower(trim((string) ($item['status'] ?? '')));
        $item['critical'] = (bool) ($item['critical'] ?? false);
    }
    unset($item);

    return $data;
}

/**
 * @return array{version:mixed, updated_at:mixed, jobs:array<int,array<string,mixed>>}
 */
function parseJobsYaml(string $content): array
{
    $lines = explode("\n", $content);
    $data = [
        'version' => 1,
        'updated_at' => '',
        'jobs' => [],
    ];
    $inJobs = false;
    $job = null;

    foreach ($lines as $lineRaw) {
        $line = str_replace("\t", '    ', $lineRaw);
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        if (!$inJobs && preg_match('/^version:\s*(.+)$/', $line, $m) === 1) {
            $data['version'] = parseScalar((string) $m[1]);
            continue;
        }

        if (!$inJobs && preg_match('/^updated_at:\s*(.+)$/', $line, $m) === 1) {
            $data['updated_at'] = parseScalar((string) $m[1]);
            continue;
        }

        if ($trimmed === 'jobs:') {
            $inJobs = true;
            if (is_array($job)) {
                $data['jobs'][] = $job;
                $job = null;
            }
            continue;
        }

        if (!$inJobs) {
            continue;
        }

        if (preg_match('/^\s{2}-\s+key:\s*(.+)$/', $line, $m) === 1) {
            if (is_array($job)) {
                $data['jobs'][] = $job;
            }
            $job = ['key' => parseScalar((string) $m[1])];
            continue;
        }

        if (
            is_array($job) &&
            preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
        ) {
            $job[(string) $m[1]] = parseScalar((string) $m[2]);
        }
    }

    if (is_array($job)) {
        $data['jobs'][] = $job;
    }

    return $data;
}

/**
 * @return array<int,array<string,mixed>>
 */
function parseCodexActiveBlocks(string $content): array
{
    $blocks = [];
    if (
        preg_match_all('/<!--\s*CODEX_ACTIVE\s*\n([\s\S]*?)-->/', $content, $matches, PREG_SET_ORDER) !== 1 &&
        empty($matches)
    ) {
        return $blocks;
    }

    foreach ($matches as $match) {
        $block = [];
        $body = (string) ($match[1] ?? '');
        foreach (explode("\n", $body) as $line) {
            if (preg_match('/^\s*([a-zA-Z_][\w-]*):\s*(.*)\s*$/', $line, $m) === 1) {
                $block[(string) $m[1]] = parseScalar((string) $m[2]);
            }
        }
        if (!is_array($block['files'] ?? null)) {
            $block['files'] = isset($block['files']) ? [(string) $block['files']] : [];
        }
        $blocks[] = $block;
    }

    return $blocks;
}

/**
 * @return array<int,array<string,mixed>>
 */
function parseCodexStrategyActiveBlocks(string $content): array
{
    $blocks = [];
    if (
        preg_match_all('/<!--\s*CODEX_STRATEGY_ACTIVE\s*\n([\s\S]*?)-->/', $content, $matches, PREG_SET_ORDER) !== 1 &&
        empty($matches)
    ) {
        return $blocks;
    }

    foreach ($matches as $match) {
        $block = [];
        foreach (explode("\n", (string) ($match[1] ?? '')) as $line) {
            if (preg_match('/^([a-zA-Z_][\w-]*):\s*(.*)$/', trim($line), $m) === 1) {
                $block[(string) $m[1]] = parseScalar((string) $m[2]);
            }
        }
        if (!is_array($block['subfront_ids'] ?? null)) {
            $block['subfront_ids'] = isset($block['subfront_ids']) ? [(string) $block['subfront_ids']] : [];
        }
        $block['status'] = strtolower(trim((string) ($block['status'] ?? '')));
        $blocks[] = $block;
    }

    return $blocks;
}

/**
 * @return array<int,array<string,mixed>>
 */
function parseCodexStrategyNextBlocks(string $content): array
{
    $blocks = [];
    if (
        preg_match_all('/<!--\s*CODEX_STRATEGY_NEXT\s*\n([\s\S]*?)-->/', $content, $matches, PREG_SET_ORDER) !== 1 &&
        empty($matches)
    ) {
        return $blocks;
    }

    foreach ($matches as $match) {
        $block = [];
        foreach (explode("\n", (string) ($match[1] ?? '')) as $line) {
            if (preg_match('/^([a-zA-Z_][\w-]*):\s*(.*)$/', trim($line), $m) === 1) {
                $block[(string) $m[1]] = parseScalar((string) $m[2]);
            }
        }
        if (!is_array($block['subfront_ids'] ?? null)) {
            $block['subfront_ids'] = isset($block['subfront_ids']) ? [(string) $block['subfront_ids']] : [];
        }
        $block['status'] = strtolower(trim((string) ($block['status'] ?? '')));
        $blocks[] = $block;
    }

    return $blocks;
}

/**
 * @return array<string,mixed>|null
 */
function normalizeStrategySubfrontShape($subfront): ?array
{
    if (!is_array($subfront)) {
        return null;
    }

    $normalizeScopes = static function ($value): array {
        $values = is_array($value) ? $value : (isset($value) ? [$value] : []);
        $out = [];
        foreach ($values as $item) {
            $clean = strtolower(trim((string) $item));
            if ($clean !== '') {
                $out[] = $clean;
            }
        }
        return $out;
    };

    return [
        'codex_instance' => strtolower(trim((string) ($subfront['codex_instance'] ?? ''))),
        'subfront_id' => trim((string) ($subfront['subfront_id'] ?? '')),
        'title' => trim((string) ($subfront['title'] ?? '')),
        'allowed_scopes' => $normalizeScopes($subfront['allowed_scopes'] ?? []),
        'support_only_scopes' => $normalizeScopes($subfront['support_only_scopes'] ?? []),
        'blocked_scopes' => $normalizeScopes($subfront['blocked_scopes'] ?? []),
    ];
}

/**
 * @return array<string,mixed>|null
 */
function getConfiguredStrategy(array $board): ?array
{
    $strategy = $board['strategy']['active'] ?? null;
    if (!is_array($strategy)) {
        return null;
    }

    $subfronts = [];
    foreach (($strategy['subfronts'] ?? []) as $subfront) {
        $normalized = normalizeStrategySubfrontShape($subfront);
        if ($normalized !== null) {
            $subfronts[] = $normalized;
        }
    }

    $exitCriteria = $strategy['exit_criteria'] ?? [];
    if (!is_array($exitCriteria)) {
        $exitCriteria = [$exitCriteria];
    }
    $normalizedExitCriteria = [];
    foreach ($exitCriteria as $criterion) {
        $clean = trim((string) $criterion);
        if ($clean !== '') {
            $normalizedExitCriteria[] = $clean;
        }
    }

    return [
        'id' => trim((string) ($strategy['id'] ?? '')),
        'title' => trim((string) ($strategy['title'] ?? '')),
        'objective' => trim((string) ($strategy['objective'] ?? '')),
        'owner' => trim((string) ($strategy['owner'] ?? '')),
        'owner_policy' => trim((string) ($strategy['owner_policy'] ?? '')),
        'status' => strtolower(trim((string) ($strategy['status'] ?? ''))),
        'started_at' => trim((string) ($strategy['started_at'] ?? '')),
        'review_due_at' => trim((string) ($strategy['review_due_at'] ?? '')),
        'closed_at' => trim((string) ($strategy['closed_at'] ?? '')),
        'close_reason' => trim((string) ($strategy['close_reason'] ?? '')),
        'exit_criteria' => $normalizedExitCriteria,
        'success_signal' => trim((string) ($strategy['success_signal'] ?? '')),
        'subfronts' => $subfronts,
    ];
}

/**
 * @return array<string,mixed>|null
 */
function getConfiguredNextStrategy(array $board): ?array
{
    $strategy = $board['strategy']['next'] ?? null;
    if (!is_array($strategy)) {
        return null;
    }

    $subfronts = [];
    foreach (($strategy['subfronts'] ?? []) as $subfront) {
        $normalized = normalizeStrategySubfrontShape($subfront);
        if ($normalized !== null) {
            $subfronts[] = $normalized;
        }
    }

    $exitCriteria = $strategy['exit_criteria'] ?? [];
    if (!is_array($exitCriteria)) {
        $exitCriteria = [$exitCriteria];
    }
    $normalizedExitCriteria = [];
    foreach ($exitCriteria as $criterion) {
        $clean = trim((string) $criterion);
        if ($clean !== '') {
            $normalizedExitCriteria[] = $clean;
        }
    }

    return [
        'id' => trim((string) ($strategy['id'] ?? '')),
        'title' => trim((string) ($strategy['title'] ?? '')),
        'objective' => trim((string) ($strategy['objective'] ?? '')),
        'owner' => trim((string) ($strategy['owner'] ?? '')),
        'owner_policy' => trim((string) ($strategy['owner_policy'] ?? '')),
        'status' => strtolower(trim((string) ($strategy['status'] ?? ''))),
        'started_at' => trim((string) ($strategy['started_at'] ?? '')),
        'review_due_at' => trim((string) ($strategy['review_due_at'] ?? '')),
        'closed_at' => trim((string) ($strategy['closed_at'] ?? '')),
        'close_reason' => trim((string) ($strategy['close_reason'] ?? '')),
        'exit_criteria' => $normalizedExitCriteria,
        'success_signal' => trim((string) ($strategy['success_signal'] ?? '')),
        'subfronts' => $subfronts,
    ];
}

/**
 * @return array<string,mixed>|null
 */
function getActiveStrategy(array $board): ?array
{
    $strategy = getConfiguredStrategy($board);
    if (!is_array($strategy)) {
        return null;
    }
    return ($strategy['status'] ?? '') === 'active' ? $strategy : null;
}

/**
 * @return array<int,string>
 */
function validateStrategyConfiguration(array $board, array $allowedCodexInstances): array
{
    $errors = [];

    $collectScopeOwnershipConflicts = static function (?array $strategy): array {
        if (!is_array($strategy)) {
            return [];
        }

        $strategyId = trim((string) ($strategy['id'] ?? ''));
        if ($strategyId === '') {
            return [];
        }

        $ownershipClaims = [];
        $blockedScopes = [];
        $scopeErrors = [];

        foreach (($strategy['subfronts'] ?? []) as $subfront) {
            $subfrontId = trim((string) ($subfront['subfront_id'] ?? ''));
            $codexInstance = trim((string) ($subfront['codex_instance'] ?? ''));
            $localScopes = [];
            $buckets = [
                'allowed_scopes' => is_array($subfront['allowed_scopes'] ?? null) ? $subfront['allowed_scopes'] : [],
                'support_only_scopes' => is_array($subfront['support_only_scopes'] ?? null) ? $subfront['support_only_scopes'] : [],
                'blocked_scopes' => is_array($subfront['blocked_scopes'] ?? null) ? $subfront['blocked_scopes'] : [],
            ];

            foreach ($buckets as $bucket => $scopes) {
                foreach ($scopes as $scopeValue) {
                    $scope = trim((string) $scopeValue);
                    if ($scope === '') {
                        continue;
                    }
                    if (isset($localScopes[$scope])) {
                        $scopeErrors[] = "{$strategyId}: subfront {$subfrontId} repite scope {$scope} entre {$localScopes[$scope]} y {$bucket}";
                        continue;
                    }
                    $localScopes[$scope] = $bucket;
                }
            }

            foreach ($buckets as $bucket => $scopes) {
                foreach ($scopes as $scopeValue) {
                    $scope = trim((string) $scopeValue);
                    if ($scope === '') {
                        continue;
                    }

                    if ($bucket === 'blocked_scopes') {
                        foreach (($ownershipClaims[$scope] ?? []) as $owner) {
                            if (($owner['codex_instance'] ?? '') !== $codexInstance) {
                                continue;
                            }
                            $scopeErrors[] = "{$strategyId}: scope {$scope} asignado de forma ambigua a {$owner['subfront_id']} y {$subfrontId}";
                        }
                        $blockedScopes[$scope] ??= [];
                        $blockedScopes[$scope][] = [
                            'subfront_id' => $subfrontId,
                            'codex_instance' => $codexInstance,
                            'bucket' => $bucket,
                        ];
                        continue;
                    }

                    foreach (($ownershipClaims[$scope] ?? []) as $owner) {
                        if (($owner['codex_instance'] ?? '') === $codexInstance) {
                            continue;
                        }
                        $scopeErrors[] = "{$strategyId}: scope {$scope} asignado de forma ambigua a {$owner['subfront_id']} y {$subfrontId}";
                    }
                    foreach (($blockedScopes[$scope] ?? []) as $blockedOwner) {
                        if (($blockedOwner['codex_instance'] ?? '') !== $codexInstance) {
                            continue;
                        }
                        $scopeErrors[] = "{$strategyId}: scope {$scope} asignado de forma ambigua a {$blockedOwner['subfront_id']} y {$subfrontId}";
                    }

                    $ownershipClaims[$scope] ??= [];
                    $ownershipClaims[$scope][] = [
                        'subfront_id' => $subfrontId,
                        'codex_instance' => $codexInstance,
                        'bucket' => $bucket,
                    ];
                }
            }
        }

        return $scopeErrors;
    };

    $validateStrategyRecord = static function (?array $strategy, string $label, array $validStatuses) use ($allowedCodexInstances): array {
        if (!is_array($strategy)) {
            return [];
        }

        $localErrors = [];
        if (($strategy['id'] ?? '') === '') {
            $localErrors[] = "{$label} requiere id";
        }
        if (($strategy['title'] ?? '') === '') {
            $localErrors[] = "{$label} requiere title";
        }
        if (($strategy['objective'] ?? '') === '') {
            $localErrors[] = "{$label} requiere objective";
        }
        if (($strategy['owner'] ?? '') === '') {
            $localErrors[] = "{$label} requiere owner";
        }
        if (!in_array($strategy['status'] ?? '', $validStatuses, true)) {
            $localErrors[] = "{$label} tiene status invalido";
        }
        if (($strategy['started_at'] ?? '') === '') {
            $localErrors[] = "{$label} requiere started_at";
        }
        if (($strategy['review_due_at'] ?? '') === '') {
            $localErrors[] = "{$label} requiere review_due_at";
        }
        if (count($strategy['exit_criteria'] ?? []) === 0) {
            $localErrors[] = "{$label} requiere exit_criteria no vacio";
        }
        if (($strategy['success_signal'] ?? '') === '') {
            $localErrors[] = "{$label} requiere success_signal";
        }

        $countsByInstance = [];
        $seenSubfrontIds = [];
        foreach (($strategy['subfronts'] ?? []) as $subfront) {
            $subfrontId = (string) ($subfront['subfront_id'] ?? '');
            $codexInstance = (string) ($subfront['codex_instance'] ?? '');
            if ($subfrontId === '') {
                $localErrors[] = "{$label}.subfronts requiere subfront_id";
            } elseif (isset($seenSubfrontIds[$subfrontId])) {
                $localErrors[] = "{$label} duplica subfront_id ({$subfrontId})";
            } else {
                $seenSubfrontIds[$subfrontId] = true;
            }
            if ($codexInstance === '') {
                $localErrors[] = "{$label}.subfront {$subfrontId} requiere codex_instance";
            } elseif (!in_array($codexInstance, $allowedCodexInstances, true)) {
                $localErrors[] = "{$label}.subfront {$subfrontId} tiene codex_instance invalido ({$codexInstance})";
            } else {
                $countsByInstance[$codexInstance] = (int) ($countsByInstance[$codexInstance] ?? 0) + 1;
            }
            if (trim((string) ($subfront['title'] ?? '')) === '') {
                $localErrors[] = "{$label}.subfront {$subfrontId} requiere title";
            }
        }

        foreach ($allowedCodexInstances as $codexInstance) {
            $count = (int) ($countsByInstance[$codexInstance] ?? 0);
            if ($count < 1) {
                $localErrors[] = "{$label} requiere al menos un subfront para {$codexInstance} (actual: {$count})";
            }
        }

        return $localErrors;
    };

    $activeStrategy = getConfiguredStrategy($board);
    $nextStrategy = getConfiguredNextStrategy($board);
    $errors = array_merge(
        $errors,
        $validateStrategyRecord($activeStrategy, 'strategy.active', ['active', 'closed']),
        $collectScopeOwnershipConflicts($activeStrategy),
        $validateStrategyRecord($nextStrategy, 'strategy.next', ['draft']),
        $collectScopeOwnershipConflicts($nextStrategy)
    );

    if (
        is_array($activeStrategy) &&
        is_array($nextStrategy) &&
        trim((string) ($activeStrategy['id'] ?? '')) !== '' &&
        (string) ($activeStrategy['id'] ?? '') === (string) ($nextStrategy['id'] ?? '')
    ) {
        $errors[] = 'strategy.active y strategy.next no pueden compartir id';
    }

    return $errors;
}

/**
 * @return array<string,mixed>|null
 */
function findStrategySubfront(?array $strategy, array $task): ?array
{
    if (!is_array($strategy)) {
        return null;
    }

    $subfrontId = trim((string) ($task['subfront_id'] ?? ''));
    if ($subfrontId !== '') {
        foreach (($strategy['subfronts'] ?? []) as $subfront) {
            if ((string) ($subfront['subfront_id'] ?? '') === $subfrontId) {
                return $subfront;
            }
        }
    }

    $codexInstance = strtolower(trim((string) ($task['codex_instance'] ?? '')));
    if ($codexInstance === '') {
        return null;
    }
    $matches = [];
    foreach (($strategy['subfronts'] ?? []) as $subfront) {
        if ((string) ($subfront['codex_instance'] ?? '') === $codexInstance) {
            $matches[] = $subfront;
        }
    }
    return count($matches) === 1 ? $matches[0] : null;
}

function isAllowedStrategyException(array $task, array $criticalScopes): bool
{
    if (isReleasePromotionExceptionTask($task)) {
        return true;
    }

    $scope = strtolower(trim((string) ($task['scope'] ?? '')));
    $runtimeImpact = strtolower(trim((string) ($task['runtime_impact'] ?? '')));
    if ((bool) ($task['critical_zone'] ?? false) || $runtimeImpact === 'high') {
        return true;
    }
    foreach ($criticalScopes as $criticalScope) {
        if ($scope !== '' && str_contains($scope, $criticalScope)) {
            return true;
        }
    }

    $corpus = strtolower(
        trim(
            implode(' ', [
                (string) ($task['strategy_reason'] ?? ''),
                (string) ($task['scope'] ?? ''),
                (string) ($task['title'] ?? ''),
                (string) ($task['blocked_reason'] ?? ''),
            ])
        )
    );
    foreach ([
        'hotfix',
        'incident',
        'incidente',
        'support',
        'soporte',
        'unlock',
        'desbloque',
        'desbloquear',
        'unblock',
        'frente activo',
        'active front',
    ] as $token) {
        if ($corpus !== '' && str_contains($corpus, $token)) {
            return true;
        }
    }
    return false;
}

function isReleasePromotionExceptionTask(array $task): bool
{
    return normalizeOptionalToken((string) ($task['strategy_role'] ?? '')) === 'exception'
        && trim((string) ($task['strategy_reason'] ?? '')) === 'validated_release_promotion'
        && trim((string) ($task['status'] ?? '')) === 'review'
        && normalizeOptionalToken((string) ($task['work_type'] ?? '')) === 'evidence'
        && normalizeOptionalToken((string) ($task['integration_slice'] ?? '')) === 'governance_evidence'
        && normalizeOptionalToken((string) ($task['executor'] ?? '')) === 'codex';
}

/**
 * @return array<int,string>
 */
function validateTaskStrategyAlignment(array $board, array $task, array $criticalScopes): array
{
    $strategy = getActiveStrategy($board);
    if (!is_array($strategy)) {
        return [];
    }

    $status = trim((string) ($task['status'] ?? ''));
    if (!isActiveStatus($status)) {
        return [];
    }

    $errors = [];
    $id = (string) ($task['id'] ?? '(sin id)');
    $strategyId = trim((string) ($task['strategy_id'] ?? ''));
    $subfrontId = trim((string) ($task['subfront_id'] ?? ''));
    $strategyRole = strtolower(trim((string) ($task['strategy_role'] ?? '')));
    $strategyReason = trim((string) ($task['strategy_reason'] ?? ''));
    $scope = strtolower(trim((string) ($task['scope'] ?? '')));
    $isReleasePromotionException = isReleasePromotionExceptionTask($task);

    if ($strategyId === '') {
        $errors[] = "Task {$id} activa requiere strategy_id";
        return $errors;
    }
    if ($strategyId !== (string) ($strategy['id'] ?? '')) {
        $errors[] = "Task {$id} tiene strategy_id desalineado con strategy.active";
    }
    if ($subfrontId === '') {
        $errors[] = "Task {$id} activa requiere subfront_id";
        return $errors;
    }

    $subfront = findStrategySubfront($strategy, $task);
    if (!is_array($subfront) || (string) ($subfront['subfront_id'] ?? '') !== $subfrontId) {
        $errors[] = "Task {$id} tiene subfront_id invalido para strategy.active";
        return $errors;
    }

    if (strtolower(trim((string) ($task['codex_instance'] ?? ''))) !== (string) ($subfront['codex_instance'] ?? '')) {
        $errors[] = "Task {$id} tiene codex_instance desalineado con subfront {$subfrontId}";
    }
    if (!in_array($strategyRole, ['primary', 'support', 'exception'], true)) {
        $errors[] = "Task {$id} tiene strategy_role invalido";
        return $errors;
    }

    $allowedScopes = is_array($subfront['allowed_scopes'] ?? null) ? $subfront['allowed_scopes'] : [];
    $supportOnlyScopes = is_array($subfront['support_only_scopes'] ?? null) ? $subfront['support_only_scopes'] : [];
    $blockedScopes = is_array($subfront['blocked_scopes'] ?? null) ? $subfront['blocked_scopes'] : [];
    if (in_array($scope, $blockedScopes, true) && !$isReleasePromotionException) {
        $errors[] = "Task {$id} usa scope bloqueado por subfront {$subfrontId}";
    }

    if ($strategyRole === 'exception') {
        if ($strategyReason === '') {
            $errors[] = "Task {$id} con strategy_role=exception requiere strategy_reason";
        } elseif (!$isReleasePromotionException && !isAllowedStrategyException($task, $criticalScopes)) {
            $errors[] = "Task {$id} exception solo permitido para hotfix critico o soporte directo al frente activo";
        }
        return $errors;
    }

    $inAllowedScopes = in_array($scope, $allowedScopes, true);
    $inSupportOnlyScopes = in_array($scope, $supportOnlyScopes, true);
    if ($inSupportOnlyScopes && $strategyRole !== 'support') {
        $errors[] = "Task {$id} scope {$scope} requiere strategy_role=support";
    }
    if (!$inAllowedScopes && !$inSupportOnlyScopes) {
        $errors[] = "Task {$id} scope {$scope} fuera del subfront {$subfrontId}";
    }

    return $errors;
}

function normalizePathToken(string $value): string
{
    $normalized = str_replace('\\', '/', trim($value));
    $normalized = preg_replace('/^\.\//', '', $normalized) ?? $normalized;
    return strtolower($normalized);
}

function hasWildcard(string $value): bool
{
    return strpos($value, '*') !== false;
}

function wildcardToRegex(string $pattern): string
{
    $quoted = preg_quote($pattern, '/');
    return '/^' . str_replace('\*', '.*', $quoted) . '$/i';
}

function classifyFileLaneForDualCodex(string $rawFile): string
{
    $file = normalizePathToken($rawFile);
    if ($file === '') {
        return 'backend_ops';
    }
    $transversalPatterns = [
        'agent-orchestrator.js',
        'agents.md',
        'agent_board.yaml',
        'agent_handoffs.yaml',
        'agent_jobs.yaml',
        'agent_signals.yaml',
        'governance-policy.json',
        'docs/agent_orchestration_runbook.md',
        'docs/public_main_update_runbook.md',
        'docs/github_actions_deploy.md',
        'dual_codex_runbook.md',
        'tri_lane_runtime_runbook.md',
        'plan_maestro_codex_2026.md',
        'tests-node/agent-orchestrator-cli.test.js',
        'tests-node/orchestrator/**',
        'tests-node/publish-checkpoint-command.test.js',
        'tools/agent-orchestrator/**',
        'bin/validate-agent-governance.php',
        'figo-ai-bridge.php',
        'check-ai-response.php',
        'lib/figo_queue.php',
        'lib/figo_queue/**',
        'lib/auth.php',
        'lib/leadopsservice.php',
        'controllers/operatorauthcontroller.php',
        'controllers/leadaicontroller.php',
        'bin/lead-ai-worker.js',
        'bin/lib/lead-ai-worker.js',
    ];
    $backendPatterns = [
        'controllers/**',
        'lib/**',
        'api.php',
        'figo-*.php',
        '.github/workflows/**',
        'cron.php',
        'env*.php',
        'bin/**',
    ];
    $frontendPatterns = [
        'src/apps/**',
        'js/**',
        'styles*.css',
        'templates/**',
        'content/**',
        '*.html',
    ];
    foreach ($transversalPatterns as $pattern) {
        if (preg_match(wildcardToRegex($pattern), $file) === 1) {
            return 'transversal_runtime';
        }
    }
    $matchesBackend = false;
    foreach ($backendPatterns as $pattern) {
        if (preg_match(wildcardToRegex($pattern), $file) === 1) {
            $matchesBackend = true;
            break;
        }
    }
    $matchesFrontend = false;
    foreach ($frontendPatterns as $pattern) {
        if (preg_match(wildcardToRegex($pattern), $file) === 1) {
            $matchesFrontend = true;
            break;
        }
    }

    // Conservative fallback: dudas o no-match se asignan a backend_ops.
    if (($matchesBackend && $matchesFrontend) || (!$matchesBackend && !$matchesFrontend)) {
        return 'backend_ops';
    }
    return $matchesFrontend ? 'frontend_content' : 'backend_ops';
}

/**
 * @return array<int,string>
 */
function frontendPublicReleaseSupportPatterns(): array
{
    return [
        'tests-node/public-v6-*.test.js',
        'tests/booking.spec.js',
        'tests/chat-booking-calendar-errors.spec.js',
        'tests/checklist-production.spec.js',
        'tests/deferred-shell-static-fallback.spec.js',
        'tests/funnel-tracking.spec.js',
        'tests/public-v6-case-stories.spec.js',
        'tests/public-v6-news-strip.spec.js',
        'verification/public-v6-canonical/**',
        'package.json',
    ];
}

function isFrontendPublicReleaseSupportTask(array $task): bool
{
    return normalizeOptionalToken((string) ($task['strategy_role'] ?? '')) === 'exception'
        && trim((string) ($task['strategy_reason'] ?? '')) === 'validated_release_promotion'
        && trim((string) ($task['status'] ?? '')) === 'review'
        && normalizeOptionalToken((string) ($task['work_type'] ?? '')) === 'evidence'
        && normalizeOptionalToken((string) ($task['integration_slice'] ?? '')) === 'governance_evidence'
        && normalizeOptionalToken((string) ($task['scope'] ?? '')) === 'frontend-public'
        && normalizeOptionalToken((string) ($task['codex_instance'] ?? '')) === 'codex_frontend'
        && normalizeOptionalToken((string) ($task['domain_lane'] ?? '')) === 'frontend_content';
}

function isFrontendPublicReleaseSupportFile(string $rawFile): bool
{
    $file = normalizePathToken($rawFile);
    if ($file === '') {
        return false;
    }
    foreach (frontendPublicReleaseSupportPatterns() as $pattern) {
        if (preg_match(wildcardToRegex($pattern), $file) === 1) {
            return true;
        }
    }
    return false;
}

/**
 * @return array{any_overlap:bool, overlap_files:array<int,string>, ambiguous_wildcard_overlap:bool}
 */
function analyzeFileOverlap(array $filesA, array $filesB): array
{
    $overlapFiles = [];
    $seen = [];
    $anyOverlap = false;
    $ambiguous = false;

    foreach ($filesA as $rawA) {
        foreach ($filesB as $rawB) {
            $a = normalizePathToken((string) $rawA);
            $b = normalizePathToken((string) $rawB);
            if ($a === '' || $b === '') {
                continue;
            }
            if ($a === $b) {
                $anyOverlap = true;
                if (!isset($seen[$a])) {
                    $seen[$a] = true;
                    $overlapFiles[] = $a;
                }
                continue;
            }

            $aWild = hasWildcard($a);
            $bWild = hasWildcard($b);

            if (!$aWild && $bWild && preg_match(wildcardToRegex($b), $a) === 1) {
                $anyOverlap = true;
                if (!isset($seen[$a])) {
                    $seen[$a] = true;
                    $overlapFiles[] = $a;
                }
                continue;
            }

            if ($aWild && !$bWild && preg_match(wildcardToRegex($a), $b) === 1) {
                $anyOverlap = true;
                if (!isset($seen[$b])) {
                    $seen[$b] = true;
                    $overlapFiles[] = $b;
                }
                continue;
            }

            if ($aWild && $bWild) {
                if (preg_match(wildcardToRegex($a), $b) === 1 || preg_match(wildcardToRegex($b), $a) === 1) {
                    $anyOverlap = true;
                    $ambiguous = true;
                }
            }
        }
    }

    sort($overlapFiles);
    return [
        'any_overlap' => $anyOverlap,
        'overlap_files' => $overlapFiles,
        'ambiguous_wildcard_overlap' => $ambiguous,
    ];
}

function isActiveStatus(string $status): bool
{
    return in_array($status, ['ready', 'in_progress', 'review', 'blocked'], true);
}

$agents = readFileStrict($agentsPath, $errors);
$claude = readFileStrict($claudePath, $errors);
$boardRaw = readFileStrict($boardPath, $errors);
$handoffsRaw = readFileStrict($handoffsPath, $errors);
$signalsRaw = readFileStrict($signalsPath, $errors);
$jobsRaw = readFileStrict($jobsPath, $errors);
$governancePolicyRaw = readFileStrict($governancePolicyPath, $errors);
$julesRaw = readFileStrict($julesPath, $errors);
$kimiRaw = readFileStrict($kimiPath, $errors);
$codexPlanRaw = readFileStrict($codexPlanPath, $errors);

if ($agents !== '') {
    if (!str_contains($agents, 'CANONICAL_AGENT_POLICY: AGENTS.md')) {
        $errors[] = 'AGENTS.md no declara el marcador canonico CANONICAL_AGENT_POLICY: AGENTS.md';
    }
    if (!str_contains($agents, 'AGENT_POLICY_VERSION:')) {
        $errors[] = 'AGENTS.md no declara AGENT_POLICY_VERSION.';
    }
}

if ($claude !== '') {
    if (!str_contains($claude, 'SOURCE_OF_TRUTH: AGENTS.md')) {
        $errors[] = 'CLAUDE.md debe declarar SOURCE_OF_TRUTH: AGENTS.md';
    }
    if (preg_match('/SOURCE_OF_TRUTH:\s*CLAUDE\.md/i', $claude) === 1) {
        $errors[] = 'CLAUDE.md no puede declararse como fuente de verdad.';
    }
}

$requiredTaskKeys = [
    'id',
    'title',
    'owner',
    'executor',
    'status',
    'risk',
    'scope',
    'files',
    'source_signal',
    'source_ref',
    'priority_score',
    'sla_due_at',
    'last_attempt_at',
    'attempts',
    'blocked_reason',
    'runtime_impact',
    'critical_zone',
    'acceptance',
    'acceptance_ref',
    'evidence_ref',
    'depends_on',
    'created_at',
    'updated_at',
];
$requiredDualTaskKeys = [
    'codex_instance',
    'domain_lane',
    'lane_lock',
    'cross_domain',
];
$allowedStatuses = ['backlog', 'ready', 'in_progress', 'review', 'done', 'blocked', 'failed'];
$allowedExecutors = ['codex', 'claude', 'kimi', 'jules', 'ci'];
$retiredExecutors = ['claude', 'kimi', 'jules'];
$allowedCodexInstances = ['codex_backend_ops', 'codex_frontend', 'codex_transversal'];
$allowedDomainLanes = ['backend_ops', 'frontend_content', 'transversal_runtime'];
$allowedLaneLocks = ['strict', 'handoff_allowed'];
$allowedProviderModes = ['openclaw_chatgpt'];
$allowedRuntimeSurfaces = ['figo_queue', 'leadops_worker', 'operator_auth'];
$allowedRuntimeTransports = ['hybrid_http_cli', 'http_bridge', 'cli_helper'];
$criticalScopes = ['payments', 'auth', 'calendar', 'deploy', 'env', 'security'];
$requiredStrategyTaskKeys = ['strategy_id', 'subfront_id', 'strategy_role'];

$board = [
    'version' => 1,
    'policy' => [],
    'strategy' => ['active' => null],
    'tasks' => [],
];
if ($boardRaw !== '') {
    $board = parseBoardYaml($boardRaw);
}

foreach (validateStrategyConfiguration($board, $allowedCodexInstances) as $strategyError) {
    $errors[] = $strategyError;
}

if (empty($board['tasks'])) {
    $errors[] = 'AGENT_BOARD.yaml no contiene tareas.';
}

if (array_key_exists('revision', $board['policy'])) {
    $boardRevisionRaw = trim((string) $board['policy']['revision']);
    if ($boardRevisionRaw === '' || preg_match('/^\d+$/', $boardRevisionRaw) !== 1) {
        $errors[] = 'AGENT_BOARD.yaml policy.revision debe ser entero >= 0';
    }
}

$taskIds = [];
foreach ($board['tasks'] as $idx => $task) {
    $position = $idx + 1;
    foreach ($requiredTaskKeys as $key) {
        if (!array_key_exists($key, $task)) {
            $errors[] = "AGENT_BOARD task #{$position} sin campo obligatorio: {$key}";
        }
    }

    $id = (string) ($task['id'] ?? '');
    if ($id === '') {
        $errors[] = "AGENT_BOARD task #{$position} tiene id vacio";
    } elseif (isset($taskIds[$id])) {
        $errors[] = "AGENT_BOARD tiene task_id duplicado: {$id}";
    } else {
        $taskIds[$id] = true;
    }

    $status = (string) ($task['status'] ?? '');
    if (!in_array($status, $allowedStatuses, true)) {
        $errors[] = "Task {$id} tiene status invalido: {$status}";
    }
    $requiresStrategyTaskKeys = isActiveStatus($status) && is_array(getActiveStrategy($board));
    $requiresDualTaskKeys = in_array($status, ['ready', 'in_progress', 'review', 'blocked'], true);
    $hasAnyDualKey = false;
    foreach ($requiredDualTaskKeys as $dualKey) {
        if (array_key_exists($dualKey, $task)) {
            $hasAnyDualKey = true;
            break;
        }
    }
    if ($requiresDualTaskKeys || $hasAnyDualKey) {
        foreach ($requiredDualTaskKeys as $dualKey) {
            if (!array_key_exists($dualKey, $task)) {
                $errors[] = "Task {$id} requiere campo dual-codex: {$dualKey}";
            }
        }
    }
    if ($requiresStrategyTaskKeys) {
        foreach ($requiredStrategyTaskKeys as $strategyKey) {
            if (!array_key_exists($strategyKey, $task) || trim((string) ($task[$strategyKey] ?? '')) === '') {
                $errors[] = "Task {$id} activa requiere campo strategy: {$strategyKey}";
            }
        }
        if (
            strtolower(trim((string) ($task['strategy_role'] ?? ''))) === 'exception' &&
            trim((string) ($task['strategy_reason'] ?? '')) === ''
        ) {
            $errors[] = "Task {$id} con strategy_role=exception requiere strategy_reason";
        }
    }

    $executor = (string) ($task['executor'] ?? '');
    if (!in_array($executor, $allowedExecutors, true)) {
        $errors[] = "Task {$id} tiene executor invalido: {$executor}";
    }
    if ($status !== 'done' && $status !== 'failed' && in_array($executor, $retiredExecutors, true)) {
        $errors[] = "Task {$id} no terminal no puede usar executor retirado: {$executor}";
    }

    $scope = strtolower((string) ($task['scope'] ?? ''));
    $runtimeImpact = strtolower((string) ($task['runtime_impact'] ?? ''));
    if (!in_array($runtimeImpact, ['none', 'low', 'high'], true)) {
        $errors[] = "Task {$id} tiene runtime_impact invalido: {$runtimeImpact}";
    }
    $attempts = is_numeric($task['attempts'] ?? null) ? (int) $task['attempts'] : -1;
    if ($attempts < 0) {
        $errors[] = "Task {$id} debe declarar attempts >= 0";
    }
    $priorityScore = is_numeric($task['priority_score'] ?? null) ? (int) $task['priority_score'] : -1;
    if ($priorityScore < 0 || $priorityScore > 100) {
        $errors[] = "Task {$id} debe declarar priority_score en rango 0..100";
    }
    $criticalZone = (bool) ($task['critical_zone'] ?? false);
    if ($criticalZone || $runtimeImpact === 'high') {
        if ($executor !== 'codex') {
            $errors[] = "Task critica {$id} por runtime/critical_zone no puede asignarse a {$executor}";
        }
    }
    foreach ($criticalScopes as $keyword) {
        if (str_contains($scope, $keyword) && $executor !== 'codex') {
            $errors[] = "Task critica {$id} ({$scope}) no puede asignarse a executor {$executor}";
            break;
        }
    }

    $codexInstance = strtolower(trim((string) ($task['codex_instance'] ?? 'codex_backend_ops')));
    $domainLane = strtolower(trim((string) ($task['domain_lane'] ?? 'backend_ops')));
    $laneLock = strtolower(trim((string) ($task['lane_lock'] ?? 'strict')));
    $crossDomain = parseBooleanLike($task['cross_domain'] ?? false, false);
    $providerMode = strtolower(trim((string) ($task['provider_mode'] ?? '')));
    $runtimeSurface = strtolower(trim((string) ($task['runtime_surface'] ?? '')));
    $runtimeTransport = strtolower(trim((string) ($task['runtime_transport'] ?? '')));
    $runtimeLastTransport = strtolower(trim((string) ($task['runtime_last_transport'] ?? '')));
    $isRuntimeTask = $providerMode === 'openclaw_chatgpt'
        || $runtimeSurface !== ''
        || $runtimeTransport !== ''
        || $runtimeLastTransport !== '';

    $shouldValidateDual = $requiresDualTaskKeys || $hasAnyDualKey;
    if ($shouldValidateDual && !in_array($codexInstance, $allowedCodexInstances, true)) {
        $errors[] = "Task {$id} tiene codex_instance invalido: {$codexInstance}";
    }
    if ($shouldValidateDual && !in_array($domainLane, $allowedDomainLanes, true)) {
        $errors[] = "Task {$id} tiene domain_lane invalido: {$domainLane}";
    }
    if ($shouldValidateDual && !in_array($laneLock, $allowedLaneLocks, true)) {
        $errors[] = "Task {$id} tiene lane_lock invalido: {$laneLock}";
    }
    if ($providerMode !== '' && !in_array($providerMode, $allowedProviderModes, true)) {
        $errors[] = "Task {$id} tiene provider_mode invalido: {$providerMode}";
    }
    if ($runtimeSurface !== '' && !in_array($runtimeSurface, $allowedRuntimeSurfaces, true)) {
        $errors[] = "Task {$id} tiene runtime_surface invalido: {$runtimeSurface}";
    }
    if ($runtimeTransport !== '' && !in_array($runtimeTransport, $allowedRuntimeTransports, true)) {
        $errors[] = "Task {$id} tiene runtime_transport invalido: {$runtimeTransport}";
    }
    if ($runtimeLastTransport !== '' && !in_array($runtimeLastTransport, $allowedRuntimeTransports, true)) {
        $errors[] = "Task {$id} tiene runtime_last_transport invalido: {$runtimeLastTransport}";
    }

    if ($shouldValidateDual) {
        if ($domainLane === 'frontend_content' && $codexInstance !== 'codex_frontend') {
            $errors[] = "Task {$id} con domain_lane=frontend_content requiere codex_instance=codex_frontend";
        }
        if ($domainLane === 'backend_ops' && $codexInstance !== 'codex_backend_ops') {
            $errors[] = "Task {$id} con domain_lane=backend_ops requiere codex_instance=codex_backend_ops";
        }
        if ($domainLane === 'transversal_runtime' && $codexInstance !== 'codex_transversal') {
            $errors[] = "Task {$id} con domain_lane=transversal_runtime requiere codex_instance=codex_transversal";
        }
        if (($criticalZone || $runtimeImpact === 'high') && !$isRuntimeTask && $codexInstance !== 'codex_backend_ops') {
            $errors[] = "Task critica {$id} requiere codex_instance=codex_backend_ops";
        }
        if ($isRuntimeTask) {
            if ($providerMode !== 'openclaw_chatgpt') {
                $errors[] = "Task {$id} runtime requiere provider_mode=openclaw_chatgpt";
            }
            if ($domainLane !== 'transversal_runtime') {
                $errors[] = "Task {$id} runtime requiere domain_lane=transversal_runtime";
            }
            if ($codexInstance !== 'codex_transversal') {
                $errors[] = "Task {$id} runtime requiere codex_instance=codex_transversal";
            }
            if ($runtimeSurface === '') {
                $errors[] = "Task {$id} runtime requiere runtime_surface";
            }
            if ($runtimeTransport === '') {
                $errors[] = "Task {$id} runtime requiere runtime_transport";
            }
        }
        if ($crossDomain && $laneLock !== 'handoff_allowed') {
            $errors[] = "Task {$id} con cross_domain=true requiere lane_lock=handoff_allowed";
        }
        if (!$crossDomain && $laneLock !== 'strict') {
            $errors[] = "Task {$id} con cross_domain=false requiere lane_lock=strict";
        }
        if ($crossDomain && (!is_array($task['depends_on'] ?? null) || count($task['depends_on']) === 0)) {
            $errors[] = "Task {$id} con cross_domain=true requiere depends_on no vacio";
        }
    }

    if (!is_array($task['files'] ?? null)) {
        $errors[] = "Task {$id} debe definir files como lista YAML inline.";
    } elseif ($shouldValidateDual && !$crossDomain) {
        $allowFrontendReleaseSupport = isFrontendPublicReleaseSupportTask($task);
        foreach ($task['files'] as $rawFile) {
            if ($allowFrontendReleaseSupport && isFrontendPublicReleaseSupportFile((string) $rawFile)) {
                continue;
            }
            $fileLane = classifyFileLaneForDualCodex((string) $rawFile);
            if (!$isRuntimeTask && $domainLane === 'backend_ops' && $fileLane === 'transversal_runtime') {
                continue;
            }
            if ($fileLane !== $domainLane) {
                $normalizedFile = normalizePathToken((string) $rawFile);
                $errors[] = "Task {$id} tiene file fuera de lane {$domainLane}: {$normalizedFile}=>{$fileLane}";
            }
        }
    }
    if (!is_array($task['depends_on'] ?? null)) {
        $errors[] = "Task {$id} debe definir depends_on como lista YAML inline.";
    }
    foreach ([
        'status_since_at',
        'lease_id',
        'lease_owner',
        'lease_created_at',
        'heartbeat_at',
        'lease_expires_at',
        'lease_reason',
        'lease_cleared_at',
        'lease_cleared_reason',
    ] as $leaseField) {
        if (array_key_exists($leaseField, $task) && !is_string($task[$leaseField])) {
            $errors[] = "Task {$id} tiene {$leaseField} invalido (debe ser string)";
        }
    }
    if ($status === 'done') {
        $evidenceRef = trim((string) ($task['evidence_ref'] ?? ''));
        if ($evidenceRef === '') {
            $errors[] = "Task {$id} en done requiere evidence_ref";
        }
    }
}

$taskMap = [];
foreach ($board['tasks'] as $task) {
    $taskMap[(string) ($task['id'] ?? '')] = $task;
}

$handoffs = [
    'version' => 1,
    'handoffs' => [],
];
if ($handoffsRaw !== '') {
    $handoffs = parseHandoffsYaml($handoffsRaw);
}

$signals = [
    'version' => 1,
    'updated_at' => '',
    'signals' => [],
];
if ($signalsRaw !== '') {
    $signals = parseSignalsYaml($signalsRaw);
}

if ((string) ($signals['version'] ?? '') !== '1') {
    $errors[] = 'AGENT_SIGNALS.yaml debe declarar version: 1';
}

$jobs = [
    'version' => 1,
    'updated_at' => '',
    'jobs' => [],
];
if ($jobsRaw !== '') {
    $jobs = parseJobsYaml($jobsRaw);
}

if ((string) ($jobs['version'] ?? '') !== '1') {
    $errors[] = 'AGENT_JOBS.yaml debe declarar version: 1';
}
if (!is_array($jobs['jobs'] ?? null) || count($jobs['jobs']) === 0) {
    $errors[] = 'AGENT_JOBS.yaml debe contener al menos un job';
} else {
    $jobKeys = [];
    foreach ($jobs['jobs'] as $job) {
        $jobKey = trim((string) ($job['key'] ?? ''));
        if ($jobKey === '') {
            $errors[] = 'AGENT_JOBS.yaml contiene job sin key';
            continue;
        }
        if (isset($jobKeys[$jobKey])) {
            $errors[] = "AGENT_JOBS.yaml contiene job duplicado: {$jobKey}";
        }
        $jobKeys[$jobKey] = true;
        if (!array_key_exists('job_id', $job) || trim((string) ($job['job_id'] ?? '')) === '') {
            $errors[] = "AGENT_JOBS {$jobKey} requiere job_id";
        }
        if (!array_key_exists('status_path', $job) || trim((string) ($job['status_path'] ?? '')) === '') {
            $errors[] = "AGENT_JOBS {$jobKey} requiere status_path";
        }
        if (!array_key_exists('health_url', $job) || trim((string) ($job['health_url'] ?? '')) === '') {
            $errors[] = "AGENT_JOBS {$jobKey} requiere health_url";
        }
    }
    $publicSyncJob = null;
    foreach ($jobs['jobs'] as $job) {
        if (trim((string) ($job['key'] ?? '')) === 'public_main_sync') {
            $publicSyncJob = $job;
            break;
        }
    }
    if (!is_array($publicSyncJob)) {
        $errors[] = 'AGENT_JOBS.yaml requiere public_main_sync';
    } else {
        $publicSyncJobId = trim((string) ($publicSyncJob['job_id'] ?? ''));
        if ($publicSyncJobId !== '8d31e299-7e57-4959-80b5-aaa2d73e9674') {
            $errors[] = 'AGENT_JOBS.yaml public_main_sync.job_id invalido';
        }
    }
}

if ((string) ($handoffs['version'] ?? '') !== '1') {
    $errors[] = 'AGENT_HANDOFFS.yaml debe declarar version: 1';
}

$governancePolicy = null;
if ($governancePolicyRaw !== '') {
    $decodedPolicy = json_decode($governancePolicyRaw, true);
    if (!is_array($decodedPolicy)) {
        $errors[] = 'governance-policy.json no contiene un objeto JSON valido';
    } else {
        $governancePolicy = $decodedPolicy;
    }
}

if (is_array($governancePolicy)) {
    if ((int) ($governancePolicy['version'] ?? 0) !== 1) {
        $errors[] = 'governance-policy.json debe declarar version=1';
    }

    $domainHealth = $governancePolicy['domain_health'] ?? null;
    if (!is_array($domainHealth)) {
        $errors[] = 'governance-policy.json requiere objeto domain_health';
    } else {
        $priorityDomains = $domainHealth['priority_domains'] ?? null;
        if (!is_array($priorityDomains) || count($priorityDomains) === 0) {
            $errors[] = 'governance-policy.json requiere domain_health.priority_domains como lista no vacia';
        } else {
            $seenDomains = [];
            foreach ($priorityDomains as $rawDomain) {
                $domain = trim((string) $rawDomain);
                if ($domain === '') {
                    $errors[] = 'governance-policy.json contiene dominio vacio en domain_health.priority_domains';
                    continue;
                }
                $key = strtolower($domain);
                if (isset($seenDomains[$key])) {
                    $errors[] = "governance-policy.json tiene dominio duplicado en priority_domains: {$domain}";
                }
                $seenDomains[$key] = true;
            }
        }

        $domainWeights = $domainHealth['domain_weights'] ?? null;
        if (!is_array($domainWeights)) {
            $errors[] = 'governance-policy.json requiere domain_health.domain_weights como objeto';
        } else {
            if (!array_key_exists('default', $domainWeights)) {
                $errors[] = 'governance-policy.json requiere domain_health.domain_weights.default';
            }
            foreach ($domainWeights as $weightKey => $rawWeight) {
                if (!is_numeric($rawWeight) || (float) $rawWeight <= 0) {
                    $errors[] = "governance-policy.json tiene peso invalido en domain_weights.{$weightKey}";
                }
            }
        }

        $signalScores = $domainHealth['signal_scores'] ?? null;
        if (!is_array($signalScores)) {
            $errors[] = 'governance-policy.json requiere domain_health.signal_scores como objeto';
        } else {
            foreach (['GREEN', 'YELLOW', 'RED'] as $signalKey) {
                if (!array_key_exists($signalKey, $signalScores)) {
                    $errors[] = "governance-policy.json requiere signal_scores.{$signalKey}";
                } elseif (!is_numeric($signalScores[$signalKey])) {
                    $errors[] = "governance-policy.json tiene signal_scores.{$signalKey} no numerico";
                }
            }

            if (
                array_key_exists('GREEN', $signalScores) &&
                array_key_exists('YELLOW', $signalScores) &&
                array_key_exists('RED', $signalScores) &&
                is_numeric($signalScores['GREEN']) &&
                is_numeric($signalScores['YELLOW']) &&
                is_numeric($signalScores['RED'])
            ) {
                $greenScore = (float) $signalScores['GREEN'];
                $yellowScore = (float) $signalScores['YELLOW'];
                $redScore = (float) $signalScores['RED'];
                if (!($greenScore >= $yellowScore && $yellowScore >= $redScore)) {
                    $errors[] = 'governance-policy.json requiere GREEN >= YELLOW >= RED en domain_health.signal_scores';
                }
            }
        }
    }

    $summary = $governancePolicy['summary'] ?? null;
    $thresholds = is_array($summary) ? ($summary['thresholds'] ?? null) : null;
    if (!is_array($thresholds)) {
        $errors[] = 'governance-policy.json requiere summary.thresholds';
    } else {
        $yellowThreshold = $thresholds['domain_score_priority_yellow_below'] ?? null;
        if (!is_numeric($yellowThreshold) || (float) $yellowThreshold < 0) {
            $errors[] = 'governance-policy.json tiene threshold invalido: summary.thresholds.domain_score_priority_yellow_below';
        }
    }

    $agentsPolicy = $governancePolicy['agents'] ?? null;
    if (!is_array($agentsPolicy)) {
        $errors[] = 'governance-policy.json requiere agents como objeto';
    } else {
        foreach (['active_executors', 'retired_executors'] as $listKey) {
            if (!isset($agentsPolicy[$listKey]) || !is_array($agentsPolicy[$listKey])) {
                $errors[] = "governance-policy.json requiere agents.{$listKey} como lista";
            }
        }
        if (
            array_key_exists('allow_legacy_terminal_executors', $agentsPolicy) &&
            !is_bool($agentsPolicy['allow_legacy_terminal_executors'])
        ) {
            $errors[] = 'governance-policy.json requiere agents.allow_legacy_terminal_executors boolean';
        }
    }

    $publishingPolicy = $governancePolicy['publishing'] ?? null;
    if (!is_array($publishingPolicy)) {
        $errors[] = 'governance-policy.json requiere publishing como objeto';
    } else {
        if (array_key_exists('enabled', $publishingPolicy) && !is_bool($publishingPolicy['enabled'])) {
            $errors[] = 'governance-policy.json requiere publishing.enabled boolean';
        }
        foreach (['checkpoint_cooldown_seconds', 'max_live_wait_seconds'] as $numericKey) {
            if (
                array_key_exists($numericKey, $publishingPolicy) &&
                (!is_numeric($publishingPolicy[$numericKey]) || (int) $publishingPolicy[$numericKey] <= 0)
            ) {
                $errors[] = "governance-policy.json requiere publishing.{$numericKey} > 0";
            }
        }
    }

    $runtimePolicy = $governancePolicy['runtime'] ?? null;
    if (!is_array($runtimePolicy)) {
        $errors[] = 'governance-policy.json requiere runtime como objeto';
    } else {
        $providers = $runtimePolicy['providers'] ?? null;
        if (!is_array($providers) || count($providers) === 0) {
            $errors[] = 'governance-policy.json requiere runtime.providers como objeto no vacio';
        } else {
            foreach ($providers as $providerName => $providerCfg) {
                if (!is_array($providerCfg)) {
                    $errors[] = "governance-policy.json requiere runtime.providers.{$providerName} como objeto";
                    continue;
                }
                foreach (['default_transport', 'preferred_transport'] as $transportKey) {
                    if (!isset($providerCfg[$transportKey]) || trim((string) $providerCfg[$transportKey]) === '') {
                        $errors[] = "governance-policy.json requiere runtime.providers.{$providerName}.{$transportKey}";
                    }
                }
                foreach (['surfaces', 'transports'] as $objectKey) {
                    if (!isset($providerCfg[$objectKey]) || !is_array($providerCfg[$objectKey])) {
                        $errors[] = "governance-policy.json requiere runtime.providers.{$providerName}.{$objectKey} como objeto";
                    }
                }
            }
        }

        $runtimeQuotas = $runtimePolicy['quotas'] ?? null;
        if (!is_array($runtimeQuotas)) {
            $errors[] = 'governance-policy.json requiere runtime.quotas como objeto';
        } else {
            $byCodexInstance = $runtimeQuotas['by_codex_instance'] ?? null;
            if (!is_array($byCodexInstance) || count($byCodexInstance) === 0) {
                $errors[] = 'governance-policy.json requiere runtime.quotas.by_codex_instance como objeto no vacio';
            } else {
                foreach ($byCodexInstance as $instance => $rawLimit) {
                    if (!is_numeric($rawLimit) || (int) $rawLimit <= 0) {
                        $errors[] = "governance-policy.json tiene quota invalida en runtime.quotas.by_codex_instance.{$instance}";
                    }
                }
            }
        }
    }

    $enforcement = $governancePolicy['enforcement'] ?? null;
    if ($enforcement !== null) {
        if (!is_array($enforcement)) {
            $errors[] = 'governance-policy.json requiere enforcement como objeto';
        } else {
            $branchProfiles = $enforcement['branch_profiles'] ?? null;
            if (!is_array($branchProfiles)) {
                $errors[] = 'governance-policy.json requiere enforcement.branch_profiles como objeto';
            } else {
                foreach ($branchProfiles as $branchName => $branchCfg) {
                    if (!is_array($branchCfg)) {
                        $errors[] = "governance-policy.json requiere enforcement.branch_profiles.{$branchName} como objeto";
                        continue;
                    }
                    $failOnRed = trim((string) ($branchCfg['fail_on_red'] ?? ''));
                    if (!in_array($failOnRed, ['warn', 'error', 'ignore'], true)) {
                        $errors[] = "governance-policy.json tiene fail_on_red invalido en enforcement.branch_profiles.{$branchName}";
                    }
                }
            }

            $warningPolicies = $enforcement['warning_policies'] ?? null;
            if (!is_array($warningPolicies)) {
                $errors[] = 'governance-policy.json requiere enforcement.warning_policies como objeto';
            } else {
                foreach ($warningPolicies as $warningKey => $warningCfg) {
                    if (!is_array($warningCfg)) {
                        $errors[] = "governance-policy.json requiere enforcement.warning_policies.{$warningKey} como objeto";
                        continue;
                    }
                    if (!array_key_exists('enabled', $warningCfg) || !is_bool($warningCfg['enabled'])) {
                        $errors[] = "governance-policy.json requiere enforcement.warning_policies.{$warningKey}.enabled boolean";
                    }
                    $severity = trim((string) ($warningCfg['severity'] ?? ''));
                    if (!in_array($severity, ['warning', 'error'], true)) {
                        $errors[] = "governance-policy.json tiene severity invalido en enforcement.warning_policies.{$warningKey}";
                    }
                    if (array_key_exists('hours_threshold', $warningCfg)) {
                        $hoursThreshold = $warningCfg['hours_threshold'];
                        if (!is_numeric($hoursThreshold) || (float) $hoursThreshold <= 0) {
                            $errors[] = "governance-policy.json tiene hours_threshold invalido en enforcement.warning_policies.{$warningKey}";
                        }
                    }
                }
            }

            $boardLeases = $enforcement['board_leases'] ?? null;
            if ($boardLeases !== null) {
                if (!is_array($boardLeases)) {
                    $errors[] = 'governance-policy.json requiere enforcement.board_leases como objeto';
                } else {
                    foreach (['enabled', 'auto_clear_on_terminal'] as $boolKey) {
                        if (array_key_exists($boolKey, $boardLeases) && !is_bool($boardLeases[$boolKey])) {
                            $errors[] = "governance-policy.json requiere enforcement.board_leases.{$boolKey} boolean";
                        }
                    }
                    foreach (['ttl_hours_default', 'ttl_hours_max', 'heartbeat_stale_minutes'] as $numKey) {
                        if (array_key_exists($numKey, $boardLeases)) {
                            $v = $boardLeases[$numKey];
                            if (!is_numeric($v) || (float) $v <= 0) {
                                $errors[] = "governance-policy.json tiene enforcement.board_leases.{$numKey} invalido";
                            }
                        }
                    }
                    foreach (['required_statuses', 'tracked_statuses'] as $arrKey) {
                        if (array_key_exists($arrKey, $boardLeases) && !is_array($boardLeases[$arrKey])) {
                            $errors[] = "governance-policy.json requiere enforcement.board_leases.{$arrKey} como lista";
                        }
                    }
                }
            }

            $boardDoctor = $enforcement['board_doctor'] ?? null;
            if ($boardDoctor !== null) {
                if (!is_array($boardDoctor)) {
                    $errors[] = 'governance-policy.json requiere enforcement.board_doctor como objeto';
                } else {
                    foreach (['enabled', 'strict_default'] as $boolKey) {
                        if (array_key_exists($boolKey, $boardDoctor) && !is_bool($boardDoctor[$boolKey])) {
                            $errors[] = "governance-policy.json requiere enforcement.board_doctor.{$boolKey} boolean";
                        }
                    }
                    $doctorThresholds = $boardDoctor['thresholds'] ?? null;
                    if ($doctorThresholds !== null) {
                        if (!is_array($doctorThresholds)) {
                            $errors[] = 'governance-policy.json requiere enforcement.board_doctor.thresholds como objeto';
                        } else {
                            foreach ($doctorThresholds as $thresholdKey => $thresholdValue) {
                                if (!is_numeric($thresholdValue) || (float) $thresholdValue < 0) {
                                    $errors[] = "governance-policy.json tiene enforcement.board_doctor.thresholds.{$thresholdKey} invalido";
                                }
                            }
                        }
                    }
                }
            }

            $wipLimits = $enforcement['wip_limits'] ?? null;
            if ($wipLimits !== null) {
                if (!is_array($wipLimits)) {
                    $errors[] = 'governance-policy.json requiere enforcement.wip_limits como objeto';
                } else {
                    if (array_key_exists('enabled', $wipLimits) && !is_bool($wipLimits['enabled'])) {
                        $errors[] = 'governance-policy.json requiere enforcement.wip_limits.enabled boolean';
                    }
                    if (array_key_exists('mode', $wipLimits) && !in_array((string) $wipLimits['mode'], ['warn', 'error', 'ignore'], true)) {
                        $errors[] = 'governance-policy.json tiene enforcement.wip_limits.mode invalido';
                    }
                    if (array_key_exists('count_statuses', $wipLimits) && !is_array($wipLimits['count_statuses'])) {
                        $errors[] = 'governance-policy.json requiere enforcement.wip_limits.count_statuses como lista';
                    }
                    foreach (['by_executor', 'by_scope'] as $mapKey) {
                        if (array_key_exists($mapKey, $wipLimits)) {
                            if (!is_array($wipLimits[$mapKey])) {
                                $errors[] = "governance-policy.json requiere enforcement.wip_limits.{$mapKey} como objeto";
                            } else {
                                foreach ($wipLimits[$mapKey] as $limitKey => $limitValue) {
                                    if (!is_numeric($limitValue) || (float) $limitValue <= 0) {
                                        $errors[] = "governance-policy.json tiene enforcement.wip_limits.{$mapKey}.{$limitKey} invalido";
                                    }
                                }
                            }
                        }
                    }
                }
            }

            $codexParallelism = $enforcement['codex_parallelism'] ?? null;
            if ($codexParallelism !== null) {
                if (!is_array($codexParallelism)) {
                    $errors[] = 'governance-policy.json requiere enforcement.codex_parallelism como objeto';
                } else {
                    if (array_key_exists('slot_statuses', $codexParallelism)) {
                        if (!is_array($codexParallelism['slot_statuses'])) {
                            $errors[] = 'governance-policy.json requiere enforcement.codex_parallelism.slot_statuses como lista';
                        } elseif (count($codexParallelism['slot_statuses']) === 0) {
                            $errors[] = 'governance-policy.json requiere enforcement.codex_parallelism.slot_statuses no vacia';
                        }
                    }
                    if (array_key_exists('by_codex_instance', $codexParallelism)) {
                        if (!is_array($codexParallelism['by_codex_instance'])) {
                            $errors[] = 'governance-policy.json requiere enforcement.codex_parallelism.by_codex_instance como objeto';
                        } else {
                            foreach ($codexParallelism['by_codex_instance'] as $instance => $limitValue) {
                                if (!is_numeric($limitValue) || (float) $limitValue <= 0) {
                                    $errors[] = "governance-policy.json tiene enforcement.codex_parallelism.by_codex_instance.{$instance} invalido";
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    foreach (validateTaskStrategyAlignment($board, $task, $criticalScopes) as $strategyTaskError) {
        $errors[] = $strategyTaskError;
    }
}

$handoffIds = [];
foreach (($handoffs['handoffs'] ?? []) as $handoff) {
    $handoffId = trim((string) ($handoff['id'] ?? ''));
    if ($handoffId === '') {
        $errors[] = 'AGENT_HANDOFFS.yaml contiene handoff sin id';
        continue;
    }
    if (isset($handoffIds[$handoffId])) {
        $errors[] = "AGENT_HANDOFFS.yaml tiene handoff duplicado: {$handoffId}";
    }
    $handoffIds[$handoffId] = true;

    if (preg_match('/^HO-\d+$/', $handoffId) !== 1) {
        $errors[] = "Handoff {$handoffId} tiene id invalido (esperado HO-###)";
    }

    $handoffStatus = strtolower(trim((string) ($handoff['status'] ?? '')));
    if (!in_array($handoffStatus, ['active', 'closed', 'expired'], true)) {
        $errors[] = "Handoff {$handoffId} tiene status invalido: {$handoffStatus}";
    }

    $fromTaskId = trim((string) ($handoff['from_task'] ?? ''));
    $toTaskId = trim((string) ($handoff['to_task'] ?? ''));
    $fromTask = $taskMap[$fromTaskId] ?? null;
    $toTask = $taskMap[$toTaskId] ?? null;

    if ($fromTaskId === '' || $fromTask === null) {
        $errors[] = "Handoff {$handoffId} referencia from_task inexistente: {$fromTaskId}";
    }
    if ($toTaskId === '' || $toTask === null) {
        $errors[] = "Handoff {$handoffId} referencia to_task inexistente: {$toTaskId}";
    }
    if ($fromTaskId !== '' && $fromTaskId === $toTaskId) {
        $errors[] = "Handoff {$handoffId} no puede usar el mismo task en from_task y to_task";
    }

    $handoffFiles = $handoff['files'] ?? null;
    if (!is_array($handoffFiles) || count($handoffFiles) === 0) {
        $errors[] = "Handoff {$handoffId} debe definir files como lista no vacia";
        $handoffFiles = [];
    }
    foreach ($handoffFiles as $rawFile) {
        $file = trim((string) $rawFile);
        if ($file === '') {
            $errors[] = "Handoff {$handoffId} contiene file vacio";
            continue;
        }
        if (str_contains($file, '*')) {
            $errors[] = "Handoff {$handoffId} no permite wildcards en files ({$file})";
        }
        if (in_array($file, ['.', './', '/'], true)) {
            $errors[] = "Handoff {$handoffId} define file demasiado amplio ({$file})";
        }
    }

    $createdAt = trim((string) ($handoff['created_at'] ?? ''));
    $expiresAt = trim((string) ($handoff['expires_at'] ?? ''));
    $createdTs = strtotime($createdAt);
    $expiresTs = strtotime($expiresAt);
    if ($createdAt === '' || $createdTs === false) {
        $errors[] = "Handoff {$handoffId} tiene created_at invalido";
    }
    if ($expiresAt === '' || $expiresTs === false) {
        $errors[] = "Handoff {$handoffId} tiene expires_at invalido";
    }
    if ($createdTs !== false && $expiresTs !== false) {
        if ($expiresTs <= $createdTs) {
            $errors[] = "Handoff {$handoffId} requiere expires_at > created_at";
        }
        if (($expiresTs - $createdTs) > (48 * 3600)) {
            $errors[] = "Handoff {$handoffId} excede TTL maximo de 48h";
        }
    }

    if ($handoffStatus === 'active') {
        if ($expiresTs !== false && $expiresTs <= time()) {
            $errors[] = "Handoff {$handoffId} esta activo pero expirado";
        }
        if (is_array($fromTask) && !isActiveStatus((string) ($fromTask['status'] ?? ''))) {
            $errors[] = "Handoff {$handoffId} requiere from_task activo ({$fromTaskId})";
        }
        if (is_array($toTask) && !isActiveStatus((string) ($toTask['status'] ?? ''))) {
            $errors[] = "Handoff {$handoffId} requiere to_task activo ({$toTaskId})";
        }
    }
    if ($handoffStatus === 'expired' && $expiresTs !== false && $expiresTs > time()) {
        $errors[] = "Handoff {$handoffId} con status expired requiere expires_at en pasado";
    }

    // Nota H6: la validacion de solape real (subset de files del handoff contra el
    // overlap concreto entre tareas) queda canonica en Node (`handoffs lint`).
    // Este contrato PHP se mantiene en checks estructurales/conservadores.
}

foreach ($board['tasks'] as $task) {
    $taskId = trim((string) ($task['id'] ?? ''));
    $taskStatus = strtolower(trim((string) ($task['status'] ?? '')));
    $crossDomain = parseBooleanLike($task['cross_domain'] ?? false, false);
    if ($taskId === '' || !$crossDomain || !isActiveStatus($taskStatus)) {
        continue;
    }
    $hasLinkedActiveHandoff = false;
    foreach (($handoffs['handoffs'] ?? []) as $handoff) {
        $handoffStatus = strtolower(trim((string) ($handoff['status'] ?? '')));
        if ($handoffStatus !== 'active') {
            continue;
        }
        $expiresTs = strtotime((string) ($handoff['expires_at'] ?? ''));
        if ($expiresTs !== false && $expiresTs <= time()) {
            continue;
        }
        $fromTask = trim((string) ($handoff['from_task'] ?? ''));
        $toTask = trim((string) ($handoff['to_task'] ?? ''));
        if ($fromTask === $taskId || $toTask === $taskId) {
            $hasLinkedActiveHandoff = true;
            break;
        }
    }
    if (!$hasLinkedActiveHandoff) {
        $errors[] = "Task {$taskId} cross_domain activa requiere handoff activo vinculado";
    }
}

$codexBlocks = $codexPlanRaw !== '' ? parseCodexActiveBlocks($codexPlanRaw) : [];
$codexStrategyBlocks = $codexPlanRaw !== '' ? parseCodexStrategyActiveBlocks($codexPlanRaw) : [];
$codexStrategyNextBlocks = $codexPlanRaw !== '' ? parseCodexStrategyNextBlocks($codexPlanRaw) : [];
$codexTasks = [];
$codexInProgress = [];
$codexActive = [];
$codexSlotTasks = [];
$codexInProgressByInstance = [];
$codexActiveByInstance = [];
$codexSlotByInstance = [];
$allowedCodexInstances = ['codex_backend_ops', 'codex_frontend', 'codex_transversal'];
$codexParallelismPolicy = is_array($governancePolicy['enforcement']['codex_parallelism'] ?? null)
    ? $governancePolicy['enforcement']['codex_parallelism']
    : [];
$codexSlotStatuses = is_array($codexParallelismPolicy['slot_statuses'] ?? null)
    ? array_values(array_filter(array_map(
        static fn ($value): string => strtolower(trim((string) $value)),
        $codexParallelismPolicy['slot_statuses']
    )))
    : ['in_progress', 'review', 'blocked'];
if (count($codexSlotStatuses) === 0) {
    $codexSlotStatuses = ['in_progress', 'review', 'blocked'];
}
$codexLaneCapacities = [];
foreach ($allowedCodexInstances as $codexInstanceKey) {
    $rawLaneCapacity = $codexParallelismPolicy['by_codex_instance'][$codexInstanceKey] ?? 2;
    $laneCapacity = is_numeric($rawLaneCapacity) ? (int) $rawLaneCapacity : 2;
    $codexLaneCapacities[$codexInstanceKey] = $laneCapacity > 0 ? $laneCapacity : 2;
}
$codexTotalLaneCapacity = array_sum($codexLaneCapacities);
foreach ($board['tasks'] as $task) {
    $id = (string) ($task['id'] ?? '');
    if (!str_starts_with($id, 'CDX-')) {
        continue;
    }
    $codexTasks[] = $task;
    if (preg_match('/^CDX-\d+$/', $id) !== 1) {
        $errors[] = "Task Codex con id invalido: {$id} (esperado CDX-###)";
    }
    $status = (string) ($task['status'] ?? '');
    $codexInstance = trim((string) ($task['codex_instance'] ?? ''));
    if ($codexInstance !== '' && !in_array($codexInstance, $allowedCodexInstances, true)) {
        $errors[] = "Task {$id} tiene codex_instance invalido: {$codexInstance}";
    }
    if ($status === 'in_progress') {
        $codexInProgress[] = $id;
        if ($codexInstance !== '') {
            $codexInProgressByInstance[$codexInstance][] = $id;
        }
    }
    if (isActiveStatus($status)) {
        $codexActive[] = $id;
        if ($codexInstance === '') {
            $errors[] = "Task {$id} activa requiere codex_instance";
        } else {
            $codexActiveByInstance[$codexInstance][] = $id;
        }
    }
    if (in_array($status, $codexSlotStatuses, true)) {
        $codexSlotTasks[] = $id;
        if ($codexInstance === '') {
            $errors[] = "Task {$id} consumiendo slot requiere codex_instance";
        } else {
            $codexSlotByInstance[$codexInstance][] = $id;
        }
    }
}

foreach ($codexSlotByInstance as $codexInstance => $taskIds) {
    $laneCapacity = (int) ($codexLaneCapacities[$codexInstance] ?? 2);
    if (count($taskIds) > $laneCapacity) {
        $errors[] = "Mas de {$laneCapacity} slot(s) ocupados para {$codexInstance}: " . implode(', ', $taskIds);
    }
}

if (count($codexBlocks) > $codexTotalLaneCapacity) {
    $errors[] = "PLAN_MAESTRO_CODEX_2026.md contiene mas de {$codexTotalLaneCapacity} bloques CODEX_ACTIVE";
}
if (count($codexStrategyBlocks) > 1) {
    $errors[] = 'PLAN_MAESTRO_CODEX_2026.md contiene mas de un bloque CODEX_STRATEGY_ACTIVE';
}
if (count($codexStrategyNextBlocks) > 1) {
    $errors[] = 'PLAN_MAESTRO_CODEX_2026.md contiene mas de un bloque CODEX_STRATEGY_NEXT';
}

$codexBlocksByTaskId = [];
$codexBlockCountByInstance = [];
foreach ($codexBlocks as $block) {
    $blockInstance = trim((string) ($block['codex_instance'] ?? ''));
    $blockTaskId = trim((string) ($block['task_id'] ?? ''));
    if ($blockInstance === '') {
        $errors[] = 'CODEX_ACTIVE.codex_instance vacio en PLAN_MAESTRO_CODEX_2026.md';
        continue;
    }
    if (!in_array($blockInstance, $allowedCodexInstances, true)) {
        $errors[] = "CODEX_ACTIVE.codex_instance invalido: {$blockInstance}";
        continue;
    }
    if ($blockTaskId === '') {
        $errors[] = "CODEX_ACTIVE.task_id vacio para {$blockInstance} en PLAN_MAESTRO_CODEX_2026.md";
    } elseif (isset($codexBlocksByTaskId[$blockTaskId])) {
        $errors[] = "PLAN_MAESTRO_CODEX_2026.md contiene mas de un bloque CODEX_ACTIVE para {$blockTaskId}";
    }
    $codexBlocksByTaskId[$blockTaskId] = $block;
    $codexBlockCountByInstance[$blockInstance] = (int) ($codexBlockCountByInstance[$blockInstance] ?? 0) + 1;
}

foreach ($codexBlockCountByInstance as $blockInstance => $count) {
    $laneCapacity = (int) ($codexLaneCapacities[$blockInstance] ?? 2);
    if ($count > $laneCapacity) {
        $errors[] = "PLAN_MAESTRO_CODEX_2026.md contiene mas de {$laneCapacity} bloques CODEX_ACTIVE para {$blockInstance}";
    }
}

if (count($codexBlocksByTaskId) === 0) {
    if (!empty($codexSlotTasks)) {
        $errors[] = 'Hay tareas CDX consumiendo slot sin bloque CODEX_ACTIVE: ' . implode(', ', $codexSlotTasks);
    }
}

foreach ($codexSlotTasks as $taskId) {
    if (!isset($codexBlocksByTaskId[$taskId])) {
        $errors[] = "Hay tarea CDX consumiendo slot sin bloque CODEX_ACTIVE para {$taskId}";
    }
}

foreach ($codexBlocks as $block) {
    $blockInstance = trim((string) ($block['codex_instance'] ?? ''));
    $blockTaskId = trim((string) ($block['task_id'] ?? ''));
    $blockStatus = trim((string) ($block['status'] ?? ''));
    $boardTask = $taskMap[$blockTaskId] ?? null;
    $blockSubfrontId = trim((string) ($block['subfront_id'] ?? ''));

    if ($blockTaskId !== '' && preg_match('/^CDX-\d+$/', $blockTaskId) !== 1) {
        $errors[] = "CODEX_ACTIVE.task_id invalido para {$blockInstance}: {$blockTaskId}";
    }

    if ($boardTask === null) {
        $errors[] = "CODEX_ACTIVE.task_id no existe en AGENT_BOARD.yaml: {$blockTaskId}";
    } else {
        if ((string) ($boardTask['executor'] ?? '') !== 'codex') {
            $errors[] = "Task {$blockTaskId} del espejo Codex debe tener executor=codex";
        }
        if ($blockStatus !== (string) ($boardTask['status'] ?? '')) {
            $errors[] = "Task {$blockTaskId} tiene status desalineado entre CODEX_ACTIVE y AGENT_BOARD";
        }
        if (trim((string) ($boardTask['codex_instance'] ?? '')) !== $blockInstance) {
            $errors[] = "Task {$blockTaskId} tiene codex_instance desalineado entre CODEX_ACTIVE y AGENT_BOARD";
        }
        if (
            $blockSubfrontId !== '' &&
            $blockSubfrontId !== trim((string) ($boardTask['subfront_id'] ?? ''))
        ) {
            $errors[] = "Task {$blockTaskId} tiene subfront_id desalineado entre CODEX_ACTIVE y AGENT_BOARD";
        }
        if (!in_array(strtolower($blockStatus), $codexSlotStatuses, true)) {
            $errors[] = "Task {$blockTaskId} tiene bloque CODEX_ACTIVE en status sin slot";
        }
        if (!in_array(strtolower(trim((string) ($boardTask['status'] ?? ''))), $codexSlotStatuses, true)) {
            $errors[] = "Task {$blockTaskId} no debe conservar CODEX_ACTIVE en status sin slot";
        }

        // Nota H6: la comparacion detallada de files entre CODEX_ACTIVE y AGENT_BOARD
        // queda canonica en Node (`codex-check`). PHP conserva existencia/estatus/executor.
    }
}

$configuredStrategy = getConfiguredStrategy($board);
$configuredNextStrategy = getConfiguredNextStrategy($board);
$planStrategyBlock = count($codexStrategyBlocks) > 0 ? $codexStrategyBlocks[0] : null;
$planNextStrategyBlock = count($codexStrategyNextBlocks) > 0 ? $codexStrategyNextBlocks[0] : null;
$compareStrategyMirror = static function (?array $boardStrategy, ?array $planBlock, string $boardLabel, string $planLabel) use (&$errors): void {
    if (is_array($boardStrategy)) {
        if (!is_array($planBlock)) {
            $errors[] = "AGENT_BOARD.yaml tiene {$boardLabel} configurada pero falta {$planLabel} en PLAN_MAESTRO_CODEX_2026.md";
            return;
        }

        $boardSubfrontIds = [];
        foreach (($boardStrategy['subfronts'] ?? []) as $subfront) {
            $subfrontId = trim((string) ($subfront['subfront_id'] ?? ''));
            if ($subfrontId !== '') {
                $boardSubfrontIds[] = $subfrontId;
            }
        }
        sort($boardSubfrontIds);
        $planSubfrontIds = is_array($planBlock['subfront_ids'] ?? null) ? $planBlock['subfront_ids'] : [];
        $planSubfrontIds = array_values(array_filter(array_map(
            static fn ($value): string => trim((string) $value),
            $planSubfrontIds
        )));
        sort($planSubfrontIds);

        if (trim((string) ($planBlock['id'] ?? '')) !== (string) ($boardStrategy['id'] ?? '')) {
            $errors[] = "{$planLabel}.id desalineado entre PLAN_MAESTRO_CODEX_2026.md y AGENT_BOARD.yaml";
        }
        if (trim((string) ($planBlock['title'] ?? '')) !== (string) ($boardStrategy['title'] ?? '')) {
            $errors[] = "{$planLabel}.title desalineado entre PLAN_MAESTRO_CODEX_2026.md y AGENT_BOARD.yaml";
        }
        if (trim((string) ($planBlock['status'] ?? '')) !== (string) ($boardStrategy['status'] ?? '')) {
            $errors[] = "{$planLabel}.status desalineado entre PLAN_MAESTRO_CODEX_2026.md y AGENT_BOARD.yaml";
        }
        if (trim((string) ($planBlock['owner'] ?? '')) !== (string) ($boardStrategy['owner'] ?? '')) {
            $errors[] = "{$planLabel}.owner desalineado entre PLAN_MAESTRO_CODEX_2026.md y AGENT_BOARD.yaml";
        }
        if ($planSubfrontIds !== $boardSubfrontIds) {
            $errors[] = "{$planLabel}.subfront_ids desalineado entre PLAN_MAESTRO_CODEX_2026.md y AGENT_BOARD.yaml";
        }
        return;
    }

    if (is_array($planBlock)) {
        $errors[] = "PLAN_MAESTRO_CODEX_2026.md tiene {$planLabel} pero AGENT_BOARD.yaml no tiene {$boardLabel} configurada";
    }
};

$compareStrategyMirror($configuredStrategy, $planStrategyBlock, 'strategy.active', 'CODEX_STRATEGY_ACTIVE');
$compareStrategyMirror($configuredNextStrategy, $planNextStrategyBlock, 'strategy.next', 'CODEX_STRATEGY_NEXT');

$requiredQueueMeta = ['task_id', 'risk', 'scope', 'files', 'acceptance_ref', 'dispatched_by', 'status'];
$julesTasks = parseTaskBlocks($julesRaw);
$kimiTasks = parseTaskBlocks($kimiRaw);

$activeQueueIds = [];
foreach (['JULES' => $julesTasks, 'KIMI' => $kimiTasks] as $queueName => $tasks) {
    foreach ($tasks as $taskMeta) {
        foreach ($requiredQueueMeta as $key) {
            if (!array_key_exists($key, $taskMeta)) {
                $errors[] = "{$queueName}_TASKS.md: bloque TASK sin metadato obligatorio {$key}";
            }
        }

        $taskId = trim((string) ($taskMeta['task_id'] ?? ''));
        if ($taskId === '') {
            continue;
        }
        $status = strtolower(trim((string) ($taskMeta['status'] ?? '')));
        if ($status !== 'done') {
            $activeQueueIds[$taskId][] = $queueName;
        }
    }
}

foreach ($activeQueueIds as $taskId => $queues) {
    $uniqueQueues = array_values(array_unique($queues));
    if (count($uniqueQueues) > 1) {
        $errors[] = "task_id {$taskId} aparece activo en colas duplicadas: " . implode(', ', $uniqueQueues);
    }
}

$criticalSignals = array_values(
    array_filter(
        $signals['signals'] ?? [],
        static function (array $signal): bool {
            $status = strtolower(trim((string) ($signal['status'] ?? '')));
            $isActive = in_array($status, ['open', 'active', 'failing'], true);
            return $isActive && (bool) ($signal['critical'] ?? false);
        }
    )
);

$readyOrInProgressCount = 0;
foreach ($board['tasks'] as $task) {
    $status = strtolower(trim((string) ($task['status'] ?? '')));
    if (in_array($status, ['ready', 'in_progress'], true)) {
        $readyOrInProgressCount++;
    }
}

if (count($criticalSignals) > 0 && $readyOrInProgressCount === 0) {
    $errors[] = 'AGENT_BOARD invalido: hay señales críticas activas en AGENT_SIGNALS.yaml pero no existen tareas ready|in_progress';
}

if (!empty($errors)) {
    fwrite(STDERR, "ERROR: validacion de gobernanza fallida (" . count($errors) . ")\n");
    foreach ($errors as $error) {
        fwrite(STDERR, "- {$error}\n");
    }
    exit(1);
}

fwrite(STDOUT, "OK: gobernanza de agentes valida.\n");
exit(0);
