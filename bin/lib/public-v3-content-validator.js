'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');
const LOCALES = ['es', 'en'];
const SECTION_FILES = [
    'navigation',
    'home',
    'hub',
    'service',
    'telemedicine',
    'legal',
];
const DEFAULT_SCHEMA_VERSION = 'v1';
const SCHEMA_CONFIG_PATH = path.join(
    'content',
    'public-v3',
    'schema-version.json'
);
const SCHEMA_FILES = {
    navigation: 'navigation.schema.json',
    home: 'home.schema.json',
    hub: 'hub.schema.json',
    service: 'service.schema.json',
    telemedicine: 'telemedicine.schema.json',
    legal: 'legal.schema.json',
    legalPage: 'legal-page.schema.json',
};

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJsonFile(filePath, errors, options = {}) {
    const required = options.required !== false;
    if (!fs.existsSync(filePath)) {
        if (required) {
            errors.push(`Missing file: ${filePath}`);
        }
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        errors.push(`Invalid JSON at ${filePath}: ${error.message}`);
        return null;
    }
}

function readSchemaConfig(repoRoot, errors) {
    const configPath = path.join(repoRoot, SCHEMA_CONFIG_PATH);
    const config = readJsonFile(configPath, errors, { required: false });
    if (!config) {
        return {
            active: DEFAULT_SCHEMA_VERSION,
            fallback: DEFAULT_SCHEMA_VERSION,
            allowFallback: true,
        };
    }

    const active =
        typeof config.active === 'string' && config.active.trim()
            ? config.active.trim()
            : DEFAULT_SCHEMA_VERSION;
    const fallback =
        typeof config.fallback === 'string' && config.fallback.trim()
            ? config.fallback.trim()
            : DEFAULT_SCHEMA_VERSION;
    const allowFallback =
        typeof config.allowFallback === 'boolean' ? config.allowFallback : true;

    return {
        active,
        fallback,
        allowFallback,
    };
}

function resolveSchemaSelection(repoRoot, options, errors) {
    const config = readSchemaConfig(repoRoot, errors);
    const requestedVersion =
        options.schemaVersion ||
        process.env.PUBLIC_V3_SCHEMA_VERSION ||
        config.active ||
        DEFAULT_SCHEMA_VERSION;
    const fallbackVersion =
        options.fallbackVersion ||
        process.env.PUBLIC_V3_SCHEMA_FALLBACK ||
        config.fallback ||
        DEFAULT_SCHEMA_VERSION;
    const allowFallback =
        typeof options.allowFallback === 'boolean'
            ? options.allowFallback
            : config.allowFallback;

    return {
        requestedVersion,
        fallbackVersion,
        allowFallback,
        config,
    };
}

function loadSchemaSet(
    repoRoot,
    requestedVersion,
    fallbackVersion,
    allowFallback,
    errors
) {
    const schemaDir = path.join(
        repoRoot,
        'content',
        'public-v3',
        'schemas',
        requestedVersion
    );
    const fallbackSchemaDir = path.join(
        repoRoot,
        'content',
        'public-v3',
        'schemas',
        fallbackVersion
    );
    const schemas = {};
    const fallbackHits = [];

    for (const [key, fileName] of Object.entries(SCHEMA_FILES)) {
        const schemaPath = path.join(schemaDir, fileName);
        const schema = readJsonFile(schemaPath, errors, { required: false });
        if (schema) {
            schemas[key] = schema;
            continue;
        }

        const canFallback =
            allowFallback &&
            typeof fallbackVersion === 'string' &&
            fallbackVersion &&
            fallbackVersion !== requestedVersion;
        if (canFallback) {
            const fallbackSchemaPath = path.join(fallbackSchemaDir, fileName);
            const fallbackSchema = readJsonFile(fallbackSchemaPath, errors, {
                required: false,
            });
            if (fallbackSchema) {
                schemas[key] = fallbackSchema;
                fallbackHits.push({
                    schema: key,
                    fromVersion: fallbackVersion,
                });
                continue;
            }
            errors.push(
                `Missing schema file for "${key}" in versions "${requestedVersion}" and fallback "${fallbackVersion}".`
            );
            continue;
        }

        errors.push(
            `Missing schema file for "${key}" in version "${requestedVersion}".`
        );
    }

    const fallbackUsed = fallbackHits.length > 0;
    const schemaVersion =
        fallbackUsed && fallbackHits.length === Object.keys(SCHEMA_FILES).length
            ? fallbackVersion
            : requestedVersion;

    return {
        schemas,
        schemaVersion,
        requestedVersion,
        fallbackVersion,
        fallbackUsed,
        fallbackHits,
    };
}

function validateBySchema(value, schema, label, errors) {
    if (!schema || !isObject(schema)) {
        errors.push(`${label} has no valid schema definition.`);
        return;
    }

    if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
        if (value !== schema.const) {
            errors.push(`${label} must equal ${JSON.stringify(schema.const)}.`);
        }
    }

    if (Array.isArray(schema.enum)) {
        if (!schema.enum.includes(value)) {
            errors.push(
                `${label} must be one of: ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}.`
            );
        }
    }

    const expectedType = schema.type;
    if (expectedType === 'string') {
        if (typeof value !== 'string') {
            errors.push(`${label} must be a string.`);
            return;
        }
        if (
            typeof schema.minLength === 'number' &&
            value.length < schema.minLength
        ) {
            errors.push(
                `${label} must have at least ${schema.minLength} characters.`
            );
        }
        return;
    }

    if (expectedType === 'number') {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            errors.push(`${label} must be a number.`);
        }
        return;
    }

    if (expectedType === 'integer') {
        if (!Number.isInteger(value)) {
            errors.push(`${label} must be an integer.`);
        }
        return;
    }

    if (expectedType === 'boolean') {
        if (typeof value !== 'boolean') {
            errors.push(`${label} must be a boolean.`);
        }
        return;
    }

    if (expectedType === 'array') {
        if (!Array.isArray(value)) {
            errors.push(`${label} must be an array.`);
            return;
        }
        if (
            typeof schema.minItems === 'number' &&
            value.length < schema.minItems
        ) {
            errors.push(
                `${label} must contain at least ${schema.minItems} item(s).`
            );
        }
        if (
            typeof schema.maxItems === 'number' &&
            value.length > schema.maxItems
        ) {
            errors.push(
                `${label} must contain at most ${schema.maxItems} item(s).`
            );
        }
        if (schema.items) {
            for (let index = 0; index < value.length; index += 1) {
                validateBySchema(
                    value[index],
                    schema.items,
                    `${label}[${index}]`,
                    errors
                );
            }
        }
        return;
    }

    if (expectedType === 'object') {
        if (!isObject(value)) {
            errors.push(`${label} must be an object.`);
            return;
        }

        if (typeof schema.minProperties === 'number') {
            const propertyCount = Object.keys(value).length;
            if (propertyCount < schema.minProperties) {
                errors.push(
                    `${label} must contain at least ${schema.minProperties} properties.`
                );
            }
        }

        const required = Array.isArray(schema.required) ? schema.required : [];
        for (const key of required) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) {
                errors.push(`${label} is missing "${key}".`);
            }
        }

        const properties = isObject(schema.properties) ? schema.properties : {};
        for (const [key, propertySchema] of Object.entries(properties)) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                validateBySchema(
                    value[key],
                    propertySchema,
                    `${label}.${key}`,
                    errors
                );
            }
        }

        if (schema.additionalProperties === false) {
            for (const key of Object.keys(value)) {
                if (!Object.prototype.hasOwnProperty.call(properties, key)) {
                    errors.push(`${label}.${key} is not allowed by schema.`);
                }
            }
        }
        return;
    }
}

function loadLocaleContent(repoRoot, locale, errors) {
    const baseDir = path.join(repoRoot, 'content', 'public-v3', locale);
    const content = {};

    for (const section of SECTION_FILES) {
        content[section] = readJsonFile(
            path.join(baseDir, `${section}.json`),
            errors
        );
    }

    const pagesDir = path.join(baseDir, 'legal');
    if (!fs.existsSync(pagesDir)) {
        errors.push(`Missing directory: ${pagesDir}`);
        content.legalPages = {};
    } else {
        const pageFiles = fs
            .readdirSync(pagesDir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
            .map((entry) => entry.name)
            .sort();

        if (pageFiles.length === 0) {
            errors.push(
                `Directory ${pagesDir} must contain at least one *.json file.`
            );
        }

        const pages = {};
        for (const fileName of pageFiles) {
            const slug = fileName.replace(/\.json$/u, '');
            pages[slug] = readJsonFile(path.join(pagesDir, fileName), errors);
        }
        content.legalPages = pages;
    }

    if (isObject(content.legal)) {
        content.legal.pages = content.legalPages;
    }

    return content;
}

function validateLegalCrossChecks(locale, legalContent, errors) {
    const scope = `content/public-v3/${locale}.legal`;
    const pages = isObject(legalContent.pages) ? legalContent.pages : {};
    const pageOrder = Array.isArray(legalContent.pageOrder)
        ? legalContent.pageOrder
        : [];
    const seen = new Set();

    for (const slug of pageOrder) {
        if (typeof slug !== 'string' || !slug.trim()) {
            errors.push(`${scope}.pageOrder contains an invalid slug entry.`);
            continue;
        }
        if (seen.has(slug)) {
            errors.push(
                `${scope}.pageOrder contains duplicated slug "${slug}".`
            );
            continue;
        }
        seen.add(slug);
        if (!pages[slug]) {
            errors.push(
                `${scope}.pageOrder references missing page "${slug}".`
            );
        }
    }

    for (const slug of Object.keys(pages)) {
        if (!seen.has(slug)) {
            errors.push(`${scope}.pages.${slug} is not declared in pageOrder.`);
        }
    }
}

function validateLocaleContent(locale, content, schemas, errors) {
    const scope = `content/public-v3/${locale}`;

    for (const section of SECTION_FILES) {
        validateBySchema(
            content[section],
            schemas[section],
            `${scope}.${section}`,
            errors
        );
    }

    const legalPages = isObject(content.legalPages) ? content.legalPages : {};
    for (const [slug, payload] of Object.entries(legalPages)) {
        validateBySchema(
            payload,
            schemas.legalPage,
            `${scope}.legal.pages.${slug}`,
            errors
        );
    }

    if (isObject(content.legal)) {
        validateLegalCrossChecks(locale, content.legal, errors);
    }
}

function validatePublicV3Content(options = {}) {
    const repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
    const errors = [];
    const selection = resolveSchemaSelection(repoRoot, options, errors);
    const loaded = loadSchemaSet(
        repoRoot,
        selection.requestedVersion,
        selection.fallbackVersion,
        selection.allowFallback,
        errors
    );

    for (const locale of LOCALES) {
        const localeContent = loadLocaleContent(repoRoot, locale, errors);
        validateLocaleContent(locale, localeContent, loaded.schemas, errors);
    }

    return {
        ok: errors.length === 0,
        errors,
        schemaVersion: loaded.schemaVersion,
        requestedSchemaVersion: loaded.requestedVersion,
        fallbackSchemaVersion: loaded.fallbackVersion,
        fallbackUsed: loaded.fallbackUsed,
        fallbackHits: loaded.fallbackHits,
    };
}

module.exports = {
    DEFAULT_REPO_ROOT,
    DEFAULT_SCHEMA_VERSION,
    SCHEMA_CONFIG_PATH,
    validateBySchema,
    readSchemaConfig,
    validatePublicV3Content,
};
