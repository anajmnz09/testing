const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'agregar-miembro-grupo';
// Clave de BÚSQUEDA del Grupo EXISTENTE al que se le agrega el miembro,
// separada de los 3 campos del popup "Agregar Miembro" (mismo criterio que
// el resto de editar-*: "Usuario"/"Compañías permitidas"/"Sucursal" son
// campos REALES del popup, no inventados). Si el Panel dirige alguno, se usa
// ese valor exacto (debe matchear una opción real del catálogo); sin
// dirección, se elige la PRIMERA opción disponible de cada selectbox — ver
// `GrupoDetallePage.agregarMiembro` para la cascada de habilitación
// (Usuario → Compañías permitidas → Sucursal).
const CLAVE_BUSQUEDA = 'Nombre de Grupo';
testContext.registrarCaso(CASO, [CLAVE_BUSQUEDA, 'Usuario', 'Compañías permitidas', 'Sucursal']);

/**
 * Agrega un miembro a un Grupo ya existente: entra a Editar, abre el popup
 * "Agregar Miembro" (sección "Miembros del grupo") y completa "Usuario" +
 * "Compañías permitidas" + "Sucursal" — ver mapeo completo (cascada de
 * habilitación, mecanismo de campos sin `<label>`, popup con Guardar propio
 * que persiste de inmediato) en `GrupoDetallePage`. Confirma que el usuario
 * elegido aparece en la lista de "Miembros del grupo".
 */
describe('Configuración - Agregar Miembro a Grupo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoGrupos();

  it(`${CASO}: agrega un miembro a un Grupo existente`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Grupos está vacío — nada a lo que agregar un miembro, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: grupo elegido automáticamente -> "${nombreUsado}"`);
    }

    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    const elegido = await detalle.agregarMiembro({
      usuario: testContext.get(CASO, 'Usuario'),
      companiaPermitida: testContext.get(CASO, 'Compañías permitidas'),
      sucursal: testContext.get(CASO, 'Sucursal'),
    });
    logger.info(`${CASO}: miembro agregado a "${nombreUsado}" -> ${JSON.stringify(elegido)}`);

    await evidence.attachScreenshot(ctx.driver, this, { label: `Miembro agregado - "${nombreUsado}"` });

    const miembros = await detalle.filasMiembros();
    assert.ok(
      miembros.some((m) => m.toLowerCase().includes(elegido.usuario.toLowerCase())),
      `"${elegido.usuario}" no aparece en la lista de "Miembros del grupo" de "${nombreUsado}" tras agregarlo (miembros: ${JSON.stringify(miembros)}).`
    );
  });
});
