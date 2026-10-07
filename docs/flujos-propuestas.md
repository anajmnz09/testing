# Flujos — decisiones, semántica y propuestas pendientes

Complementa `GUIDELINES.md §12` (reglas) con el análisis de lo que quedó **decidido**, lo que quedó **implementado** y lo
que queda como **propuesta** para una etapa posterior. Nada de lo propuesto aquí está implementado.

## 1. Estados de un test dentro de un flujo

Los escribe `core/utils/flowHooks.js` en `flow-estado.json` y el Panel solo los representa.

| Estado | Cuándo | Lo escribe |
|---|---|---|
| **Pendiente** (`pendiente`) | Aún no le toca | Al iniciar el flujo |
| **En ejecución** (`running`) | Está corriendo | `beforeEach` |
| **Aprobado** (`passed`) | Terminó bien y publicó lo que declara producir | `afterEach` |
| **Falló** (`failed`) | Terminó con error (o `contrato-incumplido`: pasó pero no publicó lo declarado) | `afterEach` |
| **Bloqueado** (`bloqueado`) | Su productor SELECCIONADO falló/se bloqueó/no publicó y el Panel no dirige ese dato | `beforeEach` (`skip`) |
| **Cancelado** (solo en el Panel) | El flujo se detuvo (botón Detener) y el test estaba en ejecución o pendiente | El Panel, al ver que el proceso terminó con estados no finales |

Reglas: *bloqueado* es una **consecuencia de dependencia** (queda escrito en cuanto se llega al test y conserva su motivo);
*cancelado* es una **decisión del usuario** y solo se asigna a lo que no llegó a terminar. Un test que ya terminó conserva
su resultado; un bloqueado nunca pasa a cancelado. Detener no deja carpetas de reporte inconsistentes: `flow-estado.json`
conserva el último estado escrito.

## 2. Reportes de un flujo (implementado)

Un flujo cruza módulos, así que su reporte no pertenece a ninguno: `core/scripts/run-flow.js` fija
`TRIPLE_REPORTS_BASE=<raíz>/flujo` y todo (JSON de Mocha, screenshots, evidencias, logs, `flow-plan.json`,
`flow-estado.json`) queda en **`flujo/reports/<RUN_ID>/`**. El `RUN_ID` es el identificador único del flujo.

- No se mueve ni duplica nada: los reportes individuales siguen en `<modulo>/reports/`.
- Solo cambia dónde se escribe `reports/` (`core/utils/paths.js`); el contexto por módulo y la metadata de pantallas siguen
  saliendo de `REPORTS_ROOT` (módulo del primer caso), igual que antes.
- Retención (`KEEP_REPORTS`) y `latest` aplican a `flujo/reports/` de forma independiente (ya está en `**/reports/` del `.gitignore`).
- El Panel lee el flujo con el mismo código de siempre (`artefactosCaso`, `/artefacto/…`), tratando `flujo` como el "módulo" del reporte.
- Pendiente (siguiente etapa): listar los flujos pasados en el Historial. No hace falta para operar hoy.

## 3. Data residual (implementado)

Antes de ejecutar, el Panel lee (solo lectura) el Execution Context de cada test seleccionado y, si hay valores dirigidos
no vacíos, muestra "⚠ Data residual detectada" con módulo/test/claves. **No borra nada, no modifica los JSON y no bloquea**,
y aclara que esos datos de ejecuciones individuales **no se aplicarán al flujo** (el flujo usa sus propios datos). Criterio de "vacío" = el de `testContext`
(`''`, `false`, `[]`). Solo se mira la sección del caso (lo que el Panel muestra y edita), no la sección `global`.

## 4. Metadata `flujo-tests.js` (estado actual y recomendación)

Hoy: un archivo **por módulo** (`<modulo>/data/flujo-tests.js`) que conserva solo el `orden` de negocio de las transformaciones
(`produces` y `requires` se leen del código, §7). El de Nómina quedó vacío a propósito.

- **¿Por módulo está bien?** Sí: cada módulo declara lo suyo, igual que `organizacion-tests.js`, y el planner las fusiona. El
  vocabulario de tipos (`requisicion`, `solicitud`, `empleado`) es compartido: lo vigila el contrato de abajo.
- **Test sin metadata:** es válido. Sigue ejecutable solo y, en un flujo, es un paso independiente (se ordena por selección).
  El Panel lo indica en su detalle ("Sin metadata de flujo: corre como paso independiente").
- **Test que no requiere ni produce nada:** igual que el anterior.
- **Metadata desactualizada:**
  - entrada de un test que ya no existe → la ignora el planner y la **detecta el contrato**
    `core/tests/contrato-flujo-metadata.spec.js` (falla en `npm run test:unit`);
  - `requires` (detectado o declarado) de un tipo que nadie produce → el contrato falla; en ejecución cae al automático;
  - `clave` que ya no existe en el contexto del caso → `run-flow --plan` lo **avisa** ("Detalles del plan" en el Panel) en vez
    de desconectar el dato en silencio;
  - `produces` declarado pero no publicado → el runner marca "contrato-incumplido" y bloquea a los dependientes.
- **Recomendación a largo plazo:** mantenerla como archivo opcional por módulo (no un registro central) y evitar que se vuelva
  obligatoria. Si crece, el siguiente paso natural es declararla **junto al test** (export `flujo` del propio `.test.js`) para
  que no pueda separarse de él; requeriría que el planner cargue el archivo del test (hoy evita ejecutarlo). Decisión de producto.

## 5. Datos específicos de un flujo (descartado: los flujos NO reciben datos)

Decisión de producto vigente: **un flujo no recibe datos específicos** (ni enviados desde el Panel, ni perfiles de datos, ni
parámetros temporales). El mecanismo `flowData` (`--datos`, `run.datos`, `TRIPLE_FLOW_DATA`) se implementó en una etapa anterior y
**se eliminó por completo** (código, host del Panel, tests y documentación). Dos mecanismos separados:

| Mecanismo | Alcance | Fuente |
|---|---|---|
| `testContext` | ejecución individual | `execution-context.json` → automático |
| `flowContext` | entidades producidas durante el flujo | memoria |

**Prioridad dentro de un flujo:** `flowContext` → automático. El `execution-context.json` individual **no es fuente de valores** en
un flujo (no se lee para valores ni se modifica; solo siembra/consulta las claves del caso con `registrarCaso`/`claveConocida`).
`testContext.valorDirigido` es el único punto que distingue el modo. Si un autor quiere que un paso use un valor concreto,
debe ejecutarlo individualmente o producirlo con un test anterior del flujo.

## 6. Orden de la secuencia de entrevistas (implementado) y reordenamiento manual

El orden de selección es la preferencia del usuario y el planner solo lo cambia cuando hay una dependencia real: `requires/produces`
entre entidades distintas, y la **secuencia de transformación** de una misma entidad, que se declara en la metadata con un
`orden` numérico dentro de `produces` (`{ tipo: 'solicitud', orden: 20 }`: paquete 10 · primera 20 · segunda 30 · tercera 40 ·
oferta 50). Es semántico (posición en la transformación de una entidad), no una conexión test → test, y funciona aunque falte un
paso (Tercera + Primera → Primera, Tercera). Sin `orden`, los transformadores siguen el orden de selección.

No se recomienda drag & drop: con la secuencia explícita ya no depende de que el usuario seleccione bien, y un segundo mecanismo de orden
chocaría con las dependencias. Para mover un test basta desmarcar y volver a marcar (queda al final).

## 7. Derivación estática de la metadata (`produces` y `requires` implementados)

### `produces` — implementado
El tipo que un test produce está en su propio código (`flowContext.publish('requisicion', …)` / `update('solicitud', …)`).
`core/utils/flowScanner.js` lo lee **sin ejecutar el test** (lexer mínimo que ignora comentarios, strings, plantillas y regex; sin
dependencias): en el repo hay 8 llamadas, todas con tipo literal y el mismo `require`, sin alias ni wrappers (127 tests escaneados,
0 indeterminados). `core/utils/flowMetadata.js` combina código + metadata mínima:

| Situación | Resultado |
|---|---|
| El código publica un tipo, la metadata no declara `produces` | Se usa el del código (sin duplicar) |
| El código y la metadata (forma antigua) coinciden | Correcto |
| Discrepan | **Error de plan** (no se elige uno en silencio): el flujo no abre el navegador y el Panel lo muestra como error |
| `orden` declarado para un tipo que el test no produce | Error de plan |
| Uso no determinable (tipo en variable, alias, desestructurado, corchetes) | No se deriva: usa el `produces` declarado y avisa; sin declarar, no produce nada y avisa (el contrato exige declararlo) |
| Test sin `produces` | Válido: no produce nada |

Se eligió "el código manda y la metadata se verifica" (en vez de override o de dejar la metadata como fuente): es la opción más segura
(la discrepancia no pasa en silencio) y la de menor impacto (la forma antigua sigue funcionando durante la transición). Limitación: el
escáner solo mira el archivo del test; si algún día un test publicara desde un helper en otro archivo, no lo vería (la discrepancia
saldría como "metadata declara, el código no publica" y se arreglaría declarándolo o publicando desde el test).

Qué dejó de ser necesario en `flujo-tests.js`: el `produces` de los 8 productores (la entrada de `crear-req-creacion` desapareció).
Qué queda en la metadata y por qué: solo `orden` (la secuencia primera → segunda → tercera es regla de negocio: no está en ningún
nombre ni dato del código); `requires` pasó al código (ver abajo).

### `requires` — implementado

Se descubre solo lo que el código demuestra, con tres fuentes que el planner trata igual (`flowMetadata.unirRequires`):

| Fuente | Forma | Resultado |
|---|---|---|
| Lectura tipada | `flowContext.get/entidad('solicitud')` (literal) | `requires { tipo }`: ordena, sin valores |
| Declaración en el código | `registrarCaso(CASO, [{ clave, entidad, campo }])` o entrada de `ESTRATEGIAS` `{ estrategia, entidad, campo }` | `requires { tipo, clave, campo }`: ordena y enlaza el valor |
| Metadata (forma antigua) | `requires: [{ tipo, clave, campo }]` | igual que la anterior; debe coincidir con el código |

- **Sin API nueva:** `registrarCaso` ya aceptaba objetos por clave (`{ clave, multivalor, vacio }`) y `ESTRATEGIAS` ya aceptaba
  `{ estrategia, … }`; las propiedades extra se ignoran fuera de un flujo, así que no hay una segunda metadata paralela.
- **Qué necesita el planner como mínimo:** el `tipo` (ordenar) y, para pasar un valor, `clave` + `campo`. `auto: false` solo si
  el test no sabe resolverse solo.
- **Errores de contrato/plan (antes del navegador):** el código lee `solicitud` y se declara `empleado`; misma clave con otra
  entidad/campo; declaración incompleta (entidad sin campo) o no literal. El contrato además exige que la entidad exista (alguien
  la produce), que el `campo` esté entre los publicados y que la clave exista en el test.
- **No determinado:** una clave suelta (`codigo`), un fixture, un nombre o un label **no** crean un requires; `testContext.get(CASO,
  'codigo')` es sin tipo. `solicitud.codigo` ← clave `codigo` y `requisicion.nombre` ← `Requisición` se declaran, no se infieren.
- **Resultado en el repo:** 9 tests declaran requires (1 además lo detecta por lectura tipada); ~10 archivos tocados, no los 127.
  `orden` sigue en `flujo-tests.js` (regla de negocio).

### `requires` por estructura (`ENTIDAD_FLUJO`) — implementado

La fuente de `requires` con valores que más metadata ahorra: el Page Object de listado declara **una vez** qué entidad localiza su
`abrirDetalle` (`static get ENTIDAD_FLUJO() { return { tipo, referencia, metodos? }; }`). El escáner (`core/utils/flowEstructura.js`)
sigue, sin ejecutar, test → fixture (`ctx.lista = <PO>`) o `new PO` → contrato, y el valor de `testContext.get(CASO, 'k')` hasta el
localizador (asignaciones simples, `a || b`, `parsearValoresMultiples`, `for…of`, helper del módulo de fixtures a un salto, clave
literal o constante). Resultado: `requires { tipo, clave: k, campo: referencia }`, el mismo que el planner ya conocía; el runtime no
cambia (sin entidad producida, el test usa su automático; individual no cambia).

- **Declarados hoy:** `SolicitudEmpleoPage` (solicitud/codigo), `RequisicionesPage` (requisicion/nombre), `EmpleadosPage`
  (empleado/**nombre**: se verificó en vivo que el buscador del listado no indexa "Código de empleado.", buscar un código existente
  devuelve 0 filas, mientras que el nombre completo sí localiza al empleado) y
  `NominaPage` (empleado/codigo vía `seleccionarEmpleadoPorCodigo`).
- **Lo que no se deduce:** un Page Object sin contrato (catálogos de Configuración, usuarios…: ningún test los publica todavía), tests
  que eligen el registro automáticamente sin clave de contexto, y controles de formulario (`Requisición` en el alta de solicitud):
  esos se declaran una vez en `ESTRATEGIAS` del Page Object.
- **Efecto de producto:** en un flujo, un test que consume una entidad producida opera sobre ella (p. ej. los consultar/editar de
  Empleados sobre el empleado creado por el flujo); fuera de un flujo conservan su comportamiento.

### Escáner de contrato (diagnóstico) — implementado, mínimo
`node core/scripts/flujo-escanear.js <modulo>/<caso>` (o `--todo`) separa **DETECTADO CON CERTEZA** (`produces` del código y su
coincidencia con la metadata), **POSIBLE / SUGERIDO** (fixture, claves de entrada, lecturas tipadas: solo informativo, sin inferir tipos
por nombre) y **NO DETERMINADO** (requires, campo, orden, auto). No escribe nada ni convierte inferencias en metadata. Útil como
checklist al agregar un test nuevo; el contrato es lo que lo hace obligatorio.

## 8. Producción estructural de entidades (crear / agregar / editar / eliminar) — implementado

Regla normativa en GUIDELINES §12 ("Producción de entidades"). Resumen del diseño y de lo que queda fuera:

- **Una sola declaración por Page Object** (`ENTIDAD_FLUJO`: `tipo`, `referencia`, `metodos`, `creadores`, `editores`, `eliminadores`,
  `confirmadores`) que leen el escáner (`flowContratos.js` + `flowEstructura.js`) y la capa común de publicación (`flowInstrumentar.js`,
  invocada desde el constructor de `UiContext`, inerte fuera de un flujo). Los tests no agregan líneas.
- **Decisiones de negocio ya aplicadas:** subentidades = entidades propias con su padre como `requires`; educación / experiencia / habilidad /
  comentario de requisición / comentario de solicitud / pregunta = entidades distintas; fotos, valoraciones, otros beneficios, miembros y
  permisos de grupo y el traslado a Banco de candidatos NO lo son (`ACCIONES_FLUJO`); `cambiar-solicitud-crear-empleado` conserva su `publish`.
- **Pendiente / no determinado hoy:** editar secciones del empleado (`editar-datos-*`, `editar-paquete-salarial`: transformación de `empleado`
  cuyo nombre puede cambiar; falta un contrato de edición del detalle), tests que reciben el detalle desestructurado de `abrirAleatoria()`
  (`agregar-foto/valoracion-*`, atributos igualmente excluidos), documentos de requisición (hay referencia —archivo + clasificación— pero no
  operaciones posteriores) y `crear-empleado` (publica el nombre; el código no está disponible al guardar).

## 9. Pendientes futuros

- Historial de flujos en el Historial del Panel (hoy el Panel solo muestra el flujo actual; los reportes quedan en `flujo/reports/`).
- Metadata `flujo-tests.js`: solo cubre la cadena requisición → solicitud → empleado → nómina; `produces` y `requires` ya se derivan del código (§7); solo hace falta `orden` en `flujo-tests.js`.
