const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const TipoNominaDetallePage = require('../pages/TipoNominaDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');
const { armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

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
    // si no se dirigió NADA (ver `cambiosEditar.js`), un default seguro
    // (renombrar "Nombre").
    const cambios = armarCambiosDirigidos(CASO, TipoNominaDetallePage.ESTRATEGIAS);
    await aplicarDefaultSiVacio(cambios, {
      defaults: [{ campo: 'Nombre', valor: siguienteNombreQA(nombreUsado) }],
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
