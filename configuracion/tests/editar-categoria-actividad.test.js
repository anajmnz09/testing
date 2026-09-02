const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const CategoriaActividadDetallePage = require('../pages/CategoriaActividadDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');
const { armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-categoria-actividad';
// Clave de BÚSQUEDA (identifica la Categoría de actividad EXISTENTE a
// abrir), separada a propósito de "Categorías" (campo del formulario, real
// y editable — mismo criterio que `editar-departamento`/`editar-beneficio`).
const CLAVE_BUSQUEDA = 'Categoría de actividad a editar';
testContext.registrarCasoDesdeFormulario(CASO, CategoriaActividadDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita una Categoría de actividad ya existente: consulta antes de editar
 * (evidencia), entra a "Editar", cambia los campos que el Panel dirija (o,
 * si no dirige ninguno, "Categorías" con `siguienteNombreQA` — no hay otro
 * campo de texto libre "seguro" como default en esta entidad, el resto son
 * numberbox/selectbox/switch), Guarda, y vuelve a consultar para confirmar
 * el cambio (evidencia después).
 */
describe('Configuración - Editar Categoría de Actividad', function () {
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
  const ctx = fixtures.usarListadoCategoriaActividades();

  it(`${CASO}: edita una Categoría de actividad existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Categoría Actividades está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Categorías'];
      logger.info(`${CASO}: Categoría de actividad elegida automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA (ver `cambiosEditar.js`), un default seguro
    // (renombrar "Categorías").
    const cambios = armarCambiosDirigidos(CASO, CategoriaActividadDetallePage.ESTRATEGIAS);
    await aplicarDefaultSiVacio(cambios, {
      defaults: [{ campo: 'Categorías', valor: siguienteNombreQA(nombreUsado) }],
    });
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
