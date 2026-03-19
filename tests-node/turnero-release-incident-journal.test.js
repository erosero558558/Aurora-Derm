'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

async function loadJournalModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-incident-journal.js'
    );
}

function withLocalStorage(storage, callback) {
    const previous = global.localStorage;
    global.localStorage = storage;

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            if (previous === undefined) {
                delete global.localStorage;
            } else {
                global.localStorage = previous;
            }
        });
}

test('turnero incident journal deduplica entradas casi idénticas y limpia el backlog antiguo', async () => {
    const journal = await loadJournalModule();
    const storage = createLocalStorageStub();
    const clinicId = 'clinica-journal-demo';

    await withLocalStorage(storage, async () => {
        const duplicate = {
            id: 'duplicate-1',
            title: 'Perfil faltante',
            detail: 'Falta perfil clínico.',
            owner: 'ops',
            severity: 'blocker',
            source: 'release-ops-console',
            state: 'blocker',
            updatedAt: '2026-03-18T12:00:01.000Z',
        };

        journal.appendTurneroIncidentJournalEntry(clinicId, duplicate);
        journal.appendTurneroIncidentJournalEntry(clinicId, {
            ...duplicate,
            id: 'duplicate-2',
            note: 'Detalle alterno que no debería generar otra fila.',
        });

        const deduped = journal.readTurneroIncidentJournal(clinicId);
        assert.equal(deduped.length, 1);
        assert.equal(deduped[0].title, 'Perfil faltante');

        const batch = Array.from({ length: 31 }, (_, index) => {
            const severity =
                index === 0 ? 'blocker' : index === 1 ? 'warning' : 'info';
            return {
                id: `entry-${index + 1}`,
                title:
                    index === 0
                        ? 'Bloqueo local principal'
                        : index === 1
                          ? 'Advertencia local'
                          : `Entrada ${index + 1}`,
                detail: `Detalle ${index + 1}`,
                owner:
                    severity === 'blocker'
                        ? 'ops'
                        : severity === 'warning'
                          ? 'deploy'
                          : 'backend',
                severity,
                source: 'release-ops-console',
                state: severity,
                updatedAt: `2026-03-18T12:00:${String(31 - index).padStart(
                    2,
                    '0'
                )}.000Z`,
            };
        });

        journal.appendTurneroIncidentJournalEntries(clinicId, batch);

        const entries = journal.readTurneroIncidentJournal(clinicId);
        const stats = journal.buildTurneroIncidentJournalStats(clinicId);
        const markdown = journal.buildTurneroIncidentJournalMarkdown(
            clinicId,
            entries
        );

        assert.equal(entries.length, 30);
        assert.ok(!entries.some((entry) => entry.title === 'Entrada 31'));
        assert.equal(stats.clinicId, clinicId);
        assert.equal(stats.total, 30);
        assert.ok(stats.blocker > 0);
        assert.ok(stats.warning > 0);
        assert.ok(stats.info > 0);
        assert.ok(Array.isArray(stats.highlights));
        assert.match(markdown, /Total entries: 30/);
        assert.match(markdown, /## Highlights/);
        assert.match(markdown, /Bloqueo local principal/);
        assert.match(markdown, /## Recent entries/);

        assert.equal(journal.clearTurneroIncidentJournal(clinicId), true);
        assert.equal(journal.readTurneroIncidentJournal(clinicId).length, 0);
    });
});
