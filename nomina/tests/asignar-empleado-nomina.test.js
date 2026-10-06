const assert = require('assert');
const { createDriver, authFlow, navigationFlow, evidence, assertTextoIgual } = require('@triple/core');
const SRHHNavBar = require('@triple/core/components/SRHHNavBar');
const testContext = require('@triple/core/context/testContext');
const logger = require('@triple/core/utils/logger');
const { parsearValoresMultiples } = require('@triple/core/strategies');
const NominaPage = require('../pages/NominaPage');
const EmpleadosPage = require('../../empleados/pages/EmpleadosPage');

const CASO = 'asignar-empleado-nomina';

// Entradas (Execution Context):
//  - `codigos`: uno o varios códigos de empleado de "Empleados de Nuevo
//    Ingreso", separados por "|" (convención multivalor del framework, ver
//    `parsearValoresMultiples`). Vacío -> modo automático (primer empleado
//    disponible del listado).
//  - `nomina`: nombre de la nómina a elegir en el modal de asignación.
//    Vacío -> primera nómina disponible.
testContext.registrarCaso(CASO, [{ clave: 'codigos', multivalor: true }, 'nomina']);

/**
 * asignar-empleado-nomina — Asigna uno o varios empleados de "Empleados de
 * Nuevo Ingreso" a una Nómina.
 *
 * Flujo: login -> módulo Nómina (card del dashboard, `navigationFlow.
 * abrirModulo`, mismo mecanismo que cualquier otro módulo) -> pantalla
 * principal de Nómina -> listado "Empleados de Nuevo Ingreso" -> seleccionar
 * empleado(s) (por código dirigido desde el Execution Context, o el primero
 * disponible en modo automático) -> "Asignar a Nómina" -> elegir nómina
 * (dirigida, o la primera disponible) -> Guardar -> validar el resultado.
 *
 *  - Modo automático (sin `codigos` ni `nomina`): primer empleado + primera
 *    nómina — nunca hardcodeados, se toman en vivo del listado/selectbox.
 *  - Modo dirigido: uno o varios códigos (separados por "|") + la nómina
 *    indicada; con varios códigos, TODOS quedan seleccionados antes de abrir
 *    el modal de asignación.
 *
 * Test DELGADO: login/navegación de los flows y componentes del core
 * (`authFlow`, `navigationFlow`), toda la mecánica de grid/checkbox/selectbox/
 * modal del Page Object (`NominaPage`, que a su vez compone `DataGrid`, `Form`,
 * `Popup` y `Notify` del core — nada reimplementado). Screenshot/evidencia
 * ante fallo los aplica la política global del framework.
 */
describe('Nómina - Asignar Empleado a Nómina', function () {
  this.timeout(300000);
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
  });

  it(`${CASO}: asigna el/los empleado(s) de "Empleados de Nuevo Ingreso" a una nómina`, async function () {
    // 1) Login + módulo Nómina (flows existentes, sin replicar lógica).
    await authFlow.login(driver);
    await navigationFlow.abrirModulo(driver, 'Nómina');
    const nomina = await new NominaPage(driver).estaCargado();

    // 2) Confirmar que se llegó a la pantalla correcta. Comparación
    //    case/acento-insensitive (helper existente del core): "Nominas" debe
    //    coincidir con el "Nóminas" real, sin importar tilde ni mayúsculas.
    const titulo = await nomina.getTitulo();
    assertTextoIgual(titulo, 'Nominas', `No se llegó a la pantalla de Nómina (título leído: "${titulo}").`);

    // 3) Listado "Empleados de Nuevo Ingreso" disponible y con datos.
    await nomina.irAEmpleadosNuevoIngreso();
    const totalDisponibles = await nomina.gridNuevoIngreso.contarFilas();
    if (totalDisponibles === 0) {
      assert.fail(
        '"Empleados de Nuevo Ingreso" no tiene ningún registro para asignar a nómina (0 filas). ' +
          'Puede deberse a una compañía/ambiente sin empleados pendientes de asignación en este momento.'
      );
    }

    // 4) Seleccionar empleado(s): códigos dirigidos (uno o varios, separados
    //    por "|") o, en modo automático, el primero disponible del listado.
    const codigosDirigidos = parsearValoresMultiples(testContext.get(CASO, 'codigos'));
    const empleadosSeleccionados = [];

    if (codigosDirigidos.length) {
      for (const codigo of codigosDirigidos) {
        empleadosSeleccionados.push(await nomina.seleccionarEmpleadoPorCodigo(codigo));
      }
    } else {
      empleadosSeleccionados.push(await nomina.seleccionarPrimerEmpleado());
    }

    await evidence.attachScreenshot(driver, this, { label: 'Empleado(s) seleccionado(s)' });

    // 5) Abrir el modal de asignación ("Asignar a Nómina", header de la sección).
    await nomina.abrirAsignacionNomina();

    // 6) Elegir nómina: dirigida desde el Execution Context, o la primera
    //    disponible si no se dirigió ninguna.
    const nominaDirigida = testContext.get(CASO, 'nomina');
    const nominaElegida = await nomina.seleccionarNomina(nominaDirigida);
    assert.ok(nominaElegida, 'No se pudo elegir ninguna nómina en el selectbox del modal de asignación.');
    if (nominaDirigida) {
      assertTextoIgual(
        nominaElegida,
        nominaDirigida,
        `Se esperaba elegir la nómina "${nominaDirigida}" y quedó seleccionada "${nominaElegida}".`
      );
    }

    // 7) Confirmar ("Guardar") y validar el resultado.
    await nomina.confirmarAsignacion();
    const resultado = await nomina.resultadoAsignacion();

    evidence.saveEvidenceBuffer(
      'json',
      this,
      JSON.stringify({ empleadosSeleccionados, nominaElegida, resultado }, null, 2),
      { label: 'resultado-asignacion', encoding: 'utf8' }
    );
    await evidence.attachScreenshot(driver, this, { label: 'Resultado de la asignación' });

    // El cierre de los popups queda registrado como diagnóstico (log +
    // evidencia), NO como criterio de éxito: confirmado con Selenium real
    // que el contenedor del modal custom "Asignar Empleados a Nómina" puede
    // seguir reportando tamaño > 0 tras una asignación EXITOSA (transición/
    // backdrop propios del componente, no un overlay DevExtreme estándar) —
    // un falso negativo si se usara como assert. El criterio real de éxito
    // es de NEGOCIO/persistencia (paso 8): el empleado ya no figura como
    // pendiente de asignar, verificado reabriendo el listado.
    if (!resultado.modalCerrado) {
      logger.info(
        `${CASO}: los popups de asignación seguían "visibles" (tamaño>0) tras Guardar/Aceptar — ` +
          'se valida el éxito real por persistencia en el paso siguiente, no por este estado de UI.'
      );
    }

    // 8) Persistencia (criterio de éxito real): el propio registro de cada
    //    empleado asignado debe listar la nómina en "Datos básicos RH" ->
    //    "Nóminas en la que participa". Evidencia MÁS DIRECTA que releer el
    //    listado de origen (confirmado real: re-filtrar el MISMO grid en la
    //    MISMA sesión del navegador no siempre refleja el cambio — ver
    //    `NominaPage.esperarEmpleadoAsignado`, que queda disponible pero ya
    //    no se usa acá por ese motivo). Reutiliza `EmpleadosPage`/
    //    `EmpleadoDetallePage` (módulo Empleados): no se duplica la mecánica
    //    de navegación por acordeones del sidemenu ni la lectura de
    //    "Nóminas en la que participa", ambas ya resueltas ahí.
    const navBar = new SRHHNavBar(driver);
    await navBar.irAModulo('Empleados');
    const empleadosGrid = await new EmpleadosPage(driver).listo();

    for (const { codigo, nombre } of empleadosSeleccionados) {
      if (!nombre) {
        logger.info(
          `${CASO}: no se pudo leer el nombre del empleado "${codigo || '(automático)'}" para verificarlo en Empleados; se omite esa verificación puntual (ya queda en la evidencia).`
        );
        continue;
      }
      const detalle = await empleadosGrid.abrirDetalle(nombre);
      await detalle.abrirSeccion('Datos básicos RH');
      const asignado = await detalle.esperarNominaAsignada(nominaElegida);
      const nominasVistas = await detalle.getNominasAsignadas();
      await evidence.attachScreenshot(driver, this, {
        label: `"Datos básicos RH" de "${nombre}" tras asignar`,
      });
      assert.ok(
        asignado,
        `El empleado "${nombre}" (código "${codigo}") no muestra la nómina "${nominaElegida}" en ` +
          `"Datos básicos RH" > "Nóminas en la que participa" (nóminas vistas: ${JSON.stringify(nominasVistas)}).`
      );
    }
  });
});
