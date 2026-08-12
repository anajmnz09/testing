const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'enviar-candidato-elegibles';
// Sin restricción real: en modo automático se envía el PRIMER candidato de
// "Descartados". Dirigible con "nombre" (texto a buscar en la fila) desde el
// Panel.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Desde "Banco de candidatos", tab "Descartados": selecciona (checkbox) un
 * candidato, lo envía a "Elegibles" (botón "Enviar a elegibles" + confirmar
 * "Sí"), guarda evidencia del notify, y confirma que aparece en la tab
 * "Elegibles" al buscarlo por nombre.
 */
describe('Reclutamiento - Enviar Candidato a Elegibles', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoBancoCandidatos();

  it(`${CASO}: envía un candidato de "Descartados" a "Elegibles" y lo confirma`, async function () {
    await ctx.lista.irATab('Descartados');

    const nombreDirigido = testContext.get(CASO, 'nombre');
    const filas = await ctx.lista.grid.filasPorColumnas();
    const filaObjetivo = nombreDirigido
      ? filas.find((f) => Object.values(f).some((v) => v && v.includes(nombreDirigido)))
      : filas[0];
    assert.ok(
      filaObjetivo,
      nombreDirigido
        ? `${CASO}: no se encontró "${nombreDirigido}" en "Descartados".`
        : `${CASO}: "Descartados" no tiene candidatos para enviar.`
    );
    const nombreCandidato = filaObjetivo['Nombre'];
    logger.info(`${CASO}: candidato elegido -> "${nombreCandidato}"`);

    const resultado = await ctx.lista.enviarAElegibles(nombreCandidato);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Notify - enviar "${nombreCandidato}" a Elegibles` });
    assert.ok(
      resultado.exito,
      `Se esperaba notify de éxito al enviar "${nombreCandidato}" a Elegibles. Notify: "${resultado.notify}"`
    );

    await ctx.lista.irATab('Elegibles');
    const filaEnElegibles = await ctx.lista.grid.esperarFila(nombreCandidato, (f) =>
      Object.values(f).some((v) => v && v.includes(nombreCandidato))
    );
    assert.ok(
      filaEnElegibles,
      `"${nombreCandidato}" no aparece en "Elegibles" tras enviarlo (fila: ${JSON.stringify(filaEnElegibles)}).`
    );
  });
});
