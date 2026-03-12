#!/usr/bin/env node
'use strict';

const { runCli } = require('./lib/operator-auth-bridge');

runCli()
    .then((code) => {
        if (Number.isInteger(code)) {
            process.exit(code);
        }
    })
    .catch((error) => {
        process.stderr.write(
            `[operator-auth-bridge] ${error && error.message ? error.message : String(error)}\n`
        );
        process.exit(1);
    });
