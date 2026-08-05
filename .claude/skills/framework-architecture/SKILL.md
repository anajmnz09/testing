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

# Política de uso eficiente del contexto

El objetivo es minimizar el consumo de contexto y tokens sin perder calidad técnica.
La prioridad es: **leer menos, razonar más, reutilizar el conocimiento ya obtenido.**
Estas reglas son obligatorias en toda tarea.

- **No releer para recordar.** Si ya analizaste un archivo en la sesión (README,
  GUIDELINES, SKILL.md, docs de arquitectura, execution-context, logs, reportes,
  screenshots), asúmelo válido y reutiliza lo aprendido. Solo se relee si: el usuario
  dice que cambió, lo modificaste tú, necesitas verificar una línea específica, o hay
  evidencia de que quedó desactualizado.
- **Nunca leer logs/reportes completos.** Prohibido `cat`, `sed`/`tail` amplios o
  volcados enteros. Usar búsqueda acotada (`grep`, `rg`, `Select-String`, `findstr`) y
  recuperar solo las líneas necesarias para la pregunta actual.
- **No listar directorios completos** (`ls -R`, `tree`, `find .`, `Get-ChildItem`
  recursivo) salvo que el usuario lo pida. Reutiliza la estructura ya conocida.
- **No abrir archivos ajenos al cambio.** Si se modifica un helper, no abras README,
  SKILL, GUIDELINES ni otros módulos "por contexto". Lee solo lo necesario.
- **Preguntas de estado/seguimiento** ("¿qué hicimos?", "¿qué falta?", "¿cuál fue el
  último cambio?", "¿qué sigue?") se responden **con la memoria de la conversación**,
  sin inspeccionar archivos.
- **Reportes ya procesados no se reabren**; se consulta la información ya extraída.
- **Mantén un resumen interno** de pocas líneas al terminar una tarea importante, y úsalo
  en tareas futuras antes de reinspeccionar.
- **Al ejecutar tests:** no leas logs antiguos; primero ejecuta el test, y solo si falla
  analiza exclusivamente el reporte de ESA corrida. Nunca reportes históricos salvo que
  el usuario lo pida.
- **Antes de cualquier lectura grande** pregúntate: "¿puedo responder con lo que ya
  tengo?". Si sí, no leas nada. Más contexto no significa mejor respuesta.

Estas reglas complementan (no reemplazan) las demás políticas del skill.

---

# Política permanente de eficiencia de contexto

Estas reglas son obligatorias para todas las tareas.

## Lectura de archivos

Antes de leer cualquier archivo determina si realmente es necesario. Orden obligatorio:

1. Buscar primero el símbolo, método o clase mediante grep/find.
2. Leer únicamente el rango mínimo necesario alrededor del resultado.
3. Leer el archivo completo solamente cuando sea estrictamente indispensable.

Está prohibido leer Page Objects completos para modificar un único método. Está
prohibido reconstruir el proyecto completo cuando la tarea afecta únicamente unos
pocos archivos.

## Reconstrucción del contexto

No reconstruyas el framework completo. Trabaja únicamente con los archivos
involucrados en la tarea actual. Si la tarea afecta menos de tres archivos, trabaja
únicamente sobre esos archivos. No releas archivos que ya fueron analizados durante
la misma sesión salvo que hayan cambiado.

## Logs

Nunca leas logs completos. Utiliza búsquedas específicas. Extrae únicamente: el
test, la excepción, el stack relevante. Está prohibido mantener en contexto dumps
enormes, JSON extensos o información repetida una vez identificada la causa.

## Selenium

Mientras el cambio aún esté en desarrollo: NO ejecutar Selenium. Solo verificar
sintaxis cuando sea necesario. La ejecución E2E deberá realizarse únicamente cuando
el cambio esté terminado o cuando el usuario la solicite explícitamente. Evita
múltiples corridas de validación cuando una sola sea suficiente.

## Informes

Los informes deberán ser breves. Informar únicamente: archivos modificados,
resultado, bloqueos, siguiente paso. No repetir contexto ya informado anteriormente.
No generar narrativas largas salvo que el usuario las solicite.

## Diagnóstico

Cuando sea necesario investigar un problema: primero recopilar evidencia mínima,
después formular la hipótesis, después validar únicamente esa hipótesis. Evitar
abrir archivos adicionales que no aporten evidencia.

## Optimización continua

Si detectas que una acción consumiría una cantidad importante de contexto:
detente, explica por qué, y propone una alternativa más eficiente antes de
continuar.

## Modelo recomendado

Sonnet 5 es el modelo recomendado para desarrollo cotidiano (refactors, Page
Objects, Selenium, helpers, tests). Opus se reserva para arquitectura compleja,
investigaciones profundas o decisiones difíciles.

## 1. Lectura mínima obligatoria

Antes de abrir cualquier archivo debes decidir si realmente es necesario. Está
prohibido leer archivos completos por defecto. Orden obligatorio:

1. Buscar el símbolo, método o clase mediante grep/find.
2. Leer únicamente el rango mínimo necesario alrededor del resultado.
3. Leer el archivo completo solamente cuando exista una necesidad demostrable de
   comprender la estructura global del archivo.

Si el cambio afecta únicamente un método, queda prohibido leer el archivo completo.

## 2. Prohibición de reconstrucción innecesaria

No reconstruyas mentalmente el framework completo para tareas locales. Si la tarea
afecta únicamente unos pocos archivos, trabaja exclusivamente sobre esos archivos.
Nunca releas archivos ya analizados durante la misma sesión salvo que hayan cambiado.

## 3. Política estricta para comandos de consola

Está prohibido ejecutar comandos cuya salida sea mayor de la necesaria. Priorizar
siempre grep/rg/findstr. Evitar `cat` de archivos completos, `sed` sobre cientos de
líneas, `tail` extensos y dumps completos. Solo podrán utilizarse cuando exista una
justificación técnica clara.

## 4. Política para logs

Nunca leer logs completos. Extraer únicamente: nombre del test, excepción, stack
relevante, líneas necesarias para identificar la causa. Una vez identificada la
causa raíz queda prohibido volver a leer el mismo bloque del log. No mantener dumps
grandes dentro del contexto.

## 5. Política para Selenium

Durante el desarrollo: no ejecutar Selenium después de cada modificación. Agrupar
todos los cambios compatibles y realizar una única validación E2E al finalizar.
Solo ejecutar Selenium antes si el usuario lo solicita expresamente, o si un
bloqueo impide continuar sin evidencia E2E.

## 6. Política para investigaciones

Antes de abrir archivos adicionales: 1) formular una hipótesis, 2) identificar la
evidencia mínima necesaria, 3) obtener únicamente esa evidencia, 4) confirmar o
descartar la hipótesis. Está prohibido explorar archivos "por si acaso".

## 7. Política para informes

Los informes deben contener únicamente: archivos modificados, resultado, bloqueos,
próximo paso. No repetir contexto previamente informado. No generar narrativas
largas salvo que el usuario las solicite.

## 8. Autoevaluación de costo

Antes de una acción que pueda consumir mucho contexto (lecturas masivas, múltiples
comandos, varias corridas) debes estimar internamente su costo. Si existe una
alternativa significativamente más eficiente, úsala automáticamente. Si ninguna
alternativa es suficiente, informa el motivo antes de continuar.

## 9. Objetivo permanente

El objetivo no es trabajar más rápido: es minimizar el consumo de contexto y
tokens manteniendo exactamente la misma calidad técnica y rigurosidad. Nunca
sacrificar evidencia técnica para ahorrar contexto. Pero tampoco consumir contexto
que no aporte información nueva.

---

# Disciplina de trabajo y control de contexto

Estas reglas son obligatorias para todas las tareas y complementan (no reemplazan)
la política de eficiencia de contexto anterior.

## 1. Planificación obligatoria antes de actuar

Antes de leer cualquier archivo determina: cuál es el objetivo exacto, qué
archivos probablemente serán modificados, cuáles solo servirán como referencia. No
comiences a explorar el proyecto sin haber definido ese alcance. Si aparece un
archivo nuevo durante la implementación, justifica por qué es necesario abrirlo.
Queda prohibido explorar archivos "por si acaso".

## 2. Lectura mínima obligatoria

Orden obligatorio: 1) buscar símbolo/método/clase mediante grep/find; 2) leer
únicamente el rango mínimo necesario; 3) leer el archivo completo solo cuando sea
imprescindible comprender su estructura global. Prohibido abrir archivos completos
para modificar un único método.

## 3. Un archivo solo se abre una vez

Cada archivo leído debe terminar en uno de estos estados: modificado, utilizado
como referencia indispensable, o descartado definitivamente para esta tarea.
Prohibido reabrir el mismo archivo durante la misma tarea salvo que haya cambiado
o exista justificación técnica.

## 4. Reconstrucción del proyecto

Prohibido reconstruir mentalmente el framework completo. Trabaja únicamente sobre
los archivos afectados. Si la tarea afecta menos de tres archivos, prohibido
ampliar el contexto a módulos no relacionados.

## 5. Comandos de consola

Priorizar grep/rg/findstr. Evitar `cat` completos, `sed` extensos, `tail` largos y
listados masivos. Nunca ejecutar comandos cuya salida supere la información
realmente necesaria.

## 6. Logs

Nunca leer logs completos. Extraer únicamente: nombre del test, excepción, stack
relevante, líneas indispensables. Una vez identificada la causa raíz, prohibido
volver a leer ese mismo bloque.

## 7. Selenium

Mientras el cambio no esté terminado, prohibido ejecutar Selenium (solo verificar
sintaxis cuando sea necesario). Agrupar los cambios compatibles y validar E2E una
única vez al finalizar. Solo ejecutar antes si el usuario lo solicita o existe un
bloqueo imposible de resolver sin evidencia E2E.

## 8. Investigación

Orden obligatorio: 1) formular hipótesis; 2) determinar la evidencia mínima; 3)
obtener únicamente esa evidencia; 4) confirmar o descartar; 5) solo entonces
decidir si abrir nuevos archivos. Nunca explorar archivos esperando encontrar la
respuesta.

## 9. Informes

Cada informe contiene únicamente: archivos modificados, resultado, bloqueos,
siguiente paso. No repetir información ya comunicada. No generar narrativas largas
salvo solicitud expresa.

## 10. Autoevaluación de costo

Antes de cualquier acción costosa (lectura de archivos, comandos, corridas de
Selenium, generación de logs, informes), estima internamente su costo. Si existe
una alternativa claramente más eficiente, úsala automáticamente.

## 11. Reutilización

Antes de escribir código nuevo, comprueba si ya existe un helper, método, utilidad
o patrón reutilizable. No crear duplicados.

## 12. Validaciones

Durante el desarrollo: no ejecutar pruebas unitarias salvo que el cambio las
afecte directamente; no ejecutar Selenium hasta el final; no realizar múltiples
validaciones cuando una sola sea suficiente.

## 13. Principio de mínima intervención

Modificar únicamente el código necesario. No refactorizar por gusto. No mover
archivos. No renombrar elementos. No mejorar código ajeno si no forma parte del
objetivo solicitado.

## 14. Principio de mínima salida

Toda respuesta contiene únicamente información útil. Evitar repetir contexto,
explicar funcionamiento ya conocido, volver a listar reglas, describir archivos
que no cambiaron.

## 15. Modelo recomendado

Sonnet 5 para: mantenimiento, Selenium, Page Objects, helpers, FastReport, React,
tests, documentación. Opus únicamente para: arquitectura, investigaciones
complejas, diseño de soluciones, causa raíz difícil.

## 16. Objetivo permanente

Minimizar el consumo de contexto y tokens manteniendo exactamente el mismo nivel
de calidad técnica. Nunca sacrificar evidencia. Nunca consumir contexto que no
aporte información nueva.

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
