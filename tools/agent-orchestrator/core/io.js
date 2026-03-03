const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { dirname } = require('path');

function readTextIfExists(path, fallback = null) {
    return existsSync(path) ? readFileSync(path, 'utf8') : fallback;
}

function readJsonFile(path, fallback = null) {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
}

function ensureDirForFile(path) {
    mkdirSync(dirname(path), { recursive: true });
}

function writeJsonFile(path, value) {
    ensureDirForFile(path);
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`, 'utf8');
}

function appendJsonlFile(path, entries, deps = {}) {
    const { ensureDir = ensureDirForFile, writeFile = writeFileSync } = deps;
    if (!path) throw new Error('appendJsonlFile requiere path');
    const list = Array.isArray(entries) ? entries : [entries];
    const serializable = list.filter(
        (item) => item && typeof item === 'object'
    );
    if (serializable.length === 0) return { appended: 0 };
    ensureDir(path);
    const payload = `${serializable.map((e) => JSON.stringify(e)).join('\n')}\n`;
    writeFile(path, payload, { encoding: 'utf8', flag: 'a' });
    return { appended: serializable.length };
}

function readJsonlFile(path, deps = {}) {
    const { exists = existsSync, readFile = readFileSync } = deps;
    if (!path) throw new Error('readJsonlFile requiere path');
    if (!exists(path)) return [];
    const raw = String(readFile(path, 'utf8') || '');
    const out = [];
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        out.push(JSON.parse(trimmed));
    }
    return out;
}

function readSignalsFile(deps = {}) {
    const {
        signalsPath,
        exists = existsSync,
        readFile = readFileSync,
        parseSignalsContent,
        currentDate = () => '',
    } = deps;
    if (!signalsPath) throw new Error('readSignalsFile requiere signalsPath');
    if (typeof parseSignalsContent !== 'function') {
        throw new Error('readSignalsFile requiere parseSignalsContent');
    }
    if (!exists(signalsPath)) {
        return { version: 1, updated_at: currentDate(), signals: [] };
    }
    return parseSignalsContent(readFile(signalsPath, 'utf8'));
}

function writeSignalsFile(data, deps = {}) {
    const { signalsPath, serializeSignals, writeFile = writeFileSync } = deps;
    if (!signalsPath) throw new Error('writeSignalsFile requiere signalsPath');
    if (typeof serializeSignals !== 'function') {
        throw new Error('writeSignalsFile requiere serializeSignals');
    }
    writeFile(signalsPath, serializeSignals(data), 'utf8');
    return data;
}

function readJobsFile(deps = {}) {
    const {
        jobsPath,
        exists = existsSync,
        readFile = readFileSync,
        parseJobsContent,
        currentDate = () => '',
    } = deps;
    if (!jobsPath) throw new Error('readJobsFile requiere jobsPath');
    if (typeof parseJobsContent !== 'function') {
        throw new Error('readJobsFile requiere parseJobsContent');
    }
    if (!exists(jobsPath)) {
        return { version: 1, updated_at: currentDate(), jobs: [] };
    }
    return parseJobsContent(readFile(jobsPath, 'utf8'));
}

function writeJobsFile(data, deps = {}) {
    const { jobsPath, serializeJobs, writeFile = writeFileSync } = deps;
    if (!jobsPath) throw new Error('writeJobsFile requiere jobsPath');
    if (typeof serializeJobs !== 'function') {
        throw new Error('writeJobsFile requiere serializeJobs');
    }
    writeFile(jobsPath, serializeJobs(data), 'utf8');
    return data;
}

function resolveTaskEvidencePath(taskId, flags = {}, deps = {}) {
    const { rootPath = '', evidenceDirPath, resolvePath } = deps;
    if (typeof resolvePath !== 'function') {
        throw new Error('resolveTaskEvidencePath requiere resolvePath');
    }
    if (flags && flags.evidence) {
        return resolvePath(rootPath, String(flags.evidence));
    }
    if (!evidenceDirPath) {
        throw new Error(
            'resolveTaskEvidencePath requiere evidenceDirPath cuando no hay --evidence'
        );
    }
    return resolvePath(evidenceDirPath, `${taskId}.md`);
}

function toRelativeRepoPath(path, deps = {}) {
    const { rootPath = '' } = deps;
    const normalizedRoot = String(rootPath).replace(/\\/g, '/');
    const normalizedPath = String(path || '').replace(/\\/g, '/');
    return normalizedPath.startsWith(`${normalizedRoot}/`)
        ? normalizedPath.slice(normalizedRoot.length + 1)
        : normalizedPath;
}

function writeBoardFile(board, deps = {}) {
    const {
        currentDate = () => '',
        boardPath,
        serializeBoard,
        writeFile = writeFileSync,
    } = deps;
    if (!boardPath) throw new Error('writeBoardFile requiere boardPath');
    if (typeof serializeBoard !== 'function') {
        throw new Error('writeBoardFile requiere serializeBoard');
    }
    const safeBoard = board || { version: 1, policy: {}, tasks: [] };
    safeBoard.policy = safeBoard.policy || {};
    safeBoard.policy.updated_at = currentDate();
    writeFile(boardPath, serializeBoard(safeBoard), 'utf8');
    return safeBoard;
}

function writeCodexActiveBlockFile(block, deps = {}) {
    const {
        codexPlanPath,
        exists = existsSync,
        readFile = readFileSync,
        writeFile = writeFileSync,
        upsertCodexActiveBlock,
        codexInstance = null,
    } = deps;
    if (!codexPlanPath) {
        throw new Error('writeCodexActiveBlockFile requiere codexPlanPath');
    }
    if (typeof upsertCodexActiveBlock !== 'function') {
        throw new Error(
            'writeCodexActiveBlockFile requiere upsertCodexActiveBlock'
        );
    }
    if (!exists(codexPlanPath)) {
        throw new Error(`No existe ${codexPlanPath}`);
    }
    const raw = readFile(codexPlanPath, 'utf8');
    const next = upsertCodexActiveBlock(raw, block, { codexInstance });
    writeFile(codexPlanPath, next, 'utf8');
    return next;
}

function syncDerivedQueuesFiles(options = {}, deps = {}) {
    const { silent = false } = options;
    const {
        parseBoard,
        parseTaskMetaMap,
        renderQueueFile,
        julesPath,
        kimiPath,
        writeFile = writeFileSync,
        log = (msg) => console.log(msg),
    } = deps;
    if (typeof parseBoard !== 'function') {
        throw new Error('syncDerivedQueuesFiles requiere parseBoard');
    }
    if (typeof parseTaskMetaMap !== 'function') {
        throw new Error('syncDerivedQueuesFiles requiere parseTaskMetaMap');
    }
    if (typeof renderQueueFile !== 'function') {
        throw new Error('syncDerivedQueuesFiles requiere renderQueueFile');
    }
    if (!julesPath || !kimiPath) {
        throw new Error('syncDerivedQueuesFiles requiere julesPath y kimiPath');
    }

    const board = parseBoard();
    const julesMeta = parseTaskMetaMap(julesPath);
    const kimiMeta = parseTaskMetaMap(kimiPath);

    const julesTasks = board.tasks.filter((task) => task.executor === 'jules');
    const kimiTasks = board.tasks.filter((task) => task.executor === 'kimi');

    const julesContent = renderQueueFile('jules', julesTasks, julesMeta);
    const kimiContent = renderQueueFile('kimi', kimiTasks, kimiMeta);

    writeFile(julesPath, julesContent, 'utf8');
    writeFile(kimiPath, kimiContent, 'utf8');

    if (!silent) {
        log(
            `Sync completado: tombstones retirados preservados (legacy_jules_tasks=${julesTasks.length}, legacy_kimi_tasks=${kimiTasks.length}).`
        );
    }

    return {
        jules_tasks: julesTasks.length,
        kimi_tasks: kimiTasks.length,
    };
}

module.exports = {
    readTextIfExists,
    readJsonFile,
    ensureDirForFile,
    writeJsonFile,
    readSignalsFile,
    writeSignalsFile,
    readJobsFile,
    writeJobsFile,
    appendJsonlFile,
    readJsonlFile,
    resolveTaskEvidencePath,
    toRelativeRepoPath,
    writeBoardFile,
    writeCodexActiveBlockFile,
    syncDerivedQueuesFiles,
};
