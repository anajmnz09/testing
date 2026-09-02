const { testContext } = require('@triple/core');

/**
 * Arma `cambios` con los campos que el Panel dirige explícitamente, para el
 * patrón COMÚN de los tests "editar-*": recorre `campos` (un mapa
 * ESTRATEGIAS del Page Object, o directamente un array de labels — para
 * entidades como Grupos que no usan `ESTRATEGIAS`) y agrega SOLO lo que
 * `testContext.get(caso, label)` devuelve definido. NO aplica ningún
 * default acá — ver `aplicarDefaultSiVacio`, que se llama aparte, DESPUÉS
 * de resolver cualquier campo condicional propio del caso (ej. "Tipo
 * Ingreso" de Concepto de Nómina, los switches de Usuario).
 *
 * @param caso     nombre del caso (CASO)
 * @param campos   mapa ESTRATEGIAS, o array de labels
 * @param opciones.excluir  labels a IGNORAR por completo (resueltos aparte por el test)
 */
function armarCambiosDirigidos(caso, campos, { excluir = [] } = {}) {
  const labels = Array.isArray(campos) ? campos : Object.keys(campos);
  const cambios = {};
  for (const label of labels) {
    if (excluir.includes(label)) continue;
    const dirigido = testContext.get(caso, label);
    if (dirigido !== undefined) cambios[label] = dirigido;
  }
  return cambios;
}

/**
 * Aplica el/los default(s) automáticos de un `editar-*` SOLO si el Panel no
 * dirigió NADA para este caso — chequeo a nivel de CASO
 * (`Object.keys(cambios).length === 0` TRAS `armarCambiosDirigidos`, Y
 * `condicionExtra` en falso), NUNCA por campo individual.
 *
 * Ver `.claude/skills/testing-patterns/SKILL.md` — sección "Automatic-mode
 * default rename in editar-*" — para la regla completa y el incidente real
 * que originó este helper: 6 de 12 tests `editar-*` la reimplementaban
 * a mano, mal (por campo: "si ESTE campo no vino, uso el default", sin
 * mirar qué más dirigió el Panel) — un usuario dirigió el registro a editar
 * y "Descripción", dejó "Nombre" vacío esperando que quedara intacto, y el
 * test lo renombró igual. Este helper existe para que esa lógica viva en
 * UN solo lugar ya correcto, en vez de 12 copias con la misma oportunidad
 * de repetir el bug.
 *
 * @param cambios  objeto ya armado por `armarCambiosDirigidos` (+ cualquier
 *   campo condicional que el test haya resuelto aparte) — se modifica
 *   in-place Y se retorna.
 * @param opciones.condicionExtra  true si CUALQUIER OTRA cosa fue dirigida
 *   aparte de lo que ya está en `cambios` (switches, tagbox, etc. que el
 *   test resuelve por su cuenta) — bloquea el default igual que si
 *   `cambios` no estuviera vacío.
 * @param opciones.defaults  array de `{ campo, valor }` (uno o varios —
 *   Grupos usa dos, el resto usa uno). `valor` puede ser un string fijo o
 *   `() => Promise<string>` (lazy: solo se evalúa si hace falta, para no
 *   pagar una lectura del form cuando el default no se va a aplicar).
 * @returns {Promise<Object>} el mismo `cambios`, ya con los defaults si aplicaron
 */
async function aplicarDefaultSiVacio(cambios, { condicionExtra = false, defaults = [] } = {}) {
  if (Object.keys(cambios).length || condicionExtra) return cambios;
  for (const { campo, valor } of defaults) {
    cambios[campo] = typeof valor === 'function' ? await valor() : valor;
  }
  return cambios;
}

module.exports = { armarCambiosDirigidos, aplicarDefaultSiVacio };
