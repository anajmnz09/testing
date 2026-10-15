/**
 * Motor de BANCOS de datos de texto para los tests (campos `input` de texto y `textarea`).
 *
 * Un banco es un conjunto pequeño de CATEGORÍAS (listas cortas) y de TEXTOS que las combinan:
 *
 *   const banco = definirBanco('educacion', {
 *     categorias: { tipo: ['Liceo', 'Instituto', 'Universidad'], nombre: ['Juan Pablo Duarte', 'Santa Clara'] },
 *     textos: { lugar: '{tipo} {nombre}' },
 *   });
 *   banco.texto('lugar');                 // "Liceo Juan Pablo Duarte", luego "Instituto Juan Pablo Duarte", ...
 *   banco.valor(dirigido, 'lugar');       // lo dirigido desde el Panel/Execution Context, o el banco
 *
 * Los DATOS viven junto a su dominio (`<modulo>/support/bancos.js`); este archivo solo trae el mecanismo.
 *
 * Selección DETERMINISTA (sin aleatoriedad suelta): cada texto tiene un cursor que arranca en la SEMILLA
 * de la corrida y avanza 1 por llamada; el cursor se descompone en base mixta sobre las categorías del
 * texto, así que con pocas opciones se recorren TODAS las combinaciones (A1×B1, A2×B1, A3×B1, A1×B2, ...)
 * sin escribirlas a mano. La semilla sale de `DATOS_SEMILLA` (reproducir una falla) o, si no está, de la
 * corrida (`RUN_ID`, o la hora de arranque) — varía entre corridas, se escribe en el log al primer uso y
 * cada valor elegido se registra con su banco, texto e índice. Misma semilla + mismo orden de llamadas =
 * mismos datos.
 *
 * Solo para texto libre. Selects, fechas, números, archivos y demás controles NO pasan por acá.
 *
 * Cada banco definido queda REGISTRADO por nombre (`obtenerBanco`): el punto de acceso común (`utils/datos.js`) los resuelve
 * por `'<banco>.<texto>'` sin que el test importe el `bancos.js` de su módulo. `prng(etiqueta)` ofrece un flujo pseudoaleatorio
 * derivado de la MISMA semilla para los generadores que necesitan azar (`datosPrueba.js`): nada depende de `Math.random`.
 */
const logger = require('./logger');

let semillaCorrida = null;

function hash(texto) {
  let h = 2166136261;
  for (const c of String(texto)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Semilla de la corrida (entero >= 0). `DATOS_SEMILLA` manda; si es texto no numérico se usa su hash. */
function semilla() {
  if (semillaCorrida === null) {
    const fija = process.env.DATOS_SEMILLA;
    if (fija !== undefined && fija !== '') {
      semillaCorrida = /^\d+$/.test(fija) ? Number(fija) : hash(fija);
      logger.info(`bancoDatos: semilla ${semillaCorrida} (fijada con DATOS_SEMILLA)`);
    } else {
      semillaCorrida = hash(process.env.RUN_ID || new Date().toISOString());
      logger.info(`bancoDatos: semilla ${semillaCorrida} de esta corrida (para repetir los mismos datos: DATOS_SEMILLA=${semillaCorrida})`);
    }
  }
  return semillaCorrida;
}

/** Solo para tests unitarios: fuerza (o reinicia con null) la semilla de la corrida. */
function _fijarSemilla(valor) {
  semillaCorrida = valor;
}

const registro = new Map(); // nombre -> banco
const FAMILIAS_RESERVADAS = ['persona', 'requisicion', 'texto']; // las resuelve utils/datos.js con generadores propios

/** Banco registrado con ese nombre (o undefined). */
function obtenerBanco(nombre) {
  return registro.get(nombre);
}

/** Nombres de los bancos registrados. */
function bancosRegistrados() {
  return [...registro.keys()].sort();
}

/** Flujo pseudoaleatorio (mulberry32) en [0,1) derivado de la semilla de la corrida y de `etiqueta`: misma semilla + mismo orden = mismos valores. */
function prng(etiqueta = '') {
  let estado = hash(`${semilla()}:${etiqueta}`);
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Valida y devuelve un banco. `categorias`: `{ nombre: [opciones...] }` (no vacías, sin duplicados);
 * `textos`: `{ clave: 'plantilla con {categoria}' }` — toda `{categoria}` debe existir.
 */
function definirBanco(nombre, { categorias = {}, textos = {} } = {}) {
  if (FAMILIAS_RESERVADAS.includes(nombre)) throw new Error(`bancoDatos: "${nombre}" es una familia reservada de utils/datos.js (${FAMILIAS_RESERVADAS.join(', ')}); elija otro nombre de banco.`);
  for (const [cat, lista] of Object.entries(categorias)) {
    if (!Array.isArray(lista) || !lista.length) throw new Error(`bancoDatos "${nombre}": la categoría "${cat}" debe ser una lista no vacía.`);
    if (new Set(lista).size !== lista.length) throw new Error(`bancoDatos "${nombre}": la categoría "${cat}" tiene opciones repetidas.`);
  }
  const usadas = {};
  for (const [clave, plantilla] of Object.entries(textos)) {
    const cats = [];
    String(plantilla).replace(PLACEHOLDER, (_, c) => {
      if (!categorias[c]) throw new Error(`bancoDatos "${nombre}": el texto "${clave}" usa {${c}}, que no es una categoría del banco.`);
      if (!cats.includes(c)) cats.push(c);
      return '';
    });
    usadas[clave] = cats;
  }
  const llamadas = {}; // clave -> cuántas veces se pidió (avanza el cursor)

  /** Combinación número `indice` (base mixta sobre las categorías del texto, en orden de aparición). */
  function combinacion(clave, indice) {
    const plantilla = textos[clave];
    if (plantilla === undefined) throw new Error(`bancoDatos "${nombre}": no existe el texto "${clave}" (hay: ${Object.keys(textos).join(', ') || 'ninguno'}).`);
    const elegidas = {};
    let resto = indice;
    for (const c of usadas[clave]) {
      const lista = categorias[c];
      elegidas[c] = lista[resto % lista.length];
      resto = Math.floor(resto / lista.length);
    }
    return String(plantilla).replace(PLACEHOLDER, (_, c) => elegidas[c]);
  }

  /** Cantidad de combinaciones distintas de un texto. */
  function total(clave) {
    return (usadas[clave] || []).reduce((n, c) => n * categorias[c].length, 1);
  }

  /** Siguiente texto del banco para `clave` (avanza el cursor de esa clave). */
  function texto(clave) {
    const indice = semilla() + (llamadas[clave] || 0);
    llamadas[clave] = (llamadas[clave] || 0) + 1;
    const valor = combinacion(clave, indice);
    logger.info(`bancoDatos: ${nombre}.${clave} -> "${valor}" (índice ${indice % total(clave)} de ${total(clave)})`);
    return valor;
  }

  /** Prioridad del framework: lo dirigido (Panel / Execution Context) gana; si no hay, sale del banco. */
  function valor(dirigido, clave) {
    return dirigido !== undefined && dirigido !== null && String(dirigido).trim() !== '' ? dirigido : texto(clave);
  }

  const banco = { nombre, texto, valor, combinacion, total, claves: () => Object.keys(textos), categorias: () => Object.keys(categorias) };
  const previo = registro.get(nombre);
  if (previo && JSON.stringify(previo.definicion) !== JSON.stringify({ categorias, textos })) {
    logger.warn(`bancoDatos: el banco "${nombre}" se redefinió con otro contenido (el último gana); los nombres de banco deben ser únicos entre módulos.`);
  }
  banco.definicion = { categorias, textos };
  registro.set(nombre, banco);
  return banco;
}

module.exports = { definirBanco, FAMILIAS_RESERVADAS, obtenerBanco, bancosRegistrados, prng, semilla, _fijarSemilla, hash };
