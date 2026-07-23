# Panel de Control Web — Diseño de Interfaz (UI)

> **Rol de este documento.** Diseño **conceptual de la interfaz visual** para que un diseñador humano la construya después. No es código, no es HTML, no es CSS, no es Figma. Es la especificación de **sistema visual, layout, jerarquía, tokens, estados y componentes**, con la justificación de cada decisión.
>
> **Base.** Se apoya en lo aprobado: [README](../README.md), [Guidelines](../CLAUDE_FRAMEWORK_GUIDELINES.md), [arquitectura de la plataforma](./plataforma-de-control-arquitectura.md), [arquitectura del panel](./panel-de-control-web-arquitectura.md), y muy especialmente el [diseño de experiencia (UX)](./panel-de-control-web-experiencia-ux.md), del que este documento es la **capa visual**: la UX define *el orden y el comportamiento*; esta UI define *cómo se ve y con qué reglas visuales*.
>
> **Identidad visual: obligatoria y cerrada.** No se propone una paleta nueva. Los cuatro colores de marca dados son la base; todo lo demás (hover, active, disabled, fondos, bordes, textos, estados) se **deriva** de ellos + un blanco cálido + una escala de grises + colores de estado que armonizan. Los hex derivados son **propuestas ajustables**, no dogmas: lo fijo son los cuatro colores de marca y las *reglas* de derivación.
>
> **Restricción rectora (una sola alta atención).** En cualquier pantalla, **un único elemento** usa el color de acción `#DE1579` como relleno: el botón **Ejecutar**. Todo lo demás permanece visualmente neutro. Esta regla gobierna cada decisión de abajo.

---

## 0. Índice

- [1. Filosofía visual y referentes](#1-filosofía-visual-y-referentes)
- [2. Sistema de color (tokens derivados de la identidad)](#2-sistema-de-color-tokens-derivados-de-la-identidad)
- [3. Jerarquía visual](#3-jerarquía-visual)
- [4. Escala tipográfica](#4-escala-tipográfica)
- [5. Sistema de espaciado y densidad](#5-sistema-de-espaciado-y-densidad)
- [6. Iconografía](#6-iconografía)
- [7. Layout general](#7-layout-general)
- [8. Sidebar y árbol de módulos](#8-sidebar-y-árbol-de-módulos)
- [9. Header](#9-header)
- [10. Panel principal y tarjeta del caso](#10-panel-principal-y-tarjeta-del-caso)
- [11. Editor de parámetros (Execution Context)](#11-editor-de-parámetros-execution-context)
- [12. Consola en vivo](#12-consola-en-vivo)
- [13. Visor del reporte HTML](#13-visor-del-reporte-html)
- [14. Visor de screenshots y de evidencias](#14-visor-de-screenshots-y-de-evidencias)
- [15. Historial de ejecuciones](#15-historial-de-ejecuciones)
- [16. Variantes de botones](#16-variantes-de-botones)
- [17. Estados visuales](#17-estados-visuales)
- [18. Responsive](#18-responsive)
- [19. Componentes reutilizables](#19-componentes-reutilizables)
- [20. Consistencia visual cuando el proyecto crezca](#20-consistencia-visual-cuando-el-proyecto-crezca)
- [21. Cierre](#21-cierre)

---

## 1. Filosofía visual y referentes

La interfaz debe leerse como una **herramienta para desarrolladores**, no como un dashboard de gestión. El norte visual es **VS Code / GitHub Desktop / Postman / Azure DevOps**: cromo oscuro y sobrio, contenido claro y denso, foco en el trabajo, cero decoración. El anti-norte es **Notion / Monday / Jira**: mucha tarjeta, mucho color, mucho gráfico.

**Decisiones de partida (y su justificación):**
- **Cromo oscuro + lienzo claro.** El sidebar/header usan el indigo `#211D34`; el área de trabajo usa un blanco cálido. Es el patrón de GitHub Desktop / Azure DevOps: el cromo oscuro ancla la navegación y hace que la acción magenta *resalte* sobre claro. *Justificación:* separa "navegación" (oscuro, estable) de "trabajo" (claro, cambiante) sin una sola línea de decoración.
- **Superficies planas, jerarquía por espacio y peso, no por sombra.** Se prohíben gradientes, glassmorphism, neumorphism y sombras exageradas. La elevación mínima (una tarjeta) se logra con **borde hairline** y, a lo sumo, una sombra sutilísima. *Justificación:* sobriedad y velocidad de lectura; las sombras y gradientes envejecen y distraen.
- **Color como semántica, no como adorno.** El magenta = acción. El verde/rojo = veredicto. El resto, neutro. *Justificación:* cumplir la regla de una sola alta atención y evitar "colores llamativos por todos lados".
- **Densidad de herramienta.** Tipografía chica (13px base), filas compactas, mucho contenido visible sin scroll — como un editor de código, no como una landing. *Justificación:* el QA trabaja horas; la densidad reduce scroll y cambio de contexto.
- **Movimiento mínimo.** Transiciones cortas y funcionales (aparición de la consola, colapsables); nada decorativo. *Justificación:* "sin animaciones innecesarias".

---

## 2. Sistema de color (tokens derivados de la identidad)

Los cuatro colores de marca son la base **inamovible**; el resto se deriva manteniendo el matiz para armonizar con el ecosistema.

### 2.1. Marca (dado)

| Token | Hex | Uso |
|---|---|---|
| `brand/indigo` (Primario) | **#211D34** | Sidebar, header, cromo oscuro, base de la consola, árbol de módulos. |
| `brand/wine` (Secundario) | **#600132** | Estados activos, énfasis secundario, encabezados importantes, acentos en el cromo oscuro. |
| `brand/magenta` (Acción) | **#DE1579** | **Único** color de alta atención: botón Ejecutar, focus ring, links realmente importantes. |
| `brand/magenta-hover` | **#B02D6E** | Hover del botón principal, switch encendido, acento de selección. |

### 2.2. Derivados de indigo `#211D34` (cromo oscuro)

Se derivan escalones más claros del mismo matiz para hover/selección/bordes **dentro** del cromo oscuro.

| Token | Hex (propuesta) | Uso |
|---|---|---|
| `indigo/950` | #191527 | Header (un punto más oscuro que el sidebar, para separarlos). Base de la consola. |
| `indigo/900` | #211D34 | Sidebar / superficie oscura base. |
| `indigo/800` | #2C2740 | Hover de filas del árbol. |
| `indigo/700` | #39334F | Fila seleccionada (relleno), bordes internos del cromo. |
| `indigo/600` | #4B4568 | Divisores sobre oscuro, texto deshabilitado sobre oscuro. |
| `indigo/500` | #746C90 | Texto secundario sobre oscuro. |

### 2.3. Derivados de magenta / wine (acción y énfasis)

| Token | Hex (propuesta) | Uso |
|---|---|---|
| `magenta/600` | #DE1579 | Relleno del CTA (Ejecutar). |
| `magenta/700` | #B02D6E | Hover del CTA, selección/switch on. |
| `magenta/800` | #93245C | CTA presionado (active). |
| `magenta/tint` | #FCE9F2 | Fondo sutil de focus/selección **en claro**, uso mínimo. |
| `wine/800` | #600132 | Encabezados importantes, chips de énfasis secundario. |
| `wine/700` | #7A0842 | Hover de ítems de menú sobre oscuro. |

### 2.4. Blanco cálido y grises (lienzo claro)

Nada de blanco puro dominante. El lienzo es un blanco **ligeramente cálido** que equilibra el índigo frío; los grises llevan un matiz cálido para armonizar.

| Token | Hex (propuesta) | Uso |
|---|---|---|
| `canvas` | #FAF8F6 | Fondo dominante del área de trabajo (blanco cálido). |
| `surface` | #FFFFFF | Tarjetas/paneles elevados, **uso puntual** (no dominante). |
| `gray/50` | #F3F0EC | Fondos sutiles (hover de fila en claro, zona de código). |
| `gray/100` | #E7E2DC | Divisores. |
| `gray/200` | #D6CFC7 | Bordes (inputs, tarjetas). |
| `gray/300` | #BBB4AB | Bordes fuertes, íconos deshabilitados. |
| `gray/400` | #9A938A | Texto deshabilitado, íconos secundarios. |
| `gray/500` | #6E675F | Texto secundario / meta. |
| `gray/700` | #38332E | Texto de cuerpo fuerte. |
| `text/strong` | #211D34 | Títulos y texto principal (**se ata al índigo de marca** para coherencia). |

### 2.5. Colores de estado (armonizados, apagados, "dev-tool")

Apagados y de baja saturación para no competir con la marca ni parecer un tablero de métricas.

| Token | Texto/Icono | Fondo tinte | Borde | Uso |
|---|---|---|---|---|
| `success` | #2E8B62 | #E6F2EB | #C2E0CE | Test **Aprobado**. |
| `warning` | #B57A20 | #F6ECD8 | #E7D3A8 | Cancelado, advertencias, datos faltantes. |
| `error` | #C43C3C | #F7E5E4 | #EAC3C1 | Test **Falló** / no pudo ejecutarse. |
| `info` | #3E6EA6 | #E7EEF6 | #C6D8EB | **Ejecutando**, mensajes informativos. |

> **Decisión crítica — rojo de error ≠ magenta de acción.** El error usa un rojo cálido (`#C43C3C`), claramente distinto en matiz del magenta de acción (`#DE1579`). *Justificación:* si el "falló" se pareciera al "ejecutar", el usuario confundiría estado con acción — el error de UX más caro (ya señalado en el doc UX). El magenta es **siempre** interacción; el rojo es **siempre** estado/fallo. Nunca se cruzan.

> **Mapeo de veredictos (canal semántico, separado del canal de acción):** Aprobado → `success`; Falló / No arrancó → `error`; Ejecutando → `info`; Sin ejecutar / Pendiente → `gray/400` (neutro); Cancelado → `warning`.

### 2.6. Cómo convive esto con "una sola alta atención"

- **Relleno magenta:** exclusivo del botón Ejecutar (uno por pantalla).
- **Acentos magenta mínimos** (focus ring, barra de 2px del ítem seleccionado): son *wayfinding*, no CTAs; su área es ínfima y no compiten como "elemento de atención". Se permiten y se justifican como orientación, no como llamada a la acción.
- **Verdes/rojos:** viven en un canal distinto (estado), en chips pequeños, sin rellenos grandes.
- **Todo lo demás:** neutro (grises + índigo), diferenciado por peso tipográfico y espacio.

---

## 3. Jerarquía visual

Orden de captura de la atención, de mayor a menor, logrado con **color, peso y espacio** (nunca con sombra/gradiente):

1. **Acción principal** — botón Ejecutar (relleno magenta). Lo primero que el ojo encuentra en el panel del caso.
2. **Veredicto** — chip de estado (verde/rojo) del resultado. Segundo, porque responde "¿pasó?".
3. **Identidad del caso** — nombre en `text/strong`, peso semibold, tamaño de encabezado.
4. **Ítem activo en el árbol** — relleno `indigo/700` + barra de acento de 2px.
5. **Etiquetas y encabezados de sección** — medium, `text/strong`.
6. **Contenido / cuerpo** — regular, `gray/700`.
7. **Meta y secundario** — `gray/500`, tamaño small.

*Justificación:* con la paleta restringida y sin efectos, la jerarquía se sostiene en tres palancas sobrias (contraste de color acotado, peso, aire). Es lo que hace que VS Code se sienta ordenado sin decorar nada.

---

## 4. Escala tipográfica

**Familias (recomendación, no imposición):**
- **UI:** una sans humanista y densa optimizada para pantalla — *Inter* (o el stack de sistema `system-ui`). *Justificación:* legibilidad a 12–13px, la que usan las dev-tools.
- **Monoespaciada:** para la consola, el código del test y los identificadores kebab de los casos — *JetBrains Mono* / *Cascadia Code* / `ui-monospace`. *Justificación:* el nombre `publicar-requisicion` y los logs se leen mejor en mono; refuerza el carácter "developer tool".

**Escala (base 13px, razón ~1.2, sobria — sin titulares grandes):**

| Rol | Tamaño | Peso | Interlineado | Uso |
|---|---|---|---|---|
| Título de página | 20px | 600 | 1.3 | Nombre del caso / de la corrida. |
| Encabezado de sección | 16px | 600 | 1.35 | "Parámetros", "Última ejecución". |
| Subtítulo / etiqueta | 13px | 500 | 1.4 | Labels de campos, encabezados de fila. |
| **Cuerpo (base)** | **13px** | 400 | 1.5 | Texto general. |
| Secundario | 12px | 400 | 1.45 | Meta, descripciones, timestamps. |
| Micro / caption | 11px | 500 | 1.4 | Chips, contadores, hints. |
| Mono (consola/código) | 12–13px | 400 | 1.5 | Logs, stack, código. |

**Reglas:** máximo tres pesos (400/500/600); evitar bold 700 salvo énfasis puntual; nunca mayúsculas sostenidas salvo micro-etiquetas de sección (tracking ligero). *Justificación:* la tipografía "callada" es la firma de las herramientas profesionales; los titulares grandes gritarían "dashboard".

---

## 5. Sistema de espaciado y densidad

**Unidad base 4px.** Escala: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Caballos de batalla: **8 y 12** (denso). 24/32 solo para separar secciones grandes.

| Token | px | Uso típico |
|---|---|---|
| `space/1` | 4 | Gaps mínimos (icono↔texto). |
| `space/2` | 8 | Padding de fila del árbol, gap entre chips. |
| `space/3` | 12 | Padding interno de controles, separación de campos. |
| `space/4` | 16 | Padding de paneles/tarjetas. |
| `space/6` | 24 | Separación entre secciones del detalle. |
| `space/8` | 32 | Márgenes mayores / cabeceras. |

**Densidad (medidas guía):** fila del árbol ~28px de alto; botón por defecto 32px (compacto 28px); input 32px; icono UI 16px; radios de esquina: 6px (botones/inputs/chips), 8px (tarjetas/paneles). *Justificación:* densidad de editor de código: mucho contenido, poco scroll, sin sensación apretada gracias al ritmo de 4px.

---

## 6. Iconografía

- **Estilo:** line icons monocromáticos, **trazo uniforme (~1.5px)**, grilla de 16px (20px para acentos). Heredan el color del texto; nunca multicolor.
- **Familia recomendada:** *Codicons* (los de VS Code — encajan perfecto con el carácter dev-tool) o *Lucide*/*Phosphor*. *Justificación:* consistencia inmediata con el mundo de herramientas de desarrollo; open source; un solo peso de trazo.
- **Color:** neutro (`gray/500`), `text/strong` cuando es interactivo primario; **magenta solo** en el ícono del botón Ejecutar y en focus. Estados: verde/rojo solo en íconos de veredicto.

**Mapa de íconos (semántica → glifo conceptual):**

| Concepto | Ícono | Concepto | Ícono |
|---|---|---|---|
| Módulo | contenedor / paquete | Ejecutar | play (triángulo) |
| Suite / carpeta | carpeta | Ejecutar carpeta | carpeta+play |
| Caso / test | archivo-check / matraz | Ejecutar módulo | pila+play |
| Aprobado | check | Cancelar / detener | cuadrado (stop) |
| Falló | x / círculo-x | Ejecutando | spinner / sync |
| Sin ejecutar | círculo vacío | Editar contexto | lápiz |
| Screenshot | imagen | Reporte | documento |
| Log / salida | terminal / lista | Código | `</>` |
| Evidencia | clip | Historial | reloj-flecha |
| Buscar | lupa | Refrescar | flechas circulares |
| Expandir/colapsar | chevron | Ambiente | servidor / etiqueta |

*Justificación:* un solo lenguaje icónico, monocromo y de un trazo, evita el ruido visual; los íconos aportan *escaneabilidad* al árbol y a las secciones sin agregar color.

---

## 7. Layout general

Tres zonas fijas estilo editor de código + una zona de consola que emerge. Cromo oscuro, trabajo claro.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◆ Panel de Automatización            env: test        ⟳    ● corrida activa   │  HEADER  (indigo/950)
├────────────────────┬─────────────────────────────────────────────────────────┤
│ [ Tests | Histor. ]│  publicar-requisicion                        ┃Aprobado┃  │
│  ⌕ buscar test…    │  Publica una requisición autorizada y valida…            │
│                    │  ──────────────────────────────────────────────────────  │
│  ▾ ▤ Reclutamiento │   ▐ Ejecutar ▌   Ejecutar carpeta   Ejecutar módulo  ⋯    │  ← CTA magenta / resto neutro
│    ▸ Login         │                                                          │
│    ▾ Requisiciones │  ▾ Parámetros (Execution Context)                        │
│      • Crear       │      nombreRequisicion  [________________]               │
│    ┃►publicar   ✔  │      estado             [ Autorizada        ▾]           │  MAIN (canvas, blanco cálido)
│      • Pausar      │                                    [ Guardar ]           │
│      • Importar    │  ▸ Última ejecución · hoy 09:12 · 3.2s · Aprobado         │
│                    │  ▸ Screenshots (4)                                       │
│  ▸ ▤ Nómina        │  ▸ Logs                                                  │
│  ▸ ▤ Portal        │  ▸ Código del test                                       │
│                    │  ▸ Reporte HTML                                          │
├────────────────────┴─────────────────────────────────────────────────────────┤
│ ▤ CONSOLA · publicar-requisicion                     N/N · 3.2s   [ Detener ] │  BOTTOM CONSOLE (indigo/950)
│ 09:12:01 Iniciando: publicar-requisicion…                                     │  (emerge al ejecutar)
│ 09:12:03 Finalizado: publicar-requisicion [passed] (3200ms)                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Decisiones:**
- **Sidebar oscuro fijo (redimensionable) + main claro.** El árbol es el "explorador de archivos". *Justificación:* el patrón mental que el usuario ya tiene (VS Code).
- **Consola como panel inferior que emerge al ejecutar**, colapsable, sobre base oscura (terminal). *Justificación:* mantiene el contexto (árbol + detalle siguen visibles) — cumple el principio UX "ejecutar sin navegar afuera" — y es el patrón de terminal integrada.
- **Sin barra de métricas, sin tarjetas KPI.** El "home" es simplemente el árbol + estado reciente. *Justificación:* no es un dashboard.

---

## 8. Sidebar y árbol de módulos

Superficie `indigo/900`. Arriba, un **toggle segmentado** minimal `[ Tests | Historial ]` y un **buscador**. Debajo, el árbol descubierto.

```
 [ Tests | Historial ]      ← segmentado; activo = texto claro + barra magenta 2px
 ⌕ buscar test…             ← input sobre indigo/800, texto claro

 ▾ ▤ Reclutamiento          ← módulo (indigo/500 icon, texto claro)
   ▸ Login                  ← suite/carpeta colapsada
   ▾ Requisiciones
     • Crear            ○   ← caso; ○ = sin ejecutar (gris)
   ┃►publicar          ✔   ← SELECCIONADO: relleno indigo/700 + barra magenta 2px; ✔ verde
     • Pausar           ✗   ← ✗ rojo (falló)
     • Importar        �𝄁   ← spinner (ejecutando)
```

**Anatomía de la fila (alto ~28px):** `[chevron] [ícono tipo] [etiqueta]  ……  [estado]  [▷ al hover]`.
- **Estado del caso** a la derecha con un glifo pequeño de color semántico (✔ verde / ✗ rojo / ○ gris / spinner info). Es la única inyección de color de estado en el árbol, mínima.
- **Ejecutar al hover:** un ícono ▷ *neutro* (no magenta) aparece al pasar el cursor para correr sin abrir el detalle (atajo). *Justificación:* velocidad; el magenta se reserva al CTA del panel, así que aquí el play es neutro.
- **Seleccionado:** relleno `indigo/700` + barra de acento magenta 2px a la izquierda. **Hover:** `indigo/800`.
- **Texto:** claro sobre oscuro; secundario `indigo/500`.

*Justificación:* el árbol es navegación pura, por eso vive en el cromo oscuro y usa color solo para el estado (mínimo) y una barra de acento para orientación.

---

## 9. Header

Barra fina (~44px) sobre `indigo/950`, un punto más oscuro que el sidebar para separarlos sin borde.

```
 ◆ Panel de Automatización          env: test          ⟳        ● corrida activa
 └ logo+nombre (izq)                └ ambiente (chip)   └refrescar └ indicador persistente
```

- **Izquierda:** marca discreta (un glifo + nombre en peso medium). Sin logotipo grande.
- **Centro/derecha:** **chip de ambiente** (de `RunEnvironment`: test/QA) en neutro; **refrescar** (ícono); **indicador de corrida activa persistente** — un punto `info` + texto "corrida activa", clickeable para volver a la consola en vivo (cumple el requisito UX de no perder el desenlace al navegar). Al terminar, cambia a "ver resultado".
- **Sin magenta en el header** (salvo focus). *Justificación:* el header es contexto global, no acción; la única acción alta vive en el panel del caso.

---

## 10. Panel principal y tarjeta del caso

Fondo `canvas`. La parte superior es la **tarjeta de información del caso** (no una "card" flotante recargada: un bloque con borde inferior hairline, sin sombra).

```
 publicar-requisicion                                              ┃ Aprobado ┃
 Publica una requisición autorizada y valida el switch y el notify.
 módulo: Reclutamiento · suite: Requisiciones · pantallas: listado, detalle
 ──────────────────────────────────────────────────────────────────────────────
  ▐ Ejecutar ▌   Ejecutar carpeta   Ejecutar módulo                          ⋯
```

- **Encabezado:** nombre (título de página, mono opcional para el id) + **chip de veredicto** a la derecha. Descripción en secundario. Una línea de meta (módulo/suite/pantallas) en `gray/500`.
- **Barra de acciones:** **Ejecutar** es el **único** botón con relleno magenta; *Ejecutar carpeta* y *Ejecutar módulo* son **secundarios neutros** (contorno/ghost). Un menú `⋯` guarda acciones raras ("Ejecutar todos" — con confirmación, ver §16/§17). *Justificación directa de la regla de una alta atención.*
- **Debajo:** secciones **colapsables** en este orden (revelación progresiva del doc UX): Parámetros, Última ejecución (abierta si hay resultado), Screenshots, Logs, Código, Reporte. Todas con encabezado clickeable + chevron.

*Justificación:* "verdad y acción primero"; el detalle vive plegado tras puertas rotuladas. Sin tarjetas múltiples: una superficie continua con divisores hairline.

---

## 11. Editor de parámetros (Execution Context)

Renderiza el **Input Model** (nunca inventa campos). Formulario denso, etiquetas arriba, controles neutros.

```
 ▾ Parámetros (Execution Context)                        origen: formulario ⓘ
    nombreRequisicion   [________________________]        (vacío ⇒ automático)
    estado              [ Autorizada              ▾]       requerido *
    clasificacion       [ CV ▾ ] [ Identificación ▾ ]…     enum
    archivo             [ Elegir…  documento-qa.txt ]      file
                                                   [ Descartar ]  [ Guardar ]
```

- **Controles por `type` del Input Model:** texto, select (enum con sus `options`), switch, campo de archivo. Los **campos de formulario** se agrupan con una nota "origen: formulario"; los **declarados** (caso sin formulario) aparecen como los parámetros mínimos.
- **Vacío es válido:** hint discreto "(vacío ⇒ el framework lo descubre)". Requeridos marcados con `*`.
- **Guardar** es **secundario neutro** (no magenta: la alta atención sigue siendo Ejecutar). Aparece "Guardado" al confirmar.
- **Switch encendido** usa `magenta-hover` (según la identidad: "switches activos"); apagado neutro.
- **Estado sin parámetros:** mensaje "Este caso no requiere datos de entrada" (no un formulario vacío).

*Justificación:* formulario sobrio tipo Postman (labels arriba, inputs de 32px, sin adornos); el color se reserva y Guardar no compite con Ejecutar.

---

## 12. Consola en vivo

Panel inferior sobre `indigo/950`, tipografía mono, autoscroll. Cabecera con contexto y **Detener**.

```
 ▤ CONSOLA · publicar-requisicion                 3 / 4 · 00:07   [ Detener ]
 ────────────────────────────────────────────────────────────────────────────
 09:12:01  Iniciando: crear-req-comentarios…
 09:12:04  Finalizado: crear-req-comentarios [passed] (2900ms)      ✔
 09:12:04  Iniciando: publicar-requisicion…                          ◀ actual
 …
```

- **Base oscura tipo terminal** (convención universal, incluso en UIs claras).
- **Cabecera:** contexto (qué corre) + **progreso N/total + tiempo** + **Detener** (secundario neutro, no rojo salvo al confirmar).
- **Líneas:** timestamp en `indigo/500`, texto claro; los "Finalizado … [passed]/[failed]" reciben un glifo de estado ✔/✗ de color semántico al margen (mínimo). Línea actual marcada con un indicador sutil.
- **Autoscroll** con botón "seguir" que se desactiva si el usuario scrollea arriba (patrón de terminal).
- **Colapsable:** se retrae a una barra fina cuando no hay corrida.

*Justificación:* el usuario lee la consola como un log; la base oscura y la mono lo hacen natural, y el progreso arriba responde "¿está avanzando?".

---

## 13. Visor del reporte HTML

El reporte de Mochawesome ya existe; el panel lo **enmarca**, no lo redibuja.

```
 ▾ Reporte HTML                       corrida: 2026-07-23 09-12-03   [ Abrir ↗ ]
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  (reporte Mochawesome incrustado — se carga bajo demanda)                 │
 └──────────────────────────────────────────────────────────────────────────┘
```

- **Bajo demanda:** no se incrusta hasta expandir (es pesado; ver riesgo UX). Botón **Abrir ↗** para verlo en pestaña aparte.
- **Marco neutro:** una barra de herramientas fina (qué corrida, abrir en pestaña, refrescar) sobre el contenido embebido tal cual.
- *Justificación:* cero reimplementación (respeta "no duplicar"); el marco solo aporta contexto y la opción de desacoplarlo a una pestaña por peso.

---

## 14. Visor de screenshots y de evidencias

**Screenshots** — galería de miniaturas + lightbox. Colapsada a la **captura clave** (la del fallo, o la final); expande a todas en orden temporal con su `label`.

```
 ▾ Screenshots (4)
 [▢ Antes de guardar] [▢ Tras pulsar]  [▢ FALLO ✗]  [▢ Listado]
                                         └ borde error, destaca la del fallo
```

- **Miniaturas** con borde hairline; la del **fallo** lleva borde `error` para saltar a la vista. Clic → lightbox a tamaño completo con navegación ‹ ›.
- **Etiqueta** (`label` del artefacto) bajo cada miniatura, en secundario.

**Evidencias** — lista de filas por tipo (JSON de bloqueo, log, etc.), no una galería.

```
 ▾ Evidencias (2)
   ⟨json⟩  bloqueo · pausar-requisicion            [ Ver ]
   ⟨log ⟩  execution.log                            [ Ver ]
```

- **Fila:** ícono de tipo + nombre + acción **Ver** (abre el contenido en un visor de texto/imagen según tipo). Neutro.
- *Justificación:* screenshots son visuales (galería); evidencias son documentos (lista) — dos patrones distintos para dos naturalezas, ambos sobrios.

---

## 15. Historial de ejecuciones

Segunda vista del sidebar (toggle `Historial`), alimenta el **mismo** panel principal. Lista de corridas (`reports/<RUN_ID>/`), ordenadas por su timestamp.

```
 [ Tests | Historial ]
 ⌕ filtrar…
 ──────────────────────
  hoy 09:12:03   ✔ 4/4      ← corrida: verde si todo pasó
  hoy 09:04:41   ✗ 3/4      ← rojo si hubo fallos; "3/4" = pasaron/total
  ayer 17:30:10  ✔ 12/12
```

- **Fila:** timestamp legible (derivado del `RUN_ID`) + resumen pasaron/total con glifo de estado. Clic → el panel principal muestra el **detalle de esa corrida** (mismas secciones de evidencia: reporte, screenshots, logs).
- **Sin métricas ni gráficos.** Es una lista, no un dashboard. *Justificación:* "reutilizar el historial que el framework ya conserva" de la forma más simple; cualquier tendencia/flakiness pertenece al doc de la plataforma.

---

## 16. Variantes de botones

Radio 6px, alto 32px (compacto 28px), peso medium, ícono opcional a la izquierda. **Un solo primario por pantalla.**

| Variante | Relleno / borde | Texto | Hover | Active | Disabled | Uso |
|---|---|---|---|---|---|---|
| **Primario (CTA)** | relleno `magenta/600` | blanco cálido | `magenta/700` | `magenta/800` | `gray/200` bg + `gray/400` texto | **Solo** Ejecutar (el caso). |
| **Secundario** | borde `gray/200`, fondo `canvas` | `gray/700` | fondo `gray/50` | fondo `gray/100` | borde `gray/100` + `gray/400` | Ejecutar carpeta/módulo, Guardar, Cancelar. |
| **Ghost / terciario** | sin borde | `gray/600` | fondo `gray/50` | fondo `gray/100` | `gray/400` | Toggles de sección, acciones menores. |
| **Link** | — | `magenta/600` (uso puntual) | subrayado | `magenta/800` | `gray/400` | Links realmente importantes (según identidad). |
| **Peligro** | borde `error`, texto `error`; relleno `error` **solo al confirmar** | — | tinte `error` | — | — | "Ejecutar todos", limpiar (si se expone). |
| **Icon-button** | ghost cuadrado | ícono `gray/500` | fondo `gray/100` | — | `gray/300` | Refrescar, expandir, detener, `⋯`. |
| **On-dark (chrome)** | ghost | ícono blanco cálido | `indigo/800` | `indigo/700` | `indigo/600` | Acciones del sidebar/header. |

**Focus (todas):** ring `magenta/600` de 2px con offset. *Justificación:* accesibilidad + coherencia; el focus es momentáneo y singular, no rompe la regla de una alta atención.

---

## 17. Estados visuales

### 17.1. Estados de ejecución (del caso / corrida)

| Estado | Señal visual |
|---|---|
| **Sin ejecutar** | Chip neutro `gray`, "Sin ejecutar". CTA Ejecutar destacado. |
| **Iniciando** | Consola emerge; chip `info` "Iniciando…"; spinner sutil. (Evita el "¿se colgó?"). |
| **Ejecutando** | Chip `info` "Ejecutando"; progreso N/total + tiempo en consola; botón Detener; indicador persistente en header. El CTA muestra estado "en curso" (no re-disparable). |
| **Aprobado** | Chip `success` "Aprobado"; captura final; enlace a reporte; CTA vuelve a "Ejecutar". |
| **Falló** | Chip `error` "Falló"; **encabezado del error primero** + captura del fallo (borde `error`); logs/stack/código a un clic. |
| **Cancelado** | Chip `warning` "Cancelado"; nota "lo ejecutado se conservó". |

### 17.2. Estados vacíos

Patrón único: **ícono tenue + mensaje breve + próxima acción**. Nunca un espacio mudo.

```
        ▢
   Sin ejecuciones todavía
   [ Ejecutar ]
```

Casos: sin módulos ("no se encontraron tests"), módulo sin casos, **caso nunca ejecutado** (estado de primera clase, no error), corrida sin screenshots ("modo sin capturas"), contexto sin parámetros, historial vacío.

### 17.3. Estados de error

Se distinguen **dos familias** con tratamiento visual distinto (decisión clave del doc UX):

- **Fallo del test** (semántico, esperado) → chip `error` + evidencia; es "trabajo hecho".
- **No pudo ejecutarse / crasheó** (entorno) → **banner** `error` distinto, con el texto crudo del intento y la aclaración "no es un fallo del test; revisá el entorno". Ícono distinto (advertencia de sistema, no ✗ de test).

Otros: conflicto al guardar contexto (diálogo "sobrescribir / recargar"), artefacto faltante (marcador discreto "no disponible", sin romper la vista), resultado ausente ("no se encontró el resultado" + ver logs).

*Justificación:* el color de error es el mismo, pero el **patrón** (chip junto al caso vs. banner de sistema) y el **ícono** separan "el test falló" de "el sistema falló".

---

## 18. Responsive

**Desktop-first** (es una herramienta de escritorio; los referentes lo son).

| Ancho | Comportamiento |
|---|---|
| **≥ 1280px (óptimo)** | Tres zonas completas; consola inferior con altura cómoda. |
| **1024–1280px** | Sidebar más angosto; consola con altura reducida; barra de acciones puede colapsar secundarias en `⋯`. |
| **768–1024px (tablet)** | Sidebar pasa a **cajón superpuesto** (toggle en el header); el detalle ocupa el ancho; consola como hoja inferior superpuesta. |
| **< 768px (teléfono)** | **No es objetivo de diseño.** Degradación de solo consulta: árbol y detalle apilados, edición/ejecución posibles pero no optimizadas. Declarado explícitamente fuera de alcance. |

*Justificación:* honestidad de alcance — nadie automatiza desde el teléfono; forzar un diseño móvil complejo contradiría "extremadamente simple".

---

## 19. Componentes reutilizables

Inventario mínimo del que se compone todo (una sola definición por componente → consistencia):

| Componente | Rol | Notas |
|---|---|---|
| **App shell** | header + sidebar + main + consola | Grilla fija; consola emergente. |
| **Tree / TreeRow** | árbol de módulos/suites/casos | Ícono tipo, etiqueta, glifo de estado, play al hover, seleccionado con barra de acento. |
| **Segmented toggle** | `Tests \| Historial` | Activo = barra magenta. |
| **Search input** | filtro del árbol/historial | Neutro; versión on-dark. |
| **Button** | 6 variantes (§16) | Un solo primario por pantalla. |
| **Icon button** | acciones compactas | Ghost cuadrado. |
| **Status chip** | veredicto/estado | success/error/info/warning/neutral. |
| **Case header** | identidad + veredicto + acciones | Bloque con divisor hairline, sin sombra. |
| **Collapsible section** | revelación progresiva | Encabezado + chevron; recuerda estado en sesión. |
| **Field controls** | text / select / switch / file | Renderizan el Input Model; labels arriba. |
| **Console / Log viewer** | salida en vivo y logs | Base oscura, mono, autoscroll, glifos de estado. |
| **Screenshot gallery + Lightbox** | capturas | Miniatura destacada del fallo. |
| **Evidence list row** | evidencias no visuales | Ícono de tipo + Ver. |
| **Report frame** | reporte Mochawesome | Embebido bajo demanda + abrir en pestaña. |
| **History list row** | corridas | Timestamp + pasaron/total + estado. |
| **Empty state** | vacíos | Ícono tenue + mensaje + acción. |
| **Error banner / inline** | errores | Dos patrones: chip (test) vs banner (sistema). |
| **Progress indicator** | ejecución | N/total + tiempo; spinner. |
| **Confirm dialog** | acciones de riesgo | Consecuencia concreta, no genérica. |
| **Persistent run indicator** | header | Sobrevive a la navegación. |
| **Tooltip** | ayudas | Neutro, breve. |

*Justificación:* con ~20 componentes bien definidos se arma toda la app; reutilizarlos (no crear variantes ad-hoc) es lo que sostiene la coherencia visual al crecer.

---

## 20. Consistencia visual cuando el proyecto crezca

Reglas de gobernanza para que la interfaz no se degrade con el tiempo (coherente con la filosofía "aditivo y mantenible" del framework):

1. **Tokens como única fuente de verdad.** Color, tipografía, espaciado, radios e íconos se definen una vez (como los de este documento) y **todo deriva** de ahí. Ningún valor "suelto".
2. **Los cuatro colores de marca son intocables;** cualquier color nuevo se **deriva** por matiz (como en §2). Prohibido introducir un color fuera del sistema.
3. **La regla de una sola alta atención es una ley de diseño, no una sugerencia.** Cada pantalla nueva debe tener exactamente **un** elemento primario (magenta). Si aparecen dos, uno debe bajar a secundario.
4. **Rojo = fallo, magenta = acción, verde = éxito.** Estos significados no se reasignan nunca.
5. **Biblioteca de componentes cerrada:** se reutilizan los de §19; un componente nuevo se agrega solo si ninguno existente sirve, y con los mismos tokens.
6. **Lista de "no":** sin gradientes, sin glassmorphism/neumorphism, sin sombras marcadas, sin gráficos de métricas, sin más de tres pesos tipográficos, sin animación decorativa. Documentada como guía viva.
7. **Densidad y escala de espaciado uniformes** (múltiplos de 4); nada de márgenes improvisados.
8. **Tema oscuro derivable a futuro.** Como el cromo ya es oscuro y todo son tokens, un tema oscuro completo (main oscuro) se deriva sin rediseñar — se deja anotado como mejora, no como deuda.
9. **Toda pantalla nueva se valida contra los referentes** (¿se parece más a VS Code/Postman que a Jira?) antes de sumarse.

---

## 21. Cierre

La interfaz es, deliberadamente, la de una **herramienta de desarrollador**: cromo índigo sobrio, trabajo sobre blanco cálido, tipografía chica y callada, cero decoración, y **un único punto magenta de acción** que dirige el ojo a "Ejecutar". Todo lo visual deriva de los cuatro colores de marca por reglas explícitas, se apoya en ~20 componentes reutilizables y respeta la jerarquía que la UX ya definió: acción y veredicto primero, detalle bajo demanda. El resultado se siente **rápido, limpio y profesional** —más VS Code que Notion— y crece sin perder coherencia porque cada decisión nace de un token y de una regla, no de un gusto puntual. Es la piel del panel; debajo, el framework sigue haciendo todo el trabajo.
