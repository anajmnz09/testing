const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const SRHHNavBar = require('@triple/core/components/SRHHNavBar');
const DataGrid = require('@triple/core/components/DataGrid');
const fixtures = require('../support/fixtures');
const flowContext = require('@triple/core/context/flowContext');

const CASO = 'cambiar-solicitud-crear-empleado';

// Requisito ÚNICO y estricto (verificado en el grid real, comparación
// case-insensitive: el grid muestra la etapa en minúscula, ej. "oferta de
// empleo"): la opción "Crear Empleado" solo aparece en el dropdown de etapa
// cuando la solicitud está en Etapa="Oferta de Empleo" y Estado="Autorizada".
// Fuera de esa combinación exacta la opción ni siquiera se lista.
const ETAPA_REQUERIDA = 'oferta de empleo';
const ESTADO_REQUERIDO = 'autorizada';

testContext.registrarCaso(CASO, ['codigo', 'salario']);

function cumpleRequisitos(fila) {
  if (!fila) return false;
  const etapa = (fila['Etapa'] || '').trim().toLowerCase();
  const estado = (fila['Estado'] || '').trim().toLowerCase();
  return etapa === ETAPA_REQUERIDA && estado === ESTADO_REQUERIDO;
}

/**
 * Última transición de etapa de una Solicitud de Empleo: "Oferta de Empleo"
 * -> "Crear Empleado" (contrata al solicitante y crea su perfil en el módulo
 * Empleados). Requiere primero llenar "Salario" en "Propuesta económica"
 * (Editar -> Guardar) — vacío, la app bloquea el cambio de etapa con un
 * warning (ver mapeo en `SolicitudEmpleoDetallePage`).
 *
 * Verificación final: navega al módulo Empleados desde el navbar
 * (`SRHHNavBar.irAModulo`, mecanismo genérico y reutilizable por cualquier
 * módulo, no específico de este caso) y confirma que el solicitante recién
 * contratado aparece en su listado general, por nombre.
 */
describe('Reclutamiento - Cambiar Solicitud a Crear Empleado', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSolicitudesEmpleo();

  it(`${CASO}: llena Salario, cambia la etapa a "Crear Empleado" y confirma que el empleado aparece en el módulo Empleados`, async function () {
    const codigo = testContext.get(CASO, 'codigo');
    let fila;
    let codigoUsado;

    if (codigo) {
      await ctx.lista.grid.buscar(codigo);
      fila = await ctx.lista.grid.leerFilaPorColumnas(codigo);
      codigoUsado = codigo;
    } else {
      const filas = await ctx.lista.grid.filasPorColumnas();
      fila = filas.find(cumpleRequisitos);
      codigoUsado = fila ? fila['Código'] : null;
    }

    if (!cumpleRequisitos(fila)) {
      assert.fail(
        'No se encontró ninguna solicitud que cumpla los requisitos para "Crear Empleado" ' +
          `(código="${codigoUsado || codigo || '(ninguna encontrada en el listado)'}", ` +
          `etapa="${fila ? fila['Etapa'] : '-'}", estado="${fila ? fila['Estado'] : '-'}"). ` +
          `Se requiere Etapa="Oferta de Empleo" y Estado="Autorizada".`
      );
    }
    const nombreSolicitante = (fila['Nombre'] || '').trim();
    logger.info(
      `${CASO}: "${codigoUsado}" cumple los requisitos (Etapa="${fila['Etapa']}", Estado="${fila['Estado']}", Nombre="${nombreSolicitante}")`
    );

    const detalle = await ctx.lista.abrirDetalle(codigoUsado);
    await detalle.editar();

    const salario = testContext.get(CASO, 'salario') || String(20000 + Math.floor(Math.random() * 30000));
    await detalle.setCampoPropuestaEconomica('Salario', salario);
    await detalle.guardar();
    const resGuardado = await detalle.resultadoGuardado();
    assert.ok(resGuardado.exito, `Se esperaba guardado exitoso de "Salario" para "${codigoUsado}". Notify: "${resGuardado.notify}"`);

    const resEtapa = await detalle.cambiarEtapa('Crear Empleado');
    assert.ok(
      resEtapa.exito,
      `Se esperaba notify de éxito al cambiar la etapa de "${codigoUsado}" a "Crear Empleado". Notify: "${resEtapa.notify}"`
    );
    const etapaFinal = await detalle.esperarEtapa('Crear Empleado');
    assert.ok(
      etapaFinal.toLowerCase().includes('crear empleado'),
      `La etapa de "${codigoUsado}" no quedó en "Crear Empleado" (quedó "${etapaFinal}").`
    );
    await evidence.attachScreenshot(ctx.driver, this, { label: 'Etapa cambiada a Crear Empleado' });

    // Verificación en el módulo Empleados: el solicitante recién contratado
    // debe aparecer en su listado general.
    if (!nombreSolicitante) {
      assert.fail(`No se pudo leer el nombre del solicitante "${codigoUsado}" desde el listado para verificarlo en Empleados.`);
    }
    const navBar = new SRHHNavBar(ctx.driver);
    await navBar.irAModulo('Empleados');
    const empleadosGrid = new DataGrid(ctx.driver);
    // "Empleados" abre por defecto en "Modo tarjeta" (no legible por este
    // componente); se cambia a "Modo lista" para poder leer sus filas (ver
    // `asegurarModoLista`).
    await empleadosGrid.asegurarModoLista();
    await empleadosGrid.listo();

    // El nombre del solicitante en el listado de Solicitudes es una versión
    // CORTA (ej. "Matias Mella"), mientras que en Empleados aparece el nombre
    // legal COMPLETO (ej. "Matias Ramon Mella Sanchez") — verificado con
    // evidencia real. No son la misma cadena contigua, así que se busca por
    // el primer token (más distintivo) y se confirma que TODOS los tokens del
    // nombre corto aparecen (en cualquier posición) en el "Nombre" resultante.
    // También verificado con evidencia real: el empleado NO aparece de
    // inmediato tras el notify de "Crear Empleado" (tarda en propagarse entre
    // módulos) — se espera con poll (`esperarFila`), no una lectura única.
    // En modo flujo la solicitud publicó su nombre legal COMPLETO (los 4 campos de
    // nombre usados al crearla): se busca por él, contiguo, para ubicar sin
    // ambigüedad al empleado de ESTA solicitud (el nombre corto del listado puede
    // coincidir con otros empleados ya existentes). Individualmente: igual que siempre.
    const solicitudFlujo = flowContext.get('solicitud');
    const nombreFlujo = solicitudFlujo && solicitudFlujo.nombreCompleto;
    const tokensNombre = (nombreFlujo || nombreSolicitante).split(/\s+/).filter(Boolean);
    const textoBusqueda = nombreFlujo || tokensNombre[0];
    const empleadoCreado = await empleadosGrid.esperarFila(textoBusqueda, (f) => {
      const nombreEmpleado = (f['Nombre'] || '').toLowerCase();
      return tokensNombre.every((t) => nombreEmpleado.includes(t.toLowerCase()));
    });
    await evidence.attachScreenshot(ctx.driver, this, { label: 'Solicitante visible en módulo Empleados' });
    assert.ok(
      empleadoCreado,
      `No se encontró a "${nombreSolicitante}" en el listado del módulo Empleados tras "Crear Empleado".`
    );
    logger.info(`${CASO}: empleado creado confirmado en el módulo Empleados: "${empleadoCreado.Nombre}" (Estado="${empleadoCreado.Estado}")`);

    // Solo en modo flujo: publica la referencia REAL del empleado (su "Código de
    // empleado." del listado, el mismo que usa Nómina) — data/flujo-tests.js.
    const colCodigo = Object.keys(empleadoCreado).find((k) => /^c[oó]digo/i.test(k));
    flowContext.publish('empleado', {
      codigo: colCodigo ? String(empleadoCreado[colCodigo]).trim() : '',
      nombre: empleadoCreado.Nombre,
      solicitud: codigoUsado,
    });
  });
});
