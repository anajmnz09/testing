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

## `KEEP_BROWSER_OPEN` al correr Selenium por tu cuenta

Cuando vos (el asistente) lanzás un navegador para investigar/reproducir/verificar
algo — no una corrida disparada desde el Panel — siempre pasá
`KEEP_BROWSER_OPEN=false` como override de esa invocación puntual, sin importar lo
que diga `.env` (nunca lo edites para esto). Ver `GUIDELINES.md §11
KEEP_BROWSER_OPEN` para el detalle completo y el porqué.

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

**Incident — declared-but-ignored control (2026-08-26):** `crear-usuario` and
`editar-usuario` declared "Es administrador"/"Tiene acceso a RRHH" as `'switch'` in
`ESTRATEGIAS` (so `validarControlesDeclarados` recognizes them) but excluded both
labels from `completarConContexto`/the field loop by design. Declaring a control is
what makes `registrarCasoDesdeFormulario` seed it into `execution-context.json` AND
makes the Panel render it as a live, tickable checkbox — that part is automatic and
NOT tied to whether the test actually reads the value. The result: the Panel showed
a real checkbox for those two fields under `crear-usuario`/`editar-usuario`, the user
ticked it expecting it to apply, and nothing happened — not a rendering bug (the
Aug-19 switch/checkbox fix still worked correctly), the test code was silently
throwing the value away. Lesson: an `excepto`/manual-skip list is invisible from the
Panel — before excluding a declared control from being applied, check whether that
exclusion is still the intended behavior, and if it's permanent, say so in the
docblock loud enough that a Panel user isn't misled by a checkbox that does nothing.
If the field needs its own verification mechanism once un-excluded, wire that up too,
not just the write path: a boolean switch needs its own poll-and-compare (e.g.
`esperarInterruptor` + `assert.strictEqual`), never the generic text-field path
(`esperarValor`/`assertTextoIgual` read/compare rendered text, not a pressed/checked
state).

**Incident — grid re-sorts instead of filtering; unchanged row count is not proof the
search is broken (2026-09-02):** Investigated Empleados' list search by comparing row
COUNT before/after searching (full name, partial name, exact employee code) — count
stayed the same (50) every time, over a couple seconds — and concluded the search box
was non-functional, filing it under the same known "Horarios search is broken" pattern
(a real, separate, already-confirmed bug elsewhere). Wrong, per the user: this screen's
search is supposed to work by putting the best match FIRST rather than removing rows.
Re-investigated with much longer waits (headed, native clicks, up to 20s, 4 independent
runs): in "Modo lista" the search reliably fires a real request (loader visible ~14s)
that this environment currently resolves to 0 rows even for an exact, on-screen name —
while the SAME input in "Modo tarjeta" (card view) filters instantly and correctly.
Likely an environment/API hiccup on this specific endpoint, not a mis-integration —
left the Page Object coded for the CORRECT behavior (search, then wait for the FIRST
row to reflect the match, then open it) with a timeout sized to the observed ~14s
round-trip, so it starts working the moment the endpoint stabilizes; see
`EmpleadosPage.abrirDetalle`. Lesson (still the core one): after searching, check
whether the FIRST row eventually changes to match the query — with a REALISTIC wait,
not 1-2s — before concluding a search is broken or has no effect. Never skip the search
box and text-match across all rendered rows instead: that silently breaks once a
matching record isn't on the first/only visible page, and hides a real API problem
behind a workaround instead of surfacing it.

**Incident — false PASS from an unread race between "loader gone" and "rows
rendered" (2026-09-03), generalizing the lesson above beyond search:** the
2026-09-02 incident above was scoped to `abrirDetalle`'s SEARCH endpoint —
never generalized to the plain, unfiltered listing load. `DataGrid.listo()`
only waits for the loading OVERLAY to disappear (`esperarSinLoader`); it does
NOT guarantee the grid finished inserting its `.dx-data-row` elements.
`contarFilas()`/`filasPorColumnas()` used to be single-shot reads (one
`findElements`/`executeScript`, no poll, no retry). Confirmed with live
Selenium evidence (Empleados, real data present, same login session):
refreshing the SAME screen 5 times in a row with nothing else changing gave
`0, 50, 0, 50, 50` — and a "0" reading fixed itself within 1-2s without any
further action. Every `editar-*`/`consultar-*` test across all 3 modules that
used `if (!(await grid.contarFilas())) { ...; return; }` as its "is there
data to test" guard inherited this false negative — and because the guard
used a plain `return` (not `this.skip()`), Mocha reported "passed" exactly
the same as a real, fully-verified run: Selenium DID open a real browser and
DID load a real screen (satisfying "Ejecución real de pruebas E2E" above),
but the business flow, its assertions, and any meaningful evidence never
ran — the screenshot from `SCREENSHOT_MODE=all` (a generic "Resultado final"
capture, not a targeted one) was the only artifact, and it looked
indistinguishable from a real pass in the Panel. Fixed at the root:
`DataGrid.contarFilas()`/`filasPorColumnas()` (`core/components/DataGrid.js`)
now poll up to `config.timeouts.explicitWaitMs` before accepting `0`/`[]` as
a confirmed result — returning immediately once rows appear, so the
data-present case pays no extra delay. **Lesson, now a hard rule:** a single
`findElements`/`executeScript` read immediately after `listo()` can NEVER be
trusted to mean "no data" — it can only mean "no data yet, as far as this one
read could tell." Never write a NEW "is there data" check without going
through the (now-fixed) `contarFilas`/`filasPorColumnas`, and never
reintroduce a single-shot read as a shortcut around them.

**Rule — after a confirmed empty state, decide FAIL vs SKIP explicitly, per
entity, and say so in the docblock (established 2026-09-03, Empleados):**
once the read above is reliable, "0 registros" still needs a decision: is
this entity a persistent catalog the app is expected to always have at least
one record of (FAIL — the precondition of the scenario wasn't met), or a
genuinely optional/ephemeral one (SKIP, via `this.skip()`, never a silent
`return`)? This is a per-entity judgment call, not a framework default —
don't assume one without checking with the user first. Precedent: Empleados
was classified as a persistent catalog (the suite assumes at least one
Employee always exists); its `editar-*`/`consultar-*` guard clauses now call
`assert.fail(...)` with a message naming the two most likely real causes (a
new company with no seed data, or an API/environment problem) instead of
returning silently — see any `empleados/tests/{consultar,editar}-*.test.js`
for the exact wording to reuse. Whichever way an entity is classified, a
silent `return` that lets the test report "passed" with zero assertions
executed is never acceptable again.

**Rule — "antes/después" evidence on every `editar-*` test, not just a final
screenshot (established 2026-09-03, generalizing `configuracion/tests/
editar-usuario.test.js`'s pattern, previously undocumented — it only lived as
an unwritten convention in that module's test code):** an edit test must
capture, explicitly:
1. A screenshot labeled "... ANTES de editar" right after confirming the
   record/section is open (before entering edit mode).
2. The change, applied and saved.
3. Re-verification of EACH changed field via `Form.esperarValor(label,
   valorEsperado)` (poll, not a single `getValor()` read — the same
   loader/render race as above applies to reading a value back after
   Guardar) — never trust the plain `getValor()` immediately after a save.
4. A screenshot labeled "... DESPUÉS de editar", taken AFTER step 3 resolves.
5. `assertTextoIgual` against the value `esperarValor` actually settled on.

`SCREENSHOT_MODE=all`'s automatic end-of-test screenshot is NOT a substitute
for steps 1 and 4: it captures whatever the LAST screen happens to be, with a
generic label, regardless of whether the edit actually happened — it proves
"the test ended here," never "this is what changed." See
`empleados/tests/editar-datos-basicos.test.js` for a second reference
implementation of this pattern outside `configuracion`.

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

**Incident — the rule was documented correctly but implemented wrong in half the files
(2026-08-27):** the case-level check above (`if (!Object.keys(cambios).length)`, evaluated
AFTER the field loop) is the only correct implementation. A tempting but WRONG variant writes
the same intent as a per-field check INSIDE the loop instead:

```js
// WRONG — fires whenever THIS field is empty, regardless of what else was directed
for (const label of Object.keys(EntidadDetallePage.ESTRATEGIAS)) {
  const dirigido = testContext.get(CASO, label);
  if (dirigido !== undefined) {
    cambios[label] = dirigido;
  } else if (label === 'Nombre') {
    cambios[label] = siguienteNombreQA(await detalle.getValor(label));  // ← bug
  }
}
```

This reads as "fall back to the default if this field wasn't directed" — which sounds right
in isolation, but ignores every OTHER field the Panel might have directed. Confirmed real:
a user directed the record to open AND a value for "Descripción", left "Nombre" blank
expecting it untouched — the record got renamed anyway, because "Nombre" alone being empty
was enough to trigger the fallback. Audited all 12 `editar-*` cases in `configuracion` against
this exact pattern: 6 already used the correct case-level check (`editar-beneficio`,
`editar-departamento`, `editar-habilidad`, `editar-plan-de-seguro`,
`editar-proveedor-seguro`, `editar-razon-salida`); 6 had the per-field bug
(`editar-categoria-actividad`, `editar-concepto-nomina`, `editar-cuenta-contable`,
`editar-grupo`, `editar-tipo-nomina`, `editar-usuario`) and were fixed to match. Lesson: when
writing a NEW `editar-*` case, copying the field-loop structure from an EXISTING file is not
enough — cross-check the fallback specifically against the `if (!Object.keys(cambios).length)`
shape in this section, since a buggy sibling file is just as easy to copy from as a correct
one and reads just as reasonably on its own.

## `editar-*`: the SEARCH key must be named distinctly from real form fields, per entity

Every `editar-*` test that lets the Panel direct WHICH record to open needs its own
search/identify key — the label used ONLY to find the record, never applied as a form
value. That key's name must be **descriptive and entity-specific**, spelling out both
the entity and that it identifies the record to edit — never a bare, generic word that
could be confused with (or collide with) a real editable field of that same form.

**Established pattern to copy:** `configuracion/tests/editar-usuario.test.js` names it
`CLAVE_BUSQUEDA = 'Nombre de Usuario a editar'` — deliberately distinct from "Nombre
Completo" (the real, editable field on that same form), with its own comment saying so.
For a new entity, the equivalent is `"Nombre de <Entidad> a editar"` (or whatever real
identifying attribute that screen searches by — code, not necessarily name, if that's
how the screen's search actually works, per "Non-form Tests"/"Discover and Verify"
above) — never just `'nombre'`.

**Incident — Empleados' `editar-*` used a bare `'nombre'` (found 2026-09-03, fixed):**
all 4 `empleados/tests/editar-*.test.js` declared `CLAVE_BUSQUEDA = 'nombre'` — generic,
lowercase, not entity-qualified. It didn't collide with a real field of THAT form
("Primer Nombre"/"Segundo Nombre" are different labels), but it read ambiguously in the
Panel among the real fields and didn't follow the established naming shape. Fixed to
`'Nombre de Empleado a editar'` across all 4, matching `editar-usuario`'s pattern.
**Lesson:** when writing a NEW `editar-*` case, don't default the search key to the
entity's bare identifying word (`'nombre'`, `'código'`, etc.) just because it reads
naturally in isolation — name it as a search key, explicitly, every time, even when
it happens not to collide with any real field on that particular form today (a form can
grow a same-named field later, and an ambiguous key is a foot-gun for the next person
reading the Panel regardless).

## General rule: the identifying-entity field goes FIRST, and code order ≠ persisted order

This generalizes the previous section beyond naming: **whenever a case represents an
operation on a specific person/entity (edit their data, add a child record to them,
etc.), the parameter that identifies WHO — the search key, or "who does this new record
belong to" — must be seeded FIRST, before every other field.** Not just for `editar-*`,
not just for one module: any case with this shape, present or future
(`editar-*`, `agregar-*` against an existing parent, any future pattern that fits).

**Two separate mechanisms, both already correct by design — use them, don't reinvent:**

- `registrarCasoDesdeFormulario(CASO, ESTRATEGIAS, clavesExtra)` seeds `clavesExtra`
  FIRST, then the form's real controls (`core/context/testContext.js`, by design — see
  its own docblock). Pass the search key as `clavesExtra`; you get first-position for
  free, no extra work.
- `registrarCaso(CASO, [...])` (non-`ESTRATEGIAS`-backed cases, e.g. a popup mini-form
  whose fields are `<span>` instead of `<label>` — see `agregar-educacion.test.js`) has
  no automatic ordering: the search key must be the literal first element of the array
  you pass.

**The trap that actually bit this project: code order and `execution-context.json`
order are two DIFFERENT things, and only one of them updates automatically.**
`registrarCaso` (the function both mechanisms above eventually call) NEVER reorders or
deletes keys already present in `execution-context.json` — it only appends genuinely
NEW keys, on purpose, so it never silently discards a value the user already typed. The
consequence: renaming a key in code (e.g. `'nombre'` → `'Nombre de Empleado a editar'`,
per the previous section's incident) does **not** move anything in a case that was
already registered under the old name — the file keeps the OLD key exactly where it
was, and the NEW key gets appended at the very end, since as far as `registrarCaso` can
tell it's simply a key it's never seen before. **Panel field order is exactly
`Object.keys()` of that JSON section** (confirmed end to end:
`testContext._escribir` → `panel/anfitrion/contexto.js#seccion` builds `claves` via
`Object.keys(s).map(...)` → `panel/web/js/contexto.js` renders that array with a plain
`for` loop, no client-side sort) — so a stale key order in the FILE is a stale key
order in the PANEL, regardless of what the code now says.

**Real incident (2026-09-04):** all 4 `empleados/tests/editar-*.test.js` plus all 3
`agregar-*.test.js` (Resumen/CV: educación, experiencia, habilidad) had `CLAVE_BUSQUEDA`
renamed from a bare `'nombre'` to an entity-specific name earlier the same session (the
incident in the previous section) — correctly, and correctly seeded FIRST in every
test file's code. But `empleados/data/execution-context.json` had already been written
once under the OLD scheme, so after the rename every one of those 7 sections still had:
a **stale, orphaned `"nombre": ""` key sitting first** (the literal ghost field the user
spotted — it doesn't correspond to anything real in the form, it's just what
`registrarCaso` never had a reason to remove), and the real, correctly-named search key
sitting **last** (appended, not moved). The code was never wrong; the persisted file
just never got migrated. Verified this is confined to `empleados` — grepped
`configuracion`/`reclutamiento`'s `execution-context.json` for the same
"`nombre` key coexisting with a differently-named search key" shape and found none: they
never went through a bare-`'nombre'` rename, so they never accumulated this debt.

**Fix applied:** for each of those 7 sections, deleted the orphaned `"nombre": ""` key
and moved the real search key to the first position, preserving every other value
byte-for-byte — a manual, one-time reconciliation of the persisted file to match what
the code had already been declaring correctly. **This is not a one-off cleanup to
forget about**: `core/context/testContext.js#registrarCaso` now logs a `logger.warn`
whenever a case's persisted section contains keys that current the declared `claves`
list doesn't mention — so the NEXT time a key gets renamed in code, the drift shows up
in the log instead of silently lingering until a user notices a ghost field months
later. It still never auto-deletes anything (same "never overwrite/delete what's
already there" principle as the rest of the framework) — the warning is the whole
point: it turns an invisible, permanent drift into a visible, one-line fix.

**Lesson for future renames of any registered key (search key or otherwise):** a code
rename is only half the fix. Always check the actual `execution-context.json` for the
affected case(s) afterward — don't assume the code change already reordered or cleaned
anything there, and don't skip it because "the code is right now." If `registrarCaso`
logs the new staleness warning for that case, that is the go/no-go signal for whether a
manual reconciliation is still needed.

## Semantic naming: never name a field after a generic label without confirming what it means

Applies to any name the framework itself INVENTS — a search key, a synthetic parameter,
anything that isn't a real, visible label already dictated by the app's own UI (real app
labels are governed by the separate "labels REALES" rule, `GUIDELINES.md §3` — never
renamed, never aliased). For everything the framework names on its own: before choosing
that name, determine what the value actually represents in THIS form's context, and name
it for that — don't default to whatever generic word first came to mind (`Nombre`,
`Tipo`, `Estado`, `Código`) just because it "reads fine" in isolation. A bare `Nombre` as
a search key for "which employee does this new education/experience/skill entry belong
to" doesn't say who the name belongs to once it shows up in a Panel field list mixed in
with other, unrelated names. Keep it natural, though — this is not license to produce
artificially long, over-qualified names either; `"Nombre de Empleado a editar"` /
`"Nombre de Empleado que recibe la Educación"` are the right length: specific enough to
be unambiguous, short enough to read naturally. If a shorter, equally unambiguous name
exists, prefer it — the goal is clarity for the person filling the Panel, not maximum
verbosity.

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

## Automatic-mode data: use `core/utils/datosPrueba.js`, never fixed strings or `Automatica-<ts>`

Texto/identificadores del modo automático (sin valor del Panel) se generan con
`@triple/core/utils/datosPrueba` + `core/data/datosPrueba.json`: nombres/apellidos de catálogo,
`correo(persona)`, `identificacion()`, `celular()`, `nombreRequisicion(puesto)`,
`texto(tipo, { puesto })`. Panel gana siempre (`get(caso, label) || generador()`); la unicidad
solo se exige donde la app la pide (persona, correo, identificación, nombre de requisición/entidad);
el contexto semántico se pasa como argumento (p. ej. el Puesto elegido). Respetar largos reales:
un nombre de requisición de 61 caracteres falló el Guardar ("Error en el sistema") — se acota a 45.
Amplía el JSON/`datosPrueba.js`; no crees generadores por módulo.

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

## Flows: making a test usable inside a flow (only when it actually exchanges data)

Most tests never need this: a test with no flow metadata stays valid, alone or as an independent step of a flow. The normative
rules (what a flow is, individual vs flow execution, priority, planner errors, blocking) live in `GUIDELINES.md §12` — don't
restate them here. This is the authoring procedure.

1. **Producing an entity:** call `flowContext.publish('<tipo>', { ...campos })` (or `update` if it transforms an existing one) right
   after the final success assert, with the type as a **string literal** and an object literal. That is the whole declaration:
   `produces` is read from this call statically (`core/utils/flowScanner.js`, no execution). Never declare `produces` in
   `flujo-tests.js`; a dynamic type (variable, alias, spread) is not provable and forces a manual declaration.
2. **Consuming an entity by key — structure first.** If the test opens/selects the record through a listing Page Object
   (`ctx.lista.abrirDetalle(testContext.get(CASO, 'codigo'))`, directly, via an alias, a constant key or a fixture helper), declare
   nothing in the test: the Page Object that implements the locator declares ONCE
   `static get ENTIDAD_FLUJO() { return { tipo: 'solicitud', referencia: 'codigo' }; }` (`metodos: [...]` for locators other than
   `abrirDetalle`) and the scanner derives `requires { tipo, clave, campo }` for every test that uses it. When you create a new listing
   Page Object whose entity some test publishes, add its `ENTIDAD_FLUJO`; don't copy `requires` into each test or `flujo-tests.js`.
   Only if the structure can't prove it (e.g. a form select), declare `entidad` and `campo` once next to the key —
   `registrarCaso(CASO, [{ clave, entidad, campo }])` or the Page Object's `ESTRATEGIAS` entry (`{ estrategia: 'searchAndSelect',
   entidad: 'requisicion', campo: 'nombre' }`). A manual declaration the structure already proves is redundant and fails the
   contract. Entity, reference field and consumed key are three different things: never infer `campo` from the key or the entity from
   a name. Extra props are ignored outside a flow, so the individual run is unchanged.
3. **Typed read:** `flowContext.get('<tipo>')` with a literal type is detected as "consumes <tipo>" on its own (orders, no values).
   If it disagrees with the structural/declared entity of a key, the plan fails before opening the browser.
4. **Business order** that no code can prove (Primera → Segunda → Tercera) is the only thing that goes in
   `<modulo>/data/flujo-tests.js` (`orden: { solicitud: n }`).
5. **Do not** treat file/test/Page Object names, labels, fixtures, generic keys (`codigo`) or previous results as a contract, and
   never convert a scanner SUGGESTION into a dependency. Flows receive no specific data: no `flowData`, no profiles; inside a flow
   values resolve `flowContext → automatic`, and the individual `execution-context.json` is ignored.
6. **Check:** `node core/scripts/flujo-escanear.js <modulo>/<caso>` (DETECTED / DECLARED / SUGGESTED / UNDETERMINED) and the unit
   suite — `core/tests/contrato-flujo-metadata.spec.js` fails on contradictions, invalid entities/fields or unknown keys.

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

## Text comparisons must be case- and accent-insensitive

Any comparison against text rendered by the app — DataGrid cell, form field, detail-page
field, screen/popup title, notify text, anything read back from the UI — must be
case-insensitive AND accent-insensitive. The app (or a value typed from the Panel/Execution
Context) may render the same value with different casing (`"Inactivo"` vs `"inactivo"`,
`"EMPLEADO"` vs `"Empleado"`) or with/without a diacritic (`"Renovación"` vs `"Renovacion"`);
neither difference is a real failure and must never fail a test.

Use the shared helper for this — do not write `.trim().toLowerCase()` (or your own accent
stripping) by hand in a test or Page Object:

```js
const { assertTextoIgual } = require('@triple/core'); // or require('@triple/core/utils/assert')

assertTextoIgual(actual, esperado, `"${label}" no quedó en "${esperado}" (quedó "${actual}").`);
```

`assertTextoIgual` (`core/utils/assert.js`, via `normalizarTexto`) trims, folds diacritics
(NFD-decompose + strip combining marks) and lower-cases both sides before comparing, throws
`AssertionError` with your message on mismatch (same assertion semantics as
`assert.strictEqual`), and requires both arguments to be `string` — it does NOT coerce
numbers/booleans/other types to text. Numeric or non-text comparisons (e.g. a formatted
salary, a star rating) keep using `assert.strictEqual`/`assert.equal` directly with their own
normalization (e.g. `parseFloat`), never this helper.

Accent-folding is a deliberate trade-off: it can equate two genuinely different Spanish words
that differ only by a diacritic (`"año"` vs `"ano"`). Accepted because the real, observed
failure mode (a Panel-typed value missing a tilde that the app renders WITH one) is far more
common in this framework's actual data than a genuine semantic collision — none is known to
exist in the system's entities today. If one is ever found for a specific field, use the
contract test's escape hatch (`// contrato-texto-ui:permitir: <razón>`) for that one call site
— do not revert the shared normalizer.

If you find yourself writing `.trim().toLowerCase()` (or any other manual case-normalization)
directly in a test, that is a sign it should be `assertTextoIgual` instead — the manual form
duplicates the rule and can drift (e.g. only trimming, or forgetting the case-fold on one
side).

For the common "does this form field show X" check specifically, prefer `Form.assertValor(label,
esperado, mensaje)` over `esperarValor()` + a separate `assertTextoIgual()` call — it fuses the
poll and the case-insensitive comparison into one call, so there's no second step to forget (see
the incident below for exactly what happens when that second step gets skipped).

A permanent contract test (`core/tests/contrato-comparacion-texto-ui.spec.js`, runs on every
`npm run test:unit`) statically fails the build if any `*.test.js` file compares UI-read text
with raw `assert.strictEqual`/`assert.equal` instead of `assertTextoIgual`/`Form.assertValor` —
do not rely on remembering this rule; the contract test is what actually enforces it now.

**Incident (2026-09-09) — why the rule/helper existing wasn't enough, and what changed so it's
now enforced mechanically, not just documented:** `empleados/tests/editar-capacitacion.test.js`
failed on `"Frecuencia"`: expected `"Renovación trimestral"`, got `"Renovación Trimestral"` — a
pure case difference, wrongly treated as a real mismatch. The rule above and `assertTextoIgual`
already existed and were already used in 29 files at the time. First pass fixed the 3 call
sites that used raw `assert.strictEqual`/`assert.equal` against UI-read text instead of
`assertTextoIgual` (`empleados/tests/editar-capacitacion.test.js`,
`configuracion/tests/editar-grupo.test.js`,
`reclutamiento/tests/editar-paquete-beneficios-solicitud-empleo.test.js`) — but fixing 3 tests
is not a fix for "why did this recur despite the rule already existing", so the investigation
went deeper. Two separate root causes were found:

1. **The comparison predicate was duplicated, and only ONE copy had ever been fixed for
   case-insensitivity.** `Form.esperarValor()` (`core/components/Form.js`) polls
   case-insensitively (`.trim().toLowerCase()`) — but it turned out NOT to be the only
   "wait for a field to show a value" implementation in the framework. Four other Page Object
   methods had each hand-rolled their OWN copy of the same wait-loop shape (literally commented
   "mismo criterio que..." each other — copy-pasted, not reused), and every one of those copies
   used a case-SENSITIVE `actual === esperado` predicate instead of delegating to `Form`'s fixed
   version: `ConfiguracionEntidadDetallePage.esperarValor`/`esperarNombre`
   (`core/pages/ConfiguracionEntidadDetallePage.js` — the base class for every `configuracion`
   entity screen), `GrupoDetallePage.esperarValorEditar`, `HabilidadesPage.esperarValor`,
   `GradosAcademicosPage.esperarValor`. This is the actual architectural gap the "Frecuencia"
   bug traces back to: a prior refactor fixed the ONE canonical `Form.esperarValor`, but never
   audited for (nor prevented) parallel, drifted copies of the same logic — "no duplicar
   lógica" was violated silently, in a way code review of any ONE file wouldn't catch. Fixed by
   replacing each duplicated `actual === esperado` with `textoIgual(actual, esperado)`
   (`core/utils/assert.js`'s boolean predicate form of the same rule) — same timing/retry
   behavior at each site, only the comparison itself changed.
2. **Nothing made the correct helper the path of least resistance, and nothing caught it
   mechanically when a test skipped it.** `assert` (Node core) is imported by literally every
   test file for its OTHER assertions (`assert.ok`, `assert.fail`); reaching for
   `assert.strictEqual` out of habit costs nothing extra, while `assertTextoIgual` requires
   remembering it exists and importing it on purpose. A repo-wide audit for the SHAPE of the
   bug (not just its exact error message) found 4 MORE pre-existing instances beyond the 3
   already fixed — `reclutamiento/tests/compartir-requisicion-publicada.test.js` (public vacancy
   name), `reclutamiento/tests/crear-req-creacion.test.js` (requisition name after reopening),
   `reclutamiento/tests/navegacion-configuracion.test.js` (screen title),
   `reclutamiento/tests/consultar-banco-elegibles-desde-requisicion.test.js` (screen title via a
   local helper function) — 7 real instances total, spread across all 3 modules, and **every
   single `assert.strictEqual`/`assert.equal` call anywhere in the test suite that compared two
   strings turned out to be one of these bugs** — there was no legitimate string-vs-string
   strict case to preserve.

**What actually closes the gap (not just this incident, the general capacity for it to
recur):**
- `Form.assertValor(label, valorEsperado, mensaje)` — a new fused "wait + compare" method
  (`core/components/Form.js`) that makes the CORRECT path shorter to write than the buggy one:
  one call, always case-insensitive, instead of a two-step `esperarValor()` +
  separately-remembered `assertTextoIgual()`. Prefer it for a straightforward "does this form
  field show X" check in new tests. It does not replace `esperarValor()` — a test that collects
  several fields' final values BEFORE asserting any of them (e.g. to guarantee a screenshot gets
  taken even if one field is wrong) still wants the two-step form on purpose; `assertValor` is
  for the common case with no such ordering constraint.
- `core/tests/contrato-comparacion-texto-ui.spec.js` + `core/utils/auditoriaComparacionTexto.js`
  — a permanent contract test, in the same family as `contrato-suite-unitaria.spec.js`, that
  runs on every `npm run test:unit` and statically scans every `*.test.js` file for
  `assert.strictEqual`/`assert.equal` called against text read from a known UI accessor
  (`getValor`, `getTitulo`, `getNombre`, a DataGrid row property, etc. — see
  `METODOS_TEXTO_UI` in that file) or a variable traced back to one. It is a documented
  heuristic (not a full parser — the project has no AST-parsing dependency and this problem
  didn't warrant adding one), with an explicit escape hatch (`// contrato-texto-ui:permitir:
  <razón>` on the offending line) for a genuinely legitimate future exception. **This is the
  piece that actually makes the rule hard to violate again**: before this, the rule lived only
  in this document and in reviewer memory, both of which already proved insufficient once.
  When adding a NEW Page Object method that reads business text rendered for a human (not a
  technical value like a URL or a CSS class), add it to `METODOS_TEXTO_UI` in that file so the
  contract test can see it too.

**Lesson:** a fix that repairs the reported symptom (3 tests, one error message) is not the
same as a fix for the architecture that allowed it — always ask, for a "we already fixed this
class of bug before" report, whether the ORIGINAL fix was ever duplicated/drifted elsewhere in
the codebase, and whether anything besides documentation stops it from happening a third time.

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

**The Panel shows the "|" hint automatically — no manual placeholder map to maintain.**
`testContext.registrarCasoDesdeFormulario` detects `{ multiple: true }` on any declared
control by itself (same declaration `Form.setValor` already uses to operate the control) and
records it in a reserved `_camposMultivalor` section of `execution-context.json` — the Panel
reads that to render the field as type `"lista"` (generic "Opción 1 | Opción 2" placeholder),
independent of the field's current stored value (so the hint doesn't disappear once the user
saves a non-empty value — it used to be inferred from "is the stored value an array", which
broke as soon as a real string got saved). For a case that registers a multi-value field
manually (`testContext.registrarCaso`, not `registrarCasoDesdeFormulario` — e.g. a popup field
with no `ESTRATEGIAS` backing it, see `agregar-permiso-grupo`'s "Roles"), pass
`{ clave: 'Roles', multivalor: true }` instead of a bare label string to get the same
treatment. Either way, parsing the "|"-separated value back into an array on the TEST side
still needs its own explicit `parsearValoresMultiples(testContext.get(caso, label))` call —
that part stayed manual on purpose: different cases consume the list differently (Usuario's
"Compañías permitidas" ADDS to what's already there, Grupos' `elegirEnTagbox` REPLACES), so
there isn't one correct auto-apply behavior to bake in.

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
one-sentence description) unless it's a pure flow test; if the test exchanges data in a flow,
its `produces`/`requires` are declared in code as described in "Flows" above and the scanner/contract pass.

## Expected Output

Implementation plan. Affected files. Compatibility analysis. Potential risks. Validation
steps. Recommended reusable abstractions. Final implementation following the framework
conventions.
