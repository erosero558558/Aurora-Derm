#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const FREEZE_HELPER_PATH = resolve(
    REPO_ROOT,
    'src',
    'apps',
    'queue-shared',
    'flow-os-recovery-freeze.js'
);
const INSTALL_HUB_PATH = resolve(
    REPO_ROOT,
    'src',
    'apps',
    'admin-v3',
    'shared',
    'modules',
    'queue',
    'render',
    'section',
    'install-hub.js'
);
const PILOT_RENDER_PATH = resolve(
    REPO_ROOT,
    'src',
    'apps',
    'admin-v3',
    'shared',
    'modules',
    'queue',
    'render',
    'section',
    'install-hub',
    'pilot',
    'render.js'
);
const OPERATOR_PATH = resolve(
    REPO_ROOT,
    'src',
    'apps',
    'queue-operator',
    'index.js'
);
const KIOSK_PATH = resolve(REPO_ROOT, 'src', 'apps', 'queue-kiosk', 'index.js');
const DISPLAY_PATH = resolve(
    REPO_ROOT,
    'src',
    'apps',
    'queue-display',
    'index.js'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('helper compartido define el freeze canonico de Flow OS recovery', () => {
    const raw = load(FREEZE_HELPER_PATH);
    const requiredSnippets = [
        'flow-os-recovery-2026-03-21',
        '2026-03-21',
        '2026-04-20',
        'queueRegionalProgramOfficeHost',
        'queueReleaseServiceExcellenceAdoptionCloudHost',
        'queueSurfaceCommercialConsoleHost',
        'queueSurfaceRenewalConsoleHost',
        'queueSurfaceExpansionConsoleHost',
        'queueOpsPilotExecutivePortfolioStudioHost',
        'queueOpsPilotStrategyDigitalTwinStudioHost',
        'queueMultiClinicControlTowerHost',
        "'renewal'",
        "'expansion'",
        'isFlowOsRecoveryAdminPanelFrozen',
        'isFlowOsRecoveryPilotHostFrozen',
        'shouldFreezeTurneroSurfaceSignal',
        'hideFlowOsRecoveryHost',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta contrato en flow-os-recovery-freeze.js: ${snippet}`
        );
    }
});

test('install hub y piloto aplican el freeze sobre paneles fuera de la slice activa', () => {
    for (const [filePath, requiredSnippets] of [
        [
            INSTALL_HUB_PATH,
            [
                'FLOW_OS_RECOVERY_FROZEN_ADMIN_PANEL_IDS',
                'applyFlowOsRecoveryFreezeToQueueHub',
                'isFlowOsRecoveryAdminPanelFrozen',
                'queueRegionalProgramOfficeHost',
                'queueReleaseServiceExcellenceAdoptionCloudHost',
                'queueSurfaceCommercialConsoleHost',
                'queueSurfaceRenewalConsoleHost',
                'queueSurfaceExpansionConsoleHost',
                'getFlowOsRecoveryFreezeNotice()',
            ],
        ],
        [
            PILOT_RENDER_PATH,
            [
                'isFlowOsRecoveryPilotHostFrozen',
                'hideFlowOsRecoveryHost',
                'queueOpsPilotExecutivePortfolioStudioHost',
                'queueOpsPilotStrategyDigitalTwinStudioHost',
                'queueMultiClinicControlTowerHost',
                'freezeExecutivePortfolioStudio',
                'freezeStrategyDigitalTwinStudio',
                'freezeMultiClinicControlTower',
            ],
        ],
    ]) {
        const raw = load(filePath);
        for (const snippet of requiredSnippets) {
            assert.equal(
                raw.includes(snippet),
                true,
                `falta wiring del freeze en ${filePath}: ${snippet}`
            );
        }
    }
});

test('operator, kiosk y display esconden renewal y expansion durante el recovery cycle', () => {
    for (const filePath of [OPERATOR_PATH, KIOSK_PATH, DISPLAY_PATH]) {
        const raw = load(filePath);
        for (const snippet of [
            'shouldFreezeTurneroSurfaceSignal',
            "shouldFreezeTurneroSurfaceSignal('renewal')",
            "shouldFreezeTurneroSurfaceSignal('expansion')",
            'getFlowOsRecoveryFreezeNotice',
            "dataset.flowOsRecoveryFrozen = 'true'",
        ]) {
            assert.equal(
                raw.includes(snippet),
                true,
                `falta freeze de renewal/expansion en ${filePath}: ${snippet}`
            );
        }
    }
});
