#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function loadModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

function createKeyboardEvent(overrides = {}) {
    return {
        key: '',
        code: '',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        location: 0,
        prevented: false,
        preventDefault() {
            this.prevented = true;
        },
        ...overrides,
    };
}

function createOptions() {
    const calls = [];

    return {
        calls,
        options: {
            navigateToSection(section) {
                calls.push(['navigateToSection', section]);
            },
            focusQuickCommand() {
                calls.push(['focusQuickCommand']);
            },
            focusAgentPrompt() {
                calls.push(['focusAgentPrompt']);
            },
            focusCurrentSearch() {
                calls.push(['focusCurrentSearch']);
            },
            runQuickAction(action) {
                calls.push(['runQuickAction', action]);
            },
            closeSidebar() {
                calls.push(['closeSidebar']);
            },
            toggleMenu() {
                calls.push(['toggleMenu']);
            },
            dismissQueueSensitiveDialog() {
                calls.push(['dismissQueueSensitiveDialog']);
                return false;
            },
            toggleQueueHelp() {
                calls.push(['toggleQueueHelp']);
            },
        },
    };
}

function withDocumentStub(callback, activeElement = null) {
    const previousDocument = global.document;
    const previousHTMLElement = global.HTMLElement;
    global.HTMLElement = class HTMLElementStub {};
    global.document = {
        activeElement,
    };
    try {
        return callback();
    } finally {
        if (previousDocument === undefined) {
            delete global.document;
        } else {
            global.document = previousDocument;
        }
        if (previousHTMLElement === undefined) {
            delete global.HTMLElement;
        } else {
            global.HTMLElement = previousHTMLElement;
        }
    }
}

test('Ctrl+K prioriza la barra de comandos global', async () => {
    const { handleGlobalKeyboardShortcut } = await loadModule(
        'src/apps/admin-v3/shared/core/keyboard/global.js'
    );
    const { options, calls } = createOptions();
    const event = createKeyboardEvent({
        key: 'k',
        code: 'KeyK',
        ctrlKey: true,
    });

    const handled = handleGlobalKeyboardShortcut(event, options);

    assert.equal(handled, true);
    assert.equal(event.prevented, true);
    assert.deepEqual(calls, [['focusQuickCommand']]);
});

test('Alt+Shift+I abre el copiloto cuando existe', async () => {
    const { handleGlobalKeyboardShortcut } = await loadModule(
        'src/apps/admin-v3/shared/core/keyboard/global.js'
    );
    const { options, calls } = createOptions();
    const event = createKeyboardEvent({
        key: 'i',
        code: 'KeyI',
        shiftKey: true,
        altKey: true,
    });

    const handled = withDocumentStub(() =>
        handleGlobalKeyboardShortcut(event, options)
    );

    assert.equal(handled, true);
    assert.equal(event.prevented, true);
    assert.deepEqual(calls, [['focusAgentPrompt']]);
});

test('Ctrl+Shift+K abre el copiloto cuando existe', async () => {
    const { handleGlobalKeyboardShortcut } = await loadModule(
        'src/apps/admin-v3/shared/core/keyboard/global.js'
    );
    const { options, calls } = createOptions();
    const event = createKeyboardEvent({
        key: 'k',
        code: 'KeyK',
        ctrlKey: true,
        shiftKey: true,
    });

    const handled = handleGlobalKeyboardShortcut(event, options);

    assert.equal(handled, true);
    assert.equal(event.prevented, true);
    assert.deepEqual(calls, [['focusAgentPrompt']]);
});

test('Meta+K usa la misma barra de comandos en macOS', async () => {
    const { handleGlobalKeyboardShortcut } = await loadModule(
        'src/apps/admin-v3/shared/core/keyboard/global.js'
    );
    const { options, calls } = createOptions();
    const event = createKeyboardEvent({
        key: 'k',
        code: 'KeyK',
        metaKey: true,
    });

    const handled = handleGlobalKeyboardShortcut(event, options);

    assert.equal(handled, true);
    assert.equal(event.prevented, true);
    assert.deepEqual(calls, [['focusQuickCommand']]);
});
