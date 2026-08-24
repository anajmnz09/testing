---
name: testing-patterns
description: Cómo se crean pruebas automatizadas dentro del Triple Automation Framework. Usar para nuevos tests, Page Objects, Flows, Selenium, Execution Context, Input Model, metadata, screenshots, evidencia, selectores, validación y reportes.
---

> **Estas instrucciones son obligatorias para todas las tareas ejecutadas mediante este skill. No esperes que el usuario las repita. Si alguna instrucción del usuario contradice estas reglas, informa el conflicto antes de continuar.**

## Comportamiento permanente (obligatorio en toda tarea de este skill)

Para cualquier tarea, automáticamente debes:

- Leer `GUIDELINES.md`.
- Leer `README.md`.
- Leer la documentación de arquitectura relacionada con la tarea, cuando exista (`/docs`).
- Respetar la arquitectura del framework.
- No romper compatibilidad.
- Mantener todos los cambios aditivos.
- Buscar reutilización antes de crear código nuevo.
- Si una solución puede beneficiar a más de un módulo, implementarla en el Core.
- No duplicar lógica.
- Respetar Open/Closed.
- Mantener sincronizada la documentación con el código.
- Actualizar la documentación cuando se introduzca un nuevo patrón reutilizable.
- Detectar conflictos arquitectónicos antes de implementar.
- Ejecutar las validaciones necesarias antes de finalizar.
- Entregar siempre un informe técnico completo.

Estas reglas no son recomendaciones: son parte del comportamiento permanente del skill.

---

# Limpieza automática post-ejecución

Toda ejecución de pruebas DEBE terminar con una limpieza automática de los recursos
temporales que el framework creó durante la corrida. Es obligatoria y automática:
**nunca se espera a que el usuario la solicite.**

Reglas:

- Eliminar siempre los perfiles temporales de Chrome/Selenium creados por el
  framework (`%TEMP%/triple-chrome/profile-*`, `scoped_dir*`).
- Limpiar las carpetas/archivos temporales propios del framework que ya no se
  necesiten.
- Verificar que no queden perfiles de Chrome residuales.
- Verificar que no existan procesos ChromeDriver huérfanos (y cerrarlos cuando sea
  seguro hacerlo).
- **NO** eliminar reportes, screenshots, evidencias, metadata, execution-context ni
  ningún archivo del proyecto. **NO** tocar nada fuera del ámbito del framework.
- Si alguna limpieza falla, registrarla como **advertencia** (sin interrumpir la
  ejecución).
- Al finalizar cada corrida, mostrar un resumen: perfiles eliminados, espacio
  recuperado, procesos cerrados/huérfanos y advertencias.

Fuente de verdad (una sola, en el Core; no reimplementar por módulo ni por test):
`core/utils/chromeProfiles.js` (perfil propio + `limpiarPerfiles`/`barrerViejos`),
`core/utils/driver.js` (`quitDriver` borra el perfil de cada sesión) y el resumen
post-corrida en `core/scripts/run-tests.js`. Ver README §Cómo correr las pruebas y
GUIDELINES §11.

---

# Validación obligatoria de pruebas E2E

Estas reglas son obligatorias para todas las tareas ejecutadas mediante este skill.

## Ejecución real de pruebas E2E

Está prohibido afirmar que un test E2E fue ejecutado, validado o verificado si Selenium
no controló realmente un navegador durante esa corrida.

Una prueba E2E solo se considera ejecutada cuando ocurrieron **todos** estos pasos:

- creación del WebDriver;
- apertura de una instancia real de Chrome;
- interacción real con la aplicación mediante Selenium;
- cierre correcto del navegador al finalizar.

Si alguno de esos pasos no ocurrió, debes indicar explícitamente que **el test NO fue
ejecutado**, aunque se hayan realizado compilaciones, análisis estáticos, unit tests,
mocks, revisiones de código o cualquier otra validación.

## Headed vs Headless

Después de cada ejecución E2E debes indicar explícitamente el modo de ejecución utilizado:

- **Modo Headed (Chrome visible):** el navegador fue abierto y pudo observarse la interacción en pantalla.
- **Modo Headless (Chrome no visible):** el navegador se ejecutó sin interfaz gráfica.

Nunca omitas esta información.

## Evidencia mínima obligatoria

Cuando informes que ejecutaste una prueba E2E debes incluir, como mínimo:

- comando ejecutado;
- nombre exacto del test;
- modo de ejecución (Headed o Headless);
- duración;
- resultado (PASS o FAIL);
- evidencia generada (reporte, screenshots, logs o equivalente).

Si no puedes proporcionar esa información, debes indicar que la prueba no fue ejecutada
realmente y explicar el motivo.

## Prohibición de inferencias

Está prohibido deducir que un test pasó únicamente porque: compila; los unit tests pasan;
el código parece correcto; existe una corrida previa; o el comportamiento puede inferirse.
Solo pueden reportarse resultados obtenidos durante la corrida actual.

## Transparencia

Nunca presentes una validación estática como si fuera una ejecución E2E. Si únicamente
realizaste una revisión del código, debes decir explícitamente:

> "Se realizó únicamente una validación estática. No se ejecutó ninguna prueba E2E."

## Compatibilidad

Estas reglas son permanentes y complementan las ya existentes. No reemplazan ninguna otra
política del skill; simplemente fortalecen el proceso de validación y reporte de pruebas E2E.

---

# Eficiencia de contexto — leer lo necesario, nunca menos de lo necesario

Minimizá lectura y comandos redundantes. Pero esto NUNCA es excusa para no verificar
algo importante: si confirmar un selector, un flujo, un parámetro o un supuesto
heredado requiere inspeccionar la pantalla real, hacelo — preferí una investigación
de más antes que generar código sobre una suposición (ver "Descubrir y Verificar"
más abajo, que es la regla que manda cuando compite con esta).

- Buscá primero (`grep`/`find`) el símbolo/método/clase antes de leer un archivo
  completo; leé el archivo entero solo cuando haga falta entender su estructura
  global o el cambio lo requiera.
- No releas archivos ya analizados en esta sesión salvo que cambiaron, los
  modificaste vos, o hay evidencia de que quedaron desactualizados.
- No leas logs/reportes completos: extraé con búsqueda acotada (`grep`/`rg`/
  `Select-String`/`findstr`) solo el test, la excepción y el stack relevantes.
- No listes directorios completos (`ls -R`, `find .`, `tree`) salvo pedido
  explícito del usuario.
- Agrupá los cambios compatibles y corré Selenium una sola vez al finalizar el
  desarrollo — salvo que necesites confirmar en vivo un selector/flujo/parámetro
  del que no tenés certeza: eso se investiga siempre, sin importar el costo.
- Informes breves: archivos modificados, resultado, bloqueos, próximo paso. No
  repitas contexto ya comunicado en la conversación.
- Antes de una acción costosa (lecturas masivas, muchos comandos, varias
  corridas), preguntate si ya podés responder con lo que tenés.

Modelo recomendado: Sonnet 5 para desarrollo cotidiano (Page Objects, Selenium,
helpers, tests, documentación). Opus para arquitectura compleja, investigaciones
profundas o causa raíz difícil.

---

# Triple Automation Testing Patterns

## Purpose

This skill defines how automated tests are created inside the Triple Automation Framework.

Use this skill whenever the request involves: new automated tests, Page Objects, Flows,
Selenium, Execution Context, Input Model, metadata, screenshots, evidence, selectors,
validation, reports.

## Primary Mission

Create tests that fully respect the framework conventions. Never create isolated
implementations. Every new test must reuse the existing infrastructure — but
infrastructure only counts as reusable once it's confirmed compatible with the
concrete screen (see "Discover and Verify" below), not because it worked elsewhere.

## Discover and Verify — before reusing any infrastructure

Similarity to another screen is NOT evidence. Before extending a generic base class
(`ConfiguracionEntidadListadoPage`, `ConfiguracionEntidadDetallePage`, or any other
reusable Page Object) for a NEW entity, confirm with real Selenium — never by
analogy — that its generic mechanisms actually apply to THAT screen: the "screen
loaded" selector, the "record name" selector, the access path into Editar, the
search box. An inherited selector that was never checked against the real DOM counts
as an "uncertain identification" (`GUIDELINES.md §5`): don't guess it — verify it or
fail explicitly.

Before implementing, map every real mode of the screen (listing, consulta, edición) —
not just the Crear form. Before registering a non-form case's parameters, test the
screen's actual search/filter criteria live — see "Non-form Tests" below.

A test is not finished when the file compiles or the Page Object looks right. It's
finished when: the reused selectors were confirmed live, the parameters were
confirmed to cover every real way to drive the scenario, and — for a parametrized
case — `execution-context.json` (or the Panel) was actually checked to contain the
registered keys, not assumed from the code.

**Incident — inherited selector (2026-08-21):** Usuario's consulta view has no
`[class*="forms-header"]`, but the test inherited that "screen loaded" wait from
`ConfiguracionEntidadListadoPage.abrirDetalle()` without checking — confirmed
`TimeoutError` against the real screen. Lesson: never reuse a base class's "loaded"
selector without confirming it exists on the new screen.

**Incident — incomplete query criteria (2026-08-21):** `consultar-usuario` was
registered with only a `nombre` parameter, copied from another entity's pattern,
without testing what this specific screen's search actually supports. Live
confirmation: the global search box finds a user by "Código de usuario" too, even
though that column isn't even visible in the grid. Lesson: "no parameters" or "one
parameter" is a decision made AFTER testing the screen's real search criteria, never
by copying the previous screen's pattern.

**Incident — incomplete Execution Context (2026-08-21):** of 6 new test files, 5
were never executed (individually or via a whole-module run) before being reported
as done — their parameters, though declared correctly in code, never reached
`execution-context.json`, so the Panel showed them as requiring no input. Lesson: a
test isn't "done" until you confirmed — by reading `execution-context.json` or the
Panel, not by assuming — that its parameters actually got registered.

## Naming

Descriptive names are the single source of truth. Never use TC-001, TC-002, etc.
Everything derives automatically from the descriptive name: filename, logger, execution
context, screenshots, reports, evidence.

## Forms

Form-based tests always use the Input Model. Official flow:

```
Form → ESTRATEGIAS → Input Model → Execution Context → Automation Panel → TestContext
     → Form.completarDesde() → Autofill only empty fields
```

Never invent parameter names. Never create manual parameter lists. User values always
override autofill. Concretely: seed with `registrarCasoDesdeFormulario(CASO, ESTRATEGIAS)`,
fill with a Page Object method that composes `Form.completarDesde()` (e.g.
`completarRequeridosConContexto`), and validate the map with `validarControlesDeclarados()`.

### ESTRATEGIAS must declare EVERY real control, not just the ones the test autofills

`ESTRATEGIAS` is the single source of truth of what controls a form HAS
(`GUIDELINES.md §Forms`) — not just the ones a given test happens to fill. A control that
exists in the app but is deliberately never autofilled (e.g. a switch that defaults ON, where
blind autofill would wrongly turn it off) still belongs in `ESTRATEGIAS`. Leaving it out to
dodge an autofill side effect breaks the single-source-of-truth contract and silently disables
`validarControlesDeclarados`'s ability to ever flag that control.

**Real incident (2026-08-20):** `ComportamientoConceptoNominaDetallePage.ESTRATEGIAS` declared
only 2 of the form's 4 real controls (`Concepto`, `Tipo Nómina`), omitting `Todos los
intervalos` (switch, defaults ON) and `Intervalo` (disabled while the switch is ON) — because
declaring the switch would have let the generic autofill force it OFF (breaking Guardar via
the newly-required `Intervalo`). The test itself also seeded its Execution Context with a
hardcoded manual list (`registrarCaso(CASO, ['Concepto', 'Tipo Nómina'])`) instead of
`registrarCasoDesdeFormulario` — the exact anti-pattern this section already prohibited — and
never called `validarControlesDeclarados`, so nothing ever warned that the map didn't match the
UI. Both gaps existed only in this one test; every sibling `crear-*` test in the same batch was
already compliant.

**Fix, and the pattern to reuse:** for a switch whose default isn't "off", declare it with
`{ estrategia: 'switch', soloSiDirigido: true }` (`core/strategies/builtinStrategies.js`,
`SwitchStrategy`). With no value directed from the Panel, the switch is left INTACT at its
current state instead of being forced off; with a directed value, it applies normally. This is
a Core-level option (benefits any switch in any module with a non-off default), not a per-test
workaround.

### `validarControlesDeclarados` is mandatory, not optional, when a test skips `completarConContexto`

`ConfiguracionEntidadDetallePage.completarConContexto()` already calls
`Form.validarControlesDeclarados()` internally — so most `crear-*`/`editar-*` tests get the
sync check for free. But a test with special filling logic that bypasses
`completarConContexto` (e.g. one that resolves values via QA fixtures instead of reading the
Execution Context directly, like `crear-comportamiento-concepto-nomina`) loses that check along
with it. **Any such test MUST call `form.validarControlesDeclarados(ESTRATEGIAS)` explicitly**,
right after opening the form, before filling anything. This is not optional cleanup — it is the
only thing that would have caught the incident above automatically.

## Automatic-mode default rename in "editar-*" tests: bounded "QA-N", never random/growing

Some `editar-*` tests rename the record's own identifier field (the one text field with no
other "safe" free-text field to touch, e.g. "Beneficio", "Departamento", "Habilidad",
"Nombre Plan de seguro", "Proveedor", "Razón") as their fallback default — but ONLY when the
Panel did not direct ANY field for that case (`Object.keys(cambios).length === 0`). This
fallback must use `siguienteNombreQA(nombreUsado)` (`configuracion/support/nombresQA.js`):
`"QA-1"`, `"QA-2"`, … — never `` `${nombreUsado} EDITADO ${Date.now()...}` `` or any other
random/timestamp suffix concatenated onto the current name.

**Why:** the old pattern concatenated onto whatever name the record ALREADY had. The
automatic fallback (`abrirPrimero()`/first row, no Panel-directed search) re-edits the SAME
record every run with no Panel involved, so the name grew by a random suffix every single
run — confirmed with real evidence on "Nombre Plan de seguro" (`maxlength` 50): after enough
automatic runs the name exceeded the field's max length, the app silently truncated what got
typed, and the final assert correctly failed against the truncated value (a real bug, not a
flaky assert). `siguienteNombreQA` fixes this by reading the CURRENT name: if it already
matches `QA-N`, the next run is `QA-N+1`; otherwise it starts over at `QA-1` — the name never
grows past a couple of characters per run, so it takes thousands of unattended runs on the
same record to approach any realistic `maxlength`. It also means a record left with a
corrupted/truncated name from a past failure self-heals on its next automatic run (it won't
match `QA-N`, so it resets to `QA-1`).

**Scope — automatic mode ONLY, never touches Panel-directed fields:** this rename applies
strictly to the `if (!Object.keys(cambios).length)` fallback branch — i.e., only when the
Panel did not direct a single field for that case. The moment the Panel directs ANY field
(including the identifier field itself), `cambios` is built entirely from
`testContext.get(CASO, label)` and the fallback branch never runs — a Panel-directed value is
used exactly as typed, verbatim, with NO suffix, NO random number, and NO call to
`siguienteNombreQA` appended to it. Never wrap or append anything to a Panel-directed value;
never call `siguienteNombreQA` outside that one `if` branch.

## Automatic-mode default name in "crear-*" tests: Panel-directed values are never suffixed

Some `crear-*` tests need the identifier field to be unique on every run (the app rejects
duplicate names), so the automatic fallback appends a short unique suffix (timestamp) to a
base QA name. That suffix must ONLY apply to the automatic fallback — it must NEVER be
appended to a value the Panel directed. Use `nombreUnicoQA(dirigido, base)`
(`configuracion/support/nombresQA.js`): if `dirigido` (`testContext.get(CASO, label)`) has a
value, it's returned EXACTLY as given, with no suffix; only when nothing was directed does it
build `` `${base} ${timestamp}` ``. Do not hand-roll a local `sufijoUnico()` + string
concatenation that appends to `dirigido || base` — that always suffixes, directed or not,
which was the actual bug (fixed across all 11 `configuracion/tests/crear-*.test.js`).

**Why:** the old per-file pattern was `` `${testContext.get(CASO, label) || BASE_QA}
${sufijo}` `` — the suffix landed on the RESULT of the fallback, not on the fallback branch
itself, so it applied unconditionally. A Panel-directed name like "Banco Popular" was saved
as "Banco Popular 293688" — a different value than what was actually asked for, silently.
`nombreUnicoQA` fixes this the same way `siguienteNombreQA` (see above) fixes the analogous
`editar-*` bug: the random/timestamp part is confined strictly to the "nothing was directed"
branch.

## Non-form Tests

Examples: publish requisition, pause requisition, share requisition, import documents,
consult/search screens, and any test that does NOT fill a form with data. Use
`registrarCaso()` — do not generate an Input Model.

"Minimum parameters required" means the smallest set that still covers every real way
the scenario can be driven — NOT the smallest set that happens to make the test run.
"This screen can execute without typing anything" is not the same statement as "this
scenario has no real parameters." Before registering, verify live (see "Discover and
Verify" above) every distinct way the screen can be searched/targeted — a global
search box, per-column filters, a lookup by an ID/code that isn't even a visible
column — and register a parameter for each one that's a legitimate way to drive the
scenario.

## Selectors

Never use indexes, DOM order, visual order, base64 or fragile selectors. Prefer accessible
name, title, aria-label, visible text, metadata, data-testid. If identification is
uncertain: do not guess — fail explicitly, generate diagnostics, attach evidence. This
applies equally to a selector inherited from a reused base class — see "Discover and
Verify" above.

## Reading DataGrid rows without opening the detail

Many of this app's listing grids (DevExtreme DataGrid) already expose business-relevant
columns directly in the row (e.g. Etapa, Estado) — checking or filtering by those values
does NOT require opening each record's detail view. Reuse `DataGrid.filasPorColumnas()`
(all visible rows, each as `{Header: "cellText", ...}` keyed by the real column header) or
`DataGrid.leerFilaPorColumnas(texto)` (the single row containing `texto`) — both already in
`core/components/DataGrid.js`. Do not re-implement header/row scraping per test; if a case
needs "find the first row matching some criteria" or "verify a column value before/without
opening the record", filter/read from these first. Comparisons against grid text should be
case-insensitive — see "Text comparisons must be case-insensitive" below.

## Text comparisons must be case-insensitive

Any comparison against text rendered by the app — DataGrid cell, form field, detail-page
field, screen/popup title, notify text, anything read back from the UI — must be
case-insensitive. The app (or a value typed from the Panel/Execution Context) may render the
same value with different casing (`"Inactivo"` vs `"inactivo"`, `"EMPLEADO"` vs `"Empleado"`);
that difference is NOT a real failure and must never fail a test.

Use the shared helper for this — do not write `.trim().toLowerCase()` by hand in a test or
Page Object:

```js
const { assertTextoIgual } = require('@triple/core'); // or require('@triple/core/utils/assert')

assertTextoIgual(actual, esperado, `"${label}" no quedó en "${esperado}" (quedó "${actual}").`);
```

`assertTextoIgual` (`core/utils/assert.js`) trims and lower-cases both sides before comparing,
throws `AssertionError` with your message on mismatch (same assertion semantics as
`assert.strictEqual`), and requires both arguments to be `string` — it does NOT coerce
numbers/booleans/other types to text. Numeric or non-text comparisons (e.g. a formatted
salary, a star rating) keep using `assert.strictEqual`/`assert.equal` directly with their own
normalization (e.g. `parseFloat`), never this helper.

If you find yourself writing `.trim().toLowerCase()` (or any other manual case-normalization)
directly in a test, that is a sign it should be `assertTextoIgual` instead — the manual form
duplicates the rule and can drift (e.g. only trimming, or forgetting the case-fold on one
side).

The same rule applies to LOCATORS, not just assertions. A hand-rolled XPath like
`` `//tr[.//td[contains(normalize-space(.), '${texto}')]]` `` is case-sensitive (XPath 1.0 has
no case-insensitive `contains()`), even when the grid's own live search box already filters
case-insensitively on the client — the row visibly appears, but the locator built from the
same search text times out because it can't match it. Use
`containsTextoIgnoreCase(texto, expresionXPath)` (`core/utils/xpath.js`) to build that
condition instead of writing `contains(normalize-space(...), '${...}')` by hand — it wraps the
DOM side in `translate()` and lower-cases the searched value, so both sides compare
case-insensitively. `DataGrid._filaLocator()` already uses it; reuse `grid._filaLocator(texto)`
from a Page Object's `abrirDetalle`/row-matching method instead of duplicating the XPath.

## Repeatable "add via popup" widgets (multi-value, optional catalog match)

Some sections are not a Form field but a small table + an "add" button (accessible via
`aria-label`, e.g. `add`) that opens a popup with its own fields (a catalog selectbox, a
value input, and often a "keep it open to add another" checkbox — verified pattern:
`SolicitudEmpleoDetallePage.agregarOtroBeneficio`/`agregarBeneficios` for "Otros
beneficios"). For a Panel/Execution Context field that should accept several values in one
run, split on `|` with `parsearValoresMultiples` (`@triple/core/strategies`) — the
framework-wide multi-value convention, already used for tags/options fields. When the
target control is a NON-required catalog match (selecting from a fixed list, not free
text) and the section itself is optional, a value that does not match any catalog option
(tolerant match via `Form._itemVisiblePorTexto`, catches its thrown error) should be
discarded silently rather than failing the case — log it and move on. Don't invent a
bespoke "strict mode"; only add one if a future case explicitly needs the field to be
required.

## Validation

Every test should verify: expected UI state, expected notifications, expected persistence,
expected navigation, expected business behavior. Whenever possible verify both positive and
negative scenarios.

### Text comparisons: leading/trailing whitespace is never significant

In assertions of text values, leading/trailing whitespace must never affect the result.
Normalize with `trim()` before comparing — this applies to BOTH sides: the value coming
from the Execution Context/Panel and the real value read from the UI. `"DEPARTAMENTO QA "`
and `"DEPARTAMENTO QA"` must be treated as equivalent; so must `"  Transporte  "` and
`"Transporte"`. Never strip INTERNAL whitespace — `"DEPARTAMENTO QA"` must never become
`"DEPARTAMENTOQA"`; only the two ends are trimmed.

Root cause this fixes: a user typing a value into the Panel easily leaves a trailing space
("DEPARTAMENTO QA "); the app itself trims it on save, so the real UI value never has it —
without this normalization, an assert comparing the raw Execution Context value against the
UI value fails on an invisible character, not a real difference.

Enforced centrally, once, in `testContext.get()` (`core/context/testContext.js`): every
value read from the Execution Context is already `trim()`-ed before it's returned, so
Page Objects and tests do NOT need to call `.trim()` on values obtained via
`testContext.get()`/`testContext.getODescubrir()` — reading it is already the normalized
value. Do not re-implement this per test or per Page Object; if a new central read path is
ever added (bypassing `get()`), normalize there the same way instead of patching call sites.
Values actually read FROM the DOM (`Form.getValor()`, a Page Object's own `getNombre()`/
`getValor()`/`esperarValor()`, etc.) still need their own `.trim()` at the read point, same
as before — this rule doesn't change that side, it fixes the Execution Context side, which
was the actual gap.

## Evidence

Always reuse Evidence, Problem Log, Screen Inspector, Screenshots, Execution Context. Never
create custom evidence systems.

## Ambient noise: the "Generación de nómina" toast

This shared QA environment runs a background "Generación de nómina" process (from another
user/session, not this test) that renders a toast using the SAME `notify_record` class as the
app's real Guardar/Crear/Editar toast, mutating its own text through stages ("Generación de
nómina" → "Verificando proceso..." → "Nómina:Cargando Nómina...Período:Cargando
Períodos...Usuario:Lyanne"). It can appear on ANY screen, unrelated to what the test is doing.

This is already filtered centrally in `core/components/Notify.js#getTexto()` — it excludes any
`notify_record` node whose text matches `/n[oó]mina\s*:|per[ií]odo\s*:|verificando proceso/i`.
**Never re-implement this filter per test** (no ad-hoc regex, no manual text matching for this
toast in a Page Object or test file) — `Notify.getTexto()`/`esperarTexto()`/`esperarResultado()`
already handle it for every case that reads a notify through the normal framework path.

The filter is a GENERAL, configurable setting — not hardcoded: `config.ruido.ignorarToastNomina`
(env var `IGNORAR_TOAST_NOMINA`, default `true`). Leave it at the default for all normal test
work. The one time to flip it (`IGNORAR_TOAST_NOMINA=false` in `.env`) is when the work ITSELF is
testing the "Generación de Nómina" feature and a case genuinely needs to read that toast as the
real notify — turn it back to the default afterward.

Confirmed with real evidence (2026-08-19): this toast does NOT contain any `loader-manager`-class
element, so it is never what `esperarSinLoader` (`core/utils/UiContext.js`) is waiting on — if a
screen hangs while this toast happens to be visible, look for an actual stuck loader on that
screen (e.g. the documented "Distribución de Pago" bug in `TipoNominaDetallePage`) rather than
assuming the toast itself is blocking the interaction.

## Recovery

Never abandon the application after a failure. Reuse the existing recovery strategy whenever
available.

## Documentation

Whenever a new testing pattern is introduced, update README, GUIDELINES, examples and
document the pattern.

## Panel organization and case description (mandatory for every new test)

Every new test case must be registered in its module's `data/organizacion-tests.js`
(create the file if the module doesn't have one yet, following the same shape as
`reclutamiento/data/organizacion-tests.js`). This file is what the Automation Panel reads
to group cases in its tree and to render the description block — it is NOT derived from
the filename anymore (the old "first hyphen segment" grouping is deprecated).

Each entry needs:
- `seccion`: the real section of the app the test belongs to (e.g. "Requisiciones",
  "Solicitudes" — mirror the app's own navigation, not an invented taxonomy). Ask the user
  if unsure which section a new test belongs to, or if the app doesn't have that section
  yet.
- `categoria`: what the test DOES within that section (e.g. "Agregar", "Crear",
  "Compartir", "Consultar", "Editar"; use "Otros" only when nothing more specific fits).
- `descripcion`: ONE short sentence, in Spanish, stating plainly what the test does (e.g.
  "Pausa una requisición que se encuentra autorizada."). This renders in the Panel between
  the case header and the "Ejecutar" button — do not restate the case name, do not
  describe implementation details, just the business action.

A test that is pure FLOW (login, navigation, opening a listing as a setup step — not a
business action on its own) must NOT get an entry: it stays out of the Panel's grouped
tree on purpose, while remaining a normal runnable test.

The Panel also renders a SECOND, FIXED paragraph after the per-test description — same
text for every case, already implemented in `panel/web/js/detalle.js`, describing the
automatic-vs-directed execution behavior (Execution Context / Screenshots). Do not
duplicate that paragraph in `descripcion`; it is appended automatically.

## Checklist

Before finishing verify: reused infrastructure was confirmed against the real screen (not
assumed from similarity); no duplicated logic; correct naming; selectors verified live;
Execution Context updated **and confirmed** (read `execution-context.json` or the Panel —
declaring it in code is not enough); evidence generated; compatibility preserved;
documentation updated; new case registered in `organizacion-tests.js` (section, category,
one-sentence description) unless it's a pure flow test.

## Expected Output

Implementation plan. Affected files. Compatibility analysis. Potential risks. Validation
steps. Recommended reusable abstractions. Final implementation following the framework
conventions.
