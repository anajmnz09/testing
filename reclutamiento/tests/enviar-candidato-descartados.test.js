const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'enviar-candidato-descartados';
// Sin restricción real: en modo automático se envía el PRIMER candidato de
// "Elegibles". Dirigible con "nombre" (texto a buscar en la fila) desde el
// Panel.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Desde "Banco de candidatos", tab "Elegibles": selecciona (checkbox) un
 * candidato, lo envía a "Descartados" (botón "Enviar a descartados" +
 * confirmar "Sí"), guarda evidencia del notify, y confirma que aparece en la
 * tab "Descartados" al buscarlo por nombre. Mismo procedimiento que
 * `enviar-candidato-elegibles`, en el sentido inverso.
 */
describe('Reclutamiento - Enviar Candidato a Descartados', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoBancoCandidatos();

  it(`${CASO}: envía un candidato de "Elegibles" a "Descartados" y lo confirma`, async function () {
    await ctx.lista.irATab('Elegibles');

    const nombreDirigido = testContext.get(CASO, 'nombre');
    const filas = await ctx.lista.grid.filasPorColumnas();
    const filaObjetivo = nombreDirigido
      ? filas.find((f) => Object.values(f).some((v) => v && v.includes(nombreDirigido)))
      : filas[0];
    assert.ok(
      filaObjetivo,
      nombreDirigido
        ? `${CASO}: no se encontró "${nombreDirigido}" en "Elegibles".`
        : `${CASO}: "Elegibles" no tiene candidatos para enviar.`
    );
    const nombreCandidato = filaObjetivo['Nombre'];
    logger.info(`${CASO}: candidato elegido -> "${nombreCandidato}"`);

    const resultado = await ctx.lista.enviarADescartados(nombreCandidato);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Notify - enviar "${nombreCandidato}" a Descartados` });
    assert.ok(
      resultado.exito,
      `Se esperaba notify de éxito al enviar "${nombreCandidato}" a Descartados. Notify: "${resultado.notify}"`
    );

    await ctx.lista.irATab('Descartados');
    const filaEnDescartados = await ctx.lista.grid.esperarFila(nombreCandidato, (f) =>
      Object.values(f).some((v) => v && v.includes(nombreCandidato))
    );
    assert.ok(
      filaEnDescartados,
      `"${nombreCandidato}" no aparece en "Descartados" tras enviarlo (fila: ${JSON.stringify(filaEnDescartados)}).`
    );
  });
});
