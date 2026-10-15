/**
 * PUNTO DE ACCESO ÚNICO a los datos de prueba generados (campos `input` de texto y `textarea`).
 *
 *   const datos = require('@triple/core/utils/datos');
 *
 *   datos.valor(testContext.get(CASO, 'Lugar'), 'educacion.lugar');          // dirigido > banco del módulo
 *   datos.valor(testContext.get(CASO, 'Nombre'), 'capacitacion.nombre', { unico: true });
 *   datos.resolver('persona.primerNombre');                                  // dato personal (generador especializado)
 *   datos.deFormulario(CASO, Page.ESTRATEGIAS);                              // { label: valor } de los campos con `dato`
 *
 * Una FUENTE es un texto `'<familia>.<clave>'` que el mecanismo delega en el proveedor adecuado:
 *   - `<banco>.<texto>`   banco de texto del dominio (`<modulo>/support/bancos.js`, motor `bancoDatos.js`): combina categorías
 *                         y recorre las combinaciones. Los bancos se descubren y registran solos: el test no los importa.
 *   - `persona.*`         dato personal con formato (`datosPrueba.js`): primerNombre, segundoNombre, primerApellido,
 *                         segundoApellido, nombreCompleto, correo, correoPersonal, identificacion, celular. Todos los campos
 *                         de una misma persona son coherentes entre sí; pedir otra vez un campo ya usado empieza otra persona.
 *   - `requisicion.nombre`  nombre de requisición único y acotado (contexto `{ puesto }`).
 *   - `texto.<tipo>`      texto libre coherente con el puesto (requisitos | responsabilidades | descripcion | comentario).
 * Las familias `persona`, `requisicion` y `texto` están reservadas (ningún banco puede llamarse así).
 *
 * DÓNDE se declara qué campo usa qué fuente: junto al campo, en el `ESTRATEGIAS` del formulario (una vez, no en cada test):
 *   Descripción: { estrategia: 'text', dato: 'puesto.descripcion' }
 *   Nombre:      { estrategia: 'text', dato: { fuente: 'capacitacion.nombre', unico: true } }
 * Solo aplica a estrategias `text` (input / textarea); `Form.completarDesde` con `autofill` y `deFormulario` lo resuelven.
 *
 * PRIORIDAD (nunca se pisa lo que alguien decidió): 1) valor dirigido desde el Panel / Execution Context, 2) valor que el
 * escenario pasa a propósito (el test simplemente no pide un dato generado para ese campo: vacío, inválido, límite…),
 * 3) valor producido por un paso anterior del flujo (llega por el mismo contexto), 4) solo entonces, la fuente declarada.
 *
 * UNICIDAD: `{ unico: true }` agrega un sufijo corto de tiempo+secuencia (`unico()`); nunca se repite aunque se repita la semilla.
 * REPRODUCIBILIDAD: todo el azar y los cursores salen de la semilla de la corrida (`DATOS_SEMILLA`, ver `bancoDatos.js`): misma
 * semilla + mismo orden de solicitudes = mismos textos y personas. Cada dato resuelto queda en el log con su fuente y su campo.
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const bancoDatos = require('./bancoDatos');
const datosPrueba = require('./datosPrueba');

const RAIZ_REPO = path.resolve(__dirname, '..', '..');
const { FAMILIAS_RESERVADAS } = bancoDatos;
const CAMPOS_PERSONA = ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido', 'nombreCompleto', 'correo', 'correoPersonal', 'identificacion', 'celular'];
const TIPOS_TEXTO = ['requisitos', 'responsabilidades', 'descripcion', 'comentario'];

const { esVacio } = require('../context/formInputModel'); // mismo criterio de "vacío" que el Execution Context

// --- descubrimiento de los bancos de cada módulo ----------------------------------------------------------------------------
const cargados = new Set();

/** Carga una sola vez los `<modulo>/support/bancos.js` de la raíz (cada uno registra sus bancos al definirlos). */
function cargarBancos(raiz = RAIZ_REPO) {
  if (cargados.has(raiz)) return;
  cargados.add(raiz);
  for (const e of fs.readdirSync(raiz, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const archivo = path.join(raiz, e.name, 'support', 'bancos.js');
    if (!fs.existsSync(archivo)) continue;
    try {
      require(archivo);
    } catch (err) {
      logger.warn(`datos: no se pudieron cargar los bancos de "${e.name}": ${err.message}`);
    }
  }
}

function banco(nombre, raiz) {
  let b = bancoDatos.obtenerBanco(nombre);
  if (!b) {
    cargarBancos(raiz);
    b = bancoDatos.obtenerBanco(nombre);
  }
  if (!b) throw new Error(`datos: no existe el banco "${nombre}" (hay: ${bancoDatos.bancosRegistrados().join(', ') || 'ninguno'}). Defínalo en <modulo>/support/bancos.js.`);
  return b;
}

// --- persona actual (coherencia entre sus campos) ---------------------------------------------------------------------------
let persona = null;
let personaUsada = new Set();

/** Empieza una persona nueva (nombre y apellidos distintos). */
function nuevaPersona() {
  persona = datosPrueba.personaUnica();
  personaUsada = new Set();
  return { ...persona };
}

function campoPersona(campo) {
  if (!CAMPOS_PERSONA.includes(campo)) throw new Error(`datos: "persona.${campo}" no existe (hay: ${CAMPOS_PERSONA.join(', ')}).`);
  if (!persona || personaUsada.has(campo)) nuevaPersona();
  personaUsada.add(campo);
  switch (campo) {
    case 'nombreCompleto':
      return [persona.primerNombre, persona.segundoNombre, persona.primerApellido, persona.segundoApellido].join(' ');
    case 'correo':
      return datosPrueba.correo(persona);
    case 'correoPersonal':
      return datosPrueba.correo({ ...persona, primerApellido: persona.segundoApellido });
    case 'identificacion':
      return datosPrueba.identificacion();
    case 'celular':
      return datosPrueba.celular();
    default:
      return persona[campo];
  }
}

// --- unicidad ---------------------------------------------------------------------------------------------------------------
let ultimoSufijo = 0;

/** Sufijo corto y siempre distinto (últimos 6 dígitos del tiempo; si coincide con el anterior avanza). */
function sufijoUnico() {
  let n = Number(String(Date.now()).slice(-6));
  if (n <= ultimoSufijo) n = ultimoSufijo + 1;
  ultimoSufijo = n;
  return String(n % 1e6).padStart(6, '0');
}

/** `base` + sufijo único (nombres que la app exige únicos). */
function unico(base) {
  return `${base} ${sufijoUnico()}`;
}

/** Nombre único QA: lo dirigido va TAL CUAL; si no, `base` + sufijo único. Es el contrato histórico de `nombreUnicoQA`. */
function unicoQA(dirigido, base) {
  return dirigido ? dirigido : unico(base);
}

// --- códigos cortos ---------------------------------------------------------------------------------------------------------
let flujoCodigos = null;

/**
 * Código alfanumérico corto (base 36, mayúsculas) para campos tipo "Código" que la app exige distintos. Sale del flujo de la
 * semilla: NO es una garantía estricta de unicidad (espacio 36^largo) y se repite si se repite la semilla; con un código de 3
 * caracteres la probabilidad de choque entre corridas es la misma que tenía el `Math.random` al que reemplaza.
 */
function codigo(largo = 3) {
  if (!flujoCodigos) flujoCodigos = bancoDatos.prng('codigo');
  const maximo = 36 ** largo;
  const valorCodigo = Math.floor(flujoCodigos() * maximo).toString(36).toUpperCase().padStart(largo, '0');
  logger.info(`datos: código de ${largo} caracteres -> "${valorCodigo}"`);
  return valorCodigo;
}

// --- resolución -------------------------------------------------------------------------------------------------------------
/** Normaliza `'banco.clave'` | `{ fuente, unico }` -> `{ fuente, unico }`. */
function normalizar(dato) {
  const d = typeof dato === 'string' ? { fuente: dato } : { ...(dato || {}) };
  if (!d.fuente || !/^[\w$-]+\.[\w$-]+$/.test(d.fuente)) {
    throw new Error(`datos: fuente inválida ${JSON.stringify(dato)} (se espera '<familia>.<clave>', p. ej. 'puesto.descripcion').`);
  }
  return d;
}

/**
 * Resuelve una fuente a un valor (sin mirar lo dirigido; para eso están `valor` y `deFormulario`).
 * @param {string|{fuente:string, unico?:boolean}} dato
 * @param {{ puesto?: string, raiz?: string, campo?: string }} [contexto]
 */
function resolver(dato, contexto = {}) {
  const { fuente, unico: pedirUnico } = normalizar(dato);
  const [familia, clave] = fuente.split('.');
  let valor;
  if (familia === 'persona') valor = campoPersona(clave);
  else if (familia === 'requisicion') {
    if (clave !== 'nombre') throw new Error(`datos: "${fuente}" no existe (hay: requisicion.nombre).`);
    valor = datosPrueba.nombreRequisicion(contexto.puesto); // ya es único
  } else if (familia === 'texto') {
    if (!TIPOS_TEXTO.includes(clave)) throw new Error(`datos: "${fuente}" no existe (hay: ${TIPOS_TEXTO.map((t) => `texto.${t}`).join(', ')}).`);
    valor = datosPrueba.texto(clave, { puesto: contexto.puesto });
  } else valor = banco(familia, contexto.raiz).texto(clave);
  if (pedirUnico && familia !== 'requisicion') valor = unico(valor);
  if (familia === 'persona' || familia === 'requisicion' || familia === 'texto' || pedirUnico) {
    logger.info(`datos: ${fuente}${pedirUnico ? ' (único)' : ''} -> "${valor}"${contexto.campo ? ` [campo "${contexto.campo}"]` : ''}`);
  }
  return valor;
}

/** El valor dirigido (Panel / Execution Context / escenario) si lo hay; si no, el de la fuente. */
function valor(dirigido, dato, contexto = {}) {
  return esVacio(dirigido) ? resolver(dato, contexto) : dirigido;
}

/** Declaración `dato` de un control de `ESTRATEGIAS` (objeto con `dato`), o undefined. Exige estrategia `text`. */
function datoDeControl(label, decl) {
  if (!decl || typeof decl !== 'object' || decl.dato === undefined) return undefined;
  if (decl.estrategia !== 'text') {
    throw new Error(`datos: el control "${label}" declara "dato" pero su estrategia es "${decl.estrategia}": solo aplica a campos de texto (estrategia "text").`);
  }
  return decl.dato;
}

/**
 * `{ [label]: valor }` de los controles de `ESTRATEGIAS` que declaran `dato`: lo dirigido en `caso` (Execution Context) si lo hay;
 * si no, el valor de la fuente. `solo` / `excepto` acotan los labels; `contexto` se pasa a la fuente (p. ej. `{ puesto }`).
 */
function deFormulario(caso, controles, { solo = null, excepto = null, contexto = {}, obtener = null } = {}) {
  const leer = obtener || ((c, l) => require('../context/testContext').get(c, l)); // `obtener` solo se inyecta en tests unitarios
  const out = {};
  for (const [label, decl] of Object.entries(controles || {})) {
    if (solo && !solo.includes(label)) continue;
    if (excepto && excepto.includes(label)) continue;
    const dato = datoDeControl(label, decl);
    if (dato === undefined) continue;
    out[label] = valor(leer(caso, label), dato, { ...contexto, campo: label });
  }
  return out;
}

module.exports = { valor, resolver, deFormulario, datoDeControl, unico, unicoQA, codigo, nuevaPersona, cargarBancos, FAMILIAS_RESERVADAS, CAMPOS_PERSONA };
