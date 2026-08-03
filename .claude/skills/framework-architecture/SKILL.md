---
name: framework-architecture
description: Principios arquitectónicos del Triple Automation Framework. Usar para arquitectura, refactoring, evolución del framework, componentes reutilizables, organización del proyecto, decisiones de diseño, deuda técnica, documentación, escalabilidad y mantenibilidad. No usar para escribir tests puntuales salvo que requieran decisiones arquitectónicas.
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

# Triple Automation Framework Architecture

## Purpose

This skill defines the architectural principles of the Triple Automation Framework.

Use this skill whenever the request involves: architecture, refactoring, framework
evolution, reusable components, project organization, design decisions, technical debt,
documentation, scalability, maintainability.

Do not use this skill for writing specific automated tests unless architectural decisions
are required.

## Primary Mission

Preserve the long-term quality of the framework. Every implementation should strengthen
the framework instead of solving only the current problem.

## Mandatory Workflow

Before proposing any implementation:

1. Read README.md.
2. Read GUIDELINES.md.
3. Read relevant documentation inside /docs.
4. Analyze existing architecture.
5. Search for reusable implementations.

Never assume something does not exist.

## Core Principles

- **Backward Compatibility** — Never break existing behavior. Changes must always be
  additive. Public APIs remain compatible.
- **Reuse First** — Always search for existing implementations. Priority: Core → Components
  → Flows → Utilities → Pages → Tests. Never duplicate logic.
- **Open / Closed** — Open for extension. Prefer composition, registries, strategies,
  providers, reusable components. Avoid special cases.
- **Responsibilities** — Respect the separation between Core, Components, Pages, Flows,
  Utilities, Metadata, Execution Context, Input Model, Evidence, Problem Log, Screen
  Inspector, Automation Panel. Never mix responsibilities.
- **Components** — Whatever can be reused by multiple modules belongs in Core. Evaluate
  existing components before creating new ones. Reusable today: Form, FormsHeader, DataGrid,
  NavBar, Notify, Popup, FileUploader. Planned: Dialog, Toolbar, Tabs, Switch.
- **Documentation** — Architecture changes are incomplete until documentation is updated
  (README.md, GUIDELINES.md, architecture docs, examples, diagrams).
- **Technical Review** — Before implementing, evaluate compatibility, reuse, scalability,
  maintainability, architectural impact, risks, technical debt.

## Expected Output

Architectural analysis. Recommended implementation. Alternative solutions. Compatibility
analysis. Affected modules. Documentation updates. Validation strategy. Implementation
roadmap.

Do not jump directly into coding if architecture should be discussed first.
