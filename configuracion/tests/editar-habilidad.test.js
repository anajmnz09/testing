const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const HabilidadesPage = require('../pages/HabilidadesPage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');
const { armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-habilidad';
// Clave de BÚSQUEDA (identifica la Habilidad EXISTENTE a abrir), separada a
// propósito de "Habilidad" (que es un campo del formulario, real y editable
// — si compartieran la misma clave del Execution Context no habría forma de
// dirigir un RENOMBRE, mismo criterio que `editar-departamento`/
// `editar-beneficio`). El buscador de esta pantalla está roto en el
// ambiente actual — el código queda LISTO para buscar apenas lo arreglen;
// mientras tanto, sin nombre dirigido, cae automáticamente a la PRIMERA
// Habilidad del listado (`editarPrimero()`/`consultarPrimero()`, sin pasar
// por el buscador).
const CLAVE_BUSQUEDA = 'Habilidad a editar';
testContext.registrarCasoDesdeFormulario(CASO, HabilidadesPage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita el popup de una Habilidad: si el Panel dirige la clave de búsqueda,
 * la busca (`consultarPorNombre`/`editarPorNombre`); si no, usa la PRIMERA
 * del listado. Cambia los campos que el Panel dirija (o, si no dirige
 * ninguno, renombra "Habilidad" con `siguienteNombreQA` (`support/nombresQA.js`:
 * "QA-1", "QA-2"… nunca concatena sobre el nombre actual — a diferencia de
 * Grados Académicos, acá no hay otro campo de texto libre seguro como
 * default), Guarda. Como evidencia, adjunta el popup de CONSULTA antes y
 * después del cambio.
 */
describe('Configuración - Editar Habilidad', function () {
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
  const ctx = fixtures.usarListadoHabilidades();

  it(`${CASO}: edita una Habilidad existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Habilidades está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Habilidad'];
      logger.info(`${CASO}: habilidad elegida (primera fila, sin buscador) -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    if (nombreDirigido) {
      await ctx.lista.consultarPorNombre(nombreDirigido);
    } else {
      await ctx.lista.consultarPrimero();
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });
    const { Key } = require('selenium-webdriver');
    await ctx.driver.actions().sendKeys(Key.ESCAPE).perform();
    await ctx.driver.sleep(500);

    const modal = nombreDirigido
      ? await ctx.lista.editarPorNombre(nombreDirigido)
      : await ctx.lista.editarPrimero();

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA (ver `cambiosEditar.js`), un default seguro
    // (renombrar "Habilidad").
    const cambios = armarCambiosDirigidos(CASO, HabilidadesPage.ESTRATEGIAS);
    await aplicarDefaultSiVacio(cambios, {
      defaults: [{ campo: 'Habilidad', valor: siguienteNombreQA(nombreUsado) }],
    });
    logger.info(`${CASO}: editando -> ${JSON.stringify(cambios)}`);
    for (const [label, valor] of Object.entries(cambios)) {
      await modal.setCampo(label, valor);
    }

    await modal.guardar();
    const res = await modal.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba edición exitosa para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Consulta DESPUÉS de editar (evidencia + verificación) ---
    if (nombreDirigido) {
      await ctx.lista.consultarPorNombre(nombreDirigido);
    } else {
      await ctx.lista.consultarPrimero();
    }
    const finales = {};
    for (const label of Object.keys(cambios)) {
      finales[label] = await ctx.lista.esperarValor(label, cambios[label]);
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
