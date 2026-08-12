const assert = require('assert');
const { testContext } = require('@triple/core');
const BancoCandidatosPage = require('../pages/BancoCandidatosPage');
const fixtures = require('../support/fixtures');

const CASO = 'agregar-candidato-banco';
// Input Model del modal: se siembran en el Execution Context TODOS los
// controles editables (labels reales) de "Datos de Empleado" declarados en
// `BancoCandidatosPage.ESTRATEGIAS_AGREGAR`, más "Apreciación" (extra: no es
// un control de Form, ver `BancoCandidatosPage.setApreciacion`).
testContext.registrarCasoDesdeFormulario(CASO, BancoCandidatosPage.ESTRATEGIAS_AGREGAR, ['Apreciación']);

// Identificación FICTICIA (no corresponde a ningún empleado/candidato real):
// a diferencia de crear-solicitud-empleo.test.js (que reutiliza a propósito
// la identificación de un empleado interno para probar el autollenado), acá
// se crea un candidato nuevo desde cero, así que no interesa disparar ningún
// autollenado — solo se espera de forma tolerante por si el modal llegara a
// reconocer la identificación (ver `identificarYEsperarAutollenado`).
const IDENTIFICACION_QA = '00199999991';
const PRIMER_NOMBRE_QA = 'CandidatoQA';
const PRIMER_APELLIDO_QA = 'AutomatizadoQA';
const CORREO_QA = 'candidato.qa.automatizado@example.com';
const TELEFONO_QA = '8095551234';
// Dos etiquetas separadas por "|" (convención del framework para campos
// multi-valor del Execution Context, ver `parsearValoresMultiples`): valida
// que el modal agregue varios tags de texto libre, no solo uno.
const ETIQUETAS_QA = 'qa-automatizado|banco-candidatos';

/**
 * Crea un candidato directamente desde "Banco de candidatos" (modal "Agregar
 * Nuevo Candidato", NO pasa por crear una Solicitud de Empleo). Completa los
 * mismos campos que "Datos de Empleado" de Solicitud de Empleo, más
 * "Etiquetas" (varias, separadas por "|") y "Apreciación" (estrellas).
 *
 * Orden obligatorio del formulario (mismo criterio que Solicitud de Empleo):
 *   Tipo ID (primero, define la máscara de Identificación) → Identificación
 *   → resto de campos requeridos (Primer Nombre, Primer Apellido, Teléfono) →
 *   opcionales (Segundo Nombre, Segundo Apellido, Correo, Grado académico,
 *   Etiquetas) → Apreciación.
 */
describe('Reclutamiento - Agregar Candidato desde Banco de candidatos', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoBancoCandidatos();

  it(`${CASO}: crea un candidato completando Datos de Empleado, Etiquetas y Apreciación`, async function () {
    const modal = await ctx.lista.abrirFormularioAgregar();

    const tipoId = testContext.get(CASO, 'Tipo ID') || 'Cedula';
    await modal.seleccionarTipoId(tipoId);

    const identificacion = testContext.get(CASO, 'Identificación') || IDENTIFICACION_QA;
    await modal.identificarYEsperarAutollenado(identificacion);

    // Requeridos sin un "valor por defecto" razonable dentro del framework:
    // se dirigen acá, igual que crear-solicitud-empleo.test.js con
    // Comentario/Etiquetas. Con una identificación ficticia no se espera
    // autollenado, pero se completan igual (no pisan nada si ya vinieran
    // llenos).
    const primerNombre = testContext.get(CASO, 'Primer Nombre') || PRIMER_NOMBRE_QA;
    const primerApellido = testContext.get(CASO, 'Primer Apellido') || PRIMER_APELLIDO_QA;
    const telefono = testContext.get(CASO, 'Teléfono') || TELEFONO_QA;
    const correo = testContext.get(CASO, 'Correo') || CORREO_QA;
    const etiquetas = testContext.get(CASO, 'Etiquetas') || ETIQUETAS_QA;
    await modal.setCampo('Primer Nombre', primerNombre);
    await modal.setCampo('Primer Apellido', primerApellido);
    await modal.setCampo('Teléfono', telefono);
    await modal.setCampo('Correo', correo);
    await modal.setCampo('Etiquetas', etiquetas);

    // Resto de "Datos de Empleado" (Segundo Nombre, Segundo Apellido, Grado
    // académico) — solo lo que siga vacío.
    await modal.completarConContexto(CASO, { incluirOpcionales: true });

    // "Apreciación": estrellas dirigidas por el Execution Context, o una
    // cantidad al azar (1-5) si no se indicó (mismo criterio que
    // agregar-valoracion-solicitud-empleo.test.js).
    const apreciacionInput = testContext.get(CASO, 'Apreciación');
    const apreciacion = apreciacionInput ? Number(apreciacionInput) : 1 + Math.floor(Math.random() * 5);
    await modal.setApreciacion(apreciacion);

    await modal.guardar();
    const res = await modal.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    // Persistencia: el candidato nuevo cae en la tab "Elegibles" por defecto
    // (ver mapeo de clase de BancoCandidatosPage). Se confirma que aparece
    // en el listado, sin abrir su detalle (DataGrid.filasPorColumnas).
    await ctx.lista.popupAgregar.esperarCerrado();
    await ctx.lista.irATab('Elegibles');
    const nombreCompleto = `${primerNombre} ${primerApellido}`;
    await ctx.lista.grid.buscar(nombreCompleto);
    const filas = await ctx.lista.grid.filasPorColumnas();
    const encontrado = filas.some((f) =>
      Object.values(f).some((v) => String(v).trim().toLowerCase().includes(nombreCompleto.trim().toLowerCase()))
    );
    assert.ok(encontrado, `No se encontró "${nombreCompleto}" en "Elegibles" tras crearlo. Filas: ${JSON.stringify(filas)}`);
  });
});
