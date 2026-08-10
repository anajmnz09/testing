const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'editar-paquete-beneficios-solicitud-empleo';

// Requisitos verificados en el grid real (columnas "Etapa"/"Estado", sin
// abrir el detalle): Estado = "Iniciada" y Etapa una de estas 3 (comparación
// case-insensitive: el grid las muestra en minúscula, ej. "crear solicitud
// de empleo").
const ETAPAS_VALIDAS = ['crear solicitud de empleo', 'primera entrevista', 'segunda entrevista'];
const ESTADO_VALIDO = 'iniciada';

// Entradas del caso: `codigo` dirige a una solicitud puntual (se verifica que
// cumpla los requisitos antes de tocar nada; si no cumple, el caso falla).
// Sin `codigo`, se elige la primera solicitud del listado que YA cumpla.
// `estadoLaboral`/`ultimoSalario`/`beneficios` dirigen los valores; sin
// ellos, se usan valores QA por defecto.
testContext.registrarCaso(CASO, ['codigo', 'estadoLaboral', 'ultimoSalario', 'beneficios']);

function cumpleRequisitos(fila) {
  if (!fila) return false;
  const estado = (fila['Estado'] || '').trim().toLowerCase();
  const etapa = (fila['Etapa'] || '').trim().toLowerCase();
  return estado === ESTADO_VALIDO && ETAPAS_VALIDAS.includes(etapa);
}

/**
 * Llena "Paquete actual de beneficios" (Estado laboral / Último salario /
 * Beneficios) de una Solicitud de Empleo EXISTENTE — solo si su Etapa/Estado
 * actuales lo permiten (ver `cumpleRequisitos`).
 *
 * El REQUISITO se verifica LEYENDO LA FILA del listado (DataGrid del core:
 * `leerFilaPorColumnas`/`filasPorColumnas`), sin entrar al detalle: el grid
 * ya expone Etapa y Estado como columnas propias.
 *
 * La EVIDENCIA/verificación posterior al guardado se hace en la MISMA
 * pantalla del detalle (que vuelve a modo consulta tras Guardar) — no se
 * navega al listado para eso, es una pantalla distinta.
 *
 * Alcance ÚNICO: Paquete actual de beneficios — no toca valoración, foto,
 * datos personales/del puesto ni preguntas personalizadas.
 */
describe('Reclutamiento - Editar Paquete Actual de Beneficios de Solicitud de Empleo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSolicitudesEmpleo();

  it(`${CASO}: llena Estado laboral/Último salario/Beneficios cuando la solicitud cumple los requisitos`, async function () {
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
      logger.info('NO CUMPLE CON LOS REQUISITOS PARA LLENAR LOS DATOS');
      assert.fail(
        'NO CUMPLE CON LOS REQUISITOS PARA LLENAR LOS DATOS ' +
          `(código="${codigoUsado || codigo || '(ninguna encontrada en el listado)'}", ` +
          `estado="${fila ? fila['Estado'] : '-'}", etapa="${fila ? fila['Etapa'] : '-'}"). ` +
          `Se requiere Estado="Iniciada" y Etapa en [${ETAPAS_VALIDAS.join(', ')}].`
      );
    }
    logger.info(`${CASO}: "${codigoUsado}" cumple los requisitos (Etapa="${fila['Etapa']}", Estado="${fila['Estado']}")`);

    const detalle = await ctx.lista.abrirDetalle(codigoUsado);
    await detalle.editar();

    const estadoLaboral = testContext.get(CASO, 'estadoLaboral') || 'Empleado';
    const ultimoSalario = testContext.get(CASO, 'ultimoSalario') || String(20000 + Math.floor(Math.random() * 30000));
    const beneficios = testContext.get(CASO, 'beneficios') || 'Seguro médico, bono navideño, días libres adicionales.';

    await detalle.setCampoPaqueteBeneficios('Estado laboral', estadoLaboral);
    await detalle.setCampoPaqueteBeneficios('Último salario', ultimoSalario);
    await detalle.setCampoPaqueteBeneficios('Beneficios', beneficios);

    await detalle.guardar();
    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba guardado exitoso para "${codigoUsado}". Notify: "${res.notify}"`);

    // Verificación EN LA MISMA PANTALLA (tras Guardar el form vuelve a modo
    // consulta con los datos recién guardados) — sin volver al listado, que
    // es una pantalla distinta y no corresponde para esta evidencia.
    // Screenshot enfocado: sin el scroll explícito, la captura podía quedar
    // desplazada (ej. hacia Comentarios) y no mostrar lo recién editado.
    await detalle.form.scrollAlCampo('Estado laboral');
    await evidence.attachScreenshot(ctx.driver, this, { label: 'Paquete de beneficios guardado' });

    const valorEstado = await detalle.form.getValor('Estado laboral');
    const valorSalario = await detalle.form.getValor('Último salario');
    const valorBeneficios = await detalle.form.getValor('Beneficios');

    // "Estado laboral" es un selectbox de catálogo fijo (Empleado/Desempleado):
    // comparación case-insensitive, mismo criterio tolerante ya establecido
    // para el resto de las selecciones por texto del framework (el usuario
    // puede escribir "empleado" desde el Panel sin que sea un fallo).
    assert.strictEqual(
      valorEstado.trim().toLowerCase(),
      estadoLaboral.trim().toLowerCase(),
      `"Estado laboral" no quedó en "${estadoLaboral}" (quedó "${valorEstado}")`
    );
    // "Último salario" es un numberbox: la app lo muestra formateado (ej.
    // "45,000.00" para "45000") — comparación NUMÉRICA, no de texto exacto.
    assert.strictEqual(
      parseFloat(String(valorSalario).replace(/,/g, '')),
      parseFloat(String(ultimoSalario).replace(/,/g, '')),
      `"Último salario" no quedó en ${ultimoSalario} (quedó "${valorSalario}")`
    );
    assert.strictEqual(valorBeneficios, beneficios, `"Beneficios" no quedó en "${beneficios}" (quedó "${valorBeneficios}")`);
  });
});
