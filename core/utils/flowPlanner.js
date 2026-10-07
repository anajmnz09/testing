/**
 * Planner de flujos: a partir de los casos SELECCIONADOS y su metadata
 * `requires` / `produces` (explícita, nunca inferida) calcula el orden de
 * ejecución y los bindings, o devuelve errores de diagnóstico ANTES de abrir
 * un navegador. Función pura (sin I/O) para poder probarla en unitario.
 *
 * Reglas (v1):
 *  - `requires` NO exige productor seleccionado: si no hay uno, el valor lo resuelve el
 *    automático del propio test (`auto`, true por defecto). Solo es error si `auto` es false.
 *  - Productor = test que declara `produces` ese tipo. "Originador" no lo
 *    requiere; "transformador" sí (solicitud → solicitud): NO es un ciclo.
 *  - `produces` admite `'tipo'` o `{ tipo, orden }`. `orden` (número) es la posición del test
 *    en la SECUENCIA DE TRANSFORMACIÓN de esa entidad (p. ej. primera → segunda → tercera
 *    entrevista): los transformadores con `orden` se encadenan por ese número sin importar
 *    el orden en que el usuario los eligió; los que no lo declaran se ordenan por selección.
 *  - Más de un originador del mismo tipo con algún consumidor → error de
 *    ambigüedad (nunca se elige uno al azar).
 *  - `elimina: [tipo]` (el test elimina una entidad que consume): se ejecuta DESPUÉS de todos los demás
 *    que la requieren o producen (la entidad deja de estar disponible al eliminarla). Dos tests que
 *    eliminan el mismo tipo → error (el segundo operaría sobre una entidad ya eliminada).
 *  - Orden: topológico estable (desempata por orden de selección).
 *
 * @param {Array<{caso:string, modulo?:string, archivo?:string}>} seleccion
 * @param {Object} metadata  por caso: `{ produces?: string[], requires?: Array<{tipo, clave, campo?, auto?}> }`
 * @param {{claveConocida?: (caso:string, clave:string)=>(boolean|null)}} [opts]
 *   `claveConocida`: true/false si se puede saber si la clave existe en el contexto del caso, null si no
 *   (sección aún no sembrada). Un binding a una clave inexistente no rompe nada, pero el dato del flujo
 *   no se aplicaría: se avisa (metadata desactualizada).
 * @returns {{orden:Array, bindings:Array, produce:Object, requiere:Object, productores:Object, avisos:string[], errores:string[]}}
 */
function planificar(seleccion, metadata, { claveConocida = () => null } = {}) {
  const errores = [];
  const avisos = [];
  const casos = seleccion.map((s) => s.caso);
  const idx = new Map(casos.map((c, i) => [c, i]));
  const meta = (c) => metadata[c] || {};
  // `produces`: 'tipo' o { tipo, orden } (normalizado). `produce(c)` sigue siendo la lista de tipos.
  const produces = (c) => (meta(c).produces || []).map((p) => (typeof p === 'string' ? { tipo: p } : p));
  const produce = (c) => produces(c).map((p) => p.tipo);
  const ordenDe = (c, t) => {
    const p = produces(c).find((x) => x.tipo === t);
    return p && typeof p.orden === 'number' ? p.orden : null;
  };
  const requiere = (c) => meta(c).requires || [];
  const elimina = (c) => meta(c).elimina || [];

  const dup = casos.filter((c, i) => casos.indexOf(c) !== i);
  if (dup.length) errores.push(`Caso(s) seleccionado(s) más de una vez: ${[...new Set(dup)].join(', ')}.`);

  // productores por tipo
  const productores = new Map();
  for (const c of casos) {
    for (const t of produce(c)) {
      if (!productores.has(t)) productores.set(t, []);
      productores.get(t).push(c);
    }
  }
  const esTransformador = (c, t) => requiere(c).some((r) => r.tipo === t);
  const originadores = (t) => (productores.get(t) || []).filter((c) => !esTransformador(c, t));
  const transformadores = (t) => (productores.get(t) || []).filter((c) => esTransformador(c, t));

  // aristas productor -> consumidor
  const aristas = [];
  const arista = (a, b) => {
    if (a !== b) aristas.push([a, b]);
  };

  for (const [t, prods] of productores) {
    const origs = originadores(t);
    const consumidoresPuros = casos.filter((c) => requiere(c).some((r) => r.tipo === t) && !produce(c).includes(t));
    const porSeleccion = (a, b) => idx.get(a) - idx.get(b);
    const todos = transformadores(t);
    const conOrden = todos.filter((x) => ordenDe(x, t) !== null).sort((a, b) => ordenDe(a, t) - ordenDe(b, t) || porSeleccion(a, b));
    const sinOrden = todos.filter((x) => ordenDe(x, t) === null).sort(porSeleccion);
    const trans = [...conOrden, ...sinOrden];
    if (origs.length > 1 && (consumidoresPuros.length > 0 || trans.length > 0)) {
      errores.push(
        `Ambigüedad: "${t}" lo producen varios tests sin relación de orden (${origs.join(', ')}) ` +
          'y hay tests que lo requieren. Deje seleccionado solo uno.'
      );
      continue;
    }
    if (sinOrden.length > 1) avisos.push(`"${t}": transformadores sin orden declarado, ordenados por selección (${sinOrden.join(' → ')}).`);
    const repetidos = conOrden.filter((x, i) => i > 0 && ordenDe(x, t) === ordenDe(conOrden[i - 1], t));
    if (repetidos.length) avisos.push(`"${t}": varios transformadores declaran el mismo orden (${repetidos.join(', ')}); se ordenan por selección.`);
    for (const o of origs) todos.forEach((x) => arista(o, x));
    // Cada grupo se encadena aparte: los de orden declarado por su número, el resto por selección.
    for (const grupo of [conOrden, sinOrden]) for (let i = 1; i < grupo.length; i++) arista(grupo[i - 1], grupo[i]);
    for (const c of consumidoresPuros) prods.forEach((p) => arista(p, c));
  }

  // eliminadores: van después de todo lo demás que use la entidad
  const eliminadoresDe = new Map();
  for (const c of casos) for (const t of elimina(c)) eliminadoresDe.set(t, [...(eliminadoresDe.get(t) || []), c]);
  for (const [t, ds] of eliminadoresDe) {
    if (ds.length > 1) {
      errores.push(`Eliminación múltiple: "${t}" la eliminan varios tests (${ds.join(', ')}); el segundo operaría sobre una entidad ya eliminada. Deje seleccionado solo uno.`);
      continue;
    }
    const d = ds[0];
    for (const c of casos) {
      if (c !== d && (requiere(c).some((r) => r.tipo === t) || produce(c).includes(t))) arista(c, d);
    }
  }

  // requires: bindings + ¿hay otra fuente si no hay productor?
  // Un binding necesita `clave` Y `campo` explícitos (nunca se deduce `campo` de la clave). Un
  // requires sin clave (consumo detectado por una lectura tipada) solo ordena, no enlaza valores.
  const bindings = [];
  for (const c of casos) {
    for (const r of requiere(c)) {
      if (r.clave && r.campo) {
        bindings.push({ caso: c, clave: r.clave, tipo: r.tipo, campo: r.campo });
        if (claveConocida(c, r.clave) === false) {
          avisos.push(
            `"${c}": la clave "${r.clave}" no figura en su Execution Context; el dato de "${r.tipo}" no se aplicaría (¿declaración de flujo desactualizada?).`
          );
        }
      }
      const hayProductor = (productores.get(r.tipo) || []).some((p) => p !== c);
      if (hayProductor) continue;
      if (r.auto === false) {
        errores.push(`"${c}" requiere "${r.tipo}" pero no hay productor seleccionado ni comportamiento automático.`);
      } else {
        avisos.push(`"${c}" requiere "${r.tipo}" sin productor en el flujo: automático.`);
      }
    }
  }

  // orden topológico estable (Kahn; elige siempre el de menor índice de selección)
  const entrada = new Map(casos.map((c) => [c, 0]));
  const sale = new Map(casos.map((c) => [c, []]));
  for (const [a, b] of aristas) {
    if (!entrada.has(a) || !entrada.has(b)) continue;
    sale.get(a).push(b);
    entrada.set(b, entrada.get(b) + 1);
  }
  const listos = casos.filter((c) => entrada.get(c) === 0);
  const ordenCasos = [];
  while (listos.length) {
    listos.sort((a, b) => idx.get(a) - idx.get(b));
    const c = listos.shift();
    ordenCasos.push(c);
    for (const n of sale.get(c)) {
      entrada.set(n, entrada.get(n) - 1);
      if (entrada.get(n) === 0) listos.push(n);
    }
  }
  if (ordenCasos.length !== casos.length) {
    const resto = casos.filter((c) => !ordenCasos.includes(c));
    errores.push(`Dependencia circular entre: ${resto.join(', ')}.`);
  }

  const porCaso = new Map(seleccion.map((s) => [s.caso, s]));
  return {
    orden: ordenCasos.map((c) => porCaso.get(c)),
    bindings,
    produce: Object.fromEntries(casos.map((c) => [c, produce(c)])),
    elimina: Object.fromEntries(casos.map((c) => [c, elimina(c)])),
    requiere: Object.fromEntries(casos.map((c) => [c, requiere(c).map((r) => ({ tipo: r.tipo, clave: r.clave }))])),
    productores: Object.fromEntries(productores),
    avisos,
    errores,
  };
}

module.exports = { planificar };
