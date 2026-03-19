'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadModule } = require('./turnero-release-test-fixtures.js');

async function loadHeaderModule() {
    return loadModule(
        'src/apps/admin-v3/ui/frame/templates/sections/queue/header.js'
    );
}

test('queue apps hub expone el reliability recovery nerve center en incidents basic', async () => {
    const module = await loadHeaderModule();
    const html = module.renderQueueAppsHub();

    assert.match(html, /id="queueReliabilityRecoveryNerveCenterHost"/);
    assert.match(html, /data-band="incidents"/);
    assert.match(html, /data-turnero-reliability-recovery/);
    assert.match(html, /data-queue-domain-match="incidents"/);
    assert.match(html, /data-queue-basic-match="incidents"/);
    assert.ok(
        html.indexOf('queueContingencyDeck') <
            html.indexOf('queueReliabilityRecoveryNerveCenterHost'),
        'el nuevo host debe quedar dentro del band incidents'
    );
    assert.ok(
        html.indexOf('queueReliabilityRecoveryNerveCenterHost') <
            html.indexOf('data-band="deployment"'),
        'el nuevo host debe aparecer antes del band deployment'
    );
});
