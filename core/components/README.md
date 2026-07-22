# Componentes reutilizables del core

Catálogo de los widgets de la app encapsulados una sola vez para todos los módulos. La documentación funcional y los ejemplos están en el [README raíz](../../README.md#referencia-rápida-de-triplecore); acá vive el **registro** y el **criterio de crecimiento**.

## Contrato de un componente

1. Extiende `BaseComponent` (hereda `click` / `type` / `getText` / `waitVisible` / `esperarSinLoader` de `UiContext` y admite un `root` opcional).
2. Encapsula sus selectores en el constructor. Los tests nunca ven un selector.
3. Métodos con lenguaje de negocio y **esperas explícitas** (nunca `sleep`).
4. **Sin asserts**: devuelve datos o diagnóstico; el test decide y arma el mensaje de fallo.
5. Ante ambigüedad **no adivina** (ni posición, ni índice, ni base64): informa que no pudo identificar el elemento y adjunta el inventario de lo que sí encontró.
6. Se registra en `index.js` y se documenta en el README raíz.

## Implementados

| Componente | Qué encapsula |
|---|---|
| `BaseComponent` | Base común: helpers de interacción + `root` opcional |
| `DataGrid` | Grid DevExtreme: buscar, filtrar, paginar, contar, crear, abrir fila |
| `Form` | Formularios `group-field` **por label** + Selection Strategies |
| `FormsHeader` | Barra de acciones superior: botones (con y sin texto) y switches del header |
| `NavBar` | Barra superior de la app: logout, dashboard, sync, notificaciones, usuario |
| `Notify` | Toast `notify_record` y su clasificación (éxito / inválido / error) |

## Previstos (todavía **no** implementados)

No existen como archivo: se crean el día que un caso real los necesite, siguiendo el contrato de arriba. Se listan para que el crecimiento del framework siga un patrón uniforme y para no improvisar dos veces la misma solución.

| Componente | Alcance previsto | Señal de que llegó el momento |
|---|---|---|
| `Dialog` | Diálogos de confirmación (`¿Estás seguro?`, `¿descartar cambios?`): aceptar / cancelar / leer mensaje | Hoy esa mecánica está repartida entre `NavBar.logout()` y `utils/recovery.js`; al tercer caso conviene unificarla |
| `Popup` | Modales de contenido (`dx-popup`): abrir, leer, cerrar por X / Esc | Un caso que opere un modal que no sea de confirmación |
| `Toolbar` | Barra de acciones del grid (Crear, Filtro, Exportar…) | Hoy vive dentro de `DataGrid`; se extrae cuando aparezca una toolbar fuera de un grid |
| `Switch` | Switch DevExtreme genérico **fuera** del header | Hoy lo cubre `FormsHeader` para switches del header y `Form` vía la estrategia `switch` |
| `Tabs` | Pestañas de una pantalla de detalle: cambiar de pestaña y esperar su carga | Un caso que valide contenido en más de una pestaña |
| `Uploader` | Carga de archivos (`Importar archivos`) y verificación del adjunto | Un caso que suba documentos a una requisición |

> Antes de crear uno nuevo: revisá si la mecánica ya existe en otro componente. La regla del framework sigue siendo *¿sirve a más de un módulo? → core; ¿es de un módulo? → dentro del módulo*.
