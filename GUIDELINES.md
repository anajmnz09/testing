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
- [ ] Documentación actualizada (README + GUIDELINES + /docs + ejemplos).
