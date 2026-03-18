#!/usr/bin/env node
'use strict';

const {
    loadFlowOsManifest,
} = require('../src/domain/flow-os/load-manifest.js');
const {
    summarizeJourney,
} = require('../src/domain/flow-os/patient-journey.js');

const manifest = loadFlowOsManifest();
const stageId = process.argv[2] || 'intake_completed';
const summary = summarizeJourney(stageId);

if (process.argv.includes('--json')) {
    console.log(
        JSON.stringify(
            {
                product: manifest.product,
                version: manifest.version,
                stageSummary: summary,
            },
            null,
            2
        )
    );
    process.exit(0);
}

console.log(`Flow OS v${manifest.version}`);
console.log(`Producto: ${manifest.product}`);
console.log(`Stage: ${summary.stage} (${summary.label})`);
console.log(`Owner: ${summary.owner}`);
console.log(`Next: ${summary.next.join(', ') || 'none'}`);
console.log(
    `Actions: ${summary.actions.map((action) => action.id).join(', ') || 'none'}`
);
console.log(
    `Delegation: ${summary.delegation.map((item) => item.worker).join(', ') || 'none'}`
);
