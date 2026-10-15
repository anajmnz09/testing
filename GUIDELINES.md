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

### Datos automáticos dinámicos — punto de acceso común `datos.js` (bancos de texto + `datosPrueba.js`)

**Un solo punto de acceso:** `require('@triple/core/utils/datos')`. El test (o el Page Object) pide el dato por **fuente**
`'<familia>.<clave>'` y el mecanismo delega en el proveedor correcto; no se importa `bancos.js`, `datosPrueba.js`, `datosQA.js` ni
`nombresQA.js` para obtener datos nuevos:

| Fuente | Proveedor | Ejemplo |
|---|---|---|
| `<banco>.<texto>` | banco de texto del dominio (`<modulo>/support/bancos.js`, motor `bancoDatos.js`), descubierto solo | `puesto.descripcion`, `educacion.lugar` |
| `persona.*` | `datosPrueba.js` (formatos válidos, coherentes entre sí): primerNombre, segundoNombre, primerApellido, segundoApellido, nombreCompleto, correo, correoPersonal, identificacion, celular | `persona.correo` |
| `requisicion.nombre`, `texto.<tipo>` | `datosPrueba.js` con contexto `{ puesto }` | `texto.requisitos` |

- **Dónde se asocia campo → fuente (declarativo, una vez):** junto al campo, en el `ESTRATEGIAS` del formulario:
  `Descripción: { estrategia: 'text', dato: 'puesto.descripcion' }`, `Nombre: { estrategia: 'text', dato: { fuente: 'capacitacion.nombre', unico: true } }`.
  Solo `estrategia: 'text'` (`input` de texto / `textarea`). `datos.deFormulario(CASO, Page.ESTRATEGIAS)` devuelve `{ label: valor }` de los
  campos con `dato`; `Form.completarDesde` con `autofill` también los resuelve. Sin `ESTRATEGIAS` (modales): `datos.valor(testContext.get(CASO, label), 'banco.clave')`.
- **Prioridad (nunca se pisa una decisión):** 1) valor dirigido del Panel / Execution Context, 2) valor que el escenario pasa a
  propósito (vacío, inválido, límite: el test simplemente **no** pide un dato generado para ese campo), 3) valor de un paso
  anterior del flujo (llega por el mismo contexto / `FlowContext`; este mecanismo no lo transporta), 4) la fuente declarada.
- **Unicidad:** `{ unico: true }` agrega un sufijo corto de tiempo+secuencia (`datos.unico`); `nombreUnicoQA` queda como adaptador de
  compatibilidad (delega en `datos.unicoQA`). `siguienteNombreQA/siguienteNumeroQA` no generan: derivan del valor previo en `editar-*`.
- **Reproducibilidad:** todo el azar y los cursores salen de **una** semilla por corrida (`bancoDatos.semilla()`): `DATOS_SEMILLA=<n>`
  (campo en Configuración del Panel o variable de entorno; vacío = semilla nueva en cada corrida) repite personas, textos y códigos
  para la misma secuencia de solicitudes. **Nada de este mecanismo usa `Math.random`.** Lo único que no se reproduce a propósito es
  el sufijo de unicidad (tiempo): repetir una corrida no debe chocar con los registros que la anterior dejó en la app.
- **Límites:** solo texto libre. Selects, fechas, números, checkboxes y archivos no pasan por acá. No es un canal de datos entre tests ni de
  Flujos (`FlowContext`, §12). Los nombres de banco son únicos entre módulos; `persona`, `requisicion` y `texto` están reservados.

Cuando un campo no recibió valor del Panel, el valor automático **nunca** es un string fijo ni
`Automatica-<timestamp>`. Hay dos proveedores, con repartos distintos (ver también *Bancos de texto*, abajo):
`datosPrueba.js` para **personas, correos, identificaciones, teléfonos y nombres/textos que dependen del contexto
del test** (p. ej. el Puesto de una requisición) y los **bancos** para el **texto libre** de `input`/`textarea`.
Lo de `datosPrueba.js`:

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
  *generadores* por módulo (lógica de generación). Los helpers de módulo (`datosQA.js`, `*.data.js`) solo adaptan labels.
- `datosPrueba.js` elige con el flujo pseudoaleatorio de la semilla de la corrida (`random` sigue siendo inyectable en tests unitarios).

#### Bancos de texto — `core/utils/bancoDatos.js` (solo `input` de texto y `textarea`)

**Problema:** los tests llenaban el texto libre con literales artificiales (`'QA Lugar'`, `'Empresa QA'`,
`'Descripción QA automatizada'`), siempre iguales y evidentemente de prueba. Un **banco** es una colección
pequeña de categorías (unas pocas opciones cada una) y de textos que las combinan, p. ej.
`'{institucion} {nombre}'`; con pocas opciones bien elegidas salen decenas de combinaciones plausibles.
No se exige ningún mínimo de datos: basta que el campo reciba valores creíbles y variados.

- **Alcance:** únicamente campos de **texto libre** (`<input type="text">`, `<textarea>`). NO aplica a selects,
  fechas, números, checkboxes, radios, archivos, componentes especializados ni identificadores/valores
  estructurados (cédula, correo, código…, que siguen en `datosPrueba.js`) salvo una regla explícita futura.
- **Dónde viven:** los **datos** junto a su dominio, `<modulo>/support/bancos.js` (un banco pequeño por
  dominio/entidad, no un catálogo global); el **mecanismo** es del Core (`bancoDatos.js`). Una lista que dos
  tests necesitan se reutiliza importando el banco, no se copia.
- **Prioridad:** `datos.valor(testContext.get(CASO, label), 'banco.clave')` (equivale a `bancos.X.valor(...)`, que sigue disponible) — el valor del Panel / Execution Context
  gana siempre; el banco solo responde cuando no se dirigió nada. El banco **no** lee ni escribe el Execution
  Context ni el `FlowContext`: no es un canal de datos entre tests ni de Flujos (las entidades que un flujo necesita
  siguen viniendo del `FlowContext`, §12).
- **Unicidad:** `{ unico: true }` en la fuente (o `nombreUnicoQA(dirigido, base)`, adaptador de compatibilidad).
- **Determinista y reproducible:** cada texto recorre todas las combinaciones desde una *semilla* de la corrida
  (derivada de `RUN_ID`); la semilla y cada valor elegido quedan en el log. Para repetir una falla:
  `DATOS_SEMILLA=<la del log>`. Este mecanismo no usa `Math.random`.
- **Estado actual:** consumen el punto común `agregar-educacion/experiencia/capacitacion/habilidad`, `crear-empleado`
  (`datosQA.js` sobre `datos`), `crear-puesto/sucursal/cuenta-contable` (con `dato` en `ESTRATEGIAS`), `crear-solicitud-empleo`,
  `agregar-comentario-solicitud-empleo`, `crear-tipo-nomina` (`datos.codigo`), las requisiciones (`texto.*`, `requisicion.nombre`) y todos los
  `crear-*`/`agregar-*` que usan `nombreUnicoQA` (adaptador). **Siguen con literales QA como `base` (nombres identificables, pendientes de
  migrar a un banco por entidad, sin urgencia):** los `NOMBRE_BASE_QA` de los `crear-*` de Configuración, y los `Math.random` numéricos de
  Reclutamiento (estrellas, salario, apreciación: fuera de alcance, no son texto). `editar-*` siguen con `siguienteNombreQA` (derivan del valor previo).
  **Regla para código nuevo:** el texto libre nuevo se declara con `dato` en `ESTRATEGIAS` (o `datos.valor`) y sale de un banco.

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

## 12. Flujos: varios tests, un navegador (`requires` / `produces`)

Un **flujo** es una corrida de varios tests existentes, en un orden calculado por el framework, con **un solo navegador y una
sola sesión**, donde un test puede consumir lo que otro produjo (la requisición creada alimenta la solicitud, etc.). Es una capa
ADICIONAL: un test individual no la usa ni cambia (sin `TRIPLE_FLOW_PLAN` todo es inerte) y **un test sin metadata de flujo sigue
siendo válido**, solo o como paso independiente de un flujo.

### Ejecución individual vs flujo

| | Individual | Flujo (`core/scripts/run-flow.js`) |
|---|---|---|
| Fuente de valores | `testContext` → `execution-context.json` → automático | `flowContext` → automático |
| `execution-context.json` | se lee y se modifica (Panel) | **no es fuente de valores**: no se lee ni se modifica (solo siembra/consulta las claves del caso: `registrarCaso`, `claveConocida`) |
| Datos específicos | los del Execution Context / Panel | **ninguno**: un flujo no recibe datos (ni perfiles ni parámetros temporales) |
| Navegador | uno por test | uno compartido (`createDriver` lo devuelve; `quitDriver` no lo cierra, lo hace `flowHooks`) |

`testContext.valorDirigido` es el único punto que distingue el modo. En un flujo, el valor de una clave es la entidad que el flujo
produjo (`flowContext`) o, si no hay, el automático del propio test. Residuos de un `execution-context.json` individual **no** se
aplican a un flujo (el Panel lo avisa como "Data residual" sin borrar nada ni bloquear).

### Descubrimiento estático (`core/utils/flowScanner.js`, `flowEstructura.js`, `flowMetadata.js`)

El escáner **lee el código sin ejecutarlo** (sin Selenium, Mocha ni `require` del test; un lexer ignora comentarios, strings y
regex). Solo acepta lo que el código **demuestra**: formas literales y sin ambigüedad. Lo demás se reporta, nunca se adivina.

| Qué | Cómo lo demuestra el código | Resultado |
|---|---|---|
| `produces` explícito | `flowContext.publish/update('tipo', …)` con tipo literal | DETECTADO: se deriva, **no se declara** |
| `produces` estructural | el test llama a un creador declarado en el `ENTIDAD_FLUJO` de un Page Object y confirma el guardado | DETECTADO: `produces { tipo }` (ver abajo); editar → transformación; eliminar → `elimina` |
| `requires` por lectura | `flowContext.get/entidad('tipo')` con tipo literal | DETECTADO: `requires { tipo }` (ordena; sin valores) |
| `requires` por **campo seleccionable** | el formulario que el test registra (`registrarCasoDesdeFormulario(CASO, <Page>.ESTRATEGIAS)`) tiene un control con estrategia de selección (`firstOption`, `directSelect`, `searchAndSelect`, `tagSelect`) cuyo label contiene el término de una entidad ya conocida (`tipo`/`alias` de un `ENTIDAD_FLUJO`) | DETECTADO: `requires { tipo }` (ordena; sin valores). Ver «Campos seleccionables» abajo |
| `requires` con valores, por **estructura** | la clave de `testContext.get(CASO, 'k')` llega, directo o por alias simple, al localizador (`abrirDetalle(x)` u otro método declarado) de un Page Object que declara `ENTIDAD_FLUJO` | DETECTADO: `requires { tipo, clave, campo: referencia }`, sin declarar nada en el test |
| `requires` con valores, no demostrable | clave con entidad y campo junto a su declaración: `registrarCaso(CASO, [{ clave, entidad, campo }])` o la entrada de `ESTRATEGIAS` del Page Object `{ estrategia, entidad, campo }` | DECLARADO (mínimo): la clave se alimenta del `campo` de la entidad |
| Orden de negocio | no está en el código | DECLARADO en `flujo-tests.js` (`orden`) |
| Resto (clave suelta, fixture, nombre) | no demuestra nada | SUGERIDO / NO DETERMINADO: **nunca crea una dependencia** |

- **Contrato de entidad (`ENTIDAD_FLUJO`), declarado UNA vez en el Page Object que implementa el localizador**
  (no en el fixture ni en cada test): `static get ENTIDAD_FLUJO() { return { tipo: 'solicitud', referencia: 'codigo', creadores: ['crear'] }; }` —
  "mi `abrirDetalle(x)` localiza una entidad `tipo` por su campo `referencia`" (el campo debe estar entre los que publican los
  productores). `metodos: [...]` lista otros localizadores (por defecto `['abrirDetalle']`) y un array declara varias entidades.
  El escáner sigue, sin ejecutar, test → fixture (cuyo cuerpo asigna `ctx.lista = <PO>`) o `new PO` → lo que DEVUELVEN sus métodos
  (`return new X(…)`: `detalle = await ctx.lista.abrirDetalle(x)`, también en un ternario o desestructurado desde un helper de
  fixtures) → `ENTIDAD_FLUJO`, y el valor de la clave hasta el localizador (asignaciones simples, `a || b`, `await`, `parsearValoresMultiples`, `for…of`, un helper del módulo de fixtures con
  un salto, clave literal o constante de módulo). Cualquier otra forma no propaga la clave. Al crear un Page Object de listado
  cuya entidad produce algún test, declare su `ENTIDAD_FLUJO`: todos los tests que lo usen quedan descubiertos sin metadata.
- **Tres conceptos distintos, siempre explícitos:** *entidad* (`solicitud`), *campo* de referencia (`campo`, el dato de la entidad
  que se usa) y *clave consumida* (`clave`, la del test). `campo` nunca se deduce de la clave: `solicitud.codigo` ← clave `codigo`,
  `requisicion.nombre` ← clave `Requisición` o `nombre` se declaran (en el contrato del Page Object o en `ESTRATEGIAS`), no se
  infieren por coincidencia de texto.
- **Heurísticas prohibidas como contrato:** nombres de archivo, de test, de Page Object o de variable; labels; fixtures; claves
  genéricas (`codigo`); resultados, screenshots o reportes previos. Pueden aparecer como SUGERIDO en el escáner, nada más.
- **Detectado y declarado se integran igual en el planner.** Si discrepan (el código lee `solicitud` y se declara `empleado`; la
  misma clave con otra entidad/campo), una declaración es incompleta o hay `orden` para un tipo que el test no produce, es un
  **error de contrato/plan** y el flujo no abre el navegador (nunca se elige uno en silencio). Si no se puede probar, queda NO
  DETERMINADO y no se inventa relación.
- **Campos seleccionables (`flowCampos.js`): label + entidad conocida + dropdown ⇒ `requires { tipo }`.** Las entidades conocidas son las que ya declaran
  los contratos `ENTIDAD_FLUJO` (su `tipo`, p. ej. `plan-de-seguro`, y los `alias: ['cargo']` opcionales del contrato; no hay otro catálogo). Cada control se resuelve
  por separado: tiene que ser un selector de opciones (un `text`, `datePicker`, `switch`… nunca cuenta) y su label debe contener el término completo
  de la entidad (sin mayúsculas/tildes/puntuación/conectores; nunca una subcadena, ni un complemento introducido por «de»: «Razón de solicitud» no es la entidad
  `solicitud`). Gana el término más largo («Tipo de nómina» → `tipo-nomina`, no `nomina`); un empate entre entidades distintas es un error de plan (se
  desambigua con un `alias` en el contrato), nunca una asignación arbitraria. No se exige rastrear de dónde salen las opciones. Una entidad que el propio test
  crea/edita (p. ej. «Departamento padre») no es una dependencia. Para que un label distinto reconozca una entidad, añada el `alias` en su `ENTIDAD_FLUJO`. Si el selector coincide con una entidad pero NO es una dependencia de flujo (p. ej. el formulario que crea la asignación `beneficio-empleado` elige un «Beneficio» del catálogo de Configuración), el control lo declara en su `ESTRATEGIAS`: `Beneficio: { estrategia: 'directSelect', sinRequires: true }` (explícito, por control).
- **Jerarquía (el framework descubre cuando hay evidencia estructural; no infiere por nombres, labels ni heurísticas ambiguas):**
  1) **detección estructural** → 2) **declaración explícita mínima** (solo si la estructura no lo demuestra, y preferentemente
  una sola vez en el Page Object: `ESTRATEGIAS` o `ENTIDAD_FLUJO`; en el test solo como último recurso) → 3) **no determinado**
  (no crea dependencia). Una declaración manual que la estructura ya demuestra es **redundante** y el contrato exige quitarla.
  Dentro de un flujo, la entidad detectada alimenta la clave desde `flowContext`; si no hay entidad producida, el test usa su
  comportamiento automático de siempre. En ejecución individual nada cambia.
- **Cuándo declarar:** solo si el test consume una entidad de un flujo y la estructura no lo demuestra. Una clave sin entidad
  es un dato libre más del test. Un test que no participa en flujos no declara nada.
- **Diagnóstico y contrato:** `node core/scripts/flujo-escanear.js <modulo>/<caso>` (o `--todo`) separa DETECTADO CON CERTEZA /
  DECLARADO EXPLÍCITAMENTE / SUGERIDO / NO DETERMINADO. `core/tests/contrato-flujo-metadata.spec.js` valida requires detectados y
  declarados, contradicciones (incluida estructura vs declaración), declaraciones redundantes, entidades inexistentes (nadie las
  produce), `campo`/`referencia` fuera de lo que la entidad publica, métodos de `ENTIDAD_FLUJO` inexistentes, claves
  inexistentes, `orden` y que los tests sin metadata son válidos.

### Producción de entidades: crear, transformar, eliminar (`flowInstrumentar.js`, contrato `ENTIDAD_FLUJO`)

**Regla general:** cualquier operación que REALMENTE crea y persiste una entidad de negocio puede ser `produces`, se llame
`crear`, `agregar`, `registrar` u otra cosa. `crear-*` no es requisito ni garantía, y `agregar-*` puede ser productor pero no siempre.
**El nombre (del test o del método) nunca es el contrato**: la evidencia es la operación estructural declarada en el Page Object.

- **Un solo contrato** (`ENTIDAD_FLUJO`) describe, por entidad: `tipo`, `referencia`, `metodos` (localizadores), `creadores`,
  `editores`, `eliminadores` y `confirmadores` (guardado de un formulario compartido). Un array declara varias entidades en la misma clase
  (el detalle de un empleado opera capacitación, dependiente, educación…). Lo leen el escáner estático y la capa común de publicación:
  **una sola fuente, sin duplicar** (`tipo` puede ser un literal o `this.<getter>.<getter>`, p. ej. el listado base de Configuración
  toma el tipo de `DetallePageClass.NOMBRE_ENTIDAD`, así que las entidades de Configuración no declaran nada más que sus propios datos).
- **Crear vs transformar vs eliminar** (no se confunde con `guardar()`): crear → `produces`; editar un registro existente →
  `requires` + `produces` la misma entidad (transformación); eliminar → `requires` + **invalida** la entidad (`elimina`). Abrir un
  formulario no persiste nada: solo cuenta si el test confirma el guardado de ESA entidad (o el creador `persiste` por sí mismo).
- **Subentidades = entidades propias** (dependiente, capacitación, educación, experiencia, habilidad, documento de capacitación,
  comentario, pregunta…). No se mezclan con la entidad padre; crear una subentidad **requiere** a su padre, que se localiza por el mismo
  mecanismo estructural y toma la entidad producida por el flujo (no "el primer registro"). Un método que sirve a varias entidades
  (`agregarEducacionOExperiencia(tipo, …)`) se distingue por su argumento **literal** (`argumento` + `valor`); si no es literal, no se adivina.
  Dos Page Objects con la misma acción (comentario de requisición / de solicitud) son entidades distintas: las diferencia quien la declara.
- **Eliminar:** el planner ejecuta al eliminador DESPUÉS de todo test que use o produzca esa entidad; dos eliminadores del mismo tipo
  son un error de plan; si aun así un paso la requiere después, `flowHooks` lo bloquea con el motivo. Eliminar no produce, y solo
  queda confirmado si el test que elimina PASA (si falla, `flowHooks` restaura la entidad).
- **No son entidades de flujo** (decisión de negocio, `static get ACCIONES_FLUJO()`): `atributo` (foto, valoración, otros beneficios),
  `relacion` (miembros y permisos de un grupo: *requieren* el grupo producido) y `traslado` (mover datos, p. ej. agregar candidato al
  banco). Un adjunto SÍ es entidad cuando se identifica de forma estable (nombre de archivo sin extensión: la app lo renombra con un sufijo) y existen operaciones posteriores
  (descargar, eliminar); si no hay referencia o consumidores, queda sin modelar hasta decidirlo con negocio.
- **Creación de respaldo:** si el test también *consume* ese tipo (p. ej. "si no hay documento, adjunta uno") la creación no lo vuelve
  productor; se publica igual si ocurre.
- **Publicación real, nunca fantasma:** todo `produces` estructural se publica desde una capa común, no desde cada test: los creadores
  arman la operación y el formulario compartido que confirma el guardado (`confirmadores`, datos de `_datosFlujo()`; en Configuración el
  valor del control `CAMPO_IDENTIFICADOR` declarado por la entidad) la resuelve (`publish` al crear, `update` al editar); los creadores
  `persiste` publican la referencia desde un argumento; los eliminadores invalidan. Es **inerte fuera de un flujo** (no envuelve nada), y
  un `publish` explícito del test en el mismo paso se fusiona sin duplicar. Un productor que pasa sin publicar deja a sus dependientes
  bloqueados (`contrato-incumplido`). Excepción explícita y aceptada: una transición que crea (`cambiar-solicitud-crear-empleado`) no
  tiene operación estructural; conserva su `publish`, y el contrato la acepta; **no se generaliza a otros cambios de etapa**.
- **Contradicciones:** la estructura crea/edita X pero el test publica otra entidad que no consume → error de plan. Ambigüedad
  (varios originadores del mismo tipo con consumidores) se mantiene.
- **Duda de negocio:** si el código demuestra que se crea algo pero no es evidente si es una entidad de flujo, relación o atributo, NO se
  decide por código: se agrupa y se confirma con negocio antes de volverlo contrato.

### Metadata `<modulo>/data/flujo-tests.js`

Hoy conserva solo lo que el código no puede demostrar: el **`orden`** de negocio de una secuencia de transformación
(`orden: { solicitud: 20 }`). Los tests que requieren Y producen la misma entidad (`solicitud → solicitud`) no son un ciclo: el
planner los encadena por ese número (10 paquete · 20 primera entrevista · 30 segunda · 40 tercera · 50 oferta), aunque se elijan
desordenados; los que no declaran `orden` siguen el orden de selección. Es único por tipo y solo para un tipo que el test produce.
Es opcional por módulo; no repetir lo que el código ya dice. La forma antigua (`produces`, `requires` en la metadata) se
sigue aceptando durante la transición y debe coincidir con el código.

### Plan, dependencias y ejecución

- **Planner** (`core/utils/flowPlanner.js`): orden topológico estable (el orden de selección solo desempata). Errores **antes de
  abrir el navegador**: varios originadores del mismo tipo con consumidores (ambigüedad), ciclos, caso repetido, contradicción de
  metadata, dos eliminadores de la misma entidad, y un `requires` sin productor seleccionado **con `auto: false`**. Sin productor y con automático solo avisa: el test
  resuelve el dato solo.
- **Publicar:** lo hace la capa común según el contrato (ver "Producción de entidades"); solo cuando la estructura no lo demuestra el test
  llama `flowContext.publish(tipo, datos)` (o `update`) tras su assert final de éxito. Solo memoria (nunca `execution-context.json` ni
  Panel). Re-publicar en otro paso sube la versión; en el mismo paso se fusiona.
- **Dependencia faltante / bloqueos:** un productor fallido (o que pasa sin publicar) deja a sus consumidores **BLOQUEADOS**
  (pendientes, con motivo; `this.skip()` en `flowHooks`), igual que quien requiere una entidad ya eliminada. **Cancelar** detiene la corrida y marca lo pendiente como Cancelado.
- **Sesión:** `authFlow.login` no repite el login con sesión viva; antes de cada test se vuelve al dashboard. `flowHooks` espera a que
  no quede un notify del test anterior.
- **Entre módulos:** cada caso conserva el `execution-context.json` de SU módulo solo para sembrar/consultar claves; el flujo
  puede cruzar módulos (reclutamiento → nómina) con el mismo driver. Cadena real verificada: `requisicion {nombre, puesto}` →
  `solicitud {codigo, identificacion, nombre, nombreCompleto, requisicion, etapa}` (los transformadores la actualizan) →
  `empleado {codigo, nombre, solicitud}`.
- **Panel:** cada TEST del árbol tiene un checkbox; el Panel guarda la selección **en orden** (`web/js/flujo.js`) y la presenta, no
  planifica. La vista previa sale de `run-flow.js --plan` (mismo planner; no crea carpetas de reportes) y "Ejecutar Flujo" lanza
  `run-flow.js`. El estado en vivo sale de `flow-estado.json` (lo escribe `flowHooks`); los reportes van a
  `flujo/reports/<RUN_ID>/`. Un test individual no cambia.
- Estados, propuestas pendientes y decisiones: `docs/flujos-propuestas.md`. Pendientes: metadata de los demás casos (si algún
  autor decide que participen), historial de flujos.

## 13. Casos de Uso IA (runner independiente, `ia/`)

Probar un **caso de uso (UC) real descrito en un PDF** operando la aplicación con un modelo de OpenAI. Es una **arquitectura aparte**: no usa Mocha, tests,
Page Objects, `flowContext`/planner/metadata ni `requires`/`produces`, y **nunca** se mezcla con Flujos (no hay `flowData` ni equivalente).
Un caso IA no depende de que exista un test. Código solo en `ia/`; el Panel (pestaña "Casos IA") únicamente sube el PDF, lanza
`ia/run-caso-ia.js` con el mismo `lanzador` y muestra `ia/reports/<RUN_ID>/` (evidencia propia, aparte de `reports/` y `flujo/reports`).

- **Qué se prueba: funcionalidad observable, no código.** El agente no tiene acceso al código, la BD ni los servicios y no los valida.
  Tablas, vistas, webservices, métodos, clases, endpoints, selectores, GUIDs o IDs internos que traiga el UC **no son pasos ni condiciones**:
  se traduce a lo funcional observable ("al guardar, la operación termina bien") o se ignora. Los pasos escritos para una persona se
  traducen a acciones de la interfaz; el nombre del UC puede diferir del de la app. Las **reglas de negocio** del UC deciden qué se
  ejecuta y qué se comprueba (llegar al final de los pasos no es PASS). El agente descubre *cómo* llegar a una pantalla, nunca *qué* es correcto.
- **El TEXTO del PDF es la fuente de verdad** (`ia/pdf.js` lo extrae sin dependencias y se entrega como "ESPECIFICACIÓN DEL CASO DE USO").
  Las imágenes son referencia visual **opcional**: el PDF solo se adjunta si trae imágenes de contenido o el texto no se pudo extraer; una
  imagen ausente o no interpretada nunca provoca `BLOCKED` ni `FAIL`.
- **Ciclo:** texto del caso + estado inicial de la app → el modelo elige una herramienta → Selenium la ejecuta (`ia/navegador.js`, reutiliza
  `createDriver`, `authFlow.login` y `UiContext`) → estado en texto (+ captura solo si algo relevante cambió) → el modelo … → `finalizar`.
- **Verificación por observación directa**, no por captura: texto visible, valor de un campo, estado de un control (p. ej. deshabilitado),
  presencia/ausencia, mensaje de la app, navegación (`buscar_texto`, `leer_elemento`, estado de la página). La captura es evidencia adicional.
- **Resultado** (consolidado por el runner, `ia/politicas.js`): `PASS` = el comportamiento se ejecutó y las condiciones funcionales relevantes se
  comprobaron; `FAIL` = se pudo ejecutar pero lo observado contradice lo esperado; `BLOCKED` = imposibilidad real (precondición inexistente,
  pantalla inaccesible, información indispensable ausente, error técnico, ambigüedad insalvable), con el motivo concreto. Cada condición lleva
  estado, método y evidencia escrita; si cita `texto_observado`, debe aparecer en lo que el navegador mostró. Un `BLOCKED` o condiciones sin
  verificar se cuestionan **una vez** antes de aceptarse. Los escenarios que exigen provocar fallos de infraestructura no se prueban ni cuentan.
  Límites: `IA_MAX_ACCIONES` (40) e `IA_MAX_MINUTOS` (20) → `BLOCKED`.
- **Capturas:** todas se guardan en disco; al modelo solo la inicial, las de cambios relevantes (URL, título, diálogos/notificaciones), errores,
  una cada 6 acciones o las que pide (`inspeccionar` con `captura: true`).
- **Seguridad:** lista cerrada de herramientas (sin shell, filesystem ni JS arbitrario); `navegar` solo dentro del origen de `BASE_URL`; el login
  lo hace el runner y las credenciales **nunca** se envían al modelo; el contenido del PDF/página es dato, no instrucción.
- **OpenAI (solo servidor):** el modelo se usa **por API** (Responses, `ia/clienteOpenAI.js`, único módulo que traduce al formato de OpenAI); no hace falta Claude Desktop, Claude Code ni nada instalado en la PC.
  `OPENAI_API_KEY` (obligatoria; credencial de acceso al servicio, nunca en el repo ni en el frontend), `OPENAI_MODEL` (opcional, modelo;
  def. `gpt-6.1-sol`), `OPENAI_REASONING_EFFORT` y `OPENAI_BASE_URL` (opcionales). Van en el `.env` raíz o en `ia/.env`
  (plantilla `ia/.env.example`); el Panel solo sabe si hay key.
- **Regla de configuración:** Casos de Uso IA **reutiliza la configuración y la autenticación de la aplicación existente** (`BASE_URL`,
  `APP_USERNAME`, `PASSWORD` y `authFlow.login`, las mismas de tests y Flujos); no define otro usuario, otro `BASE_URL` ni otro login. Su **única
  configuración externa nueva es la conexión con OpenAI** (`OPENAI_API_KEY`; el resto, opcional). Una PC nueva necesita: Node.js, Chrome,
  `npm install`, la configuración existente del proyecto y la key — pasos en el README ("Casos de Uso IA").
- **Estado:** validado con un servidor falso (tubería) y con un UC real contra OpenAI (`gpt-6.1-sol`, TRIPLE 000035: el modelo separó lo funcional de lo técnico,
  encontró la pantalla pese al nombre distinto, ejecutó el flujo y verificó con texto, estado de controles y el reporte; ver `ia/reports/`). Pruebas: `npm run test:ia`.

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
