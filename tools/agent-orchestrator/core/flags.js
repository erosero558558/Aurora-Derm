function parseFlags(args) {
    const positionals = [];
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        const arg = String(args[i]);
        if (!arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next === undefined || String(next).startsWith('--')) {
            flags[key] = true;
            continue;
        }
        flags[key] = String(next);
        i += 1;
    }
    return { positionals, flags };
}

function parseCsvList(value) {
    if (!value) return [];
    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function isTruthyFlagValue(value) {
    if (value === true) return true;
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    if (!raw) return false;
    if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
    return true;
}

function isFlagEnabled(flags, ...keys) {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(flags || {}, key)) continue;
        return isTruthyFlagValue(flags[key]);
    }
    return false;
}

module.exports = {
    parseFlags,
    parseCsvList,
    isTruthyFlagValue,
    isFlagEnabled,
};
