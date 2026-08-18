const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const GradosAcademicosPage = require('../pages/GradosAcademicosPage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-grado-academico';
// Clave de BÚSQUEDA (identifica el Grado Académico EXISTENTE a abrir),
// separada a propósito de "Nombre" (mismo criterio que `editar-horario`). El
// buscador de esta pantalla está roto en el ambiente actual (mismo hallazgo
// que Horarios) — el código queda LISTO para buscar apenas lo arreglen;
// mientras tanto, sin nombre dirigido, cae automáticamente al PRIMER Grado
// Académico del listado (`editarPrimero()`/`consultarPrimero()`, sin pasar
// por el buscador).
const CLAVE_BUSQUEDA = 'Grado Académico a editar';
testContext.registrarCasoDesdeFormulario(CASO, GradosAcademicosPage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

// Default QA solo para el campo que SIEMPRE se cambia si el Panel no dirige
// nada (texto libre opcional, sin efectos colaterales de identidad/negocio
// — no se toca "Nombre" ni "Estado" por defecto, mismo criterio que
// Sucursales/Puestos/Horarios).
const DEFAULTS_QA = {
  'Referencia MT': '123456',
};

/**
 * Edita el popup de un Grado Académico: si el Panel dirige la clave de
 * búsqueda, lo busca (`consultarPorNombre`/`editarPorNombre`); si no, usa el
 * PRIMERO del listado (`consultarPrimero`/`editarPrimero`, ver nota sobre el
 * buscador roto, arriba). Cambia los campos que el Panel dirija (o, si no
 * dirige ninguno, "Referencia MT"), Guarda. Como evidencia, adjunta el popup
 * de CONSULTA antes y después del cambio (mismo criterio "antes/después"
 * que el resto de entidades).
 */
describe('Configuración - Editar Grado Académico', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoGradosAcademicos();

  it(`${CASO}: edita un Grado Académico existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Grados Académicos está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: grado académico elegido (primera fila, sin buscador) -> "${nombreUsado}"`);
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

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +
    // los defaults QA para lo que no se dirigió.
    const cambios = {};
    for (const label of Object.keys(GradosAcademicosPage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      } else if (DEFAULTS_QA[label] !== undefined) {
        cambios[label] = DEFAULTS_QA[label];
      }
    }
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
