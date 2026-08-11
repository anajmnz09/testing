const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'cambiar-solicitud-oferta-empleo';
const ETAPA_OBJETIVO = 'Oferta de Empleo';
// "Crear Empleado" es la etapa FINAL del flujo (donde se contrata y se crea
// el perfil en el módulo Empleados) — DISTINTA de "Crear Solicitud de
// Empleo" (la etapa inicial). Solo se excluye esta, la final: cualquier otra
// etapa (incluida "Crear Solicitud de Empleo") es un candidato válido.
const ETAPA_EXCLUIDA = 'crear empleado';
const ESTADO_EXCLUIDO = 'rechazada';

// Entradas del caso: `codigo` dirige a una solicitud puntual. Sin él, se
// elige automáticamente la PRIMERA solicitud no rechazada que NO esté en
// etapa "Crear Empleado" (la etapa final) — leyendo la fila del listado
// (DataGrid del core: `filasPorColumnas`), sin abrir ningún detalle para
// decidir.
testContext.registrarCaso(CASO, ['codigo']);

/**
 * Cambia la etapa de una Solicitud de Empleo a "Oferta de Empleo", desde el
 * dropdown de etapa del HEADER (junto al badge de Estado) — acción directa,
 * sin pasar por "Editar": seleccionar la opción guarda sola y dispara su
 * propio notify (mismo criterio que Pausar/Publicar en Requisición). La
 * evidencia se toma en la misma vista de consulta.
 *
 * Alcance ÚNICO: cambiar la etapa — no toca valoración, foto, datos
 * personales/del puesto, preguntas personalizadas ni paquete de beneficios.
 */
describe('Reclutamiento - Cambiar Solicitud a Oferta de Empleo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSolicitudesEmpleo();

  it(`${CASO}: cambia la etapa a "Oferta de Empleo" y confirma con el notify`, async function () {
    const codigo = testContext.get(CASO, 'codigo');
    let codigoUsado = codigo;

    if (!codigoUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      const fila = filas.find((f) => {
        const etapa = (f['Etapa'] || '').trim().toLowerCase();
        const estado = (f['Estado'] || '').trim().toLowerCase();
        return etapa !== ETAPA_EXCLUIDA && estado !== ESTADO_EXCLUIDO;
      });
      if (!fila) {
        assert.fail(
          'No se encontró ninguna solicitud no rechazada fuera de la etapa "Crear Empleado" ' +
            'para dirigir la prueba automáticamente.'
        );
      }
      codigoUsado = fila['Código'];
      logger.info(`${CASO}: elegida automáticamente la solicitud "${codigoUsado}" (etapa="${fila['Etapa']}", estado="${fila['Estado']}")`);
    }

    const detalle = await ctx.lista.abrirDetalle(codigoUsado);
    // Acción de header directa: NO se entra a Editar.
    const res = await detalle.cambiarEtapa(ETAPA_OBJETIVO);

    await evidence.attachScreenshot(ctx.driver, this, { label: 'Etapa cambiada a Oferta de Empleo' });

    assert.ok(
      res.exito,
      `Se esperaba notify de éxito al cambiar la etapa de "${codigoUsado}" a "${ETAPA_OBJETIVO}". Notify: "${res.notify}"`
    );

    const etapaFinal = await detalle.getEtapa();
    assert.ok(
      etapaFinal.toLowerCase().includes('oferta de empleo'),
      `La etapa de "${codigoUsado}" no quedó en "${ETAPA_OBJETIVO}" (quedó "${etapaFinal}").`
    );
  });
});
