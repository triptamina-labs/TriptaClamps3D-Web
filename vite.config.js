import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    plugins: [
        {
            name: 'copy-presets-csv',
            writeBundle() {
                copyFileSync(
                    resolve(__dirname, 'src/presets.csv'),
                    resolve(__dirname, 'dist/presets.csv')
                );
            }
        }
    ]
});
