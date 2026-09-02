const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const { parsearValoresMultiples } = require('@triple/core/strategies');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'agregar-permiso-grupo';
// Clave de BÚSQUEDA del Grupo EXISTENTE al que se le agrega el permiso,
// separada de "Módulo"/"Roles" (campos reales del popup "Agregar Permiso").
// "Roles" acepta VARIOS valores separados por "|" (mismo criterio que
// "Compañías permitidas" de Usuario — ver `parsearValoresMultiples`), ya
// que el widget real es un tagbox multi-select — se marca `multivalor: true`
// para que el Panel muestre el hint del separador automáticamente (este caso
// no pasa por `registrarCasoDesdeFormulario`/`ESTRATEGIAS`, así que no hay
// forma de detectarlo solo; hay que marcarlo a mano acá, una vez). Si el
// Panel no dirige "Módulo"/"Roles", se elige la PRIMERA opción de cada uno —
// ver `GrupoDetallePage.agregarPermiso`.
const CLAVE_BUSQUEDA = 'Nombre de Grupo';
testContext.registrarCaso(CASO, [CLAVE_BUSQUEDA, 'Módulo', { clave: 'Roles', multivalor: true }]);

/**
 * Agrega un permiso a un Grupo ya existente: entra a Editar, abre el popup
 * "Agregar Permiso" (sección "Permisos del grupo") y completa "Módulo" +
 * "Roles" — ver mapeo completo (cascada de habilitación, "Roles" es tagbox
 * multi-select, popup con Guardar propio que persiste de inmediato) en
 * `GrupoDetallePage`. Confirma que el Módulo elegido aparece en la lista de
 * "Permisos del grupo".
 */
describe('Configuración - Agregar Permiso a Grupo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoGrupos();

  it(`${CASO}: agrega un permiso a un Grupo existente`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Grupos está vacío — nada a lo que agregar un permiso, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: grupo elegido automáticamente -> "${nombreUsado}"`);
    }

    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    const rolesDirigidos = testContext.get(CASO, 'Roles');
    const elegido = await detalle.agregarPermiso({
      modulo: testContext.get(CASO, 'Módulo'),
      roles: rolesDirigidos ? parsearValoresMultiples(rolesDirigidos) : undefined,
    });
    logger.info(`${CASO}: permiso agregado a "${nombreUsado}" -> ${JSON.stringify(elegido)}`);

    await evidence.attachScreenshot(ctx.driver, this, { label: `Permiso agregado - "${nombreUsado}"` });

    // Este grid NO tiene buscador y se divide en varias páginas. NO alcanza
    // con pararse en la última: si el módulo elegido YA tenía un permiso
    // asignado al grupo, la app le suma el rol a esa fila EN SU LUGAR (no
    // crea una fila nueva al final) — confirmado con evidencia real
    // (incidente 2026-08-28, módulo "ADMINISTRACION" ya permisado en
    // "qa-1"). `filasPermisos()` recorre TODAS las páginas por eso mismo.
    const permisos = await detalle.filasPermisos();
    assert.ok(
      permisos.some((p) => p.toLowerCase().includes(elegido.modulo.toLowerCase())),
      `"${elegido.modulo}" no aparece en la lista de "Permisos del grupo" de "${nombreUsado}" tras agregarlo (permisos: ${JSON.stringify(permisos)}).`
    );
  });
});
