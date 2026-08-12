const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const SRHHNavBar = require('@triple/core/components/SRHHNavBar');
const BancoCandidatosPage = require('../pages/BancoCandidatosPage');
const fixtures = require('../support/fixtures');

const CASO = 'cerrar-requisicion';

// Sin restricción real (se puede cerrar cualquier requisición no cerrada
// todavía), pero en modo automático se PREFIERE una con más de 1 Solicitud
// de Empleo (columna propia del grid, sin abrir el detalle) para ejercitar
// el camino con "Envío de candidatos" — si no hay ninguna así, cualquier
// requisición no cerrada sirve.
testContext.registrarCaso(CASO, ['codigo']);

function elegirRequisicion(filas) {
  const noCerradas = filas.filter((f) => (f['Estado'] || '').trim().toLowerCase() !== 'cerrada');
  const conVarias = noCerradas.find((f) => parseInt(f['Solicitudes de Empleo'], 10) > 1);
  return conVarias || noCerradas[0] || null;
}

/**
 * Cierra una requisición desde el botón "Cerrar" del header
 * (`RequisicionDetallePage.cerrar`). Cubre los dos caminos reales:
 *   - Sin solicitantes pendientes: un solo popup de confirmación.
 *   - Con al menos uno: segundo popup "Envío de candidatos" — cada
 *     candidato se envía a "B. Elegibles" o "B. Descartados" de forma
 *     aleatoria (repartirlos a mano sería excesivo para este caso).
 *
 * Verifica Estado="Cerrada" en la MISMA vista de consulta y en el listado
 * (navegando de vuelta). Si hubo "Envío de candidatos", registra en el log
 * nombre+destino de cada solicitante y confirma en Banco de candidatos
 * (llegando esta vez por el navbar, no por el botón de la requisición) que
 * cada uno quedó en la tab correcta.
 */
describe('Reclutamiento - Cerrar Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: cierra la requisición, resuelve "Envío de candidatos" si aplica, y confirma el estado`, async function () {
    const codigo = testContext.get(CASO, 'codigo');
    let codigoUsado = codigo;

    if (!codigoUsado) {
      await ctx.lista.esperarFilas();
      const filas = await ctx.lista.grid.filasPorColumnas();
      const fila = elegirRequisicion(filas);
      if (!fila) {
        assert.fail(`${CASO}: no se encontró ninguna requisición sin cerrar en el listado.`);
      }
      codigoUsado = fila['Código'];
      logger.info(
        `${CASO}: elegida automáticamente "${codigoUsado}" (Estado="${fila['Estado']}", Solicitudes de Empleo="${fila['Solicitudes de Empleo']}")`
      );
    }

    const detalle = await ctx.lista.abrirDetalle(codigoUsado);
    await detalle.estaCargado();

    const resultado = await detalle.cerrar();
    assert.ok(
      resultado.exito,
      `Se esperaba notify de éxito al cerrar "${codigoUsado}". Notify: "${resultado.notify}"`
    );

    if (resultado.envios) {
      logger.info(
        `${CASO}: "Envío de candidatos" resuelto para "${codigoUsado}" -> ${JSON.stringify(resultado.envios)}`
      );
    } else {
      logger.info(`${CASO}: "${codigoUsado}" no tenía solicitantes pendientes (sin "Envío de candidatos").`);
    }

    const estadoConsulta = await detalle.form.esperarValor('Estado', 'Cerrada');
    await evidence.attachScreenshot(ctx.driver, this, { label: 'Requisición cerrada (consulta)' });
    assert.strictEqual(
      estadoConsulta.trim().toLowerCase(),
      'cerrada',
      `El campo "Estado" de "${codigoUsado}" no quedó en "Cerrada" (quedó "${estadoConsulta}").`
    );

    // Verificación en el LISTADO (no solo en la vista de consulta). El
    // filtro del buscador tarda un instante en reflejarse (misma carrera ya
    // vista en Empleados): se usa `esperarFila` (poll), no una sola lectura.
    await ctx.lista.navBar.ir('Requisiciones');
    await ctx.lista.esperarFilas();
    const filaListado = await ctx.lista.grid.esperarFila(codigoUsado, (f) => f['Código'] === codigoUsado);
    assert.strictEqual(
      (filaListado && filaListado['Estado'] || '').trim().toLowerCase(),
      'cerrada',
      `El listado de Requisiciones no muestra "${codigoUsado}" en Estado="Cerrada" (fila: ${JSON.stringify(filaListado)}).`
    );

    if (!resultado.envios) {
      return;
    }

    // Confirmar en Banco de candidatos, llegando esta vez por el navbar
    // (no por el botón "B. Elegibles" de la requisición). Por cada
    // candidato: cambiar a su tab, escribirlo en el buscador general, y
    // adjuntar una captura de ESE resultado de búsqueda puntual (evidencia
    // visual explícita, no solo el resultado del assert).
    const navBar = new SRHHNavBar(ctx.driver);
    await navBar.ir('Banco de candidatos');
    const banco = await new BancoCandidatosPage(ctx.driver).estaCargado();

    const tabsVisitadas = new Set();
    for (const envio of resultado.envios) {
      const tab = envio.destino === 'B. Elegibles' ? 'Elegibles' : 'Descartados';
      if (!tabsVisitadas.has(tab)) {
        await banco.irATab(tab);
        tabsVisitadas.add(tab);
      }
      // El envío puede tardar en propagarse a Banco de candidatos (misma
      // carrera ya vista con Empleados): poll (re-busca en cada intento),
      // no una sola lectura.
      const filaEncontrada = await banco.grid.esperarFila(envio.nombre, (f) =>
        Object.values(f).some((v) => v && v.includes(envio.nombre))
      );
      await evidence.attachScreenshot(ctx.driver, this, { label: `Banco de candidatos - buscar "${envio.nombre}"` });
      assert.ok(
        filaEncontrada,
        `"${envio.nombre}" no aparece en la tab "${tab}" de Banco de candidatos (se envió a "${envio.destino}").`
      );
      logger.info(`${CASO}: confirmado en Banco de candidatos -> "${envio.nombre}" en tab "${tab}"`);
    }
  });
});
