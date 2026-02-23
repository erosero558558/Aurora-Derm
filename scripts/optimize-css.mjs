import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import cssnano from 'cssnano';

const rootDir = process.cwd();
const files = fs.readdirSync(rootDir).filter(file => {
    return file.endsWith('.css') &&
           !file.endsWith('.min.css') &&
           !file.endsWith('.optimized.css');
});

console.log('Optimizing CSS files:', files);

const processor = postcss([cssnano]);

async function optimize() {
    for (const file of files) {
        const filePath = path.join(rootDir, file);
        const css = fs.readFileSync(filePath, 'utf8');

        try {
            const outputPath = filePath.replace('.css', '.min.css');
            const result = await processor.process(css, { from: filePath, to: outputPath });
            fs.writeFileSync(outputPath, result.css);
            console.log(`Minified ${file} -> ${path.basename(outputPath)}`);
        } catch (error) {
            console.error(`Error optimizing ${file}:`, error);
        }
    }
}

optimize();
