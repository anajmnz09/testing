/**
 * Root Hook Plugin ADICIONAL para ejecuciones en MODO FLUJO. Solo lo carga
 * `scripts/run-flow.js` (`--require`); `mochaRootHooks.js` sigue cargándose
 * igual y hace lo de siempre (logging, screenshot, bloqueo, recovery). Sin
 * `TRIPLE_FLOW_PLAN` este plugin es inerte, por seguridad.
 *
 * Responsabilidades (solo flujo):
 *  - beforeEach: bloquear (`skip`) un test cuyo productor SELECCIONADO falló,
 *    fue bloqueado o no publicó lo que declaró — salvo que el Panel dirija ese
 *    dato (el Panel siempre gana) — y llevar el navegador compartido al
 *    dashboard para que ningún test dependa de dónde terminó el anterior.
 *  - afterEach: registrar el estado del caso y verificar el contrato `produces`
 *    (PASS sin publicar la entidad declarada = el flujo lo trata como fallo).
 *  - afterAll: cerrar el driver compartido (los tests no lo cierran).
 *  - `flow-estado.json` (en la carpeta de la corrida): estado POR TEST, escrito de forma
 *    incremental. Es lo único que el Panel necesita para mostrar el flujo en vivo
 *    (pendiente / en ejecución / aprobado / falló / bloqueado + motivo + duración);
 *    los screenshots y evidencias los lee de las carpetas que el framework ya genera.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('./logger');
const paths = require('./paths');
const flowContext = require('../context/flowContext');
const testContext = require('../context/testContext');
const navigationFlow = require('../flows/navigationFlow');
const recovery = require('./recovery');
const Notify = require('../components/Notify');
const { quitDriver } = require('./driver');

const estados = new Map(); // caso -> 'passed' | 'failed' | 'bloqueado' | 'contrato-incumplido'

// --- Estado por test para el Panel (flow-estado.json) ----------------------
const FLOW_ESTADO = 'flow-estado.json';
let estadoFlujo = null;

function escribirEstadoFlujo() {
  if (!estadoFlujo) return;
  try {
    fs.writeFileSync(path.join(paths.getRunDir(), FLOW_ESTADO), JSON.stringify(estadoFlujo, null, 2), 'utf8');
  } catch (e) {
    logger.warn(`flujo: no se pudo escribir ${FLOW_ESTADO}: ${e.message}`);
  }
}

function iniciarEstadoFlujo() {
  const orden = (flowContext.plan().orden || []).map((x) => ({ modulo: x.modulo, caso: x.caso }));
  estadoFlujo = {
    runId: paths.RUN_ID,
    inicio: new Date().toISOString(),
    fin: null,
    orden: orden.map((x) => x.caso),
    casos: Object.fromEntries(
      orden.map((x) => [x.caso, { modulo: x.modulo, estado: 'pendiente', motivo: null, duracionMs: null, error: null }])
    ),
  };
  escribirEstadoFlujo();
}

function marcarCaso(caso, cambios) {
  if (!estadoFlujo || !estadoFlujo.casos[caso]) return;
  Object.assign(estadoFlujo.casos[caso], cambios);
  escribirEstadoFlujo();
}

/** Por convención, el nombre del archivo (sin .test.js) ES el nombre del caso. */
function casoDe(test) {
  return test && test.file ? path.basename(test.file).replace(/\.test\.js$/, '') : null;
}

/** Motivo por el que el caso no debe ejecutarse, o null. */
function motivoBloqueo(caso) {
  const plan = flowContext.plan();
  for (const r of (plan.requiere || {})[caso] || []) {
    for (const p of ((plan.productores || {})[r.tipo] || []).filter((x) => x !== caso)) {
      const e = estados.get(p);
      if (e && e !== 'passed') {
        return `requiere "${r.tipo}" (clave "${r.clave}") y su productor "${p}" terminó en estado "${e}"`;
      }
    }
  }
  return null;
}

exports.mochaHooks = {
  beforeAll() {
    if (flowContext.activo()) iniciarEstadoFlujo();
  },

  async beforeEach() {
    if (!flowContext.activo()) return;
    const caso = casoDe(this.currentTest);
    flowContext.setCasoActual(caso);

    const motivo = motivoBloqueo(caso);
    if (motivo) {
      estados.set(caso, 'bloqueado');
      logger.warn(`flujo: "${caso}" BLOQUEADO — ${motivo}`);
      marcarCaso(caso, { estado: 'bloqueado', motivo });
      this.skip();
      return;
    }
    marcarCaso(caso, { estado: 'running' });

    const driver = flowContext.driverCompartido();
    if (driver && flowContext.sesionIniciada(driver)) {
      try {
        await navigationFlow.volverAlDashboard(driver);
      } catch (e) {
        logger.warn(`flujo: no se pudo volver al dashboard (${e.message.split('\n')[0]}); se intenta recuperar el estado`);
        await recovery.recuperarEstado(driver);
        await navigationFlow.volverAlDashboard(driver);
      }
      // Con un navegador compartido, el toast del test anterior puede seguir en
      // pantalla unos segundos y el siguiente lo leería como SUYO (verificado en
      // vivo: "Guardado exitoso" del paquete de beneficios tomado como éxito del
      // cambio de etapa). Se espera a que no quede ninguno (no se toca el DOM).
      const notify = new Notify(driver);
      await driver
        .wait(async () => !(await notify.getTexto()), 12000)
        .catch(() => logger.warn('flujo: sigue visible un notify del test anterior; el siguiente test podría leerlo'));
    }
  },

  afterEach() {
    if (!flowContext.activo()) return;
    const test = this.currentTest;
    const caso = casoDe(test);
    if (!caso || estados.get(caso) === 'bloqueado') return;

    if (test.state !== 'passed') {
      estados.set(caso, 'failed');
      marcarCaso(caso, {
        estado: 'failed',
        duracionMs: test.duration || null,
        error: (test.err && test.err.message) || null,
      });
      return;
    }
    const faltan = ((flowContext.plan().produce || {})[caso] || []).filter((t) => {
      const e = flowContext.entidad(t);
      return !e || e.productor !== caso;
    });
    if (faltan.length) {
      estados.set(caso, 'contrato-incumplido');
      logger.error(`flujo: "${caso}" pasó pero NO publicó lo que declara producir: ${faltan.join(', ')}`);
      marcarCaso(caso, {
        estado: 'contrato-incumplido',
        duracionMs: test.duration || null,
        motivo: `pasó, pero no publicó lo que declara producir: ${faltan.join(', ')}`,
      });
    } else {
      estados.set(caso, 'passed');
      marcarCaso(caso, { estado: 'passed', duracionMs: test.duration || null });
    }
  },

  async afterAll() {
    if (!flowContext.activo()) return;
    const resumen = [...estados.entries()].map(([c, e]) => `${c}=${e}`).join(', ');
    logger.info(`flujo: resumen de estados -> ${resumen || '(sin tests)'}`);
    if (estadoFlujo) {
      estadoFlujo.fin = new Date().toISOString();
      escribirEstadoFlujo();
    }
    const driver = flowContext.driverCompartido();
    if (driver && !config.panel.mantenerNavegadorAbierto) {
      try {
        await quitDriver(driver, { forzar: true });
      } catch (e) {
        logger.error('flujo: no se pudo cerrar el driver compartido', e);
      }
    }
  },
};

