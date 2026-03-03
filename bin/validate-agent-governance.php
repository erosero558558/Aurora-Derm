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

/**
 * @return array{version:mixed, policy:array<string,mixed>, tasks:array<int,array<string,mixed>>}
 */
function parseBoardYaml(string $content): array
{
    $lines = explode("\n", $content);
    $board = [
        'version' => 1,
        'policy' => [],
        'tasks' => [],
    ];

    $inPolicy = false;
    $inTasks = false;
    $task = null;

    foreach ($lines as $lineRaw) {
        $line = str_replace("\t", '    ', $lineRaw);
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        if ($trimmed === 'policy:') {
            $inPolicy = true;
            $inTasks = false;
            continue;
        }

        if ($trimmed === 'tasks:') {
            $inPolicy = false;
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
$allowedCodexInstances = ['codex_backend_ops', 'codex_frontend'];
$allowedDomainLanes = ['backend_ops', 'frontend_content'];
$allowedLaneLocks = ['strict', 'handoff_allowed'];
$criticalScopes = ['payments', 'auth', 'calendar', 'deploy', 'env', 'security'];

$board = [
    'version' => 1,
    'policy' => [],
    'tasks' => [],
];
if ($boardRaw !== '') {
    $board = parseBoardYaml($boardRaw);
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

    if ($shouldValidateDual) {
        if ($domainLane === 'frontend_content' && $codexInstance !== 'codex_frontend') {
            $errors[] = "Task {$id} con domain_lane=frontend_content requiere codex_instance=codex_frontend";
        }
        if ($domainLane === 'backend_ops' && $codexInstance !== 'codex_backend_ops') {
            $errors[] = "Task {$id} con domain_lane=backend_ops requiere codex_instance=codex_backend_ops";
        }
        if (($criticalZone || $runtimeImpact === 'high') && $codexInstance !== 'codex_backend_ops') {
            $errors[] = "Task critica {$id} requiere codex_instance=codex_backend_ops";
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
        foreach ($task['files'] as $rawFile) {
            $fileLane = classifyFileLaneForDualCodex((string) $rawFile);
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
        }
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
$codexTasks = [];
$codexInProgress = [];
$codexActive = [];
$codexInProgressByInstance = [];
$codexActiveByInstance = [];
$allowedCodexInstances = ['codex_backend_ops', 'codex_frontend'];
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
}

if (count($codexInProgress) > 2) {
    $errors[] = 'Mas de dos tareas CDX in_progress: ' . implode(', ', $codexInProgress);
}
foreach ($codexInProgressByInstance as $codexInstance => $taskIds) {
    if (count($taskIds) > 1) {
        $errors[] = "Mas de una tarea CDX in_progress para {$codexInstance}: " . implode(', ', $taskIds);
    }
}
if (count($codexActive) > 2) {
    $errors[] = 'Mas de dos tareas CDX activas: ' . implode(', ', $codexActive);
}
foreach ($codexActiveByInstance as $codexInstance => $taskIds) {
    if (count($taskIds) > 1) {
        $errors[] = "Mas de una tarea CDX activa para {$codexInstance}: " . implode(', ', $taskIds);
    }
}

if (count($codexBlocks) > 2) {
    $errors[] = 'PLAN_MAESTRO_CODEX_2026.md contiene mas de dos bloques CODEX_ACTIVE';
}

$codexBlocksByInstance = [];
foreach ($codexBlocks as $block) {
    $blockInstance = trim((string) ($block['codex_instance'] ?? ''));
    if ($blockInstance === '') {
        $errors[] = 'CODEX_ACTIVE.codex_instance vacio en PLAN_MAESTRO_CODEX_2026.md';
        continue;
    }
    if (!in_array($blockInstance, $allowedCodexInstances, true)) {
        $errors[] = "CODEX_ACTIVE.codex_instance invalido: {$blockInstance}";
        continue;
    }
    if (isset($codexBlocksByInstance[$blockInstance])) {
        $errors[] = "PLAN_MAESTRO_CODEX_2026.md contiene mas de un bloque CODEX_ACTIVE para {$blockInstance}";
        continue;
    }
    $codexBlocksByInstance[$blockInstance] = $block;
}

if (count($codexBlocksByInstance) === 0) {
    if (!empty($codexActive)) {
        $errors[] = 'Hay tareas CDX activas sin bloque CODEX_ACTIVE: ' . implode(', ', $codexActive);
    }
}

foreach ($codexActiveByInstance as $codexInstance => $taskIds) {
    if (!isset($codexBlocksByInstance[$codexInstance])) {
        $errors[] = "Hay tarea CDX activa sin bloque CODEX_ACTIVE para {$codexInstance}: " . implode(', ', $taskIds);
    }
}

foreach ($codexBlocksByInstance as $blockInstance => $block) {
    $blockTaskId = trim((string) ($block['task_id'] ?? ''));
    $blockStatus = trim((string) ($block['status'] ?? ''));
    $boardTask = $taskMap[$blockTaskId] ?? null;

    if ($blockTaskId === '') {
        $errors[] = "CODEX_ACTIVE.task_id vacio para {$blockInstance} en PLAN_MAESTRO_CODEX_2026.md";
    } elseif (preg_match('/^CDX-\d+$/', $blockTaskId) !== 1) {
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

        // Nota H6: la comparacion detallada de files entre CODEX_ACTIVE y AGENT_BOARD
        // queda canonica en Node (`codex-check`). PHP conserva existencia/estatus/executor.
    }

    if (isActiveStatus($blockStatus) && empty($codexActiveByInstance[$blockInstance])) {
        $errors[] = "CODEX_ACTIVE indica status activo pero no hay tarea CDX activa para {$blockInstance} en AGENT_BOARD";
    }
}

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
