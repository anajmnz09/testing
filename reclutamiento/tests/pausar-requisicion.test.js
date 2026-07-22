const assert = require('assert');
const { createDriver, authFlow, evidence } = require('@triple/core');
const problemLog = require('@triple/core/utils/problemLog');
const testContext = require('@triple/core/context/testContext');
const requisicionesFlow = require('../flows/requisicionesFlow');

const CASO = 'pausar-requisicion';
const ESTADO_ORIGEN = 'Autorizada';
const ESTADO_ESPERADO = 'Pausada';

// Deja la sección del caso en el Execution Context (vacía) para que el usuario
// pueda dirigir la prueba a una requisición concreta por nombre o por id. Si
// queda vacía, el test descubre automáticamente la primera "Autorizada".
testContext.registrarCaso(CASO, ['nombreRequisicion', 'idRequisicion', 'estado']);

/**
 * pausar-requisicion — Pausar una requisición autorizada.
 *
 * Flujo: login -> módulo Reclutamiento -> listado de Requisiciones -> primera
 * requisición "Autorizada" -> abrir detalle -> botón "Pausar" del header ->
 * notify de éxito -> volver al listado -> el estado ahora es "Pausada".
 *
 * El test es DELGADO a propósito, igual que publicar-requisicion: el login y la
 * navegación vienen de los flows del core, la búsqueda/apertura y el regreso al
 * listado del flow del módulo, y la mecánica del botón del Page Object
 * (RequisicionDetallePage -> componente FormsHeader del core). Aquí solo quedan
 * los asserts del caso.
 *
 * Screenshot, log, contexto y evidencias ante un fallo los aplica
 * automáticamente la política global del framework (mochaRootHooks).
 */
describe('Reclutamiento - Pausar Requisición', function () {
  this.timeout(300000);
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
  });

  it(`${CASO}: pausa una requisición autorizada y valida el notify y el estado`, async function () {
    // 1) Login + módulo + listado (flows existentes, sin replicar lógica).
    await authFlow.login(driver);
    await requisicionesFlow.abrirListado(driver);

    // 2) Abrir la requisición. Los datos NO están hardcodeados: salen del
    //    Execution Context. Si `nombreRequisicion`/`idRequisicion` están vacíos,
    //    `undefined` hace que el flow descubra la primera del estado pedido.
    const referencia =
      testContext.get(CASO, 'nombreRequisicion') || testContext.get(CASO, 'idRequisicion');
    const estadoOrigen = testContext.get(CASO, 'estado') || ESTADO_ORIGEN;

    const { detalle, dirigido, indice, revisadas, total } =
      await requisicionesFlow.abrirPrimeraRequisicionConEstado(driver, {
        estado: estadoOrigen,
        nombreRequisicion: referencia,
      });

    evidence.saveEvidenceBuffer(
      'json',
      this,
      JSON.stringify({ estadoOrigen, dirigido, totalConEstado: total, revisadas }, null, 2),
      { label: 'requisiciones-revisadas', encoding: 'utf8' }
    );

    if (!detalle) {
      // No es un fallo de la app: no había ninguna requisición en ese estado, o
      // no se pudo abrir. Se registra con contexto suficiente para reproducirlo.
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: `abrir la primera requisición con estado "${estadoOrigen}"`,
        campo: 'Estado',
        valor: referencia || `${total} fila(s) con estado "${estadoOrigen}"`,
      });
      assert.fail(
        `No se pudo abrir ninguna requisición con estado "${estadoOrigen}" ` +
          `(encontradas: ${total}${referencia ? `, referencia pedida: "${referencia}"` : ''}).`
      );
    }

    // 3) Identificar la requisición abierta: es el dato con el que se la vuelve
    //    a buscar en el listado al final. Si el usuario dirigió la prueba se usa
    //    su dato; si no, se lee del propio detalle (descubrimiento automático).
    const nombreRequisicion = await testContext.getODescubrir(CASO, 'nombreRequisicion', () =>
      detalle.getNombre()
    );
    assert.ok(
      nombreRequisicion,
      'No se pudo determinar el nombre de la requisición abierta (el detalle no cargó el campo "Nombre de requisición").'
    );

    // 4) El botón "Pausar" debe existir y estar habilitado en el header.
    const boton = await detalle.buscarBotonPausar();
    if (!boton.encontrado || boton.deshabilitado) {
      evidence.saveEvidenceBuffer('json', this, JSON.stringify(boton, null, 2), {
        label: 'acciones-del-header',
        encoding: 'utf8',
      });
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: 'ubicar el botón "Pausar" en el header de la requisición',
        campo: 'Pausar',
        valor: nombreRequisicion,
      });
      assert.fail(
        `El botón "Pausar" no está disponible para la requisición "${nombreRequisicion}" ` +
          `(encontrado=${boton.encontrado}, deshabilitado=${boton.deshabilitado}, motivo=${boton.motivo || 'n/d'}). ` +
          `Acciones del header: ${JSON.stringify(boton.botones)}`
      );
    }

    // 5) Pausar.
    const resultado = await detalle.pausar();
    await evidence.attachScreenshot(driver, this, { label: 'Tras pulsar Pausar' });

    // 6) Primer criterio de éxito: el notify de la app.
    assert.ok(
      resultado.exito,
      `No apareció el Notify de éxito al pausar "${nombreRequisicion}". ` +
        `Notify recibido: "${resultado.notify}" (inválido=${resultado.invalido}, errorSistema=${resultado.errorSistema}).`
    );

    // 7) Volver al listado por el menú del módulo: sin cerrar sesión y sin
    //    reingresar al módulo (flujo normal del usuario).
    const listado = await requisicionesFlow.volverAlListado(driver);

    // 8) Criterio final: la requisición ahora figura como "Pausada".
    const { coincide, celdas } = await listado.esperarEstadoDeRequisicion(
      nombreRequisicion,
      ESTADO_ESPERADO
    );

    evidence.saveEvidenceBuffer(
      'json',
      this,
      JSON.stringify({ nombreRequisicion, estadoEsperado: ESTADO_ESPERADO, filaEnListado: celdas }, null, 2),
      { label: 'estado-final-en-listado', encoding: 'utf8' }
    );
    await evidence.attachScreenshot(driver, this, { label: 'Listado tras pausar' });

    assert.ok(
      coincide,
      `La requisición "${nombreRequisicion}" (índice ${indice}) no quedó en estado "${ESTADO_ESPERADO}" ` +
        `tras pausarla. Fila leída en el listado: ${JSON.stringify(celdas)}.`
    );
  });
});
