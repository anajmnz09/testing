const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const { parsearValoresMultiples } = require('@triple/core/strategies');
const logger = require('@triple/core/utils/logger');
const UsuarioDetallePage = require('../pages/UsuarioDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');

const CASO = 'editar-usuario';
// Clave de BÚSQUEDA (identifica el Usuario EXISTENTE a abrir, por su "Nombre
// Completo"), separada a propósito de "Nombre Completo" (campo del
// formulario, real y editable) — mismo criterio que `editar-departamento`.
const CLAVE_BUSQUEDA = 'Nombre de Usuario a editar';
testContext.registrarCasoDesdeFormulario(CASO, UsuarioDetallePage.ESTRATEGIAS_EDITAR, [CLAVE_BUSQUEDA]);

/**
 * Edita un Usuario ya existente: consulta antes de editar (evidencia), entra
 * en modo edición vía `#usuario-form-dropdown-acciones` > "Editar" (acceso
 * distinto del resto de Configuración — ver `UsuarioDetallePage`), cambia los
 * campos que el Panel dirija (o, si no dirige ninguno, "Nombre Completo" con
 * `siguienteNombreQA`), Guarda, y vuelve a consultar para confirmar el
 * cambio. La sección "Grupos" se ignora por completo, a pedido explícito del
 * usuario.
 *
 * "Es administrador"/"Tiene acceso a RRHH" NUNCA se tocan acá — tienen sus
 * propios tests dedicados (`marcar-usuario-administrador`,
 * `dar-acceso-rrhh-usuario`).
 *
 * "Compañías permitidas" (tagbox multi-select) se resuelve APARTE del resto:
 * el Panel dirige varios valores separados por "|" (ver
 * `parsearValoresMultiples`); agregar valores NO reemplaza los que el
 * usuario ya tenía (confirmado con Selenium real). Se verifica con los
 * chips reales del tagbox, no con `Form.getValor`/`assertTextoIgual` (no
 * sirven para un tagbox — mismo criterio que "Etiquetas" en Solicitud de
 * Empleo).
 */
describe('Configuración - Editar Usuario', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoUsuarios();

  it(`${CASO}: edita un Usuario existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Usuarios está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre Completo'];
      logger.info(`${CASO}: Usuario elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Cambios "simples" (texto): todo lo que el Panel dirija, salvo los 2
    // switches (tests aparte) y "Compañías permitidas" (multi-valor, aparte).
    const cambios = {};
    for (const label of Object.keys(UsuarioDetallePage.ESTRATEGIAS_EDITAR)) {
      if (label === 'Es administrador' || label === 'Tiene acceso a RRHH' || label === 'Compañías permitidas') continue;
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      } else if (label === 'Nombre Completo') {
        cambios[label] = siguienteNombreQA(await detalle.getValor(label));
      }
    }

    const companiasDirigidas = testContext.get(CASO, 'Compañías permitidas');
    const companiasAAgregar = companiasDirigidas ? parsearValoresMultiples(companiasDirigidas) : null;

    logger.info(
      `${CASO}: editando -> ${JSON.stringify(cambios)}` +
        (companiasAAgregar ? `, Compañías permitidas (agregar) -> ${JSON.stringify(companiasAAgregar)}` : '')
    );
    for (const [label, valor] of Object.entries(cambios)) {
      await detalle.setCampo(label, valor);
    }
    if (companiasAAgregar && companiasAAgregar.length) {
      await detalle.setCampo('Compañías permitidas', companiasAAgregar);
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

    if (companiasAAgregar && companiasAAgregar.length) {
      const chips = await detalle.form.getTags('Compañías permitidas');
      for (const compania of companiasAAgregar) {
        assert.ok(
          chips.some((c) => c.toLowerCase() === compania.toLowerCase()),
          `"${compania}" no aparece entre las "Compañías permitidas" de "${nombreUsado}" tras editar (chips: ${JSON.stringify(chips)}).`
        );
      }
    }
  });
});
