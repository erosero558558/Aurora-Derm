const globals = require('globals');
const pluginPlaywright = require('eslint-plugin-playwright');
const js = require('@eslint/js');

const isCiLint = String(process.env.CI || '').toLowerCase() === 'true';
const srcNoConsoleRule = [
    isCiLint ? 'error' : 'warn',
    {
        allow: ['warn', 'error', 'info'],
    },
];

module.exports = [
    {
        ignores: [
            '.generated/**',
            '_deploy_bundle/**',
            'vendor/**',
            'node_modules/**',
            'playwright-report/**',
            'test-results/**',
            'verification/**',
        ],
    },
    js.configs.recommended,
    {
        // These runtime bundles stay versioned for git-sync deploy, but drift is
        // enforced by artifact contracts instead of authored-source lint.
        ignores: [
            '.generated/**',
            'admin.js',
            'script.js',
            'vendor/**',
            'js/chunks/**',
            'js/admin-chunks/**',
            'js/engines/**',
            'js/booking-calendar.js',
        ],
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
            'no-unused-vars': [
                'warn',
                {
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
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
        files: ['src/**/*.js', 'js/main.js'],
        rules: {
            'no-console': srcNoConsoleRule,
            'no-debugger': isCiLint ? 'error' : 'warn',
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
            // All test.skip() calls are conditional runtime guards (auth, feature-flag).
            'playwright/no-skipped-test': 'off',
        },
    },
];
