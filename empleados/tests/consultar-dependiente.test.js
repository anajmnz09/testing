const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-dependiente';
const CLAVE_EMPLEADO = 'Nombre de Empleado con el Dependiente';
const CLAVE_DEPENDIENTE = 'Identificación o nombre del Dependiente a consultar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_DEPENDIENTE]);

/**
 * Consulta un Dependiente de un Empleado en la sección "Dependientes" del detalle (modo SOLO CONSULTA: no abre "Editar" ni modifica
 * nada). Lee la fila del dependiente en el listado y verifica que muestre sus datos (Parentesco, Tipo ID, Identificación, Nombre,
 * Género, Fecha de nacimiento); si el Panel dirigió el dependiente, comprueba además que la fila corresponde a ese valor.
 *
 * AUTOMÁTICO por defecto: primer empleado del listado y primer dependiente de ese empleado. Se puede dirigir el empleado, el
 * dependiente (identificación o nombre exacto) o ambos. Sin dependientes el test FALLA (precondición no cumplida).
 * (Distinto de `consultar-dependientes`, que solo abre la sección.)
 */
describe('Empleados - Consultar Dependiente', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: consulta un Dependiente de un Empleado existente y verifica sus datos`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const dependienteDirigido = testContext.get(CASO, CLAVE_DEPENDIENTE);
    let detalle;
    let nombreEmpleado = empleadoDirigido;

    if (empleadoDirigido) {
      detalle = await ctx.lista.abrirDetalle(empleadoDirigido);
    } else {
      if (!((await ctx.lista.grid.contarFilas()) > 0)) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — la suite asume que siempre hay al menos un registro.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
      nombreEmpleado = await detalle.getNombre();
      logger.info(`${CASO}: empleado elegido automáticamente -> "${nombreEmpleado}"`);
    }

    const abierta = await detalle.abrirSeccion('Dependientes');
    const titulo = await detalle.esperarTituloContenido('Dependientes');
    assert.ok(titulo.coincide, `El área de título no muestra "Dependientes" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
    assert.ok(abierta.activada, `La sección "Dependientes" no quedó activa para "${nombreEmpleado}".`);

    const filas = await detalle.leerFilasDependientes();
    if (!filas.length) {
      assert.fail(
        `${CASO}: el empleado "${nombreEmpleado}" no tiene ningún Dependiente registrado — no hay nada que consultar. ` +
          `(Precondición del escenario: se esperaba al menos una fila en la sección "Dependientes".)`
      );
    }
    const indice = detalle._indiceDependiente(filas, dependienteDirigido || 0);
    if (indice < 0) {
      assert.fail(
        `${CASO}: "${nombreEmpleado}" no tiene un Dependiente "${dependienteDirigido}". ` +
          `Dependientes: ${JSON.stringify(filas.map((f) => `${f['Identificación']} (${f.Nombre})`))}.`
      );
    }
    const fila = filas[indice];
    await evidence.attachScreenshot(ctx.driver, this, { label: `Dependiente consultado - "${fila['Identificación']}"` });
    logger.info(`${CASO}: fila consultada -> ${JSON.stringify(fila)}`);

    for (const columna of ['Parentesco', 'Tipo ID', 'Identificación', 'Nombre', 'Género', 'Fecha de nacimiento']) {
      assert.ok(String(fila[columna] || '').trim(), `La columna "${columna}" del Dependiente consultado está vacía. Fila: ${JSON.stringify(fila)}.`);
    }
    if (dependienteDirigido) {
      const buscado = String(dependienteDirigido);
      assert.ok(
        [fila['Identificación'], fila.Nombre].some((v) => String(v).toLowerCase() === buscado.trim().toLowerCase()),
        `La fila consultada no corresponde al Dependiente dirigido "${buscado}": ${JSON.stringify(fila)}.`
      );
      assertTextoIgual(String(fila['Identificación'] === buscado ? fila['Identificación'] : fila.Nombre), buscado, 'El dependiente consultado no coincide con el dirigido.');
    }
    logger.info(`${CASO}: verificado -> Dependiente "${fila.Nombre}" (Identificación ${fila['Identificación']}) de "${nombreEmpleado}"`);
  });
});
