/**
 * INPUT MODEL de un formulario.
 *
 * Es la lista de los controles EDITABLES de un formulario, derivada de una única
 * fuente de verdad: el mapa `control -> estrategia` que cada Page Object declara
 * (p. ej. `RequisicionFormPage.ESTRATEGIAS`). Ese mapa ya existe porque es lo que
 * el framework necesita para saber CÓMO operar cada control; acá se lo reutiliza
 * para saber QUÉ controles tiene el formulario.
 *
 * Por qué esta fuente y no la metadata inspeccionada: el mapa de estrategias es
 * lo que realmente se usa para llenar el formulario, así que el Input Model
 * siempre coincide con lo que el framework sabe operar. La metadata inspeccionada
 * (`metadata/screens/*.json`) podrá ENRIQUECER esta información en el futuro
 * (requerido, opciones), pero la definición del formulario sale del Page Object.
 *
 * Consecuencia buscada: los parámetros usan los LABELS REALES del formulario
 * ("Nombre de requisición", "Puesto", …). No se inventan nombres, no se traducen,
 * no se crean alias. El usuario ve exactamente el mismo texto que hay en pantalla.
 *
 * Módulo puro: sin Selenium, sin disco. Lo consumen `testContext`
 * (para sembrar el Execution Context) y `Form` (para llenar el formulario).
 */

/** Normaliza una declaración de control: acepta 'text' o { estrategia, ...opciones }. */
function _normalizar(decl) {
  if (typeof decl === 'string') return { estrategia: decl };
  return { ...(decl || {}) };
}

/**
 * Un valor "vacío" NO dirige la prueba (mismo criterio que el Execution Context):
 * string vacío/espacios, null, undefined o array vacío.
 */
function esVacio(valor) {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
}

/**
 * Modelo canónico del formulario, en el ORDEN en que el Page Object declaró los
 * controles: `[{ label, estrategia, opciones }]`.
 *
 * @param controles  mapa `label -> 'estrategia' | { estrategia, ...opciones }`
 */
function desdeControles(controles = {}) {
  return Object.keys(controles || {}).map((label) => {
    const { estrategia, ...opciones } = _normalizar(controles[label]);
    return { label, estrategia, opciones };
  });
}

/**
 * Sólo los labels de los controles (las CLAVES que se siembran en el Execution
 * Context). Preserva el orden declarado.
 */
function labels(controles = {}) {
  return Object.keys(controles || {});
}

/** Normaliza un label para comparar: quita el asterisco de requerido y el ':' final. */
function _normLabel(s) {
  return String(s == null ? '' : s)
    .replace(/\*/g, '')
    .replace(/:\s*$/, '')
    .trim();
}

/**
 * Compara los controles DECLARADOS (labels del mapa de estrategias) contra los
 * controles realmente presentes EN PANTALLA. Puro: no toca DOM ni disco.
 *
 * Sirve al mecanismo preventivo de desincronización: ESTRATEGIAS sigue siendo la
 * única fuente de verdad, pero se valida contra la UI para avisar cuando divergen.
 *
 * @returns {{declarados:string[], enPantalla:string[],
 *            faltantesEnEstrategias:string[], declaradosNoVistos:string[],
 *            sincronizado:boolean}}
 *   - faltantesEnEstrategias: controles VISIBLES que NO están declarados en el mapa.
 *   - declaradosNoVistos: controles declarados que no se ven ahora (normal si
 *     dependen del contexto, p. ej. campos que sólo aparecen en Sustitución).
 */
function comparar(declarados = [], enPantalla = []) {
  const D = [...new Set((declarados || []).map(_normLabel).filter(Boolean))];
  const P = [...new Set((enPantalla || []).map(_normLabel).filter(Boolean))];
  const Dset = new Set(D);
  const Pset = new Set(P);
  return {
    declarados: D,
    enPantalla: P,
    faltantesEnEstrategias: P.filter((x) => !Dset.has(x)),
    declaradosNoVistos: D.filter((x) => !Pset.has(x)),
    sincronizado: P.every((x) => Dset.has(x)),
  };
}

module.exports = { desdeControles, labels, esVacio, comparar };
