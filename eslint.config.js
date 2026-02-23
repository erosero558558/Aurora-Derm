const globals = require('globals');
const pluginPlaywright = require('eslint-plugin-playwright');
const js = require('@eslint/js');

module.exports = [
    {
        ignores: [
            '_deploy_bundle/**',
            'vendor/**',
            'node_modules/**',
            'playwright-report/**',
            'test-results/**',
            'verification/**',
            'dist/**'
        ]
    },
    js.configs.recommended,
    {
        ignores: ['admin.js', 'script.js', 'booking-ui.js', 'booking-engine.js', 'vendor/**']
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'no-undef': 'warn',
            'no-useless-assignment': 'warn',
            'preserve-caught-error': 'off',
            'no-empty': 'warn',
            'no-redeclare': 'warn',
        },
    },
    {
        files: ['js/**/*.js', 'src/**/*.js', '**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ['tests/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
                console: 'readonly',
            },
        },
        rules: {
            'no-console': 'off',
            'no-undef': 'off',
        },
    },
    {
        files: ['tests/**/*.spec.js'],
        ...pluginPlaywright.configs['flat/recommended'],
        rules: {
            ...pluginPlaywright.configs['flat/recommended'].rules,
            'playwright/expect-expect': 'off',
            'playwright/no-conditional-in-test': 'warn',
            'playwright/no-conditional-expect': 'warn',
            'playwright/no-wait-for-timeout': 'warn',
            'playwright/no-useless-not': 'warn',
        },
    },
];
