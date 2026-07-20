# Framework de Automatización E2E — Sistema Triple

Monorepo de automatización de pruebas **end-to-end** para el sistema **Triple** (`https://test.triple.com.do/`), construido con **Selenium WebDriver + JavaScript**, patrón **Page Object Model** con capas de **Componentes** y **Flows**, reportes profesionales con **Mochawesome**, historial de ejecuciones, sistema de evidencias extensible y logging centralizado.

La idea central: un **core reutilizable** (`@triple/core`) que contiene todo lo transversal (login, navegación, navbar, grid, reportes, infra), y **un proyecto por módulo** (Reclutamiento hoy; Nómina, Empleados, Vacantes… mañana) que solo escribe sus pruebas y sus páginas propias. Agregar un módulo **no requiere tocar el core**.

---

## Índice

- [Estructura del monorepo](#estructura-del-monorepo)
- [Requisitos e instalación](#requisitos-e-instalación)
- [Cómo correr las pruebas](#cómo-correr-las-pruebas)
- [Arquitectura de capas](#arquitectura-de-capas)
- [Configuración (`.env` + framework)](#configuración)
- [Reportes, evidencias y logging](#reportes-evidencias-y-logging)
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
- [Convenciones](#convenciones)
- [Notas y troubleshooting](#notas-y-troubleshooting)

---

## Estructura del monorepo

```
Selenium/                          # raíz del monorepo (npm workspaces)
├── package.json                   # define los workspaces: ["core", "Reclutamiento/Tests"]
├── .env                           # GLOBAL: BASE_URL, credenciales y config del framework (NO se versiona)
├── .gitignore
├── node_modules/                  # dependencias hoisteadas (compartidas por core y módulos)
│
├── core/                          # === @triple/core: todo lo reutilizable ===
│   ├── package.json               # expone bins: triple-run-tests, triple-report-*
│   ├── index.js                   # "barrel": punto de entrada -> require('@triple/core')
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
│   │   ├── executionContext.js    # ambiente, SO, navegador, usuario, timezone
│   │   ├── paths.js               # rutas de reports/ (historial por ejecución + retención + latest)
│   │   └── mochaRootHooks.js      # Root Hooks: automatiza logging/screenshot/cierre de driver
│   │
│   ├── pages/                     # páginas APP-GLOBAL (compartidas por todos los módulos)
│   │   ├── base/BasePage.js       # base de todos los Page Objects (extiende UiContext)
│   │   ├── LoginPage.js
│   │   └── DashboardPage.js
│   │
│   ├── components/                # widgets reutilizables (se repiten en muchas pantallas)
│   │   ├── BaseComponent.js       # base de los componentes (extiende UiContext)
│   │   ├── NavBar.js              # barra superior: logout, volver al dashboard, sync, notif, usuario…
│   │   └── DataGrid.js            # grid DevExtreme: buscar, filtrar, crear, paginar, contar filas…
│   │
│   ├── flows/                     # flujos de negocio reutilizables (cruzan varias pantallas)
│   │   ├── authFlow.js            # login / logout
│   │   └── navigationFlow.js      # abrirModulo / volverAlDashboard
│   │
│   └── scripts/                   # orquestación y reportes (se invocan como bins triple-*)
│       ├── run-tests.js           # corre Mocha, genera reporte, aplica retención
│       ├── generate-report.js     # mergea JSON y genera el HTML
│       ├── open-report.js         # abre reports/latest/html/index.html
│       └── clean-reports.js       # borra el historial de reportes del módulo
│
└── Reclutamiento/
    └── Tests/                     # === proyecto del módulo Reclutamiento (consume @triple/core) ===
        ├── package.json           # deps: @triple/core; scripts: test, report:*
        ├── pages/                 # Page Objects PROPIOS del módulo
        │   └── RequisicionesPage.js
        ├── tests/                 # specs de Mocha (solo flujo de negocio)
        │   ├── login.test.js
        │   ├── navegacion.test.js
        │   └── reclutamiento-requisiciones.test.js
        └── reports/               # reportes generados de ESTE módulo (no se versiona)
```

> **Regla de oro para decidir dónde va algo:** ¿sirve a más de un módulo? → `core/`. ¿Es específico de un módulo? → dentro del módulo (`Reclutamiento/Tests/…`).

---

## Requisitos e instalación

- **Node.js** instalado.
- **Google Chrome** instalado (Selenium Manager resuelve el driver automáticamente).

Instalación (una sola vez, desde la **raíz** `Selenium/`):

```bash
npm install
```

Esto instala todas las dependencias de todos los workspaces y enlaza `@triple/core` dentro de `node_modules` para que los módulos lo importen por nombre.

---

## Cómo correr las pruebas

Los tests se ejecutan **desde el proyecto del módulo**, no desde la raíz. Ubicate en la carpeta del módulo:

```bash
cd Reclutamiento/Tests
npm test
```

`npm test` (por debajo `triple-run-tests`):

1. Calcula un `RUN_ID` (timestamp) y corre Mocha sobre la carpeta `tests/`.
2. Loguea cada paso, adjunta el contexto de ejecución y captura screenshots según `SCREENSHOT_MODE`.
3. Genera el reporte HTML de esa ejecución en `reports/<RUN_ID>/html/index.html` y actualiza `reports/latest/`.
4. Aplica la retención (`KEEP_REPORTS`) borrando ejecuciones viejas.

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

### 1. `.env` global (`Selenium/.env`) — datos sensibles y de ambiente

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

## Recetas (mini-ejemplos)

### Receta: correr un solo test

Desde `Reclutamiento/Tests`:

```bash
npm test -- tests/login.test.js
```

El `--` es obligatorio: le dice a npm que pase el argumento al script. Sin argumento corre toda la carpeta `tests/`.

### Receta: escribir un test nuevo

Creá un archivo `tests/<lo-que-sea>.test.js`. **No** necesitás manejar el driver, screenshots ni logging (lo hace el core). Componé flows y páginas:

```js
// Reclutamiento/Tests/tests/mi-caso.test.js
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
// Reclutamiento/Tests/pages/CandidatosPage.js
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

Y agregalo al barrel `core/index.js`. Prioridad de selectores para esta app DevExtreme: `data-testid` → `id` → `name` → `aria-label` → **clase `dx-*` estable + texto/`title`** → XPath por texto (último recurso). Nunca clases hasheadas de CSS-modules.

### Receta: agregar un módulo nuevo

Ejemplo: módulo **Empleados**. No se toca el core.

1. Crear el proyecto `Selenium/Empleados/Tests/` con su `package.json`:
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
2. Registrar el workspace en `Selenium/package.json`:
   ```json
   "workspaces": ["core", "Reclutamiento/Tests", "Empleados/Tests"]
   ```
3. `npm install` en la raíz (enlaza el nuevo workspace).
4. Crear `Empleados/Tests/pages/EmpleadosPage.js` (como la receta de Page Object) y `Empleados/Tests/tests/…test.js` (como la receta de test), reutilizando `authFlow`, `navigationFlow`, `DataGrid`, `NavBar` del core.
5. Correr: `cd Empleados/Tests && npm test`.

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
  // bases de capas
  UiContext, BasePage, BaseComponent,
  // páginas app-global
  LoginPage, DashboardPage,
  // componentes reutilizables
  NavBar, DataGrid,
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

### Helpers de `UiContext` (heredados por toda página/componente)

```js
await this.waitVisible(locator);
await this.click(locator);
await this.type(locator, texto, { clear = true });
await this.getText(locator);
```

---

## Convenciones

- **Page Objects**: `PascalCase` + sufijo `Page` (`RequisicionesPage.js`). App-global → `core/pages/`; de módulo → `<Modulo>/Tests/pages/`.
- **Componentes**: `PascalCase` (`DataGrid.js`) en `core/components/`, extienden `BaseComponent`.
- **Flows**: `camelCase` + sufijo `Flow` (`authFlow.js`), sin locators.
- **Tests**: `kebab-case` + `.test.js`.
- **Selectores** (en camelCase dentro de la clase): prioridad `data-testid` → `id` → `name` → `aria-label` → clase `dx-*` estable + texto/`title` → XPath por texto (último recurso). Nunca clases hasheadas de CSS-modules.
- **Esperas**: siempre explícitas (`UiContext`/`wait.js`). Nunca `sleep`/timeouts fijos.
- **Credenciales**: prefijo propio sin colisión con variables del SO (`APP_USERNAME`).

---

## Notas y troubleshooting

- **La app es DevExtreme.** Casi no hay `data-testid`; los selectores realistas son `id` estables (navbar) y clases `dx-*` + texto/`title`. Los componentes del core ya encapsulan esos selectores en un solo lugar.
- **`USERNAME` vs `APP_USERNAME`** (Windows): ver la sección de configuración. Nunca uses `USERNAME` para credenciales.
- **Los reportes salen en el módulo, no en el core** (`paths.js` deriva la carpeta del `cwd` del módulo). Si ves reportes dentro de `core/`, algo corrió con el cwd equivocado.
- **`npm test` desde la raíz** no corre un módulo puntual; ubicate en `Reclutamiento/Tests` (o el módulo que sea). Para correr todos, se puede `npm test --workspaces` desde la raíz.
- **El logout dispara un diálogo de confirmación** ("¿Estás seguro?"); `NavBar.logout()` ya lo maneja (clic en "Aceptar").
- **Screenshot de fallo automático**: con `SCREENSHOT_MODE=fail` (default) cada test que falla deja su captura embebida en el reporte — clave para diagnosticar sin reproducir.
