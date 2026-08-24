const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-usuario';
// Dos criterios reales de búsqueda, confirmados con Selenium real: el
// buscador global de este listado encuentra un registro tanto por "nombre"
// (columna visible "Nombre Completo") como por "Código de usuario" (NO es
// columna visible, pero el buscador SÍ lo indexa) — ver
// `ConfiguracionEntidadListadoPage.abrirPrimero` (core). Nunca declarar
// "sin parámetros"/"un solo parámetro" sin haber probado en vivo los
// criterios reales de la pantalla (`.claude/skills/testing-patterns/SKILL.md`
// §"Discover and Verify").
testContext.registrarCaso(CASO, ['nombre', 'Código de usuario']);

/**
 * Abre el detalle (modo consulta) de un Usuario ya existente, por cualquiera
 * de sus 2 criterios de búsqueda reales:
 *  - "nombre": columna visible ("Nombre Completo") — usa `abrirDetalle`
 *    (filtra y matchea el texto contra la fila).
 *  - "Código de usuario": NO es columna visible — usa
 *    `abrirPrimero(codigo)` (solo filtra y abre lo que quede; `abrirDetalle`
 *    no sirve acá porque su `_filaLocator` busca el texto DENTRO de las
 *    celdas visibles, y el código no aparece en ninguna).
 * Si el Panel no dirige ninguno de los dos, abre el PRIMERO del listado. Si
 * el listado está VACÍO, el test termina sin fallar.
 */
describe('Configuración - Consultar Usuario', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoUsuarios();

  it(`${CASO}: abre el detalle de un Usuario existente`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    const codigoDirigido = testContext.get(CASO, 'Código de usuario');

    if (!nombreDirigido && !codigoDirigido) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Usuarios está vacío — no hay ningún registro para consultar, se termina el test.`);
        return;
      }
    }

    let detalle;
    if (nombreDirigido) {
      detalle = await ctx.lista.abrirDetalle(nombreDirigido);
    } else if (codigoDirigido) {
      detalle = await ctx.lista.abrirPrimero(codigoDirigido);
    } else {
      detalle = await ctx.lista.abrirPrimero();
    }

    const nombreReal = await detalle.getNombre();
    assert.ok(nombreReal.trim().length > 0, 'El detalle abierto no muestra ningún nombre de registro.');
    logger.info(`${CASO}: detalle abierto -> "${nombreReal}"`);
  });
});
