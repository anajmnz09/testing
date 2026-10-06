# GUIDELINES — Reglas de contribución del Framework de Automatización Triple

Este documento define las **reglas duras** para evolucionar el framework y escribir
pruebas. Es el complemento del [`README.md`](README.md): el README explica **cómo se
usa** el framework (estructura, recetas, API); esta guía fija **qué está permitido y
qué no** al contribuir. Ante conflicto, mandan estas reglas.

> Regla de las reglas: **no dupliques**. Si algo ya está explicado en el README o en
> `/docs`, aquí solo se enuncia la regla y se enlaza — no se reescribe.

---

## 1. Principios de diseño (innegociables)

- **Aditividad.** Cada cambio SUMA. No se elimina un método, no se cambia una firma
  pública, no se cambia el nombre de una función que otros usan. Lo nuevo convive con
  lo viejo.
- **Compatibilidad hacia atrás.** Un test o módulo que funcionaba debe seguir
  funcionando **idéntico** tras tu cambio. Si un caso no migró todavía, sigue como estaba.
- **Reuse-first.** Antes de escribir algo, búscalo. Orden de búsqueda y de preferencia:
  **Core → Components → Flows → Utilities → Pages → Tests**. Nunca dupliques lógica.
- **Open/Closed.** El framework se extiende **sin tocar** lo existente: componiendo,
  registrando en catálogos (`strategies`, `evidence`, componentes) o agregando providers/
  estrategias. Evita los casos especiales incrustados.
- **Una responsabilidad por capa.** No mezcles Core / Components / Pages / Flows /
  Utilities / Metadata / Execution Context / Input Model / Evidence / Problem Log /
  Screen Inspector / Panel. Cada uno hace una cosa.
- **Regla de oro de ubicación:** ¿sirve a más de un módulo? → `core/`. ¿Es propio de un
  módulo? → dentro del módulo. (README §Estructura.)

---

## 2. Naming — el nombre descriptivo es la única fuente de verdad

- Casos en **kebab-case** descriptivo del comportamiento: `crear-req-comentarios`,
  `publicar-requisicion`. **Nunca** `TC-001`, `TC-002`, ni numeraciones secuenciales.
- Un caso = un archivo `tests/<nombre>.test.js`. El nombre se declara **una vez**
  (`const CASO = '...'`) y de él derivan **automáticamente** archivo, logger, Execution
  Context, screenshots, evidencias y reportes. (README §Nomenclatura.)

---

## 3. Formularios — flujo oficial: Input Model

Todo test que llena un **formulario** usa el **Input Model**. El flujo canónico:

```
Formulario real
   ↓  (fuente de verdad)
ESTRATEGIAS  (mapa control→estrategia del Page Object)
   ↓  formInputModel  (deriva labels reales, sin inventar)
Execution Context  ←  Panel de Automatización  (el usuario solo completa valores)
   ↓  testContext.get(caso, label)
Form.completarDesde()  /  completar...ConContexto()
   ↓
Autofill SOLO de los campos vacíos (comportamiento automático de hoy)
```

Reglas:

- **`ESTRATEGIAS` (el mapa `control→estrategia` del Page Object) es la única fuente de
  verdad** de qué controles tiene el formulario y cómo se operan.
- El caso siembra sus parámetros con
  **`testContext.registrarCasoDesdeFormulario(CASO, PageObject.ESTRATEGIAS[, extra])`**
  — nunca con una lista camelCase escrita a mano.
- Los parámetros usan los **labels REALES** del formulario. **Nunca** inventes nombres,
  traduzcas ni crees alias. El usuario ve en pantalla el mismo texto que en el contexto.
- **Prioridad:** valor cargado por el usuario → se usa; valor vacío → **exactamente** el
  comportamiento automático que ya existía (primera opción / textos por defecto).
  Nunca se pierde una automatización existente.
- El llenado dirigido por contexto se hace con **`Form.completarDesde(controles, valores,
  { autofill, solo, excepto })`** (genérico del core) o con un método del Page Object que
  lo componga (ej. `RequisicionFormPage.completarRequeridosConContexto(caso)`).
- **Sincronización mapa↔UI:** al llenar, valida con
  **`Form.validarControlesDeclarados(ESTRATEGIAS)`** — si la UI muestra controles que
  `ESTRATEGIAS` no declara, se registra **una advertencia** (`logger.warn`) y **nada más**:
  no se rellenan, no se rompe, no se agrega comportamiento implícito.
- **El campo que identifica la entidad/persona principal de la operación va PRIMERO.**
  Si un caso representa una operación sobre una persona/entidad específica (editar sus
  datos, agregarle un registro hijo, etc.), el parámetro que identifica A QUIÉN — la
  clave de búsqueda, típicamente `"Nombre de <Entidad> a <acción>"` (§Naming más abajo)
  — debe sembrarse **antes** que los demás campos, nunca al final. Con
  `registrarCasoDesdeFormulario(CASO, ESTRATEGIAS, clavesExtra)`, `clavesExtra` YA se
  siembra primero por diseño — pasar ahí la clave de búsqueda alcanza. Con
  `registrarCaso(CASO, [...])` a mano (casos sin `ESTRATEGIAS`, ej. un mini-form
  emergente), la clave de búsqueda debe ser el **primer** elemento del array. Esto NO es
  específico de ningún módulo o formulario: aplica a cualquier caso con este patrón,
  presente o futuro.
  - **Ojo con el orden ya persistido:** `registrarCaso` nunca reordena ni borra claves
    que YA existen en `execution-context.json` (protege datos que el usuario cargó a
    mano) — así que renombrar o reordenar una clave en el código **no mueve nada** en un
    caso que ya se había registrado antes con el nombre/orden viejo. Tras un rename como
    este, hay que reordenar esa sección del `execution-context.json` a mano UNA vez (y
    borrar cualquier clave vieja que ya no exista en el código — ver siguiente punto). El
    orden del **objeto JavaScript en el código no es lo mismo que el orden ya escrito en
    disco**; verificá el archivo real antes de asumir que un cambio de código ya se
    reflejó ahí. El orden que ve el usuario en el Panel es exactamente
    `Object.keys()` de esa sección del JSON — confirmado siguiendo la cadena completa
    `testContext._escribir` → `panel/anfitrion/contexto.js#seccion` (`Object.keys(s)`) →
    `panel/web/js/contexto.js` (itera esa lista tal cual, sin reordenar).
  - **Claves huérfanas:** si un caso se registró antes con un nombre de clave que después
    se renombró en el código, la clave VIEJA queda para siempre en
    `execution-context.json` (nadie la borra sola) — un campo fantasma que no corresponde
    a nada real. `registrarCaso` avisa con `logger.warn` cuando detecta claves en el
    archivo que ya no están en la lista declarada, para que se note y se limpien a mano;
    no las borra automáticamente (mismo criterio "nunca pisa/borra lo que ya está" del
    resto del framework — podría ser un dato real que el usuario todavía necesita).
- **Nunca nombres un campo por su etiqueta genérica sin verificar qué representa.**
  Antes de mapear/declarar un control o una clave de búsqueda, determiná qué dato
  representa REALMENTE en el contexto de ESE formulario — no le pongas
  "Nombre"/"Tipo"/"Estado"/"Código" solo porque así arrancó o porque es la palabra más
  corta. Si el label es realmente así en la app (`ESTRATEGIAS`, valores de controles
  reales), se respeta tal cual (regla de labels reales, arriba); el problema es
  específicamente para claves SINTÉTICAS que el framework inventa (ej. una clave de
  búsqueda que no es un campo real del DOM) — ahí sí hay que nombrarla por lo que
  representa (ej. el empleado AL QUE se le agrega un registro), sin quedarse con lo
  genérico solo porque "andaba".

### Datos automáticos dinámicos — `core/utils/datosPrueba.js` (única fuente)

Cuando un campo de texto/identificador no recibió valor del Panel, el valor automático
sale **siempre** de `@triple/core/utils/datosPrueba` (catálogos en `core/data/datosPrueba.json`),
nunca de strings fijos ni `Automatica-<timestamp>`:

- **Prioridad intacta:** el llamador sigue haciendo `testContext.get(caso, label) || generador(...)`;
  el generador no lee ni pisa el contexto.
- **Unicidad solo donde la app la exige:** `personaUnica()`, `correo()`, `identificacion()`,
  `celular()`, `nombreRequisicion(puesto)` (llevan token temporal/secuencia). Textos libres
  (`texto('requisitos'|'responsabilidades'|'descripcion'|'comentario', { puesto })`) pueden repetirse.
- **Coherencia semántica:** el generador recibe el contexto del test (p. ej. el Puesto ya elegido
  en el formulario) y lo incorpora; Search/Select sigue tomando la primera opción.
- **Límites reales:** `nombreRequisicion` se acota a 45 caracteres (61 hizo fallar el Guardar con
  "Error en el sistema"). Si un campo nuevo tiene `maxlength`, acotarlo en el generador.
- Para ampliar: agregar catálogo/plantilla al JSON o una función a `datosPrueba.js`; no crear
  generadores por módulo. Los helpers de módulo (`datosQA.js`, `*.data.js`) solo adaptan labels.

Ver README §Selection Strategies y `docs/plataforma-de-control-arquitectura.md §18`.

---

## 4. Tests que NO son de formulario

Ej.: `publicar-`, `pausar-`, `compartir-`, `importar-`. Reglas:

- Usan **`registrarCaso(CASO, [claves mínimas])`** con **solo** los parámetros que el caso
  necesita (una referencia, un estado, un archivo…).
- **No** generan Input Model ni siembran campos de formulario.

---

## 5. Selectores

- **Prohibido:** índices, orden del DOM, orden visual, base64, clases hasheadas de
  CSS-modules, selectores frágiles.
- **Preferencia:** `data-testid` → `id` → `name` → `aria-label`/`title` → nombre
  accesible / texto visible → clase `dx-*` estable + texto → XPath por texto (último recurso).
- **Si la identificación es incierta: NO adivines.** Falla explícito, genera diagnóstico
  (Problem Log) y adjunta evidencia. Un click en el control equivocado es peor que un fallo.

---

## 6. Validación

Un test verifica, según aplique: estado de UI esperado, notificaciones, **persistencia**
(reabrir y comprobar), navegación y comportamiento de negocio. Siempre que se pueda,
cubrir el escenario **positivo y el negativo** (ej. compartir publicada vs. no publicada).

---

## 7. Evidencia, Problem Log y Recovery — reutilizar, nunca reinventar

- Screenshots/evidencias: `evidence` del core. Bloqueos: `problemLog`. Metadata de
  pantalla: `screenInspector`/`screenMetadata`. **Nunca** crees un sistema de evidencias propio.
- Ante un fallo, **no abandones la app**: reutiliza `recovery.recuperarEstado(driver)`
  (Descartar → Cancelar → Cerrar → X → volver al listado). La política ya es automática en
  los root hooks. (README §Política de ejecución.)

---

## 8. Metadata y Execution Context

- La metadata de pantallas es **autogestionada** por sello `{version, firma}`: no se
  edita ni se borra a mano. (README §Metadata.)
- No confundir **`context/testContext.js`** (DATOS de prueba) con
  **`utils/executionContext.js`** (metadata del REPORTE). Son cosas distintas a propósito.

---

## 9. Pruebas unitarias del framework

Todo cambio en el core que **decide algo** (clasificar, sanear, resolver, comparar,
orquestar) lleva prueba unitaria en `core/tests/` (Mocha + Chai + jsdom, sin navegador).
Lo que solo "encuentra un selector y clickea" no se unit-testea. (README §Pruebas unitarias.)

---

## 10. Documentación — un cambio no está completo sin ella

Al introducir o cambiar arquitectura o un **patrón de prueba**, actualiza en el mismo
lote: `README.md`, este `GUIDELINES.md`, los documentos de `/docs` afectados y los
ejemplos. Documentar es parte de "terminado".

---

## 11. Limpieza automática post-ejecución

Toda corrida de pruebas termina con una **limpieza automática** de los temporales que
el framework creó — sin que el usuario la pida. Está en el Core (única fuente de
verdad), no se reimplementa por módulo:

- `core/utils/chromeProfiles.js` — perfil de Chrome propio + `limpiarPerfiles`
  (post-corrida) y `barrerViejos` (huérfanos al arrancar).
- `core/utils/driver.js` — `quitDriver` borra el perfil de **cada** sesión.
- `core/scripts/run-tests.js` — al terminar, barre residuales y muestra un **resumen**
  (perfiles eliminados, espacio recuperado, ChromeDriver huérfanos, advertencias).

Reglas: **nunca** toca reports, screenshots, evidencias, metadata, execution-context ni
archivos del proyecto; **nada** fuera del ámbito del framework. Si una limpieza falla,
se registra como **advertencia** y la corrida sigue. Matar procesos del sistema es
delicado: ChromeDriver huérfano se **reporta** (se cierra solo cuando es seguro), nunca
se matan procesos de Chrome del usuario.

### `KEEP_BROWSER_OPEN` — solo aplica a corridas lanzadas desde el Panel

`KEEP_BROWSER_OPEN` (`.env`) es una preferencia del **usuario humano operando el
Panel** — sirve para dejar el navegador abierto e inspeccionar visualmente el
resultado de una corrida que él mismo lanzó desde ahí. Cuando es el asistente
(Claude) quien levanta un navegador por su cuenta — para investigar un error,
reproducir un bug, verificar un fix, o correr un test/script de diagnóstico
directamente (`npm test`, `npx mocha`, un script `node -e`, etc.) — el
navegador **siempre debe cerrarse al terminar**, sin importar el valor de
`KEEP_BROWSER_OPEN` en `.env`: el asistente pasa `KEEP_BROWSER_OPEN=false`
como override de esa invocación puntual (nunca edita el `.env` para lograrlo).

**Por qué:** el valor de `.env` reflejaba lo que el usuario quería para SUS
propias corridas manuales desde el Panel — el asistente corriendo decenas de
scripts de diagnóstico en una sesión de investigación no debería heredar esa
preferencia y dejar ventanas de Chrome acumulándose de fondo (confirmado real:
esto generó confusión sobre si esas ventanas eran del framework o personales
del usuario, y contribuyó a diagnosticar mal una causa de flakiness).

**Cómo aplica:** únicamente las corridas que el **Panel** lanza (`panel/anfitrion/
comando.js`/`lanzador.js`, el mismo `npm test` que ve el usuario en la consola)
respetan `KEEP_BROWSER_OPEN` tal cual está en `.env` — eso no cambia. Todo lo
demás que el asistente ejecute por su cuenta, aunque use el mismo comando o
script, cierra el navegador siempre.

## Checklist antes de dar por terminado

- [ ] Reutiliza infraestructura existente (Core→…→Tests); sin lógica duplicada.
- [ ] Aditivo: nada eliminado, ninguna firma pública cambiada.
- [ ] Naming descriptivo correcto (sin `TC-###`).
- [ ] Formularios: Input Model (`registrarCasoDesdeFormulario` + `completarDesde`),
      labels reales, prioridad valor-provisto, autofill solo en vacíos.
- [ ] No-formulario: `registrarCaso` con parámetros mínimos.
- [ ] Selectores robustos; si hay incertidumbre, falla explícito + diagnóstico + evidencia.
- [ ] Validación de UI/notificación/persistencia/navegación (positivo y negativo).
- [ ] Evidencia/Problem Log/Recovery reutilizados (no propios).
- [ ] Execution Context actualizado (claves sembradas, no valores inventados).
- [ ] Pruebas unitarias para la lógica de decisión nueva del core.
- [ ] Compatibilidad preservada (los tests que no migraron siguen igual).
- [ ] Limpieza automática post-corrida verificada (0 perfiles residuales; no se tocaron reports/evidencias).
- [ ] "¿Hay datos de prueba?" se lee con `grid.contarFilas()`/`filasPorColumnas()`
      (ya hacen poll — nunca una lectura de una sola vez) y, ante un vacío
      CONFIRMADO, la entidad está clasificada explícitamente como catálogo
      persistente (falla con `assert.fail()`, nunca `return` silencioso) o
      como opcional/efímera (`this.skip()`, nunca `return` silencioso) — sin
      asumir la clasificación, se confirma con el usuario. Ver
      `testing-patterns/SKILL.md` (incidentes 2026-09-02/2026-09-03).
- [ ] `editar-*`: captura "ANTES de editar", cambio aplicado, verificación de
      cada campo con `Form.esperarValor` (no `getValor` suelto), captura
      "DESPUÉS de editar", `assertTextoIgual` contra el valor ya releído —
      mismo patrón que `configuracion/tests/editar-usuario.test.js`.
- [ ] `editar-*`: la clave de BÚSQUEDA (qué registro abrir) tiene nombre
      propio, descriptivo y específico de la entidad — nunca una palabra
      genérica (`'nombre'`, `'código'`) que se confunda con un campo real del
      formulario. Ej.: `"Nombre de Empleado a editar"`, igual que
      `"Nombre de Usuario a editar"` en `editar-usuario.test.js`. Ver
      `testing-patterns/SKILL.md`.
- [ ] La clave que identifica la entidad/persona principal de la operación
      (búsqueda, o "a quién se le agrega este registro") está sembrada
      **primero** (`clavesExtra` de `registrarCasoDesdeFormulario`, o primer
      elemento del array de `registrarCaso`) — y, si el caso YA existía antes
      del cambio, el `execution-context.json` real se revisó y reordenó a
      mano (el código no reordena claves ya persistidas), sin dejar claves
      huérfanas del nombre viejo. Ver §3 arriba y `testing-patterns/SKILL.md`.
- [ ] Documentación actualizada (README + GUIDELINES + /docs + ejemplos).
