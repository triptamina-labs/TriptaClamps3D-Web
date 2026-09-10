import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    root: '.',
    // Tratar .wasm como asset (import devuelve la URL del archivo)
    assetsInclude: ['**/*.wasm'],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    worker: {
        format: 'es',
    },
    plugins: [
        {
            name: 'copy-data-csv',
            writeBundle() {
                for (const f of ['presets.csv', 'npt.csv']) {
                    copyFileSync(resolve(__dirname, 'src', f), resolve(__dirname, 'dist', f));
                }
            }
        }
    ]
});
