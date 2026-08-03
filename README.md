# Framework de Automatización E2E — Sistema Triple

Monorepo de automatización de pruebas **end-to-end** para el sistema **Triple** (`https://test.triple.com.do/`), construido con **Selenium WebDriver + JavaScript**, patrón **Page Object Model** con capas de **Componentes** y **Flows**, reportes profesionales con **Mochawesome**, historial de ejecuciones, sistema de evidencias extensible y logging centralizado.

La idea central: un **core reutilizable** (`@triple/core`) que contiene todo lo transversal (login, navegación, navbar, grid, reportes, infra), y **un proyecto por módulo** (Reclutamiento hoy; Nómina, Empleados, Vacantes… mañana) que solo escribe sus pruebas y sus páginas propias. Agregar un módulo **no requiere tocar el core**.

> Antes de contribuir o escribir pruebas, leé las **[reglas de contribución](GUIDELINES.md)**: aditividad, reuse-first, Open/Closed, Input Model para formularios, selectores robustos y el checklist de "terminado".

---

## Índice

- [Estructura del monorepo](#estructura-del-monorepo)
- [Requisitos e instalación](#requisitos-e-instalación)
- [Cómo correr las pruebas](#cómo-correr-las-pruebas)
- [Arquitectura de capas](#arquitectura-de-capas)
- [Configuración (`.env` + framework)](#configuración)
- [Reportes, evidencias y logging](#reportes-evidencias-y-logging)
- [Metadata de pantallas (autogestionada)](#metadata-de-pantallas-autogestionada)
- [Política de ejecución](#política-de-ejecución-aplica-a-todo-el-framework)
- [Nomenclatura de casos de prueba](#nomenclatura-de-casos-de-prueba)
- [Execution Context (datos de prueba)](#execution-context-datos-de-prueba)
- [Selection Strategies](#selection-strategies)
- [Recetas (mini-ejemplos)](#recetas-mini-ejemplos)
  - [Correr un solo test](#receta-correr-un-solo-test)
  - [Escribir un test nuevo](#receta-escribir-un-test-nuevo)
  - [Crear un Page Object de módulo](#receta-crear-un-page-object-de-módulo)
  - [Crear un flow nuevo](#receta-crear-un-flow-nuevo)
  - [Crear un componente reutilizable](#receta-crear-un-componente-reutilizable)
  - [Agregar un módulo nuevo (ej. Empleados)](#receta-agregar-un-módulo-nuevo)
  - [Adjuntar evidencias / screenshots manuales](#receta-adjuntar-evidencias)
  - [Registrar un nuevo tipo de evidencia](#receta-registrar-un-nuevo-tipo-de-evidencia)
- [Referencia rápida de `@triple/core`](#referencia-rápida-de-triplecore)
- [Pruebas unitarias del core](#pruebas-unitarias-del-core)
- [Convenciones](#convenciones)
- [Notas y troubleshooting](#notas-y-troubleshooting)

---

## Estructura del monorepo

```
testing/                           # raíz del monorepo (npm workspaces)
├── package.json                   # define los workspaces: ["core", "reclutamiento"]
├── .env                           # GLOBAL: BASE_URL, credenciales y config del framework (NO se versiona)
├── .gitignore
├── node_modules/                  # dependencias hoisteadas (compartidas por core y módulos)
│
├── core/                          # === @triple/core: todo lo reutilizable ===
│   ├── package.json               # expone bins: triple-run-tests, triple-report-*
│   ├── index.js                   # "barrel": punto de entrada -> require('@triple/core')
│   ├── .mocharc.json              # configuración de las pruebas UNITARIAS del framework
│   │
│   ├── config/
│   │   └── index.js               # config del framework (browser, timeouts, screenshotMode, keepReports…)
│   │
│   ├── utils/
│   │   ├── env.js                 # carga jerárquica de .env (módulo + global)
│   │   ├── driver.js              # createDriver / quitDriver / getCurrentDriver
│   │   ├── wait.js                # esperas explícitas (waitForElementVisible, waitForUrlContains)
│   │   ├── UiContext.js           # base compartida: helpers click/type/getText/waitVisible
│   │   ├── logger.js              # logger con timestamp (consola + archivo)
│   │   ├── evidence.js            # registro extensible de evidencias (image/video/pdf/log/json/…)
│   │   ├── screenshot.js          # guardado de PNG de bajo nivel
│   │   ├── executionContext.js    # metadata del REPORTE: ambiente, SO, navegador, usuario, timezone
│   │   ├── recovery.js            # recuperar el estado con los controles de la app (Descartar/Cancelar/…)
│   │   ├── problemLog.js          # registro estructurado de bloqueos (reproducible)
│   │   ├── retry.js               # ejecución con intentos ACOTADOS + recuperación entre intentos
│   │   ├── screenMetadata.js      # caché persistente de metadata + validez del sello del inspector
│   │   ├── screenInspector.js     # inspector genérico de pantallas (versionado y autogestionado)
│   │   ├── testFiles.js           # resuelve el archivo a subir (Execution Context o fixture por defecto)
│   │   ├── paths.js               # rutas de reports/ (historial por ejecución + retención + latest)
│   │   └── mochaRootHooks.js      # Root Hooks: logging/screenshot/cierre + política ante fallos
│   │
│   ├── context/
│   │   └── testContext.js         # EXECUTION CONTEXT: datos de prueba desacoplados del test
│   │
│   ├── strategies/                # Selection Strategies (cómo se opera cada tipo de control)
│   │   ├── SelectionStrategy.js   # contrato base
│   │   ├── builtinStrategies.js   # searchAndSelect, directSelect, tagSelect, text, switch, datePicker…
│   │   └── index.js               # registro Open/Closed (registrar / obtener)
│   │
│   ├── pages/                     # páginas APP-GLOBAL (compartidas por todos los módulos)
│   │   ├── base/BasePage.js       # base de todos los Page Objects (extiende UiContext)
│   │   ├── LoginPage.js
│   │   └── DashboardPage.js
│   │
│   ├── components/                # widgets reutilizables (se repiten en muchas pantallas)
│   │   ├── index.js               # REGISTRO de componentes (fuente de verdad del barrel)
│   │   ├── README.md              # catálogo: implementados + previstos + contrato
│   │   ├── BaseComponent.js       # base de los componentes (extiende UiContext)
│   │   ├── NavBar.js              # barra superior: logout, volver al dashboard, sync, notif, usuario…
│   │   ├── DataGrid.js            # grid DevExtreme: buscar, filtrar, crear, paginar, contar filas…
│   │   ├── Form.js                # formularios DevExtreme POR LABEL (+ setValor, elegirEnSelectbox)
│   │   ├── Notify.js              # toast `notify_record` (éxito / inválido / error del sistema)
│   │   ├── FormsHeader.js         # header `forms-header`: botones (dx + `div.xxxButton`) y switches
│   │   ├── Popup.js               # modal genérico dx-popup (esperar/accionar/cerrar)
│   │   └── FileUploader.js        # carga de archivos sin diálogo del SO (sendKeys al input oculto)
│   │
│   ├── flows/                     # flujos de negocio reutilizables (cruzan varias pantallas)
│   │   ├── authFlow.js            # login / logout
│   │   └── navigationFlow.js      # abrirModulo / volverAlDashboard
│   │
│   ├── scripts/                   # orquestación y reportes (se invocan como bins triple-*)
│   │   ├── run-tests.js           # corre Mocha, genera reporte, aplica retención
│   │   ├── generate-report.js     # mergea JSON y genera el HTML
│   │   ├── open-report.js         # abre reports/latest/html/index.html
│   │   └── clean-reports.js       # borra el historial de reportes del módulo
│   │
│   └── tests/                     # === PRUEBAS UNITARIAS del framework (sin Selenium) ===
│       ├── contrato-suite-unitaria.spec.js  # impide que la suite abra un navegador
│       ├── components/            # FormsHeader, Notify, Popup, FileUploader
│       ├── context/               # Execution Context
│       ├── strategies/            # Selection Strategies
│       ├── utils/                 # screenMetadata, evidence, logger, paths, testFiles
│       └── support/               # driver simulado (jsdom), proyecto temporal, entorno
│
└── reclutamiento/                  # === proyecto del módulo Reclutamiento (consume @triple/core) ===
    ├── package.json               # deps: @triple/core; scripts: test, report:*
    ├── README.md
    ├── pages/                     # Page Objects PROPIOS del módulo
    │   ├── RequisicionesPage.js       # listado (grid): buscar, abrir por estado, leer estado, volver…
    │   ├── RequisicionFormPage.js     # form de creación + mapa control→estrategia
    │   ├── RequisicionDetallePage.js  # detalle: switch "Publicada" y acciones del header
    │   └── DocumentosRequisicionPage.js # panel "Documentos" + popup "Importar Documentos"
    ├── flows/                     # flujos de negocio DEL MÓDULO (componen los flows del core)
    │   └── requisicionesFlow.js
    ├── data/                      # datos del módulo
    │   ├── requisiciones.data.js      # textos y config de casos
    │   ├── documentos.data.js         # clasificaciones y selectores de la carga de documentos
    │   └── execution-context.json     # EXECUTION CONTEXT (editable a mano)
    ├── metadata/screens/          # caché de metadata de pantallas (se versiona, se autogestiona)
    │   ├── requisiciones-listado.json
    │   └── requisiciones-detalle.json
    ├── support/                   # fixtures compartidos por los tests del módulo
    │   └── fixtures.js
    ├── tests/                     # specs de Mocha — UN CASO POR ARCHIVO
    │   ├── login.test.js
    │   ├── navegacion.test.js
    │   ├── reclutamiento-requisiciones.test.js
    │   ├── crear-req-campos-requeridos.test.js
    │   ├── crear-req-sustitucion-requeridos.test.js
    │   ├── crear-req-validacion-requeridos.test.js
    │   ├── crear-req-persona-sustituir.test.js
    │   ├── crear-req-pregunta-personalizada.test.js
    │   ├── crear-req-comentarios.test.js
    │   ├── publicar-requisicion.test.js
    │   ├── pausar-requisicion.test.js
    │   └── importar-archivos-requisicion.test.js
    └── reports/                   # reportes generados de ESTE módulo (no se versiona)
```

> **Regla de oro para decidir dónde va algo:** ¿sirve a más de un módulo? → `core/`. ¿Es específico de un módulo? → dentro del módulo (`reclutamiento/…`).

---

## Requisitos e instalación

- **Node.js** instalado.
- **Google Chrome** instalado (Selenium Manager resuelve el driver automáticamente).

Instalación (una sola vez, desde la **raíz** del monorepo):

```bash
npm install
```

Esto instala todas las dependencias de todos los workspaces y enlaza `@triple/core` dentro de `node_modules` para que los módulos lo importen por nombre.

---

## Cómo correr las pruebas

El repositorio tiene **dos suites independientes**, con propósitos distintos:

| | **Unitarias** (`core/tests/`) | **E2E** (`<módulo>/tests/`) |
|---|---|---|
| Qué prueban | El **framework**: componentes, utilidades, registros | El **sistema Triple**: flujos de negocio reales |
| Con qué corren | Mocha + Chai + jsdom, todo **en memoria** | Mocha + Selenium + Chrome contra `BASE_URL` |
| Necesitan `.env` / credenciales | **No** | Sí |
| Cuánto tardan | Segundos | Minutos |
| Qué generan | Nada (no tocan el repo) | Reporte HTML, screenshots, evidencias, logs |
| Archivos | `*.spec.js` | `*.test.js` |

Se ejecutan por separado o juntas, **desde la raíz**:

```bash
npm run test:unit     # solo el framework — no abre ningún navegador
npm run test:e2e      # solo los casos de negocio (Selenium + Chrome)
npm run test:all      # unitarias primero; si pasan, las E2E
```

`test:all` corre las unitarias **primero** a propósito: son las rápidas, y si el framework está roto no tiene sentido gastar minutos de navegador.

### Pruebas unitarias del framework

Ver [Pruebas unitarias del core](#pruebas-unitarias-del-core) para saber cuándo escribir una, cómo, y qué NO va ahí.

### Pruebas E2E

Se ejecutan **desde el proyecto del módulo**, no desde la raíz. Ubicate en la carpeta del módulo:

```bash
cd reclutamiento
npm test
```

`npm test` (por debajo `triple-run-tests`):

1. Calcula un `RUN_ID` (timestamp) y corre Mocha sobre la carpeta `tests/`.
2. Loguea cada paso, adjunta el contexto de ejecución y captura screenshots según `SCREENSHOT_MODE`.
3. Genera el reporte HTML de esa ejecución en `reports/<RUN_ID>/html/index.html` y actualiza `reports/latest/`.
4. Aplica la retención (`KEEP_REPORTS`) borrando ejecuciones viejas.
5. **Limpieza automática post-ejecución**: barre los perfiles temporales de Chrome que el framework creó y muestra un resumen (perfiles eliminados, espacio recuperado, ChromeDriver huérfanos, advertencias). Es automática —no hay que pedirla— y **nunca** toca reports, screenshots, evidencias, metadata ni execution-context. Detalle en [GUIDELINES §11](GUIDELINES.md) y en `core/utils/chromeProfiles.js`.

Termina con código ≠ 0 si algún test falló (útil para CI), pero **el reporte se genera siempre**.

### Comandos del módulo

| Comando | Qué hace |
|---|---|
| `npm test` | Corre toda la suite y genera el reporte |
| `npm test -- tests/login.test.js` | Corre **un solo** archivo (ver receta) |
| `npm run report:open` | Abre `reports/latest/html/index.html` en el navegador |
| `npm run report:generate` | Regenera el HTML de la última ejecución sin re-correr los tests |
| `npm run report:clean` | Borra todo el historial de reportes del módulo |

### Variar el comportamiento por corrida (sin tocar `.env`)

En PowerShell (Windows):

```powershell
$env:SCREENSHOT_MODE="all"; npm test      # screenshot en cada test, pase o falle
$env:HEADLESS="true"; npm test            # correr sin ventana visible
```

---

## Arquitectura de capas

De arriba (lo que escribe QA) hacia abajo (la mecánica):

```
tests/            "describe el negocio"      it('debe filtrar una requisición…')
   │
   ▼
flows/            "orquesta pasos que cruzan pantallas"   authFlow.login, navigationFlow.abrirModulo
   │
   ▼
pages/            "una pantalla = un Page Object"         RequisicionesPage, LoginPage, DashboardPage
   │
   ▼
components/       "un widget reutilizable"                DataGrid, NavBar
   │
   ▼
UiContext / utils "plumbing: click, type, wait, driver"
```

**Por qué estas capas escalan a cientos de tests:**

- **Componentes** — la app es DevExtreme: el mismo grid, navbar y dropdowns aparecen en *todas* las pantallas de *todos* los módulos. Encapsularlos una vez (`DataGrid`, `NavBar`) evita reescribir "buscar/paginar/crear" cientos de veces.
- **Flows** — el ~80% de los tests empieza igual: "estar logueado y parado en el módulo X". `authFlow` + `navigationFlow` eliminan ese preámbulo duplicado. Si el login cambia, se arregla **una vez** y todos los tests siguen andando.
- **Pages** — traducen componentes a **lenguaje de negocio** (`buscarRequisicion('1090')` en vez de `grid.buscar(...)`).
- **UiContext/BasePage/BaseComponent** — eliminan el plumbing repetido (`waitForElementVisible(...).click()`).

---

## Configuración

Hay dos configuraciones **separadas a propósito**:

### 1. `.env` global (`<raíz>/.env`) — datos sensibles y de ambiente

```ini
BASE_URL=https://test.triple.com.do/
APP_USERNAME=ahinojosa@camsoft.com.do
PASSWORD=Contraportal1*

# --- Configuración del framework (opcionales) ---
# BROWSER=chrome
# HEADLESS=false
# DEFAULT_TIMEOUT=10000
# TEST_TIMEOUT=30000
# TEST_RETRIES=0
SCREENSHOT_MODE=fail        # none | fail | all | steps
# KEEP_REPORTS=20
# TESTER_NAME=
# TEST_ENVIRONMENT=
```

**Carga jerárquica** (`core/utils/env.js`): primero se lee un `.env` local del módulo (si existe, para overrides puntuales), luego el `.env` global de la raíz. Las credenciales viven en un solo lugar.

> ⚠️ Se usa `APP_USERNAME`, **no** `USERNAME`: en Windows `USERNAME` es una variable reservada del SO y `dotenv` no la sobreescribe, así que el test intentaría loguearse con el usuario de Windows.

### 2. `core/config/index.js` — comportamiento del framework

Lee las variables de arriba y expone valores con defaults seguros:

| Variable | Default | Descripción |
|---|---|---|
| `BROWSER` | `chrome` | Navegador |
| `HEADLESS` | `false` | Correr sin ventana |
| `DEFAULT_TIMEOUT` | `10000` | Timeout de esperas explícitas (ms) |
| `TEST_TIMEOUT` | `30000` | Timeout por test en Mocha (ms) |
| `TEST_RETRIES` | `0` | Reintentos por test fallido |
| `SCREENSHOT_MODE` | `fail` | `none` \| `fail` \| `all` \| `steps` |
| `KEEP_REPORTS` | `20` | Ejecuciones históricas a conservar |
| `TESTER_NAME` | usuario del SO | Quién ejecutó (para el reporte) |
| `TEST_ENVIRONMENT` | inferido de `BASE_URL` | Nombre del ambiente en el reporte |

**Política de screenshots (`SCREENSHOT_MODE`):**
- `none`: nunca. `fail` (default): solo al fallar. `all`: en cada test. `steps`: solo cuando el test/página lo pida manualmente (ver receta de evidencias).

---

## Reportes, evidencias y logging

- **Reportes**: Mochawesome, un HTML autocontenido por ejecución en `reports/<RUN_ID>/html/index.html`, y una copia siempre en `reports/latest/`. Incluye total/exitosas/fallidas, duración, stack trace completo, contexto de ejecución (ambiente, SO, navegador, usuario, timezone) y screenshots embebidos.
- **Historial + retención**: cada corrida crea su propia carpeta `reports/<RUN_ID>/`; se conservan las últimas `KEEP_REPORTS`.
- **Evidencias**: `core/utils/evidence.js` — registro extensible (image, video, pdf, download, log, json, html, text), agrupadas por test. Imágenes/videos se embeben en el HTML; el resto se referencia por ruta.
- **Logging**: `core/utils/logger.js` — cada línea con timestamp, en consola y en `reports/<RUN_ID>/logs/execution.log`.

Todo esto es **automático** para cualquier test dentro de `tests/` gracias a `mochaRootHooks.js` (cargado con `--require`): no hay que escribir `afterEach`, ni cerrar el driver, ni capturar screenshots a mano.

---

## Metadata de pantallas (autogestionada)

El framework toma una **radiografía** de cada pantalla que visita (controles, labels, requeridos, ids, botones —incluidos los solo-ícono con su nombre accesible—, grids, headers, switches y validaciones) y la persiste en `<módulo>/metadata/screens/<pantalla>.json`. Sirve para automatizar contra el DOM real **sin volver a explorar el sistema**: se puede validar un mapa de estrategias o buscar el label exacto de un control sin abrir el navegador.

```js
await screenInspector.inspeccionarYGuardar(driver, 'requisiciones-detalle');
```

**Se mantiene sola.** Cada JSON guarda el sello del inspector que lo generó:

```json
"inspector": { "version": 2, "firma": "f8f84161d5d0" }
```

- `version` — se sube a mano cuando cambia el *significado* de la metadata.
- `firma` — hash del código que corre en el browser: **cualquier** cambio en el inspector la modifica, aunque nadie se acuerde de subir la versión.

En cada corrida se compara el sello guardado con el actual:

| Situación | Qué hace |
|---|---|
| Sello idéntico | **No re-inspecciona nada** (la caché cumple su función) |
| Falta el archivo | Lo genera |
| Sello distinto (versión o firma) | Lo regenera y loguea el motivo |
| Sin sello (formato anterior) o JSON corrupto | Lo regenera |
| `{ forzar: true }` | Lo regenera aunque esté vigente |

Nunca hay que borrar JSONs a mano, y una metadata vigente no se vuelve a capturar. El motivo de cada regeneración queda en el log: `screenInspector: inspeccionando pantalla "requisiciones-detalle" (motivo: firma-distinta (cambió el inspector))`.

> La metadata **se versiona en git** y vive fuera de `reports/` a propósito: esa carpeta se poda según `KEEP_REPORTS`.

---

## Política de ejecución (aplica a TODO el framework)

El framework se comporta como un **QA humano experimentado**: ante un problema, intenta recuperar el estado con la propia app antes de reiniciar, evita generar registros innecesarios y sigue con la mayor cantidad de casos posible. Aplica a **cualquier pantalla/módulo** — está centralizada en el core, no hay que reimplementarla por test.

### 1. Recuperación del estado con la propia app
Ante un fallo, **no se cierra el navegador de inmediato ni se reinicia todo el flujo**. Primero se intenta volver a un estado limpio con los controles normales del usuario, en orden: **Descartar → Cancelar → Cerrar → X del modal → volver al listado** (manejando diálogos de confirmación tipo "¿descartar cambios?"). Solo si ninguna vía funciona se considera el estado inconsistente.
- Automático en `mochaRootHooks.js` (afterEach de un test fallido).
- Reutilizable en tests/flows: `const { recovery } = require('@triple/core'); await recovery.recuperarEstado(driver);`

### 2. Registro de bloqueos (reproducible)
Un fallo se documenta con información suficiente para reproducirlo, **no solo la excepción**: caso, pantalla, acción, campo, valor, mensaje de la app, URL, timestamp y stack de Selenium. Se adjunta como **JSON + screenshot** a la evidencia y al reporte.
- Automático ante cualquier test fallido.
- Manual: `const { problemLog } = require('@triple/core'); await problemLog.registrarBloqueo(this, driver, { accion, campo, valor, error });`

### 3. Límite de intentos (sin ciclos infinitos)
Cada caso tiene un número **acotado** de intentos:
- **A nivel test**: `TEST_RETRIES` (en `.env`) reintenta el caso completo N veces; agotado, se marca **Failed** y se continúa con el siguiente.
- **A nivel flujo** (dentro de un test/page object): `retry.conRecuperacion(fn, { intentos, recuperar })` ejecuta con tope de intentos y recuperación entre ellos.
  ```js
  const { retry, recovery } = require('@triple/core');
  await retry.conRecuperacion(() => flujoDeLectura(driver), {
    intentos: 2,
    recuperar: () => recovery.recuperarEstado(driver),
    etiqueta: 'abrir detalle',
  });
  ```
  > ⚠️ No envuelvas el "guardar" con reintentos automáticos: podría **duplicar registros**. Usá `conRecuperacion` para pasos de lectura/navegación/preparación.

### 4. No generar registros innecesarios
La **exploración** de formularios se hace **inspeccionando el DOM** (validaciones, campos requeridos, listas desplegables, atributos) — **no** creando registros. Solo se crean registros cuando un caso de prueba lo exige para validar el resultado. La recuperación por **Descartar** permite salir de un formulario sin guardar.

---

## Nomenclatura de casos de prueba

Cada caso se identifica con un **nombre descriptivo y estable**, no con un código secuencial. Ese nombre es la **única fuente de verdad**: se usa igual para el archivo, el Execution Context, el logger, las evidencias, los screenshots y las carpetas generadas.

### Reglas

- **Minúsculas**, palabras separadas por **guiones**.
- **Descriptivo del comportamiento**, no del orden: `crear-req-comentarios`, no `TC-006`.
- **Sin** espacios, acentos, caracteres especiales ni numeraciones secuenciales.
- Prefijo por acción/pantalla para que ordene bien alfabéticamente: `crear-req-…`, `publicar-…`.
- **Un caso = un archivo**: `<nombre-descriptivo>.test.js`.

### Ejemplos vigentes

| Archivo | Sección en el Execution Context |
|---|---|
| `crear-req-campos-requeridos.test.js` | `crear-req-campos-requeridos` |
| `crear-req-sustitucion-requeridos.test.js` | `crear-req-sustitucion-requeridos` |
| `crear-req-validacion-requeridos.test.js` | `crear-req-validacion-requeridos` |
| `crear-req-persona-sustituir.test.js` | `crear-req-persona-sustituir` |
| `crear-req-pregunta-personalizada.test.js` | `crear-req-pregunta-personalizada` |
| `crear-req-comentarios.test.js` | `crear-req-comentarios` |
| `publicar-requisicion.test.js` | `publicar-requisicion` |
| `pausar-requisicion.test.js` | `pausar-requisicion` |
| `importar-archivos-requisicion.test.js` | `importar-archivos-requisicion` |

### Cómo nombrar un caso nuevo

1. Elegí el nombre: `<acción>-<entidad>-<aspecto>` → ej. `crear-vacante-requeridos`, `editar-candidato-documentos`.
2. Creá `tests/<ese-nombre>.test.js`.
3. Dentro, declaralo **una sola vez** y reutilizalo en todo el archivo:

```js
const CASO = 'crear-vacante-requeridos';
testContext.registrarCaso(CASO, ['nombreVacante', 'puesto']);

describe('Reclutamiento - Vacantes', function () {
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: completa los requeridos y guarda`, async function () { /* … */ });
});
```

Al usar `${CASO}` en el título del `it`, el nombre aparece automáticamente en el reporte, en el log y en los nombres de carpeta de evidencias/screenshots — sin repetirlo a mano en ningún otro lado.

---

## Execution Context (datos de prueba)

Desacopla los **datos** de la **lógica** de los tests. Un test nunca hardcodea un valor: se lo pregunta al contexto.

> ⚠️ No confundir con `core/utils/executionContext.js`, que ya existía y hace otra cosa: arma la metadata del **reporte** (ambiente, SO, navegador). El Execution Context de **datos** es `core/context/testContext.js`.

### Cómo funciona

El archivo vive en **`<proyecto>/data/execution-context.json`** (uno por módulo, editable a mano y versionable):

```json
{
  "global":     { "usuario": "", "empresa": "" },
  "publicar-requisicion": { "nombreRequisicion": "REQ-000125", "estado": "" }
}
```

La regla es una sola:

| ¿El dato está definido (no vacío)? | Qué hace el test |
|---|---|
| **SÍ** | Usa exactamente ese dato. |
| **NO** | Se comporta **igual que hoy**: descubre el dato automáticamente. |

Se considera "no definido" el string vacío, `null`, `undefined` o un array vacío. La resolución busca primero en la sección del caso y después en `global`; si no encuentra nada, devuelve `undefined`, y ese `undefined` es la señal para el descubrimiento automático.

```js
const testContext = require('@triple/core/context/testContext');

// Opción A: leer y decidir
const nombre = testContext.get('publicar-requisicion', 'nombreRequisicion'); // undefined si está vacío

// Opción B: azúcar para el patrón completo
const req = await testContext.getODescubrir('publicar-requisicion', 'nombreRequisicion',
  async () => buscarUnaRequisicionAutomaticamente()   // solo corre si el dato está vacío
);
```

### Agregar parámetros y casos nuevos

- **Un parámetro nuevo**: agregá la clave al JSON. No hay que tocar código del framework.
- **Un caso nuevo**: al implementarlo, registrá su sección; queda vacía y lista para que la completes:

```js
const CASO = 'crear-vacante-requeridos';
testContext.registrarCaso(CASO, ['nombreVacante', 'puesto', 'empleado']);
```

`registrarCaso` **no pisa** valores ya cargados ni borra claves que hayas agregado: solo crea lo que falta.

### Casos de formulario: sembrar desde el Input Model

Un caso que llena un **formulario** no escribe su lista de claves a mano: la deriva del
formulario con **`registrarCasoDesdeFormulario`**, que siembra **todos** los controles
editables con sus **labels reales** (la fuente de verdad es el mapa `control→estrategia`
del Page Object, ver [Selection Strategies](#selection-strategies)):

```js
const RequisicionFormPage = require('../pages/RequisicionFormPage');

const CASO = 'crear-req-campos-requeridos';
// Siembra en el Execution Context TODOS los campos del formulario (labels reales).
testContext.registrarCasoDesdeFormulario(CASO, RequisicionFormPage.ESTRATEGIAS);
// Opcional: claves extra que NO son del formulario (un contador, etc.)
// testContext.registrarCasoDesdeFormulario(CASO, ESTRATEGIAS, ['maxEmpleados']);
```

Así el usuario ve en el Execution Context (y en el Panel) **todos** los campos con su
nombre de pantalla y solo completa los que quiera dirigir; **nunca inventa ni crea claves**.
Reutiliza `registrarCaso` por debajo (misma garantía: no pisa lo cargado). Los casos que
**no** son de formulario siguen usando `registrarCaso` con sus parámetros mínimos.

---

## Selection Strategies

En esta app muchos controles DevExtreme filtran al escribir, pero **escribir no alcanza**: la aplicación solo da por válido el valor cuando se **selecciona explícitamente** el item del listado. Esa mecánica está centralizada en estrategias, no repetida en cada test.

**Los tests nunca conocen el tipo de control.** Solo dicen qué valor quieren; el Page Object declara la estrategia; la estrategia sabe cómo interactuar.

```js
// En el Page Object: mapa control -> estrategia
const ESTRATEGIAS = {
  'Razón de solicitud': 'directSelect',
  'Descripción': 'text',
  'Rotativo': 'switch',
  // Un control puede declarar OPCIONES además de la estrategia.
  // `multiple: true` es necesario en los tagbox: no cierran solos al elegir.
  'Persona(s) a sustituir': { estrategia: 'searchAndSelect', multiple: true },
};

// En el test: solo el valor. El test no sabe si es tagbox, selectbox ni nada.
await form.setCampo('Persona(s) a sustituir', 'Hugo Valentina Cordero');
```

> **Ojo con los labels**: la clave del mapa debe coincidir con el label REAL del control. Si tenés la pantalla cacheada en `metadata/screens/`, podés validar el mapa contra ella sin abrir el navegador — así se detectó que el label real era `Persona(s) a sustituir`, con "(s)", y no `Persona a sustituir`.

`searchAndSelect` hace los 4 pasos obligatorios: **abre** el dropdown → **escribe** para filtrar → **espera** el filtrado → **clickea** el item.

> **Verificado en la app**: no todos los controles filtran igual. `Puesto` sí filtra (141 opciones → 3 al escribir "ADMIN"), mientras que `Persona(s) a sustituir` **no filtra** (63 opciones antes y después). `searchAndSelect` funciona en ambos casos, porque su paso decisivo no es escribir sino **seleccionar explícitamente el item** — que es justo lo que la app exige para dar el valor por válido.

### Estrategias incluidas

`firstOption` (por defecto — primera opción válida, el comportamiento histórico) · `directSelect` · `searchAndSelect` · `tagSelect` · `text` · `switch` · `datePicker` · `treeView` · `custom`

Si un control no declara estrategia, se usa `firstOption`: por eso todo lo que ya existía sigue funcionando igual.

### Agregar una estrategia nueva (Open/Closed)

No se toca ningún test, ni el `Form`, ni las estrategias existentes:

```js
const SelectionStrategy = require('@triple/core/strategies/SelectionStrategy');
const strategies = require('@triple/core/strategies');

class MiEstrategia extends SelectionStrategy {
  async aplicar(form, label, valor) {
    await form._abrirDropdown(label);
    // ... mecánica propia del control, componiendo las primitivas de Form
  }
}

strategies.registrar('miEstrategia', new MiEstrategia());
```

Después basta con apuntar el control a `'miEstrategia'` en el mapa del Page Object. Las estrategias **componen** las primitivas ya verificadas de `Form` (`_abrirDropdown`, `_itemVisiblePorTexto`, `_esperarOverlayCerrado`), así que si cambia el DOM se arregla en un solo lugar.

### Llenar un formulario desde el Execution Context (Input Model)

El mapa `control→estrategia` (`ESTRATEGIAS`) no solo dice **cómo** operar cada control:
es también la **fuente de verdad del Input Model** del formulario (qué campos tiene, con
sus labels reales). Sobre él, `Form.completarDesde` llena el formulario dando **prioridad
al valor que el usuario cargó** en el Execution Context y cayendo al comportamiento
automático cuando está vacío:

```js
// Genérico del core. Recorre los controles y, por cada label:
//   valor no vacío  → lo usa con su estrategia (prioridad del usuario)
//   valor vacío + autofill:true  → aplica la estrategia sin valor (primera opción, etc.)
//   valor vacío + autofill:false → NO toca el control (neutro)
await form.completarDesde(ESTRATEGIAS, valores, { autofill: false, solo, excepto });
```

Un Page Object compone esto con su automatización curada (dependencias entre campos,
textos por defecto) en un método propio — ej. `RequisicionFormPage.completarRequeridosConContexto(caso)`,
que lee cada control por su label del `testContext` y usa el valor provisto o el automático.
Es el **patrón de referencia** para migrar cualquier formulario.

**Sincronización mapa↔UI (preventiva).** Para que `ESTRATEGIAS` no se desincronice si el
formulario cambia, `Form.validarControlesDeclarados(ESTRATEGIAS)` compara los controles
**visibles** contra los declarados y, si hay controles en pantalla que el mapa no declara,
registra una **advertencia** (`logger.warn`) con la lista. Es solo informativo: **no
rellena, no interrumpe, no agrega comportamiento**. `ESTRATEGIAS` sigue siendo la única
fuente de verdad, ahora validada contra la UI en cada llenado.

---

## Recetas (mini-ejemplos)

### Receta: correr un solo test

Desde `reclutamiento/`:

```bash
npm test -- tests/login.test.js
```

El `--` es obligatorio: le dice a npm que pase el argumento al script. Sin argumento corre toda la carpeta `tests/`.

**También podés correrlo estando dentro de `tests/`.** `npm` normaliza el directorio a la raíz del módulo, y el runner antepone `tests/` al nombre si hace falta, así que desde `reclutamiento/tests` funciona el nombre pelado:

```bash
npm test -- login.test.js            # equivale a tests/login.test.js
npm test -- "crear-req-*.test.js"    # glob (entre comillas para que no lo expanda el shell)
```

El runner avisa cuando resolvió el path: `Target: tests/login.test.js (resuelto desde "login.test.js")`.

> Esto vale para `npm test`. Si en cambio invocás `mocha`/`npx mocha` a mano desde `tests/`, el `cwd` queda en esa subcarpeta y el framework busca `data/`, `metadata/` y `reports/` en el lugar equivocado (falla en silencio). Usá siempre `npm test`.

### Receta: escribir un test nuevo

Creá un archivo `tests/<lo-que-sea>.test.js`. **No** necesitás manejar el driver, screenshots ni logging (lo hace el core). Componé flows y páginas:

```js
// reclutamiento/tests/mi-caso.test.js
const assert = require('assert');
const { createDriver, authFlow, navigationFlow } = require('@triple/core');
const RequisicionesPage = require('../pages/RequisicionesPage');

describe('Reclutamiento - mi caso', function () {
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
    await authFlow.login(driver);                          // login reutilizable
    await navigationFlow.abrirModulo(driver, 'Reclutamiento');
  });

  it('debe encontrar una requisición existente', async function () {
    const requisiciones = await new RequisicionesPage(driver).listo();
    await requisiciones.buscarRequisicion('1090');
    assert.strictEqual(await requisiciones.existeRequisicion('1090'), true);
  });
});
```

Corré: `npm test -- tests/mi-caso.test.js`.

### Receta: crear un Page Object de módulo

Una página de módulo **extiende `BasePage` del core** y **compone** los componentes reutilizables (no reimplementa el grid). Expone métodos con lenguaje de negocio. Usá `RequisicionesPage.js` como plantilla:

```js
// empleados/pages/CandidatosPage.js
const { BasePage, DataGrid } = require('@triple/core');
const logger = require('@triple/core/utils/logger');

class CandidatosPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.grid = new DataGrid(driver);   // compone el componente del core
  }

  async listo() {
    await this.grid.listo();
    logger.info('CandidatosPage: listado cargado');
    return this;
  }

  async buscarCandidato(nombre) {
    await this.grid.buscar(nombre);
  }

  async existeCandidato(nombre) {
    return this.grid.existeFila(nombre);
  }
}

module.exports = CandidatosPage;
```

Reglas: **toda interacción con Selenium vive en la página/componente** (los tests no localizan elementos); **esperas siempre explícitas** vía `wait.js` / los helpers de `UiContext` (`this.click`, `this.type`, `this.waitVisible`), nunca `sleep` fijos.

### Receta: crear un flow nuevo

Un flow orquesta pasos que cruzan pantallas y se repiten en muchos tests. **No tiene locators**: compone páginas y componentes. Si es transversal (sirve a todos los módulos) va en `core/flows/`; si es propio del módulo, en el módulo.

```js
// core/flows/reclutamientoFlow.js  (o dentro del módulo si es específico)
const DashboardPage = require('../pages/DashboardPage');
const logger = require('../utils/logger');

async function irAReclutamiento(driver) {
  logger.info('reclutamientoFlow: ir a Reclutamiento');
  const dashboard = new DashboardPage(driver);
  await dashboard.abrirModulo('Reclutamiento');
}

module.exports = { irAReclutamiento };
```

Si lo pusiste en el core, exportalo en `core/index.js` (el barrel) para poder hacer `const { reclutamientoFlow } = require('@triple/core')`.

### Receta: crear un componente reutilizable

Si un widget se repite en varias pantallas, hacelo un componente en `core/components/`. **Extiende `BaseComponent`** (que ya trae `click/type/getText/waitVisible` y soporta un elemento `root` opcional):

```js
// core/components/DropDown.js
const { By } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');

class DropDown extends BaseComponent {
  async elegir(opcionTexto) {
    const opcion = By.xpath(`//div[contains(@class,'dx-item')][normalize-space(.)='${opcionTexto}']`);
    await this.click(opcion);
  }
}

module.exports = DropDown;
```

Y registralo en `core/components/index.js` (el barrel `core/index.js` lo re-exporta desde ahí, así que no hay dos listas que mantener). Prioridad de selectores para esta app DevExtreme: `data-testid` → `id` → `name` → `aria-label`/`title` → **clase `dx-*` estable + texto/`title`** → XPath por texto (último recurso). Nunca clases hasheadas de CSS-modules, **ni posición o índice dentro del DOM, ni contenido base64**.

> Si el componente no puede identificar un elemento con certeza, **no debe adivinar**: devuelve el diagnóstico de lo que encontró y deja que el test falle con un mensaje accionable. Un click en el control equivocado produce falsos verdes, que es peor que un fallo.

El catálogo de componentes —los implementados y los **previstos** (`Dialog`, `Popup`, `Toolbar`, `Switch`, `Tabs`, `Uploader`), con la señal que indica cuándo conviene crearlos— está en **[`core/components/README.md`](core/components/README.md)**. No se crean componentes vacíos: se implementan el día que un caso real los necesita.

### Receta: agregar un módulo nuevo

Ejemplo: módulo **Empleados**. No se toca el core.

1. Crear el proyecto `empleados/` en la raíz del monorepo con su `package.json`:
   ```json
   {
     "name": "empleados-tests",
     "private": true,
     "scripts": {
       "test": "triple-run-tests",
       "report:open": "triple-report-open",
       "report:generate": "triple-report-generate",
       "report:clean": "triple-report-clean"
     },
     "dependencies": { "@triple/core": "*", "selenium-webdriver": "^4.46.0" }
   }
   ```
2. Registrar el workspace en el `package.json` de la raíz:
   ```json
   "workspaces": ["core", "reclutamiento", "empleados"]
   ```
3. `npm install` en la raíz (enlaza el nuevo workspace).
4. Crear `empleados/pages/EmpleadosPage.js` (como la receta de Page Object) y `empleados/tests/…test.js` (como la receta de test), reutilizando `authFlow`, `navigationFlow`, `DataGrid`, `NavBar` del core.
5. Correr: `cd empleados && npm test`.

### Receta: adjuntar evidencias

Screenshot manual en cualquier punto (útil con `SCREENSHOT_MODE=steps` o para capturar un paso intermedio). El **contexto** debe ser el `this` de Mocha del `it()`:

```js
const { evidence } = require('@triple/core');

it('...', async function () {
  // ... pasos ...
  await evidence.attachScreenshot(driver, this, { label: 'Antes de guardar' });
});
```

Otros tipos ya registrados (pdf, log, json, …):

```js
const filePath = evidence.saveEvidenceBuffer('pdf', this, pdfBuffer, { label: 'comprobante' });
evidence.attach('pdf', this, filePath, { label: 'Comprobante de pago' });
```

### Receta: registrar un nuevo tipo de evidencia

Sin tocar `evidence.js`, registrás un handler una vez:

```js
const evidence = require('@triple/core/utils/evidence');
const paths = require('@triple/core/utils/paths');

evidence.registerEvidenceType('excel', {
  extension: 'xlsx',
  dir: () => require('path').join(paths.EVIDENCE_DIR, 'excel'),
  embed: () => null, // Mochawesome no lo embebe: se referencia por ruta
});
```

---

## Referencia rápida de `@triple/core`

Todo se importa desde el barrel:

```js
const {
  // infra
  createDriver, quitDriver, getCurrentDriver,
  config, wait, logger, evidence, paths, executionContext,
  // política de ejecución (recuperación, bloqueos, intentos acotados)
  recovery, problemLog, retry,
  // metadata de pantallas (inspeccionar una vez, reutilizar siempre)
  screenMetadata, screenInspector,
  // Execution Context (DATOS de prueba) + Selection Strategies
  testContext, strategies,
  // resolución de archivos para cargas (Execution Context o fixture por defecto)
  testFiles,
  // bases de capas
  UiContext, BasePage, BaseComponent,
  // páginas app-global
  LoginPage, DashboardPage,
  // componentes reutilizables (registro completo en `components`)
  NavBar, DataGrid, Form, Notify, FormsHeader, Popup, FileUploader, components,
  // flows
  authFlow, navigationFlow,
} = require('@triple/core');
```

También podés importar submódulos directos: `require('@triple/core/utils/wait')`, `require('@triple/core/components/DataGrid')`, etc.

### API de los flows

```js
await authFlow.login(driver);                              // usa credenciales del .env, deja el dashboard cargado
await authFlow.login(driver, { username, password });      // credenciales explícitas
await authFlow.logout(driver);                             // menú usuario → Cerrar sesión → confirma

await navigationFlow.abrirModulo(driver, 'Reclutamiento'); // clic en la tarjeta del dashboard
await navigationFlow.volverAlDashboard(driver);            // logo del navbar
```

### API del componente `DataGrid`

```js
const grid = await new DataGrid(driver).listo();
await grid.buscar('texto');            // filtra el grid
await grid.existeFila('texto');        // -> boolean (poll con timeout)
await grid.contarFilas();              // -> nº de filas en la página actual
await grid.clickFila('texto');
await grid.crear();                    // botón Crear
await grid.abrirFiltro();              // botón Filtro
await grid.irAPagina(2);
await grid.paginaSiguiente();
await grid.paginaAnterior();
await grid.getInfoPaginacion();        // "Página #1. Cantidad de páginas: 3 (46 Registros)"
```

### API del componente `NavBar`

```js
const navbar = new NavBar(driver);
await navbar.irAlDashboard();
await navbar.logout();
await navbar.sincronizar();
await navbar.abrirNotificaciones();
await navbar.abrirConfiguracion();
await navbar.getCompania();            // texto de la compañía activa
await navbar.getUsuario();             // texto del usuario logueado
```

### API del componente `FormsHeader`

Barra de acciones superior de las pantallas de detalle (`<div class="forms-header …">`). Muchos de sus botones son **solo ícono**: sin texto, sin `id`, sin `data-testid` y con la imagen embebida como `data:image/png;base64,…`. El componente los localiza por **nombre accesible** (`title` → `aria-label` → `data-testid` → `alt`/`title` del `<img>` → texto visible) y, si no, por el **ícono con nombre** (su `title`, `alt`, `aria-label` o clase). **Nunca** se usa el base64 como selector: es enorme, cambia con cualquier retoque del ícono y no describe la acción.

El conjunto de "clickeables" incluye tanto los `.dx-button` como los **botones de acción propios de la app**, que no son `.dx-button` sino `<div class="xxxButton" title="…">` (ej. `documentoButton` → "Documentos", `seguimientoButton` → "Seguimiento"). Se reconocen por la convención de clase `*Button` (con B mayúscula, que no colisiona con los internos `dx-button-*`). Como la coincidencia es siempre por nombre accesible, ampliar el conjunto nunca clickea de más.

```js
const header = await new FormsHeader(driver).listo();

// --- botones ---
await header.esperarBoton('pausar|pausa');            // { encontrado, via, nombre, deshabilitado, botones }
await header.accionar('pausar|pausa', { etiqueta: 'Pausar' });  // click + notify ya clasificado
await header.clickBoton('documentos', { etiqueta: 'Documentos' }); // click SIN esperar notify (abrir panel/menú)
await header.acciones();                              // inventario del header (diagnóstico para evidencias)

// --- switches del header (Publicada, Activo, …) ---
await header.ubicarSwitch('publicada', { contenedor: '[class*="grupo-publicada"]' });
await header.esperarSwitch('publicada', { obligatorio: true });  // lanza si no aparece
await header.encenderSwitch('publicada', { etiqueta: 'Publicada' }); // { yaEstaba, …notify }
await header.esperarEstadoSwitch('publicada', true);  // confirma el estado REAL tras operarlo
```

Un switch se ubica por su **contenedor propio** (la vía más estable, si el Page Object lo conoce) y, si no, por su **etiqueta**, subiendo hasta el `.dx-switch` más cercano: no depende del anidamiento interno del header.

`esperarBoton` y `esperarSwitch` **no lanzan** por defecto: devuelven el diagnóstico (incluido el inventario de acciones del header) para que el test decida el assert y muestre un mensaje útil en el reporte. `esperarSwitch` acepta `obligatorio: true` cuando la ausencia del control es un fallo de la pantalla y no un dato.

**Nunca adivina.** Si ninguna vía identifica el control, devuelve `encontrado: false` con el motivo — no usa la posición dentro del header, ni el índice del botón, ni "el único ícono que hay", ni el base64 de la imagen.

### API del componente `Popup`

Modal/diálogo genérico de DevExtreme (`.dx-popup-wrapper` / `.dx-overlay-wrapper`). El popup correcto se identifica por un `contiene` (un selector propio de ESE popup) en vez del texto del título, que rara vez está en un elemento estable. Los botones se accionan por **nombre accesible**, salteando los deshabilitados — mismo criterio de "no adivinar" que `FormsHeader`.

```js
const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });
await popup.esperarVisible();                 // lanza si no aparece
await popup.accionar('guardar', { etiqueta: 'Guardar' }); // click por nombre; no clickea deshabilitados
await popup.esperarCerrado();                 // espera a que el modal cierre
await popup.botones();                        // inventario para diagnóstico
```

### API del componente `FileUploader`

Carga de archivos **sin abrir el diálogo del sistema operativo**: envía la ruta absoluta directamente al `<input type="file">` oculto (Selenium no puede operar el selector nativo del SO). Elige el input que declara `accept` cuando hay varios, y **falla explícito** si el archivo no existe.

```js
const uploader = new FileUploader(driver, { selector: '.dx-popup-wrapper input[type="file"]' });
await uploader.subir('/ruta/absoluta/al/archivo.pdf');   // { ruta, nombre, bytes }
```

El **qué archivo** subir se resuelve con `testFiles.resolver({ ruta, base })`: usa el archivo indicado en el Execution Context si existe, o genera uno por defecto (fixture en el temp del SO, nunca una ruta hardcodeada). Ver [Execution Context](#execution-context-datos-de-prueba).

### Helpers de `UiContext` (heredados por toda página/componente)

```js
await this.waitVisible(locator);
await this.click(locator);
await this.type(locator, texto, { clear = true });
await this.getText(locator);
await this.esperarSinLoader();   // no hay overlay `loader-manager` visible
```

---

## Pruebas unitarias del core

Las pruebas unitarias protegen el **framework mismo**. Viven en `core/tests/`, corren **en memoria** (Mocha + Chai + jsdom) y no abren Selenium, ni Chrome, ni tocan la aplicación. Toda la suite tarda **segundos**.

```bash
npm run test:unit                 # desde la raíz
cd core && npm run test:unit      # equivalente, desde el core
cd core && npx mocha tests/components/FormsHeader.spec.js   # un solo archivo
cd core && npm run test:unit:watch                          # modo watch mientras desarrollás
```

### ¿Unitaria o E2E?

| Escribí una **unitaria** cuando… | Escribí una **E2E** cuando… |
|---|---|
| Agregás o cambiás un componente del core | Agregás un caso de negocio |
| Un helper decide algo (clasificar, sanear, validar, resolver) | Querés verificar que la app responde como se espera |
| Querés fijar una regla de robustez ("no adivinar el selector") | El valor está en la integración real (login, grid, navegación) |
| Corregís un bug del framework: la prueba lo reproduce primero | El comportamiento depende del DOM real de DevExtreme |

Regla práctica: **si la prueba necesita un navegador, no es unitaria**. Y si podés expresarla con un DOM simulado, no la mandes a E2E: ahí tarda minutos y falla por motivos ajenos.

### Qué se prueba: comportamiento, no implementación

Las pruebas verifican lo que el componente **hace observable**, no cómo lo hace por dentro:

```js
// ✅ comportamiento: QUÉ botón quedó accionado
await new FormsHeader(driver).accionar('pausar|pausa');
expect(driver.traza.clicks[0].id).to.equal('objetivo');

// ❌ implementación: qué método interno se llamó
expect(header._ubicarBoton.called).to.equal(true);
```

Así la prueba sobrevive a una refactorización del componente y **falla solo cuando se rompe algo que le importa a alguien**.

### Cómo se prueba un componente que habla con Selenium

Los componentes del core no dependen de Selenium: dependen de una **interfaz muy chica del driver** (`executeScript`, `wait`, `findElement`). `tests/support/fakeDriver.js` implementa esa misma interfaz contra un DOM de jsdom, respetando el contrato real (`wait` rechaza al expirar, `executeScript` devuelve `null` cuando la función no retorna, los scripts como string funcionan igual). Por eso las pruebas ejercitan **el código real del componente**, el mismo que corre en producción.

```js
const driver = crearDriver('<div class="forms-header">…</div>');
const resultado = await new FormsHeader(driver).accionar('pausar', { timeout: 60 });
expect(driver.traza.clicks).to.be.empty;   // no adivinó: no clickeó nada
```

Si una prueba necesitara más superficie de Selenium que esa, es señal de que ese comportamiento pertenece a las E2E.

Para los módulos que escriben en disco (metadata, Execution Context, evidencias, logs), `tests/support/proyectoTemporal.js` arma un proyecto descartable en el temp del sistema y reimporta el módulo en frío. Nada queda en el repositorio.

### Agregar una prueba unitaria

1. Ubicá el archivo espejando la estructura del core: `core/tests/<carpeta-del-módulo>/<Modulo>.spec.js`.
2. Importá **el submódulo concreto** (`require('../../components/Notify')`), nunca el barrel `@triple/core`: arrastra `utils/driver.js` y la suite dejaría de ser unitaria.
3. Usá `crearDriver()` si necesitás DOM, `crearProyecto()` si necesitás disco.
4. Pasá **timeouts chicos** (decenas de ms) a lo que espere: las pruebas unitarias no esperan a nadie.
5. Nombrá el `it()` describiendo la **conducta**, no el método: *"no clickea un botón deshabilitado, pero informa que existe"*.

`core/tests/contrato-suite-unitaria.spec.js` vigila que la suite siga siendo unitaria: falla si algún spec importa el driver de Selenium, carga chromedriver, depende de credenciales o escribe dentro del repositorio.

### Qué NO va acá

- Nada que necesite un navegador o la app levantada.
- Los Page Objects y flows de un módulo: son E2E por naturaleza (su valor está en el DOM real).
- Componentes cuya lógica es "encontrar un selector y clickearlo" sin decisiones propias: una prueba unitaria ahí solo repetiría el selector y daría falsa sensación de cobertura.

---

## Convenciones

- **Page Objects**: `PascalCase` + sufijo `Page` (`RequisicionesPage.js`). App-global → `core/pages/`; de módulo → `<modulo>/pages/`.
- **Componentes**: `PascalCase` (`DataGrid.js`) en `core/components/`, extienden `BaseComponent`.
- **Flows**: `camelCase` + sufijo `Flow` (`authFlow.js`), sin locators.
- **Tests E2E**: `kebab-case` + `.test.js`, en `<módulo>/tests/`.
- **Pruebas unitarias del framework**: `.spec.js`, en `core/tests/`, espejando la estructura del core.
- **Selectores** (en camelCase dentro de la clase): prioridad `data-testid` → `id` → `name` → `aria-label` → clase `dx-*` estable + texto/`title` → XPath por texto (último recurso). Nunca clases hasheadas de CSS-modules.
- **Esperas**: siempre explícitas (`UiContext`/`wait.js`). Nunca `sleep`/timeouts fijos.
- **Credenciales**: prefijo propio sin colisión con variables del SO (`APP_USERNAME`).

---

## Notas y troubleshooting

- **La app es DevExtreme.** Casi no hay `data-testid`; los selectores realistas son `id` estables (navbar) y clases `dx-*` + texto/`title`. Los componentes del core ya encapsulan esos selectores en un solo lugar.
- **`USERNAME` vs `APP_USERNAME`** (Windows): ver la sección de configuración. Nunca uses `USERNAME` para credenciales.
- **Los reportes salen en el módulo, no en el core** (`paths.js` deriva la carpeta del `cwd` del módulo). Si ves reportes dentro de `core/`, algo corrió con el cwd equivocado.
- **`npm test` desde la raíz** no corre un módulo puntual; ubicate en `reclutamiento/` (o el módulo que sea). Para correr todos, se puede `npm test --workspaces` desde la raíz.
- **Correr desde `tests/`**: `npm test` funciona igual (npm normaliza el cwd a la raíz del módulo) y el runner antepone `tests/` al nombre si hace falta. Lo que NO funciona es invocar `mocha`/`npx mocha` a mano desde una subcarpeta: ahí el `cwd` queda mal y `data/`, `metadata/` y `reports/` se resuelven en el lugar equivocado, fallando en silencio.
- **El logout dispara un diálogo de confirmación** ("¿Estás seguro?"); `NavBar.logout()` ya lo maneja (clic en "Aceptar").
- **Screenshot de fallo automático**: con `SCREENSHOT_MODE=fail` (default) cada test que falla deja su captura embebida en el reporte — clave para diagnosticar sin reproducir.
