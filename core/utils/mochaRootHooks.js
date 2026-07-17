/**
 * Root Hook Plugin de Mocha (https://mochajs.org/#root-hook-plugins).
 * Se carga UNA vez vía --require en scripts/run-tests.js y sus hooks
 * (beforeAll/afterAll/beforeEach/afterEach) corren automáticamente para
 * TODOS los archivos de tests/, presentes y futuros, sin que cada uno
 * tenga que repetir esta lógica.
 *
 * Responsabilidades centralizadas aquí:
 *  - Loggear inicio/fin de cada test (utils/logger.js) y de la corrida completa.
 *  - Adjuntar el contexto de ejecución (ambiente, SO, navegador, usuario, etc.)
 *    al reporte de Mochawesome.
 *  - Decidir si capturar screenshot según SCREENSHOT_MODE (config/index.js).
 *  - Cerrar el driver activo (utils/driver.js) al terminar cada test.
 *
 * Un archivo de test nuevo (candidatos, vacantes, etc.) solo necesita crear
 * el driver con utils/driver.js#createDriver() en su propio beforeEach; todo
 * lo demás (logging, screenshot, cierre del driver) ocurre solo.
 *
 * NOTA técnica: Mochawesome/marge no renderiza en el HTML los hooks del root
 * suite ("before all"/"after all" de más alto nivel) aunque sí quedan en el
 * JSON — se verificó empíricamente. Por eso el contexto de ejecución se
 * adjunta al PRIMER test real que corre (vía addContext en "after each"),
 * que es el único lugar donde Mochawesome sí lo muestra visualmente.
 */
const addContext = require('mochawesome/addContext');
const config = require('../config');
const logger = require('./logger');
const paths = require('./paths');
const evidence = require('./evidence');
const executionContext = require('./executionContext');
const { getCurrentDriver, quitDriver } = require('./driver');

let runStartedAt = null;
let executionContextAttached = false;

exports.mochaHooks = {
  beforeAll() {
    paths.ensureReportDirs();
    runStartedAt = Date.now();
    logger.info(
      `Iniciando ejecución [${paths.RUN_ID}] - ambiente: ${executionContext.inferEnvironment(process.env.BASE_URL)} - URL: ${process.env.BASE_URL || 'N/D'}`
    );
  },

  beforeEach() {
    if (this.currentTest) {
      logger.testStart(this.currentTest.fullTitle());
    }
  },

  async afterEach() {
    const test = this.currentTest;
    if (!test) return;

    logger.testEnd(test.fullTitle(), test.state || 'desconocido', test.duration);

    const driver = getCurrentDriver();

    if (driver && !executionContextAttached) {
      executionContextAttached = true;
      try {
        const browserInfo = await executionContext.enrichWithDriver(driver);
        const info = {
          ...executionContext.buildStaticContext(),
          ...browserInfo,
          runId: paths.RUN_ID,
          inicioEjecucion: new Date(runStartedAt).toISOString(),
        };
        addContext(this, { title: 'Contexto de ejecución', value: JSON.stringify(info, null, 2) });
      } catch (err) {
        logger.error('No se pudo adjuntar el contexto de ejecución al reporte', err);
      }
    }

    if (driver) {
      const mode = config.screenshot.mode;
      const shouldCapture = mode === 'all' || (mode === 'fail' && test.state === 'failed');

      if (shouldCapture) {
        try {
          await evidence.attachScreenshot(driver, this, {
            label: test.state === 'failed' ? 'Fallo' : 'Resultado final',
          });
        } catch (err) {
          logger.error('No se pudo capturar el screenshot automático', err);
        }
      }

      try {
        await quitDriver(driver);
      } catch (err) {
        logger.error('No se pudo cerrar el driver', err);
      }
    }
  },

  afterAll() {
    const durationMs = runStartedAt ? Date.now() - runStartedAt : undefined;
    logger.info(`Ejecución finalizada${typeof durationMs === 'number' ? ` (${durationMs}ms)` : ''}`);
  },
};
