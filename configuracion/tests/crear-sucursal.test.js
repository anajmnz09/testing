const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const SucursalDetallePage = require('../pages/SucursalDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');
const bancos = require('../support/bancos');

const CASO = 'crear-sucursal';
// Input Model del formulario: se siembran en el Execution Context TODOS los
// controles editables (labels reales), derivados de la única fuente de
// verdad (SucursalDetallePage.ESTRATEGIAS). El usuario solo completa los
// valores que quiera dirigir.
testContext.registrarCasoDesdeFormulario(CASO, SucursalDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'SUCURSAL QA';
const CORREO_QA = 'sucursal.qa.automatizado@example.com';
const TELEFONO_QA = '8095551234';

/**
 * Crea una Sucursal nueva desde Configuración > Administración > Sucursales,
 * completando "Nombre Sucursal"/"Nombre/Referencia" (requeridos) y
 * Correo/Teléfono/Dirección (opcionales, con datos QA para dejar un registro
 * con contenido real, reutilizable después por `editar-sucursal`).
 *
 * "Compañía" y "Estado" NUNCA se tocan (declarados en ESTRATEGIAS pero
 * deshabilitados al crear, ya vienen con un valor — ver mapeo de
 * `SucursalDetallePage`).
 *
 * "Nombre Sucursal"/"Nombre/Referencia", si el Panel los dirige, se usan TAL
 * CUAL (sin sufijo); si no, cada uno lleva su propio sufijo único (timestamp)
 * para no chocar con una corrida anterior — ver `nombreUnicoQA`
 * (`support/nombresQA.js`).
 */
describe('Configuración - Crear Sucursal', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSucursales();

  it(`${CASO}: crea una Sucursal nueva completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const nombreSucursal = nombreUnicoQA(testContext.get(CASO, 'Nombre Sucursal'), NOMBRE_BASE_QA);
    const referencia = nombreUnicoQA(testContext.get(CASO, 'Nombre/Referencia'), 'REF QA');
    logger.info(`${CASO}: nombre elegido -> "${nombreSucursal}" (referencia "${referencia}")`);

    await form.setCampo('Nombre Sucursal', nombreSucursal);
    await form.setCampo('Nombre/Referencia', referencia);

    const correo = testContext.get(CASO, 'Correo') || CORREO_QA;
    const telefono = testContext.get(CASO, 'Teléfono') || TELEFONO_QA;
    const direccion = bancos.sucursal.valor(testContext.get(CASO, 'Dirección'), 'direccion');
    await form.setCampo('Correo', correo);
    await form.setCampo('Teléfono', telefono);
    await form.setCampo('Dirección', direccion);

    // Resto de campos opcionales (RNL, Latitud, Longitud) — solo si el
    // Panel los dirigió explícitamente.
    await form.completarConContexto(CASO, { incluirOpcionales: false });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombreSucursal}". Notify: "${res.notify}"`);

    // Tras Guardar, confirmado con evidencia real: la app vuelve al LISTADO
    // (no se queda en el detalle del registro recién creado) — se confirma
    // primero ahí que la fila existe (DataGrid.esperarFila, poll tolerante a
    // la propagación).
    const filaCreada = await ctx.lista.grid.esperarFila(nombreSucursal, (f) => f['Sucursal'] === nombreSucursal);
    assert.ok(filaCreada, `"${nombreSucursal}" no aparece en el listado de Sucursales tras crearla.`);

    // La columna "Teléfono" del LISTADO puede quedar en blanco un rato para
    // un registro recién creado en la MISMA sesión (caché de grid desfasada,
    // confirmado con evidencia real: el detalle sí tenía el valor correcto
    // mientras la columna del listado seguía vacía) — el dato verdadero se
    // confirma abriendo el detalle, no leyendo esa columna.
    const detalleCreado = await ctx.lista.abrirDetalle(nombreSucursal);
    const telefonoFinal = (await detalleCreado.getValor('Teléfono')).trim();
    assert.ok(
      telefonoFinal.replace(/\D/g, '').endsWith(telefono),
      `"Teléfono" de "${nombreSucursal}" no quedó guardado como se esperaba (esperado dígitos de "${telefono}", quedó "${telefonoFinal}").`
    );
  });
});
