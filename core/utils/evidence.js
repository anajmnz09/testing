const fs = require('fs');
const path = require('path');
const addContext = require('mochawesome/addContext');
const paths = require('./paths');
const { sanitizeFileName } = require('./screenshot');

/**
 * Registro extensible de tipos de evidencia. Cada handler define:
 *  - extension: extensión de archivo por defecto para ese tipo
 *  - dir(): carpeta donde se guardan los archivos de ese tipo (function, se evalúa
 *           en el momento de guardar para respetar el RUN_ID vigente)
 *  - embed(filePath): devuelve el valor que se pasa a addContext. Si Mochawesome
 *           puede embeberlo nativamente (imagen/video vía Data URI, o texto/JSON
 *           como code-snippet) se devuelve ese contenido; si no hay soporte nativo
 *           se devuelve null y attach() arma una referencia legible por archivo.
 *
 * Agregar un tipo nuevo NO requiere tocar el resto del framework: alcanza con
 * llamar registerEvidenceType(nombre, handler) una vez (por ejemplo desde un
 * nuevo Page Object o desde un test).
 */
const handlers = new Map();

function registerEvidenceType(type, handler) {
  handlers.set(type, handler);
}

function getHandler(type) {
  const handler = handlers.get(type);
  if (!handler) {
    throw new Error(
      `Tipo de evidencia no registrado: "${type}". Usa evidence.registerEvidenceType() para agregarlo antes de usarlo.`
    );
  }
  return handler;
}

function sanitizeFolderName(name) {
  return String(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim();
}

/**
 * Resuelve el Test/Hook real a partir de lo que se le pasa a las funciones de
 * este módulo. SIEMPRE hay que pasar el contexto de Mocha ("this" dentro de un
 * hook o de un it()), nunca el test ya resuelto — addContext() internamente
 * espera ese contexto (usa context.currentTest / context.test para ubicar el
 * nodo real). Pasar el test resuelto directamente produce
 * "[mochawesome] Error adding context: Invalid test object."
 */
function resolveTest(context) {
  if (!context) return context;
  if (typeof context.fullTitle === 'function') return context; // ya es un Test/Hook
  return context.currentTest || context.test || context;
}

function testEvidenceDir(baseDir, context) {
  const test = resolveTest(context);
  const rawName = test && typeof test.fullTitle === 'function' ? test.fullTitle() : String(test);
  const dir = path.join(baseDir, sanitizeFolderName(rawName));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildFileName(label, extension) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${sanitizeFileName(label)}__${stamp}.${extension}`;
}

/**
 * Guarda un buffer/contenido de evidencia agrupado en una subcarpeta por test.
 * `context` es el contexto de Mocha ("this" del hook o del it()), igual que en attach().
 */
function saveEvidenceBuffer(type, context, content, { label, encoding = 'base64' } = {}) {
  const handler = getHandler(type);
  const dir = testEvidenceDir(handler.dir(), context);
  const fileName = buildFileName(label || type, handler.extension);
  const filePath = path.join(dir, fileName);

  fs.writeFileSync(filePath, content, encoding);

  return filePath;
}

/**
 * Adjunta un archivo ya existente en disco al reporte de Mochawesome, asociado al test.
 * Si el tipo es embebible (imagen/video/texto/json), se muestra directamente en el
 * reporte. Si no, se deja una referencia clara con la ruta relativa del archivo.
 *
 * `context` debe ser el contexto de Mocha ("this" dentro de un hook o de un it()),
 * NO el test ya resuelto (ver resolveTest() arriba).
 */
function attach(type, context, filePath, { label } = {}) {
  const handler = getHandler(type);
  const title = label || path.basename(filePath);
  const value = handler.embed(filePath);

  if (value !== null && value !== undefined) {
    addContext(context, { title, value });
  } else {
    const relativePath = path.relative(paths.ROOT_DIR, filePath).split(path.sep).join('/');
    addContext(context, {
      title: `${title} (Mochawesome no embebe este tipo de archivo)`,
      value: `Archivo generado: ${relativePath}`,
    });
  }

  return filePath;
}

// ---------------------------------------------------------------------------
// Handlers nativos
// ---------------------------------------------------------------------------

registerEvidenceType('image', {
  extension: 'png',
  dir: () => paths.SCREENSHOTS_DIR,
  embed: (filePath) => `data:image/png;base64,${fs.readFileSync(filePath, 'base64')}`,
});

registerEvidenceType('video', {
  extension: 'mp4',
  dir: () => path.join(paths.EVIDENCE_DIR, 'videos'),
  embed: (filePath) => `data:video/mp4;base64,${fs.readFileSync(filePath, 'base64')}`,
});

registerEvidenceType('pdf', {
  extension: 'pdf',
  dir: () => path.join(paths.EVIDENCE_DIR, 'pdfs'),
  // Mochawesome no tiene visor de PDF embebido: se referencia por ruta (ver attach()).
  embed: () => null,
});

registerEvidenceType('download', {
  extension: 'bin',
  dir: () => path.join(paths.EVIDENCE_DIR, 'downloads'),
  embed: () => null,
});

registerEvidenceType('log', {
  extension: 'log',
  dir: () => path.join(paths.EVIDENCE_DIR, 'logs'),
  // Se embebe como texto plano (Mochawesome lo muestra como code-snippet).
  embed: (filePath) => fs.readFileSync(filePath, 'utf-8'),
});

registerEvidenceType('json', {
  extension: 'json',
  dir: () => path.join(paths.EVIDENCE_DIR, 'json'),
  embed: (filePath) => fs.readFileSync(filePath, 'utf-8'),
});

registerEvidenceType('html', {
  extension: 'html',
  dir: () => path.join(paths.EVIDENCE_DIR, 'html'),
  // HTML crudo no se embebe (se renderizaría dentro del reporte): se referencia por ruta.
  embed: () => null,
});

registerEvidenceType('text', {
  extension: 'txt',
  dir: () => path.join(paths.EVIDENCE_DIR, 'text'),
  embed: (filePath) => fs.readFileSync(filePath, 'utf-8'),
});

// ---------------------------------------------------------------------------
// Helper de conveniencia para el caso más común: screenshot desde un driver vivo
// ---------------------------------------------------------------------------

/**
 * `context` debe ser el "this" de Mocha (hook o it()), no el test resuelto.
 *
 * Por defecto captura la página completa. Si se provee `element` (un
 * WebElement ya localizado), captura ÚNICAMENTE ese elemento —vía el comando
 * nativo de Selenium `WebElement.takeScreenshot()` (W3C "Take Element
 * Screenshot"), que ya hace scroll-into-view internamente: no hay coordenadas
 * fijas ni scroll manual involucrados—. Reutiliza el mismo guardado/adjuntado
 * que la captura de página completa: solo cambia el origen de la imagen.
 */
async function attachScreenshot(driver, context, { label, element } = {}) {
  const image = await (element ? element.takeScreenshot() : driver.takeScreenshot());
  const filePath = saveEvidenceBuffer('image', context, image, { label: label || 'screenshot' });
  attach('image', context, filePath, { label: label ? `Screenshot: ${label}` : 'Screenshot' });
  return filePath;
}

module.exports = {
  registerEvidenceType,
  saveEvidenceBuffer,
  attach,
  attachScreenshot,
  sanitizeFolderName,
  resolveTest,
};
