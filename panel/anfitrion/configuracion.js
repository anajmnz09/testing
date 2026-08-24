'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const ARCHIVO_ENV = path.join(RAIZ, '.env');

/**
 * Configuración del Panel (distinta de la sección "Configuración" de la APP
 * que se prueba — esta es la pantalla de settings DEL FRAMEWORK/Panel en sí).
 *
 * Única fuente de verdad de qué variables administra esta pantalla, su tipo
 * de control, su sección visual y su valor por defecto — los mismos
 * defaults que ya usa el equipo. Agregar una variable nueva acá es lo único
 * que hace falta para que aparezca en el Panel; no hay que tocar el HTML/JS
 * de la pantalla.
 */
const CAMPOS = [
  { seccion: 'Datos de acceso', clave: 'BASE_URL', etiqueta: 'URL base', tipo: 'texto', defecto: 'https://test.triple.com.do/' },
  { seccion: 'Datos de acceso', clave: 'APP_USERNAME', etiqueta: 'Usuario', tipo: 'texto', defecto: 'ahinojosa@camsoft.com.do' },
  { seccion: 'Datos de acceso', clave: 'PASSWORD', etiqueta: 'Contraseña', tipo: 'password', defecto: 'Contraportal1*' },

  { seccion: 'Framework', clave: 'BROWSER', etiqueta: 'Navegador', tipo: 'texto', defecto: 'chrome' },
  { seccion: 'Framework', clave: 'HEADLESS', etiqueta: 'Headless (sin ventana visible)', tipo: 'checkbox', defecto: false },
  { seccion: 'Framework', clave: 'DEFAULT_TIMEOUT', etiqueta: 'Timeout por defecto (ms)', tipo: 'numero', defecto: '30000' },
  { seccion: 'Framework', clave: 'TEST_TIMEOUT', etiqueta: 'Timeout del test (ms)', tipo: 'numero', defecto: '30000' },
  { seccion: 'Framework', clave: 'TEST_RETRIES', etiqueta: 'Reintentos', tipo: 'numero', defecto: '0' },
  {
    seccion: 'Framework',
    clave: 'SCREENSHOT_MODE',
    etiqueta: 'Modo de screenshots',
    tipo: 'select',
    opciones: ['none', 'fail', 'all', 'steps'],
    defecto: 'all',
  },
  { seccion: 'Framework', clave: 'KEEP_REPORTS', etiqueta: 'Reportes a conservar', tipo: 'numero', defecto: '5' },
  { seccion: 'Framework', clave: 'TESTER_NAME', etiqueta: 'Nombre del tester', tipo: 'texto', defecto: '' },
  { seccion: 'Framework', clave: 'TEST_ENVIRONMENT', etiqueta: 'Ambiente', tipo: 'texto', defecto: '' },

  {
    seccion: 'Panel',
    clave: 'KEEP_BROWSER_OPEN',
    etiqueta: 'Permanecer en el navegador al concluir la prueba',
    tipo: 'checkbox',
    defecto: false,
  },
];

function _parsearEnv(texto) {
  const valores = {};
  for (const linea of texto.split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    // Corta un comentario al final de la línea (ej. "SCREENSHOT_MODE=all  # none | fail…").
    let valor = t.slice(i + 1);
    const hashIdx = valor.indexOf('#');
    if (hashIdx !== -1) valor = valor.slice(0, hashIdx);
    valores[t.slice(0, i).trim()] = valor.trim();
  }
  return valores;
}

function _esVerdadero(crudo) {
  return ['true', '1', 'yes'].includes(String(crudo).toLowerCase());
}

/** Estado actual de cada campo administrado: valor real del `.env` o, si no está seteado, el default. */
function leer() {
  const existentes = fs.existsSync(ARCHIVO_ENV) ? _parsearEnv(fs.readFileSync(ARCHIVO_ENV, 'utf8')) : {};
  return CAMPOS.map((c) => {
    const crudo = existentes[c.clave];
    let valor;
    if (crudo === undefined || crudo === '') valor = c.defecto;
    else if (c.tipo === 'checkbox') valor = _esVerdadero(crudo);
    else valor = crudo;
    return { ...c, valor };
  });
}

function _formatear(campo, valorNuevo) {
  if (campo.tipo === 'checkbox') return valorNuevo ? 'true' : 'false';
  return valorNuevo == null ? '' : String(valorNuevo);
}

/**
 * Regenera el `.env` raíz completo, en un formato fijo y comentado por
 * sección (mismas secciones que esta pantalla), con los valores nuevos
 * mezclados sobre los actuales (`valores` puede traer solo un subconjunto de
 * claves — las que no vienen se conservan tal cual estaban). Es la vía
 * OFICIAL para editar estas variables desde que existe esta pantalla; no
 * intenta preservar un formato distinto si el archivo fue editado a mano
 * antes con otra estructura.
 */
function guardar(valores) {
  const actuales = leer();
  const porClave = {};
  for (const c of actuales) {
    const nuevo = valores && Object.prototype.hasOwnProperty.call(valores, c.clave) ? valores[c.clave] : c.valor;
    porClave[c.clave] = _formatear(c, nuevo);
  }

  const lineas = [
    `BASE_URL=${porClave.BASE_URL}`,
    `APP_USERNAME=${porClave.APP_USERNAME}`,
    `PASSWORD=${porClave.PASSWORD}`,
    '',
    '# --- Configuración del framework ---',
    `BROWSER=${porClave.BROWSER}`,
    `HEADLESS=${porClave.HEADLESS}`,
    `DEFAULT_TIMEOUT=${porClave.DEFAULT_TIMEOUT}`,
    `TEST_TIMEOUT=${porClave.TEST_TIMEOUT}`,
    `TEST_RETRIES=${porClave.TEST_RETRIES}`,
    `SCREENSHOT_MODE=${porClave.SCREENSHOT_MODE}       # none | fail | all | steps`,
    `KEEP_REPORTS=${porClave.KEEP_REPORTS}`,
    `TESTER_NAME=${porClave.TESTER_NAME}`,
    `TEST_ENVIRONMENT=${porClave.TEST_ENVIRONMENT}`,
    '',
    '# --- Panel de Automatización ---',
    `KEEP_BROWSER_OPEN=${porClave.KEEP_BROWSER_OPEN}`,
    '',
  ];
  fs.writeFileSync(ARCHIVO_ENV, lineas.join('\n'), 'utf8');
  return leer();
}

module.exports = { leer, guardar };
