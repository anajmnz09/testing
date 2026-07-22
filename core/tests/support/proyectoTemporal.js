const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * PROYECTO TEMPORAL en disco para las pruebas de los módulos que persisten
 * archivos (metadata de pantallas, Execution Context, evidencias, logs).
 *
 * Por qué hace falta: esos módulos resuelven sus rutas UNA vez, al importarse,
 * desde `process.env.REPORTS_ROOT` / `process.cwd()`. Es una decisión del
 * framework (los reportes deben caer en el módulo que corre los tests, no en el
 * core) y no se toca. La consecuencia para las pruebas es que hay que fijar el
 * entorno ANTES del require y volver a importar el módulo en frío.
 *
 * Este helper hace justamente eso, sin modificar una línea del framework:
 *   const proyecto = crearProyecto();
 *   const screenMetadata = proyecto.importar('../../utils/screenMetadata');
 *   ...
 *   proyecto.limpiar();
 */

function crearProyecto({ archivoContexto } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'triple-core-unit-'));
  const previo = {
    REPORTS_ROOT: process.env.REPORTS_ROOT,
    EXECUTION_CONTEXT: process.env.EXECUTION_CONTEXT,
    RUN_ID: process.env.RUN_ID,
  };

  process.env.REPORTS_ROOT = raiz;
  process.env.RUN_ID = 'unit-test-run';
  if (archivoContexto) process.env.EXECUTION_CONTEXT = path.join(raiz, archivoContexto);

  const importados = [];

  return {
    raiz,

    /** Importa un módulo del core EN FRÍO, ya con el entorno temporal aplicado. */
    importar(rutaRelativa) {
      const resuelta = require.resolve(rutaRelativa, { paths: [__dirname] });
      delete require.cache[resuelta];
      importados.push(resuelta);
      return require(resuelta);
    },

    ruta(...partes) {
      return path.join(raiz, ...partes);
    },

    escribir(rutaRelativa, contenido) {
      const destino = path.join(raiz, rutaRelativa);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, contenido, 'utf8');
      return destino;
    },

    leerJson(rutaAbsoluta) {
      return JSON.parse(fs.readFileSync(rutaAbsoluta, 'utf8'));
    },

    /** Restaura el entorno y borra los archivos temporales. */
    limpiar() {
      importados.forEach((r) => delete require.cache[r]);
      Object.entries(previo).forEach(([clave, valor]) => {
        if (valor === undefined) delete process.env[clave];
        else process.env[clave] = valor;
      });
      fs.rmSync(raiz, { recursive: true, force: true });
    },
  };
}

/** Captura lo que se escribe por consola durante una función (para el logger). */
async function capturandoConsola(fn) {
  const lineas = [];
  const original = console.log;
  console.log = (...args) => lineas.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lineas;
}

module.exports = { crearProyecto, capturandoConsola };
