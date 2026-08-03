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

# Triple Automation Testing Patterns

## Purpose

This skill defines how automated tests are created inside the Triple Automation Framework.

Use this skill whenever the request involves: new automated tests, Page Objects, Flows,
Selenium, Execution Context, Input Model, metadata, screenshots, evidence, selectors,
validation, reports.

## Primary Mission

Create tests that fully respect the framework conventions. Never create isolated
implementations. Every new test must reuse the existing infrastructure.

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

## Non-form Tests

Examples: publish requisition, pause requisition, share requisition, import documents, and
any test that does NOT fill a form with data (e.g. a required-field validation test that
saves empty, or a detector that iterates a control). Use `registrarCaso()` only with the
minimum parameters required. Do not generate an Input Model.

## Selectors

Never use indexes, DOM order, visual order, base64 or fragile selectors. Prefer accessible
name, title, aria-label, visible text, metadata, data-testid. If identification is
uncertain: do not guess — fail explicitly, generate diagnostics, attach evidence.

## Validation

Every test should verify: expected UI state, expected notifications, expected persistence,
expected navigation, expected business behavior. Whenever possible verify both positive and
negative scenarios.

## Evidence

Always reuse Evidence, Problem Log, Screen Inspector, Screenshots, Execution Context. Never
create custom evidence systems.

## Recovery

Never abandon the application after a failure. Reuse the existing recovery strategy whenever
available.

## Documentation

Whenever a new testing pattern is introduced, update README, GUIDELINES, examples and
document the pattern.

## Checklist

Before finishing verify: uses existing infrastructure; no duplicated logic; correct naming;
correct selectors; Execution Context updated; evidence generated; compatibility preserved;
documentation updated.

## Expected Output

Implementation plan. Affected files. Compatibility analysis. Potential risks. Validation
steps. Recommended reusable abstractions. Final implementation following the framework
conventions.
