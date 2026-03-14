#!/usr/bin/env node
'use strict';

const { startCliServer } = require('./openclaw-auth-helper.js');

process.stderr.write(
    '[DEPRECATED] operator-auth-bridge ahora delega a openclaw-auth-helper. Usa `npm run openclaw:auth:start`.\n'
);

startCliServer().catch((error) => {
    process.stderr.write(
        `[operator-auth-bridge] ${error && error.message ? error.message : String(error)}\n`
    );
    process.exit(1);
});
