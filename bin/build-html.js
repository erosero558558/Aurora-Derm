#!/usr/bin/env node
/**
 * build-html.js — HTML partial assembler
 *
 * Reads a .template.html file, replaces all <!-- @include path --> directives
 * with the content of the referenced file, and writes the assembled output.
 *
 * Usage:
 *   node bin/build-html.js templates/index.template.html index.html
 *   node bin/build-html.js templates/telemedicina.template.html telemedicina.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

const [, , templatePath, outputPath] = process.argv;

if (!templatePath || !outputPath) {
    console.error('Usage: node bin/build-html.js <template> <output>');
    process.exit(1);
}

const root = path.resolve(path.dirname(__dirname));
const templateFile = path.resolve(root, templatePath);

if (!fs.existsSync(templateFile)) {
    console.error('Template not found:', templateFile);
    process.exit(1);
}

// Normalize line endings to LF (handles Windows CRLF template files)
let template = fs.readFileSync(templateFile, 'utf8').replace(/\r\n/g, '\n');
const includePattern = /<!-- @include ([^\s>]+) -->/g;
const missing = [];

const assembled = template.replace(includePattern, (_match, includePath) => {
    const fullPath = path.resolve(root, includePath);
    if (!fs.existsSync(fullPath)) {
        missing.push(includePath);
        return `<!-- MISSING: ${includePath} -->`;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    // Remove trailing newline so includes join cleanly
    return content.replace(/\n$/, '');
});

if (missing.length > 0) {
    console.error('Missing partials:', missing.join(', '));
    process.exit(1);
}

const outputFile = path.resolve(root, outputPath);
fs.writeFileSync(outputFile, assembled + '\n');

const lines = assembled.split('\n').length;
console.log(`Built ${outputPath}: ${lines} lines (from ${templatePath})`);
