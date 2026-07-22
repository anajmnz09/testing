/**
 * REGISTRO de componentes reutilizables del core.
 *
 * Un "componente" es un widget de la app que se repite en varias pantallas y en
 * varios módulos (el grid, el navbar, el toast, el header de formulario…). Se
 * encapsula UNA vez acá y todos los Page Objects lo componen, en vez de repetir
 * sus selectores dx-* por todo el framework.
 *
 * Contrato que cumple todo componente de esta carpeta:
 *   1. Extiende `BaseComponent` (hereda click/type/getText/waitVisible/
 *      esperarSinLoader de UiContext y soporta un `root` opcional).
 *   2. Encapsula sus selectores en el constructor; no los expone a los tests.
 *   3. Expone métodos con lenguaje de negocio y esperas SIEMPRE explícitas.
 *   4. No contiene asserts: devuelve datos/diagnóstico y el test decide.
 *   5. Cuando no puede identificar algo con certeza, informa el fallo con
 *      diagnóstico; no adivina por posición ni por índice.
 *   6. Se registra en este barrel y se documenta en el README raíz.
 *
 * El catálogo completo —incluidos los componentes PREVISTOS que todavía no se
 * implementaron (Dialog, Popup, Toolbar, Switch, Tabs, Uploader)— está en
 * `components/README.md`. No se crean archivos vacíos: un componente se agrega
 * el día que un caso real lo necesita, siguiendo el contrato de arriba.
 */
module.exports = {
  BaseComponent: require('./BaseComponent'),
  DataGrid: require('./DataGrid'),
  Form: require('./Form'),
  FormsHeader: require('./FormsHeader'),
  NavBar: require('./NavBar'),
  Notify: require('./Notify'),
};
