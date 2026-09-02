const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const PuestoDetallePage = require('../pages/PuestoDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-puesto';
// Clave de BÚSQUEDA (identifica el puesto EXISTENTE a abrir), separada a
// propósito de "Nombre" (que es un campo del formulario, real y editable —
// mismo criterio ya aplicado en `editar-sucursal`/`editar-departamento`).
const CLAVE_BUSQUEDA = 'Nombre de Puesto a editar';
testContext.registrarCasoDesdeFormulario(CASO, PuestoDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

// Defaults QA solo para los campos que SIEMPRE se cambian si el Panel no
// dirige nada (texto libre, sin efectos colaterales de identidad/negocio —
// no se toca "Nombre" por defecto, mismo criterio que Sucursales).
const DEFAULTS_QA = {
  Descripción: 'Descripción editada por prueba automatizada QA.',
  Requisitos: 'Requisitos editados por prueba automatizada QA.',
  Responsabilidades: 'Responsabilidades editadas por prueba automatizada QA.',
};

/**
 * Edita un Puesto ya existente: consulta antes de editar (evidencia), entra
 * a "Editar", cambia los campos que el Panel dirija (o, si no dirige
 * ninguno, los 3 de `DEFAULTS_QA`), Guarda, y vuelve a consultar para
 * confirmar el cambio (evidencia después).
 */
describe('Configuración - Editar Puesto', function () {
  this.timeout(300000);
  // Reintento GLOBAL (mocha --retries, TEST_RETRIES) desactivado a propósito
  // acá: este caso busca el registro por nombre Y le cambia ESE MISMO nombre —
  // no es idempotente. Si el intento 1 ya renombró el registro pero terminó
  // en falla por otro motivo (verificación lenta, timeout puntual), un
  // reintento automático buscaría el nombre VIEJO, que ya no existe, y
  // fallaría garantizado — confirmado con evidencia real (2026-08-27,
  // editar-usuario): el intento 1 renombró "QA Usuario 911669" -> "fulano
  // de tal" con éxito pero terminó "desconocido" por un timeout de
  // verificación; el reintento buscó "QA Usuario 911669" de nuevo, nunca lo
  // encontró, y voló el estado del navegador. Mejor un fallo fuerte y claro
  // una sola vez que un segundo intento condenado.
  this.retries(0);
  const ctx = fixtures.usarListadoPuestos();

  it(`${CASO}: edita un Puesto existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Puestos está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Título de Puesto'];
      logger.info(`${CASO}: puesto elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +
    // los defaults QA para lo que no se dirigió.
    const cambios = {};
    for (const label of Object.keys(PuestoDetallePage.ESTRATEGIAS)) {
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
      assertTextoIgual(
        finales[label],
        cambios[label],
        `"${label}" no quedó en "${cambios[label]}" (quedó "${finales[label]}").`
      );
    }
  });
});
