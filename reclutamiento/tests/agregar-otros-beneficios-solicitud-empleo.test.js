const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'agregar-otros-beneficios-solicitud-empleo';

// Mismo requisito que "cambiar-solicitud-crear-empleado": la sección "Otros
// beneficios" (y "Propuesta económica"/"Salario", requerida en la misma
// vista) solo existe cuando la solicitud está en Etapa="Oferta de Empleo" y
// Estado="Autorizada" (comparación case-insensitive, ver el grid real).
const ETAPA_REQUERIDA = 'oferta de empleo';
const ESTADO_REQUERIDO = 'autorizada';

testContext.registrarCaso(CASO, ['codigo', 'salario', 'beneficios', 'montos']);

function cumpleRequisitos(fila) {
  if (!fila) return false;
  const etapa = (fila['Etapa'] || '').trim().toLowerCase();
  const estado = (fila['Estado'] || '').trim().toLowerCase();
  return etapa === ETAPA_REQUERIDA && estado === ESTADO_REQUERIDO;
}

/**
 * Agrega uno o más "Otros beneficios" (sección NO requerida, debajo de
 * "Propuesta económica") a una Solicitud de Empleo en Etapa="Oferta de
 * Empleo"/Estado="Autorizada". Varios beneficios se declaran separados por
 * "|" en el Execution Context/Panel (misma convención que el resto del
 * framework), emparejados por posición con "montos". Un beneficio que no
 * matchea (tolerante, case-insensitive, por similitud) ninguna opción del
 * catálogo se DESCARTA silenciosamente — no hace fallar el caso, ya que la
 * sección no es requerida.
 *
 * Sin declarar `beneficios`, se usa un default que ejercita ambos caminos:
 * dos beneficios reales en minúscula (verifica que el match sea
 * case-insensitive) y uno inexistente (verifica el descarte silencioso).
 */
describe('Reclutamiento - Agregar Otros Beneficios a Solicitud de Empleo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSolicitudesEmpleo();

  it(`${CASO}: agrega los beneficios que matchean el catálogo y descarta los que no`, async function () {
    const codigo = testContext.get(CASO, 'codigo');
    let fila;
    let codigoUsado;

    if (codigo) {
      await ctx.lista.grid.buscar(codigo);
      fila = await ctx.lista.grid.leerFilaPorColumnas(codigo);
      codigoUsado = codigo;
    } else {
      const filas = await ctx.lista.grid.filasPorColumnas();
      fila = filas.find(cumpleRequisitos);
      codigoUsado = fila ? fila['Código'] : null;
    }

    if (!cumpleRequisitos(fila)) {
      assert.fail(
        'No se encontró ninguna solicitud que cumpla los requisitos para "Otros beneficios" ' +
          `(código="${codigoUsado || codigo || '(ninguna encontrada en el listado)'}", ` +
          `etapa="${fila ? fila['Etapa'] : '-'}", estado="${fila ? fila['Estado'] : '-'}"). ` +
          `Se requiere Etapa="Oferta de Empleo" y Estado="Autorizada".`
      );
    }
    logger.info(`${CASO}: "${codigoUsado}" cumple los requisitos (Etapa="${fila['Etapa']}", Estado="${fila['Estado']}")`);

    const detalle = await ctx.lista.abrirDetalle(codigoUsado);
    await detalle.editar();

    // "Salario" es requerido en esta misma vista: sin llenarlo, Guardar
    // falla con "Formulario Inválido" sin importar los beneficios.
    const salario = testContext.get(CASO, 'salario') || String(20000 + Math.floor(Math.random() * 30000));
    await detalle.setCampoPropuestaEconomica('Salario', salario);

    const beneficiosTexto = testContext.get(CASO, 'beneficios') || 'parqueo|transporte|Beneficio Que No Existe XYZ';
    const montosTexto = testContext.get(CASO, 'montos') || '1500|800';
    const agregados = await detalle.agregarBeneficios(beneficiosTexto, montosTexto);
    logger.info(`${CASO}: beneficios agregados (matchearon el catálogo): ${JSON.stringify(agregados)}`);

    await detalle.guardar();
    const resGuardado = await detalle.resultadoGuardado();
    assert.ok(
      resGuardado.exito,
      `Se esperaba guardado exitoso para "${codigoUsado}" con beneficios ${JSON.stringify(agregados)}. Notify: "${resGuardado.notify}"`
    );
    await evidence.attachScreenshot(ctx.driver, this, { label: 'Otros beneficios guardados' });

    const filasBeneficios = await detalle.leerOtrosBeneficios();
    logger.info(`${CASO}: filas de "Otros beneficios" tras guardar: ${JSON.stringify(filasBeneficios)}`);

    assert.ok(
      agregados.length > 0,
      `Ningún beneficio de "${beneficiosTexto}" matcheó el catálogo (todos fueron descartados).`
    );
    for (const beneficio of agregados) {
      const encontrado = filasBeneficios.some((f) => f.nombre.toLowerCase().includes(beneficio.trim().toLowerCase()));
      assert.ok(
        encontrado,
        `El beneficio "${beneficio}" no aparece en la tabla "Otros beneficios" tras guardar (filas: ${JSON.stringify(filasBeneficios)}).`
      );
    }
  });
});
