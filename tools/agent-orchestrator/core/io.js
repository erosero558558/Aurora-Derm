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
    const next = upsertCodexActiveBlock(raw, block);
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
            `Sync completado: ${julesTasks.length} tareas Jules, ${kimiTasks.length} tareas Kimi.`
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
    resolveTaskEvidencePath,
    toRelativeRepoPath,
    writeBoardFile,
    writeCodexActiveBlockFile,
    syncDerivedQueuesFiles,
};
