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
 * "Es administrador"/"Tiene acceso a RRHH": se tocan SOLO si el Panel dirige
 * `true` explícito para alguno — a diferencia del resto de campos, no hay
 * autofill acá (no se apagan solos si no se dirigen; quedan INTACTOS en su
 * estado actual). Se verifican APARTE del resto con `esperarInterruptor`
 * (no con `Form.getValor`/`assertTextoIgual`: no sirven para un switch — ver
 * `UsuarioDetallePage.estadoInterruptor`). Además de acá, siguen existiendo
 * tests dedicados idempotentes para activarlos: `marcar-usuario-administrador`,
 * `dar-acceso-rrhh-usuario`.
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
    // switches (verificados aparte, ver abajo) y "Compañías permitidas"
    // (multi-valor, aparte).
    const cambios = {};
    for (const label of Object.keys(UsuarioDetallePage.ESTRATEGIAS_EDITAR)) {
      if (label === 'Es administrador' || label === 'Tiene acceso a RRHH' || label === 'Compañías permitidas') continue;
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      }
    }

    // Switches: solo se tocan si el Panel dirige `true` explícito (`_vacio`
    // trata `false`/sin dirigir como "no dirigido") — sin autofill, quedan
    // intactos si no se dirigen.
    const interruptores = {};
    for (const label of ['Es administrador', 'Tiene acceso a RRHH']) {
      if (testContext.get(CASO, label) === true) interruptores[label] = true;
    }

    const companiasDirigidas = testContext.get(CASO, 'Compañías permitidas');
    const companiasAAgregar = companiasDirigidas ? parsearValoresMultiples(companiasDirigidas) : null;

    // Default seguro (renombrar "Nombre Completo") SOLO si el Panel no
    // dirigió NADA en absoluto (ni un campo simple, ni un switch, ni
    // "Compañías permitidas") — chequeo a nivel de CASO, no de campo: si se
    // dirigió cualquier otra cosa, "Nombre Completo" vacío significa "no
    // tocar".
    if (!Object.keys(cambios).length && !Object.keys(interruptores).length && !companiasAAgregar) {
      cambios['Nombre Completo'] = siguienteNombreQA(await detalle.getValor('Nombre Completo'));
    }

    logger.info(
      `${CASO}: editando -> ${JSON.stringify(cambios)}` +
        (Object.keys(interruptores).length ? `, interruptores -> ${JSON.stringify(interruptores)}` : '') +
        (companiasAAgregar ? `, Compañías permitidas (agregar) -> ${JSON.stringify(companiasAAgregar)}` : '')
    );
    for (const [label, valor] of Object.entries(cambios)) {
      await detalle.setCampo(label, valor);
    }
    for (const [label, valor] of Object.entries(interruptores)) {
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
    const interruptoresFinales = {};
    for (const label of Object.keys(interruptores)) {
      interruptoresFinales[label] = await detalle.esperarInterruptor(label, true);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta DESPUÉS de editar - "${nombreUsado}"` });

    for (const label of Object.keys(cambios)) {
      assertTextoIgual(
        finales[label],
        cambios[label],
        `"${label}" no quedó en "${cambios[label]}" (quedó "${finales[label]}").`
      );
    }
    for (const label of Object.keys(interruptores)) {
      assert.strictEqual(
        interruptoresFinales[label],
        true,
        `"${label}" no quedó activado para "${nombreUsado}" tras editar.`
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
