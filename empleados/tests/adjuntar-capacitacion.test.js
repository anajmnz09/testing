const assert = require('assert');
const { testContext, evidence, testFiles } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'adjuntar-capacitacion';
const CLAVE_EMPLEADO = 'Nombre del Empleado con la Capacitación';
const CLAVE_CAPACITACION = 'Nombre de la Capacitación a la que se adjunta (opcional)';
// `archivo`: ruta opcional a un archivo propio; vacío -> PDF genérico del
// framework (`.txt` NO sirve acá: el uploader solo acepta
// .pdf/.docx/.doc/.png/.jpg/.jpeg).
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_CAPACITACION, 'archivo']);

/**
 * Adjunta un documento a una Capacitación de un Empleado. En la columna
 * "Acción" del grid de Capacitación, al lado del lápiz, hay un ícono de clip
 * ("Adjuntar documento") que NAVEGA a una pantalla propia titulada con el
 * NOMBRE DE LA CAPACITACIÓN (se verifica ese título para confirmar que el
 * archivo se adjuntó a ESA capacitación) y con 2 botones: "Adjuntar" y
 * "Eliminar". "Adjuntar" abre el popup "Importar Documentos" (carga sin
 * diálogo del SO, mismo mecanismo que "Documentos" de Requisición).
 *
 * Empleado: dirigido desde el Panel o el PRIMERO del listado. Capacitación:
 * opcionalmente dirigida por nombre; si solo se da el empleado, la PRIMERA
 * fila del grid. Si el empleado NO tiene ninguna capacitación -> el test
 * FALLA. Archivo: el del Panel (`archivo`) o un PDF genérico, SIEMPRE el mismo
 * en auto y desde el Panel.
 */
describe('Empleados - Adjuntar documento a Capacitación', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: adjunta un documento a una Capacitación y confirma la carga`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const capacitacionDirigida = testContext.get(CASO, CLAVE_CAPACITACION);
    let detalle;
    let nombreEmpleado = empleadoDirigido;

    if (empleadoDirigido) {
      detalle = await ctx.lista.abrirDetalle(empleadoDirigido);
    } else {
      const hayFilas = (await ctx.lista.grid.contarFilas()) > 0;
      if (!hayFilas) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — ` +
            `la suite asume que siempre hay al menos un registro.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
      nombreEmpleado = await detalle.getNombre();
      logger.info(`${CASO}: empleado elegido automáticamente -> "${nombreEmpleado}"`);
    }

    const abierta = await detalle.abrirSeccion('Capacitación');
    const titulo = await detalle.esperarTituloContenido('Capacitación');
    assert.ok(titulo.coincide, `El área de título no muestra "Capacitación" (empleado: "${nombreEmpleado}").`);
    assert.ok(abierta.activada, `La sección "Capacitación" no quedó activa para "${nombreEmpleado}".`);

    const filas = await detalle.leerFilasCapacitacion();
    if (!filas.length) {
      assert.fail(
        `${CASO}: el empleado "${nombreEmpleado}" no tiene ninguna Capacitación registrada — no hay a qué adjuntar. ` +
          `(Precondición del escenario: se esperaba al menos una fila en la sección "Capacitación".)`
      );
    }

    let objetivo = 0;
    let nombreCap = filas[0].Nombre;
    if (capacitacionDirigida) {
      const idx = filas.findIndex((f) => String(f.Nombre || '').trim().toLowerCase() === capacitacionDirigida.trim().toLowerCase());
      if (idx < 0) {
        assert.fail(
          `${CASO}: "${nombreEmpleado}" no tiene una Capacitación llamada "${capacitacionDirigida}". ` +
            `Capacitaciones: ${JSON.stringify(filas.map((f) => f.Nombre))}.`
        );
      }
      objetivo = capacitacionDirigida;
      nombreCap = filas[idx].Nombre;
    }
    logger.info(`${CASO}: adjuntando a la Capacitación "${nombreCap}" de "${nombreEmpleado}"`);

    const adjuntos = await detalle.abrirAdjuntarCapacitacion(objetivo);

    // Verificación de que estamos en la pantalla de ESA capacitación (a pedido
    // explícito: el título de la pantalla es el nombre de la capacitación).
    const tituloPantalla = await adjuntos.tituloCapacitacion();
    assert.ok(
      tituloPantalla.toLowerCase().includes(String(nombreCap).toLowerCase()),
      `La pantalla de adjuntos no está titulada con la Capacitación "${nombreCap}" (título leído: "${tituloPantalla}").`
    );

    const archivo = testFiles.resolver({ ruta: testContext.get(CASO, 'archivo'), tipo: 'pdf', base: 'capacitacion-adjunto' });
    logger.info(`${CASO}: archivo -> ${archivo.nombre} (por defecto=${archivo.porDefecto})`);

    const res = await adjuntos.adjuntar(archivo.ruta);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Adjunto en Capacitación "${nombreCap}" - ${archivo.nombre}` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba adjuntado exitoso de "${archivo.nombre}" en la Capacitación "${nombreCap}" ` +
        `(empleado "${nombreEmpleado}", popup cerrado=${res.cerrado}, notify="${res.notify}").`
    );

    // El grid de la pantalla lista el archivo (nombre con sufijo UUID:
    // `<base>_<uuid>`), por eso se busca por el nombre SIN extensión.
    const base = archivo.nombre.replace(/\.[^.]+$/, '');
    const listado = await adjuntos.esperarAdjunto(base);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Listado de adjuntos - "${nombreCap}"` });
    assert.ok(
      listado.some((f) => f.toLowerCase().includes(base.toLowerCase())),
      `El adjunto "${archivo.nombre}" no aparece en el grid de la Capacitación "${nombreCap}" tras Guardar. ` +
        `Filas: ${JSON.stringify(listado)}.`
    );
    logger.info(`${CASO}: verificado -> "${archivo.nombre}" adjunto a "${nombreCap}"`);
  });
});
