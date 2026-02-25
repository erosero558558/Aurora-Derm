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

module.exports = {
    readTextIfExists,
    readJsonFile,
    ensureDirForFile,
    writeJsonFile,
};
