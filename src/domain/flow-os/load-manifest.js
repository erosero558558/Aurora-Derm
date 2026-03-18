'use strict';

const fs = require('fs');
const path = require('path');

function manifestPath() {
    return path.resolve(__dirname, '../../../data/flow-os/manifest.v1.json');
}

function loadFlowOsManifest() {
    const raw = fs.readFileSync(manifestPath(), 'utf8');
    const manifest = JSON.parse(raw);

    if (
        !Array.isArray(manifest.journeyStages) ||
        !manifest.journeyStages.length
    ) {
        throw new Error('Flow OS manifest sin journeyStages');
    }

    const ids = new Set();
    for (const stage of manifest.journeyStages) {
        const stageId = String(stage && stage.id ? stage.id : '').trim();
        if (!stageId) {
            throw new Error('Flow OS manifest tiene un stage sin id');
        }
        if (ids.has(stageId)) {
            throw new Error(`Flow OS manifest repite stage id: ${stageId}`);
        }
        ids.add(stageId);
    }

    return manifest;
}

module.exports = {
    loadFlowOsManifest,
    manifestPath,
};
