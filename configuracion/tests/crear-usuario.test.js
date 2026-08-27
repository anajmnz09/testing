const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const UsuarioDetallePage = require('../pages/UsuarioDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA, codigoDesdeNombre } = require('../support/nombresQA');

const CASO = 'crear-usuario';
testContext.registrarCasoDesdeFormulario(CASO, UsuarioDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'QA Usuario';
const DOMINIO_CORREO_QA = 'qa.triple.test';

/**
 * Crea un Usuario nuevo desde Configuración > Usuarios y permisos > Usuarios,
 * completando TODOS los campos del formulario de Crear ("Nombre Completo",
 * "Compañía", "Código de usuario", "Correo", "Idioma") — ver
 * `UsuarioDetallePage` para el mapeo completo verificado con Selenium real.
 *
 * "Nombre Completo", si el Panel lo dirige, se usa TAL CUAL; si no, lleva un
 * sufijo único — ver `nombreUnicoQA`.
 *
 * "Código de usuario" queda RELACIONADO al nombre elegido, sin espacios (el
 * placeholder real de la app es "e.g: johnsmith") — `codigoDesdeNombre`
 * deriva un valor tipo username a partir del nombre, en vez de uno
 * arbitrario. Si el Panel dirige su propio código, se respeta ese.
 *
 * "Es administrador"/"Tiene acceso a RRHH": APAGADOS por defecto (igual que
 * la app) salvo que el Panel dirija explícitamente `true` para alguno — en
 * ese caso este test SÍ los enciende al crear. Sin dirección, el autofill
 * genérico (`completarConContexto` con `incluirOpcionales:true`) los deja en
 * `false`, mismo estado que trae la app por defecto (no-op, confirmado en
 * `SwitchStrategy`: sin `soloSiDirigido`, fuerza a apagado cuando no hay
 * valor). Además de acá, siguen existiendo tests dedicados idempotentes para
 * activarlos sobre un Usuario YA EXISTENTE: `marcar-usuario-administrador` y
 * `dar-acceso-rrhh-usuario`.
 *
 * El usuario creado queda en estado "Pendiente" (requiere validación por
 * correo) — comportamiento esperado de la app, no algo que este test
 * resuelva.
 */
describe('Configuración - Crear Usuario', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoUsuarios();

  it(`${CASO}: crea un Usuario nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const nombre = nombreUnicoQA(testContext.get(CASO, 'Nombre Completo'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: "Nombre Completo" elegido -> "${nombre}"`);
    await form.setCampo('Nombre Completo', nombre);

    const codigo = testContext.get(CASO, 'Código de usuario') || codigoDesdeNombre(nombre);
    logger.info(`${CASO}: "Código de usuario" elegido -> "${codigo}"`);
    await form.setCampo('Código de usuario', codigo);

    const correo = testContext.get(CASO, 'Correo') || `${codigo}@${DOMINIO_CORREO_QA}`;
    await form.setCampo('Correo', correo);

    await form.completarConContexto(CASO, {
      incluirOpcionales: true,
      excepto: ['Nombre Completo', 'Código de usuario', 'Correo'],
    });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombre}". Notify: "${res.notify}"`);

    const filaCreada = await ctx.lista.grid.esperarFila(nombre, (f) => f['Nombre Completo'] === nombre);
    assert.ok(filaCreada, `"${nombre}" no aparece en el listado de Usuarios tras crearlo.`);
  });
});
