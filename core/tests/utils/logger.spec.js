const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { crearProyecto, capturandoConsola } = require('../support/proyectoTemporal');

/**
 * Logger.
 *
 * Lo observable: el FORMATO de cada línea (el reporte y el archivo de log se
 * leen a mano, así que el formato es contrato), que escriba tanto en consola
 * como en disco, y que un problema de disco NUNCA interrumpa una prueba.
 */
describe('logger (unitario)', function () {
  let proyecto;
  let logger;
  let paths;

  const HORA = /^\d{2}:\d{2}:\d{2} - /;

  beforeEach(function () {
    proyecto = crearProyecto();
    paths = proyecto.importar('../../utils/paths');
    logger = proyecto.importar('../../utils/logger');
  });

  afterEach(function () {
    proyecto.limpiar();
  });

  describe('formato de las líneas', function () {
    it('antepone la hora HH:MM:SS a cada mensaje', async function () {
      const [linea] = await capturandoConsola(() => logger.info('mensaje de prueba'));

      expect(linea).to.match(HORA);
      expect(linea).to.equal(`${linea.slice(0, 11)}mensaje de prueba`);
    });

    it('marca los errores con el nivel ERROR', async function () {
      const [linea] = await capturandoConsola(() => logger.error('no se pudo abrir el detalle'));

      expect(linea).to.match(HORA);
      expect(linea).to.contain('ERROR: no se pudo abrir el detalle');
    });

    it('agrega el mensaje de la excepción cuando se le pasa una', async function () {
      const [linea] = await capturandoConsola(() =>
        logger.error('falló el paso', new Error('element not interactable'))
      );

      expect(linea).to.contain('ERROR: falló el paso - element not interactable');
    });

    it('no agrega basura cuando el error viene vacío o sin message', async function () {
      const lineas = await capturandoConsola(() => {
        logger.error('sin error asociado');
        logger.error('error raro', {});
      });

      lineas.forEach((l) => expect(l).to.not.contain('undefined'));
      expect(lineas[0]).to.match(/ERROR: sin error asociado$/);
    });
  });

  describe('ciclo de vida de un test', function () {
    it('registra el inicio y el fin con estado y duración', async function () {
      const lineas = await capturandoConsola(() => {
        logger.testStart('Reclutamiento pausar-requisicion: pausa una requisición');
        logger.testEnd('Reclutamiento pausar-requisicion: pausa una requisición', 'passed', 1234);
      });

      expect(lineas[0]).to.contain('Iniciando: Reclutamiento pausar-requisicion');
      expect(lineas[1]).to.contain('Finalizado: Reclutamiento pausar-requisicion');
      expect(lineas[1]).to.contain('[passed] (1234ms)');
    });

    it('omite la duración cuando no se conoce', async function () {
      const [linea] = await capturandoConsola(() => logger.testEnd('caso', 'failed'));

      expect(linea).to.contain('[failed]');
      expect(linea).to.not.contain('ms)');
    });
  });

  describe('medición de pasos', function () {
    it('`step` loguea y devuelve el instante para medir la duración', async function () {
      let inicio;
      const lineas = await capturandoConsola(() => {
        inicio = logger.step('abriendo el detalle');
      });

      expect(lineas[0]).to.contain('abriendo el detalle');
      expect(inicio).to.be.a('number');
    });

    it('`stepDone` agrega la duración medida desde `step`', async function () {
      const [linea] = await capturandoConsola(() => logger.stepDone('detalle abierto', Date.now() - 50));

      expect(linea).to.match(/detalle abierto \(\d+ms\)/);
    });
  });

  describe('persistencia en disco', function () {
    it('escribe también en el execution.log de la corrida', async function () {
      await capturandoConsola(() => {
        logger.info('primera línea');
        logger.error('segunda línea');
      });

      const contenido = fs.readFileSync(path.join(paths.LOGS_DIR, 'execution.log'), 'utf8');
      expect(contenido).to.contain('primera línea');
      expect(contenido).to.contain('ERROR: segunda línea');
      expect(contenido.trim().split('\n')).to.have.lengthOf(2);
    });

    it('un fallo escribiendo el archivo NO interrumpe la prueba', async function () {
      const original = fs.appendFileSync;
      fs.appendFileSync = () => {
        throw new Error('disco lleno');
      };
      try {
        const lineas = await capturandoConsola(() => logger.info('sigue andando'));
        expect(lineas[0]).to.contain('sigue andando'); // la consola sí recibió el mensaje
      } finally {
        fs.appendFileSync = original;
      }
    });
  });
});
