const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const HorarioDetallePage = require('../pages/HorarioDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-horario';
// Clave de BÚSQUEDA (identifica el horario EXISTENTE a abrir), separada a
// propósito de "Descripción" (mismo criterio que `editar-sucursal`/
// `editar-departamento`/`editar-puesto`). El buscador de Horarios está roto
// en el ambiente actual (ver `consultar-horario`) — el código queda LISTO
// para buscar apenas lo arreglen; mientras tanto, sin nombre dirigido, cae
// automáticamente al PRIMER Horario del listado (`abrirPrimero()`, sin
// pasar por `grid.buscar()`).
const CLAVE_BUSQUEDA = 'Descripción de Horario a editar';
testContext.registrarCasoDesdeFormulario(CASO, HorarioDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

// Default QA solo para el campo que SIEMPRE se cambia si el Panel no dirige
// nada (texto libre opcional, sin efectos colaterales de identidad/negocio
// — no se toca "Descripción" ni "Hora Inicial"/"Hora final" por defecto,
// mismo criterio que Sucursales/Puestos). Máximo 10 caracteres: confirmado
// con evidencia real que "Referencia" tiene `maxlength="10"` en la app — un
// texto más largo se trunca solo, así que el default se mantiene corto a
// propósito (si no, comparar el valor final contra el texto completo
// original fallaría por la truncación, no por un error real).
const DEFAULTS_QA = {
  Referencia: 'REF QA ED',
};

/**
 * Edita el PRIMER Horario del listado (ver nota sobre el buscador roto,
 * arriba): consulta antes de editar (evidencia), entra a "Editar", cambia
 * los campos que el Panel dirija (o, si no dirige ninguno, "Referencia"),
 * Guarda, y vuelve a consultar para confirmar el cambio (evidencia después).
 */
describe('Configuración - Editar Horario', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoHorarios();

  it(`${CASO}: edita un Horario existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Horarios está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Descripción'];
      logger.info(`${CASO}: horario elegido (primera fila, sin buscador) -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +
    // los defaults QA para lo que no se dirigió. "Hora Inicial"/"Hora final"
    // se normalizan al formato EXACTO de la lista de la app ANTES de guardar
    // el valor "esperado" en `cambios` — si no, comparar contra lo que el
    // usuario tipeó ("8:00 AM") nunca matchearía lo que la UI realmente
    // termina mostrando ("8:00 a. m.", ver `HorarioDetallePage.formatoHora`).
    const CAMPOS_HORA = ['Hora Inicial', 'Hora final'];
    const cambios = {};
    for (const label of Object.keys(HorarioDetallePage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = CAMPOS_HORA.includes(label) ? HorarioDetallePage.formatoHora(dirigido) : dirigido;
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
