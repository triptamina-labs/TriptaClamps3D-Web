<p align="center">
  <img src="banner.png" alt="Tripta Fittings — visor paramétrico Tri-Clamp" width="100%" />
</p>

<br />

### Demo en línea

**[https://triclamps.triptalabs.com.co/](https://triclamps.triptalabs.com.co/)**

---

**Tripta Fittings** es un visor web para explorar geometrías **Tri-Clamp**: férulas, gaskets, spools y **end-caps**, con parámetros inspirados en **ASME BPE**. El modelo se genera por **revolución** de un perfil 2D y se visualiza en **Three.js**: puedes alternar entre bordes, malla, nube de puntos y sólido, ajustar el color de la vista técnica y **exportar** la pieza actual a **STL** (binario o ASCII), **OBJ**, **STEP** o **BREP**.

También incluye **exportación en lote**: permite seleccionar piezas y presets desde un checklist, elegir formato y descargar un **ZIP** con carpetas por tipo de pieza y archivos nombrados por pieza + preset.

En la raíz, `index.html` usa un **`importmap`** para cargar **Three.js** desde CDN (no hace falta compilar para probarlo así). El código de la app está en **`src/`**; también puedes usar **Vite** (ver abajo) para desarrollo con recarga y build de producción. El despliegue público usa el build de producción (`pnpm build`).

---

### Estructura del repositorio

| Ruta | Contenido |
|------|-----------|
| `index.html` | Entrada: fuentes, `importmap`, enlace a CSS y a `src/main.ts`. |
| `src/main.ts` | Orquestador principal que une interfaz, datos y escena 3D. |
| `src/parts/` | Generadores matemáticos de geometría (férula, gasket, spool, end-cap). |
| `src/scene/` | Configuración de Three.js (luces, cámara, controles, materiales). |
| `src/ui/`    | Gestión de eventos y manipulación del panel DOM. |
| `src/data/`  | Estado global tipado y carga de presets BPE. |
| `src/export/`| Lógica de descarga individual y en lote a formatos STL / OBJ / STEP / BREP. |
| `src/cad/`   | Puente y Web Worker para OpenCascade.js (STEP/BREP), perfil 2D tipado. |
| `src/core/`  | Módulos compartidos: validador de constraints, factory `vista→malla`, constantes. |
| `src/**/__tests__/` | Tests unitarios por módulo con Vitest (ver [Tests](#tests)). |
| `src/presets.csv` | Tabla de presets normativos. Es la fuente de verdad (se copia a `dist/` en producción). |
| `src/styles.css` | Estilos del panel y del layout. |
| `tsconfig.json` | TypeScript en modo estricto (`strict: true`). |
| `biome.json` | Linting y formateo automático con Biome. |
| `vitest.config.ts` | Configuración de tests unitarios con Vitest. |
| `vite.config.ts` | Configuración de Vite y copia de `presets.csv` al build. |
| `banner.png` | Imagen del encabezado de este README. |

---

### Qué incluye la app

- Presets por tamaño (y longitudes corta/larga tipo norma) para férula, empaque, spool y end-cap.
- Panel lateral responsivo: en pantallas pequeñas se colapsa para dejar sitio al lienzo 3D.
- Cámara orbital sobre el modelo y descarga de malla o CAD sólido según la geometría actual.
- Descarga en lote a ZIP: carpetas por tipo de pieza y archivos nombrados con pieza + preset.
- Modo **Custom** para editar parámetros con sliders cuando no usas un preset del CSV.

---

### Cómo abrirlo (sin instalar dependencias)

Necesitas un navegador con **WebGL** y **módulos ES**.

Abre **`index.html`** desde la raíz del clon (doble clic o arrastrando al navegador). Debe existir la carpeta **`src/`** junto a ese archivo.

Si abres el archivo con `file://`, en algunos navegadores **no se puede leer** `presets.csv` por política de seguridad; entonces se usan los valores de respaldo embebidos en `main.ts`. Para cargar siempre el CSV del proyecto, sirve la carpeta con HTTP:

`pnpm dlx serve .`

y abre la URL que indique la herramienta (por ejemplo `http://localhost:3000`).

---

### Desarrollo con pnpm

Si clonas el repo y quieres **Vite** (recarga al guardar, build optimizado):

```bash
pnpm install
pnpm dev
```

- **`pnpm dev`** — servidor de desarrollo con recarga en caliente.
- **`pnpm build`** — genera **`dist/`** (HTML, JS y CSS empaquetados; **`presets.csv`** se copia a la raíz de `dist/`).
- **`pnpm preview`** — sirve localmente la carpeta `dist/` para comprobar el resultado del build.
- **`pnpm lint`** — verifica el código con Biome.
- **`pnpm format`** — formatea el código con Biome.
- **`pnpm test`** — ejecuta los tests unitarios con Vitest.

---

### Tests

Cada módulo bajo `src/` tiene su carpeta `__tests__/` con tests unitarios (Vitest). La suite cubre lógica pura, integración con Three.js vía mocks, DOM con jsdom, y el puente CAD con mock de Worker.

```bash
pnpm test          # ejecuta toda la suite (164 tests en 15 archivos)
pnpm test --watch  # modo interactivo con recarga
pnpm lint          # verifica estilo antes de commitear
```

**Estructura de tests:**

| Capa | Módulos | Entorno | Mock |
|------|---------|---------|------|
| Lógica pura | `constants`, `store`, `presets`, `profileDescriptor`, `constraints` | node | ninguno |
| Three.js | `materials`, `ferrule`, `gasket`, `spool`, `endcap`, `exporter` | node | `vi.mock('three')` |
| DOM | `dom`, `bulkExport` | jsdom | DOM fixture |
| CAD bridge | `bridge` | node | `vi.stubGlobal('Worker')` |

Los tests de lógica pura verifican las funciones matemáticas que definen la geometría de cada pieza (cantidad de comandos, coordenadas, simetría). Los tests con mock de Three.js confirman que los generadores usan las constantes correctas (`PROFILE_POINTS_SPOOL` = 80 vs `PROFILE_POINTS_FERRULE` = 60) y los materiales correctos por tipo de pieza (`matGasketSolido` para gasket, `matSolido` para el resto).

---

### Stack

**TypeScript** (tipado estricto) · **Three.js** (OrbitControls, STL/OBJ, `LatheGeometry`) · **OpenCascade.js** (STEP/BREP en Web Worker) · **fflate** (ZIP en lote) · **Vite** (dev y build) · **Biome** (lint + format) · **Vitest** (tests) · **jsdom** (entorno DOM para tests) · **CSS** (Inter, Fira Code) · **CSV** para presets

---

### Licencia

[Código abierto bajo la licencia MIT](LICENSE).

---

**TriptaLabs**
