const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const SucursalDetallePage = require('../pages/SucursalDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-sucursal';
// Clave de BÚSQUEDA (identifica la sucursal EXISTENTE a abrir), separada a
// propósito de "Nombre Sucursal" (que es un campo del formulario, real y
// editable — si compartieran la misma clave del Execution Context no habría
// forma de dirigir un RENOMBRE: el valor usado para buscar pisaría al valor
// a guardar, o viceversa). El resto de los campos del formulario se siembran
// desde `SucursalDetallePage.ESTRATEGIAS` (Input Model), igual que
// `crear-sucursal` — antes este caso solo registraba 4 claves a mano y el
// Panel no ofrecía el resto de los campos del form.
const CLAVE_BUSQUEDA = 'Nombre de Sucursal a editar';
testContext.registrarCasoDesdeFormulario(CASO, SucursalDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

// Defaults QA solo para los campos que SIEMPRE se cambian si el Panel no
// dirige nada (texto libre, sin efectos colaterales de identidad/negocio).
// "Nombre Sucursal", "Teléfono", "Estado", etc. SOLO se tocan si el Panel
// los dirige explícitamente (ver loop más abajo) — cambiarlos por defecto en
// cada corrida automática sería un efecto colateral no pedido (renombrar la
// sucursal, tocar su Estado activo/inactivo, etc.).
const DEFAULTS_QA = {
  Correo: 'sucursal.editada.qa@example.com',
  Dirección: 'Dirección editada por prueba automatizada QA.',
  RNL: `RNL-QA-${Date.now().toString().slice(-6)}`,
};

/**
 * Edita una Sucursal ya existente: consulta antes de editar (evidencia),
 * entra a "Editar", cambia los campos que el Panel dirija (o, si no dirige
 * ninguno, los 3 de `DEFAULTS_QA` — Correo/Dirección/RNL, texto libre sin
 * máscara), Guarda, y vuelve a consultar para confirmar el cambio (evidencia
 * después).
 *
 * "Compañía" NUNCA se toca (deshabilitada siempre, ver mapeo de
 * `SucursalDetallePage`). Cualquier otro campo declarado en ESTRATEGIAS
 * —incluyendo "Nombre Sucursal" (renombrar) o "Teléfono"— se puede dirigir
 * desde el Panel; solo los 3 de `DEFAULTS_QA` tienen un valor automático si
 * no se dirige nada.
 */
describe('Configuración - Editar Sucursal', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSucursales();

  it(`${CASO}: edita una Sucursal existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Sucursales está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Sucursal'];
      logger.info(`${CASO}: sucursal elegida automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado,
    // "Compañía" excluida por estar siempre deshabilitada) + los defaults QA
    // para lo que no se dirigió.
    const cambios = {};
    for (const label of Object.keys(SucursalDetallePage.ESTRATEGIAS)) {
      if (label === 'Compañía') continue;
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      } else if (DEFAULTS_QA[label] !== undefined) {
        cambios[label] = DEFAULTS_QA[label];
      }
    }
    logger.info(`${CASO}: editando -> ${JSON.stringify(cambios)}`);
    for (const [label, valor] of Object.entries(cambios)) {
      await detalle.setCampo(label, valor);
    }

    await detalle.guardar();
    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba edición exitosa para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Consulta DESPUÉS de editar (evidencia + verificación) ---
    // Tras Guardar, confirmado con evidencia real: la app RECARGA la
    // pantalla ("Cargando...") antes de mostrar el registro actualizado —
    // se espera (poll) cada valor, no se lee inmediatamente.
    const finales = {};
    for (const label of Object.keys(cambios)) {
      finales[label] = await detalle.esperarValor(label, cambios[label]);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta DESPUÉS de editar - "${nombreUsado}"` });

    for (const label of Object.keys(cambios)) {
      assert.strictEqual(
        finales[label],
        cambios[label],
        `"${label}" no quedó en "${cambios[label]}" (quedó "${finales[label]}").`
      );
    }
  });
});
