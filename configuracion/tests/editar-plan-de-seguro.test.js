const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const PlanDeSeguroDetallePage = require('../pages/PlanDeSeguroDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');
const { armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-plan-de-seguro';
// Clave de BÚSQUEDA (identifica el plan de seguro EXISTENTE a abrir),
// separada a propósito de "Nombre Plan de seguro" (campo del formulario,
// real y editable — mismo criterio que `editar-departamento`/`editar-beneficio`).
// El buscador de esta pantalla es INESTABLE en el ambiente actual
// (confirmado con evidencia real: "Error cargando registro(s)" en rojo,
// reproducido 2/2 veces) — el código queda LISTO para buscar apenas lo
// arreglen; mientras tanto, sin nombre dirigido, cae automáticamente al
// PRIMER Plan de seguro del listado (`abrirPrimero()`, sin pasar por el
// buscador) — mismo criterio ya aplicado en Horarios/Grados Académicos.
const CLAVE_BUSQUEDA = 'Nombre de Plan de seguro a editar';
testContext.registrarCasoDesdeFormulario(CASO, PlanDeSeguroDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita un Plan de seguro ya existente: consulta antes de editar (evidencia),
 * entra a "Editar", cambia los campos que el Panel dirija, Guarda, y vuelve a
 * consultar para confirmar el cambio (evidencia después).
 *
 * Igual que Departamentos/Beneficios: solo "Nombre Plan de seguro" es un
 * texto libre seguro como default automático — el resto son selectbox/
 * numberbox sin un valor QA "seguro" inventable. Por eso, si el Panel no
 * dirige NINGÚN campo, el default automático es renombrar "Nombre Plan de
 * seguro" con `siguienteNombreQA` (`support/nombresQA.js`: "QA-1", "QA-2"…
 * nunca concatena sobre el nombre actual); cualquier otro campo declarado se
 * suma al cambio SOLO si el Panel lo dirige explícitamente.
 *
 * Nota de causa raíz (evidencia real, "Nombre Plan de seguro" tiene
 * `maxlength` 50): el criterio anterior (`"${nombreUsado} EDITADO
 * ${timestamp}"`) concatenaba sobre el nombre YA editado — como el fallback
 * automático (`abrirPrimero()`) siempre reedita el MISMO registro, el nombre
 * creció en cada corrida hasta truncarse en la app, y el assert final
 * fallaba contra el valor truncado, no por un error real del campo.
 */
describe('Configuración - Editar Plan de seguro', function () {
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
  const ctx = fixtures.usarListadoPlanesDeSeguros();

  it(`${CASO}: edita un Plan de seguro existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Planes de seguros está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: plan de seguro elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA (ver `cambiosEditar.js`), un default seguro
    // (renombrar "Nombre Plan de seguro").
    const cambios = armarCambiosDirigidos(CASO, PlanDeSeguroDetallePage.ESTRATEGIAS);
    await aplicarDefaultSiVacio(cambios, {
      defaults: [{ campo: 'Nombre Plan de seguro', valor: siguienteNombreQA(nombreUsado) }],
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
