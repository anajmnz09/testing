const SelectionStrategy = require('./SelectionStrategy');
const builtin = require('./builtinStrategies');

/**
 * REGISTRO de Selection Strategies (punto de extensión Open/Closed).
 *
 * Los tests no conocen estrategias ni controles: piden un valor. Los Page
 * Objects declaran qué estrategia usa cada control. Agregar soporte para un
 * control nuevo = registrar una estrategia más, sin modificar tests, ni Form,
 * ni las estrategias existentes.
 *
 *   const strategies = require('@triple/core/strategies');
 *   strategies.registrar('miControl', new MiEstrategia());
 */
const _registro = new Map();

/** Registra (o reemplaza) una estrategia bajo un nombre. */
function registrar(nombre, instancia) {
  if (!(instancia instanceof SelectionStrategy)) {
    throw new Error(`La estrategia "${nombre}" debe extender SelectionStrategy`);
  }
  _registro.set(nombre, instancia);
  return instancia;
}

/** Obtiene una estrategia por nombre. Si se pasa una instancia, la devuelve tal cual. */
function obtener(nombre) {
  if (nombre instanceof SelectionStrategy) return nombre;
  const s = _registro.get(nombre);
  if (!s) {
    throw new Error(
      `Estrategia de selección desconocida: "${nombre}". Registradas: ${listar().join(', ')}`
    );
  }
  return s;
}

/** True si el nombre está registrado. */
function existe(nombre) {
  return _registro.has(nombre);
}

/** Nombres registrados. */
function listar() {
  return [..._registro.keys()].sort();
}

// --- Estrategias de fábrica -------------------------------------------------
// Los nombres son los que usan los Page Objects en sus mapas de controles.
registrar('firstOption', new builtin.FirstOptionStrategy());
registrar('directSelect', new builtin.DirectSelectStrategy());
registrar('searchAndSelect', new builtin.SearchAndSelectStrategy());
registrar('tagSelect', new builtin.TagSelectStrategy());
registrar('text', new builtin.TextInputStrategy());
registrar('switch', new builtin.SwitchStrategy());
registrar('datePicker', new builtin.DatePickerStrategy());
registrar('treeView', new builtin.TreeViewStrategy());
registrar('custom', new builtin.CustomStrategy());
registrar('tagsLibres', new builtin.TagsLibresStrategy());

/** Estrategia usada cuando un control no declara ninguna. */
const POR_DEFECTO = 'firstOption';

module.exports = {
  SelectionStrategy,
  ...builtin,
  registrar,
  obtener,
  existe,
  listar,
  POR_DEFECTO,
};
