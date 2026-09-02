const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const GruposPage = require('../pages/GruposPage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');
const { armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-grupo';
// Clave de BÚSQUEDA (identifica el Grupo EXISTENTE a abrir), separada a
// propósito de "Nombre" (campo del formulario, real y editable) — mismo
// criterio que `editar-banco`/`editar-departamento`. "Nombre"/"Descripción"
// se registran a mano (no vía `registrarCasoDesdeFormulario`): en modo
// Editar no usan el mecanismo `ESTRATEGIAS`/`Form` genérico — ver mapeo de
// clase en `GrupoDetallePage`.
const CLAVE_BUSQUEDA = 'Nombre de Grupo a editar';
testContext.registrarCaso(CASO, [CLAVE_BUSQUEDA, 'Nombre', 'Descripción']);

const DESCRIPCION_QA = 'Descripción QA de prueba automatizada.';

/**
 * Edita un Grupo ya existente: cambia "Nombre" y/o "Descripción" (los únicos
 * campos de Editar que este caso toca, a pedido explícito — "Miembros del
 * grupo" y la sección de permisos, Módulos/Roles, quedan para tests propios
 * aparte).
 *
 * REGLA (incidente real, 2026-08-27): un campo vacío/no dirigido desde el
 * Panel se deja SIN TOCAR — nunca se le inventa un valor solo porque quedó
 * vacío. El default automático ("Nombre" con `siguienteNombreQA`,
 * "Descripción" con un texto QA fijo) es un chequeo a nivel de CASO, no de
 * campo: SOLO se aplica cuando el Panel no dirigió NI "Nombre" NI
 * "Descripción" (modo 100% automático). Si el Panel dirigió cualquiera de
 * los dos, el otro campo, si queda vacío, se deja INTACTO — nunca se
 * renombra "por las dudas". Antes, este archivo comparaba
 * `testContext.get(CASO, 'Nombre') || siguienteNombreQA(...)` campo por
 * campo: eso renombraba "Nombre" igual aunque el Panel hubiera dirigido
 * "Descripción" (o incluso la clave de búsqueda) — confirmado reproducido en
 * vivo por el usuario (dirigió Grupo="QA-2" + Descripción, dejó "Nombre"
 * vacío esperando que no se tocara, y terminó renombrado a "QA-1"). Mismo
 * tipo de bug ya corregido en esta misma pasada en `editar-usuario` y otros
 * 4 `editar-*` de Configuración que tenían el mismo patrón por-campo — ver
 * `.claude/skills/testing-patterns/SKILL.md` para el detalle completo.
 *
 * VERIFICACIÓN: NO se afirma sobre `resultadoGuardado()` acá — confirmado
 * con evidencia real que el notify de éxito de Editar queda SIEMPRE VACÍO en
 * esta pantalla (ver nota completa en `GrupoDetallePage`), aunque el cambio
 * sí se aplique de verdad. La evidencia real es releer la fila del listado
 * (única vista que expone "Descripción"; también se usa para "Nombre", ya
 * que el título de Editar puede truncarlo) — solo se verifican los campos
 * que este caso realmente tocó.
 */
describe('Configuración - Editar Grupo', function () {
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
  const ctx = fixtures.usarListadoGrupos();

  it(`${CASO}: edita "Nombre" y "Descripción" de un Grupo existente`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Grupos está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: grupo elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija ("Nombre"/"Descripción") +,
    // si no se dirigió NADA (ver `cambiosEditar.js` — REGLA en el docblock
    // de arriba), los defaults automáticos de ambos campos.
    const cambios = armarCambiosDirigidos(CASO, ['Nombre', 'Descripción']);
    await aplicarDefaultSiVacio(cambios, {
      defaults: [
        { campo: 'Nombre', valor: siguienteNombreQA(nombreUsado) },
        { campo: 'Descripción', valor: DESCRIPCION_QA },
      ],
    });
    const nombreNuevo = cambios['Nombre'];
    const descripcionNueva = cambios['Descripción'];

    logger.info(
      `${CASO}: editando "${nombreUsado}" -> ` +
        `Nombre: ${nombreNuevo !== undefined ? `"${nombreNuevo}"` : '(sin tocar)'}, ` +
        `Descripción: ${descripcionNueva !== undefined ? `"${descripcionNueva}"` : '(sin tocar)'}`
    );

    if (nombreNuevo !== undefined) await detalle.setNombreEditar(nombreNuevo);
    if (descripcionNueva !== undefined) await detalle.setDescripcionEditar(descripcionNueva);

    await detalle.guardar();
    // NO se lee/afirma `resultadoGuardado()` acá a propósito — ver nota de
    // clase en `GrupoDetallePage` (notify de Editar siempre vacío en esta
    // pantalla, confirmado con evidencia real).

    // --- Verificación real: releer la fila desde el LISTADO ---
    // El nombre con el que buscar/matchear la fila es el NUEVO si se tocó
    // "Nombre", o el ORIGINAL si no se tocó (sigue siendo ese en el listado).
    const nombreParaBuscar = nombreNuevo !== undefined ? nombreNuevo : nombreUsado;
    await GruposPage.ir(ctx.driver);
    const filaFinal = await ctx.lista.grid.esperarFila(nombreParaBuscar, (f) => f['Nombre'] === nombreParaBuscar);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Listado DESPUÉS de editar - "${nombreParaBuscar}"` });

    assert.ok(
      filaFinal,
      `"${nombreParaBuscar}" no aparece en el listado de Grupos tras editarlo (¿no se aplicó el cambio de Nombre, o cambió sin querer?).`
    );
    if (descripcionNueva !== undefined) {
      assert.strictEqual(
        filaFinal['Descripción'],
        descripcionNueva,
        `"Descripción" de "${nombreParaBuscar}" no quedó en "${descripcionNueva}" (quedó "${filaFinal['Descripción']}").`
      );
    }
  });
});
