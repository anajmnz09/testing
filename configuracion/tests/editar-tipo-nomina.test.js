const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const TipoNominaDetallePage = require('../pages/TipoNominaDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');

const CASO = 'editar-tipo-nomina';
// Clave de BÚSQUEDA (identifica el Tipo Nómina EXISTENTE a abrir), separada
// a propósito de "Nombre" (campo del formulario, real y editable — mismo
// criterio que `editar-departamento`/`editar-beneficio`).
const CLAVE_BUSQUEDA = 'Nombre de Tipo Nómina a editar';
testContext.registrarCasoDesdeFormulario(CASO, TipoNominaDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita un Tipo Nómina ya existente: consulta antes de editar (evidencia),
 * entra a "Editar", cambia los campos que el Panel dirija (o, si no dirige
 * ninguno, "Nombre" con `siguienteNombreQA` — no hay otro campo de texto
 * libre "seguro" como default en esta entidad, mismo criterio que
 * Departamentos/Beneficios/Planes de seguro), Guarda, y vuelve a consultar
 * para confirmar el cambio (evidencia después). "Distribución de Pago" no
 * se toca acá (ya existe en el registro, `editar()` no la afecta).
 *
 * BUG DE APP conocido (ver `TipoNominaDetallePage`): entrar en modo Editar
 * sobre un registro existente deja "Distribución de Pago" cargando
 * indefinidamente, reproducido 2/2 veces — no es un bug de este test. Se
 * espera que este caso siga FALLANDO hasta que se corrija del lado de la
 * app.
 */
describe('Configuración - Editar Tipo Nómina', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoTipoNomina();

  it(`${CASO}: edita un Tipo Nómina existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Tipo Nómina está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: Tipo Nómina elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA (ni un solo campo), un default seguro (renombrar
    // "Nombre"). Chequeo a nivel de CASO, no de campo: si el Panel dirigió
    // cualquier otro campo, "Nombre" vacío significa "no tocar".
    const cambios = {};
    for (const label of Object.keys(TipoNominaDetallePage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      }
    }
    if (!Object.keys(cambios).length) {
      cambios['Nombre'] = siguienteNombreQA(nombreUsado);
    }
    logger.info(`${CASO}: editando -> ${JSON.stringify(cambios)}`);
    for (const [label, valor] of Object.entries(cambios)) {
      await detalle.setCampo(label, valor);
    }

    await detalle.guardar();
    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba edición exitosa para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Consulta DESPUÉS de editar (evidencia + verificación) ---
    const finales = {};
    for (const label of Object.keys(cambios)) {
      finales[label] = await detalle.esperarValor(label, cambios[label]);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta DESPUÉS de editar - "${nombreUsado}"` });

    for (const label of Object.keys(cambios)) {
      assertTextoIgual(
        finales[label],
        cambios[label],
        `"${label}" no quedó en "${cambios[label]}" (quedó "${finales[label]}").`
      );
    }
  });
});
