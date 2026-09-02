const assert = require('assert');
const { testContext, evidence, assertTextoIgual, textoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const ConceptoNominaDetallePage = require('../pages/ConceptoNominaDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');
const { armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-concepto-nomina';
// Clave de BÚSQUEDA (identifica el Concepto de nómina EXISTENTE a abrir),
// separada a propósito de "Nombre" (campo del formulario, real y editable —
// mismo criterio que `editar-departamento`/`editar-beneficio`).
const CLAVE_BUSQUEDA = 'Nombre de Concepto de nómina a editar';
testContext.registrarCasoDesdeFormulario(CASO, ConceptoNominaDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita un Concepto de nómina ya existente: consulta antes de editar
 * (evidencia), entra a "Editar", cambia los campos que el Panel dirija (o,
 * si no dirige ninguno, "Nombre" con `siguienteNombreQA` — "Código Alterno"
 * es el único otro texto libre, pero es opcional y puede no aplicar a todo
 * concepto, así que no se usa como default automático), Guarda, y vuelve a
 * consultar para confirmar el cambio (evidencia después). Los 4 tabs del
 * form se ignoran (ver `ConceptoNominaDetallePage`).
 *
 * "Tipo Ingreso" es un caso especial: la app lo deja DESHABILITADO/no
 * clickeable cuando "Origen" es "Descuento", y solo lo habilita con
 * Origen="Ingreso" — regla real de la app (confirmada por el usuario), sin
 * importar si el valor viene dirigido desde el Panel o del comportamiento
 * automático. Un "Tipo Ingreso" dirigido solo se aplica si el "Origen"
 * EFECTIVO (el que este mismo cambio dirige, o si no se dirige, el que YA
 * tiene el registro) termina en "Ingreso"; si no, se ignora sin intentar
 * tocar el control.
 */
describe('Configuración - Editar Concepto de Nómina', function () {
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
  const ctx = fixtures.usarListadoConceptoNomina();

  it(`${CASO}: edita un Concepto de nómina existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Concepto de Nómina está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: Concepto de nómina elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado).
    // "Tipo Ingreso" se resuelve APARTE (depende de "Origen" — ver comentario
    // del archivo), nunca como un campo directo más de este loop.
    const cambios = armarCambiosDirigidos(CASO, ConceptoNominaDetallePage.ESTRATEGIAS, { excluir: ['Tipo Ingreso'] });

    const tipoIngresoDirigido = testContext.get(CASO, 'Tipo Ingreso');
    if (tipoIngresoDirigido !== undefined) {
      const origenEfectivo = cambios['Origen'] !== undefined ? cambios['Origen'] : await detalle.getValor('Origen');
      if (textoIgual(String(origenEfectivo || ''), 'Ingreso')) {
        cambios['Tipo Ingreso'] = tipoIngresoDirigido;
      } else {
        logger.info(
          `${CASO}: se ignora "Tipo Ingreso" dirigido porque "Origen" queda en "${origenEfectivo}" (deshabilitado por la app salvo Origen="Ingreso").`
        );
      }
    }

    // Default seguro (renombrar "Nombre") SOLO si el Panel no dirigió NADA
    // (ver `cambiosEditar.js`) — "Tipo Ingreso" ya resuelto arriba cuenta:
    // si quedó agregado a `cambios`, el default no se aplica.
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
