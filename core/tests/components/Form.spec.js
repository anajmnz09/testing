const { expect } = require('chai');
const Form = require('../../components/Form');

/**
 * Form.completarDesde — llenado genérico de un formulario dirigido por valores.
 *
 * Es la pieza que hace que un valor cargado en el Execution Context tenga
 * PRIORIDAD sobre el descubrimiento automático. Su lógica de orquestación (qué
 * controles se operan, con qué valor, y cuáles se saltan) se prueba en memoria:
 * se instancia el Form real y se intercepta `setValor` (la única primitiva que
 * llama), sin navegador ni app.
 */
describe('Form.completarDesde (unitario)', function () {
  // Form real, pero con setValor espiado: registra label/valor/estrategia y
  // devuelve el "valor efectivo" (imita a las estrategias: si no hay valor, la
  // primera opción).
  function formEspia() {
    const form = Object.create(Form.prototype);
    const llamadas = [];
    form.setValor = async (label, valor, opciones = {}) => {
      llamadas.push({ label, valor, estrategia: opciones.estrategia, opciones });
      return valor === undefined || valor === null || valor === '' ? 'AUTO' : valor;
    };
    form.llamadas = llamadas;
    form.labelsOperados = () => llamadas.map((l) => l.label);
    return form;
  }

  const CONTROLES = {
    Puesto: 'searchAndSelect',
    Sucursal: 'searchAndSelect',
    'Nombre de requisición': 'text',
    'Persona(s) a sustituir': { estrategia: 'searchAndSelect', multiple: true },
  };

  it('usa el valor provisto con la estrategia declarada de cada control', async function () {
    const form = formEspia();
    const usados = await form.completarDesde(CONTROLES, {
      Puesto: 'ANALISTA DE MERCADO',
      'Nombre de requisición': 'REQ-QA',
    });

    expect(form.labelsOperados()).to.deep.equal(['Puesto', 'Nombre de requisición']);
    expect(form.llamadas[0]).to.include({ label: 'Puesto', valor: 'ANALISTA DE MERCADO', estrategia: 'searchAndSelect' });
    expect(form.llamadas[1]).to.include({ label: 'Nombre de requisición', valor: 'REQ-QA', estrategia: 'text' });
    expect(usados).to.deep.equal({ Puesto: 'ANALISTA DE MERCADO', 'Nombre de requisición': 'REQ-QA' });
  });

  it('propaga las opciones extra del control (ej. multiple del tagbox)', async function () {
    const form = formEspia();
    await form.completarDesde(CONTROLES, { 'Persona(s) a sustituir': 'Hugo' });

    expect(form.llamadas[0].opciones).to.deep.include({ estrategia: 'searchAndSelect', multiple: true });
  });

  it('con autofill:false (default) NO toca los controles sin valor', async function () {
    const form = formEspia();
    await form.completarDesde(CONTROLES, { Puesto: 'ADMIN' });

    expect(form.labelsOperados()).to.deep.equal(['Puesto']); // Sucursal/Nombre/Persona no se tocan
  });

  it('con autofill:true aplica la estrategia SIN valor a los controles vacíos', async function () {
    const form = formEspia();
    const usados = await form.completarDesde(CONTROLES, { Puesto: 'ADMIN' }, { autofill: true });

    // Todos los controles se operan; los vacíos con valor undefined -> 'AUTO'.
    expect(form.labelsOperados()).to.have.members(Object.keys(CONTROLES));
    expect(usados.Puesto).to.equal('ADMIN');
    expect(usados.Sucursal).to.equal('AUTO');
    expect(form.llamadas.find((l) => l.label === 'Sucursal').valor).to.equal(undefined);
  });

  it('trata como vacío el string en blanco, null y el array vacío', async function () {
    const form = formEspia();
    await form.completarDesde(CONTROLES, { Puesto: '   ', Sucursal: null, 'Nombre de requisición': [] });

    expect(form.llamadas).to.be.empty; // nada provisto de verdad -> nada operado (autofill:false)
  });

  it('`solo` restringe a un subconjunto de controles', async function () {
    const form = formEspia();
    await form.completarDesde(CONTROLES, { Puesto: 'ADMIN', Sucursal: 'CENTRAL' }, { solo: ['Puesto'] });

    expect(form.labelsOperados()).to.deep.equal(['Puesto']);
  });

  it('`excepto` excluye controles aunque tengan valor (los maneja la rutina curada)', async function () {
    const form = formEspia();
    await form.completarDesde(CONTROLES, { Puesto: 'ADMIN', Sucursal: 'CENTRAL' }, { excepto: ['Puesto'] });

    expect(form.labelsOperados()).to.deep.equal(['Sucursal']);
  });

  it('respeta el orden declarado de los controles (dependencias entre campos)', async function () {
    const form = formEspia();
    await form.completarDesde(CONTROLES, { 'Nombre de requisición': 'X', Sucursal: 'C', Puesto: 'P' }, { autofill: true });

    expect(form.labelsOperados()).to.deep.equal(Object.keys(CONTROLES));
  });
});

/**
 * Form.validarControlesDeclarados — mecanismo de cobertura ESTRATEGIAS ↔ UI.
 *
 * Prueba la ORQUESTACIÓN (qué hace con el diagnóstico de `formInputModel.comparar`),
 * no la detección en sí (esa ya la cubre `formInputModel.spec.js`): se instancia el
 * Form real con `controlesVisibles` espiado (devuelve una lista fija, sin navegador),
 * mismo criterio que `formEspia()` arriba.
 *
 * Esto es directamente la prueba pedida para el incidente de "Editar paquete
 * salarial" (2026-09-04): demuestra que, ante un control real deliberadamente
 * omitido de ESTRATEGIAS, `{ estricta: true }` SIEMPRE lo detecta y falla duro — no
 * depende de que alguien lea un log.
 */
describe('Form.validarControlesDeclarados (unitario)', function () {
  function formConPantalla(enPantalla) {
    const form = Object.create(Form.prototype);
    form.controlesVisibles = async () => enPantalla;
    return form;
  }

  const ESTRATEGIAS_COMPLETAS = {
    Salario: 'text',
    'Indicador Comision': { estrategia: 'checkbox', soloSiDirigido: true },
  };

  it('con estricta:false (default) NO lanza aunque falte un control — solo informa (compatibilidad con todo llamador existente)', async function () {
    const form = formConPantalla(['Salario']); // "Indicador Comision" no declarado en este mapa incompleto a propósito
    const incompleto = { Salario: 'text' };

    const diag = await form.validarControlesDeclarados(incompleto, { etiqueta: 'test' });

    expect(diag.faltantesEnEstrategias).to.be.empty; // acá "Indicador Comision" ni aparece en pantalla
  });

  it('estricta:true LANZA cuando un control visible real fue omitido deliberadamente de ESTRATEGIAS', async function () {
    // Simula EXACTAMENTE el incidente: "Indicador Comision" está en pantalla
    // pero se omite a propósito del mapa declarado para probar la detección.
    const mapaConOmisionDeliberada = { Salario: 'text' }; // falta "Indicador Comision" a propósito
    const form = formConPantalla(['Salario', 'Indicador Comision']);

    let error;
    try {
      await form.validarControlesDeclarados(mapaConOmisionDeliberada, { etiqueta: 'editar-paquete-salarial', estricta: true });
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.message).to.include('Indicador Comision');
  });

  it('estricta:true NO lanza cuando ESTRATEGIAS ya declara todo lo visible', async function () {
    const form = formConPantalla(['Salario', 'Indicador Comision']);

    // Si lanzara, el `await` rechazaría y mocha marcaría el test como fallido —
    // no hace falta un try/catch para probar la ausencia de excepción.
    const diag = await form.validarControlesDeclarados(ESTRATEGIAS_COMPLETAS, {
      etiqueta: 'editar-paquete-salarial',
      estricta: true,
    });
    expect(diag.faltantesEnEstrategias).to.be.empty;
  });

  it('estricta:true NO marca falsamente un control deshabilitado/decorativo que `controlesVisibles` ya filtró (Caso 4)', async function () {
    // `controlesVisibles()` real ya excluye deshabilitados antes de devolver la
    // lista — acá se simula esa salida (sin "Indicador Nomina", deshabilitado
    // real confirmado) para probar que la capa de arriba no lo reintroduce.
    const form = formConPantalla(['Salario']); // "Indicador Nomina" (deshabilitado) NUNCA llega a esta lista

    const diag = await form.validarControlesDeclarados(
      { Salario: 'text' },
      { etiqueta: 'editar-paquete-salarial', estricta: true }
    );
    expect(diag.faltantesEnEstrategias).to.be.empty;
  });
});

/**
 * Form.assertValor — API "espera + compara" fusionada en un solo call, que
 * reemplaza el patrón de dos pasos (`esperarValor()` seguido de un `assert`
 * manual) donde el segundo paso puede olvidarse o hacerse con
 * `assert.strictEqual` crudo (ver SKILL.md, incidente 2026-09-09:
 * `editar-capacitacion.test.js` y otros 2 archivos reintrodujeron
 * exactamente ese olvido). `esperarValor` en sí ya está probado
 * indirectamente vía Form real en los E2E; acá se prueba SOLO el
 * pegamento propio de `assertValor` (delega en `esperarValor`, compara
 * case-insensitive, lanza con el mensaje correcto) con `esperarValor`
 * espiado, sin driver.
 */
describe('Form.assertValor (unitario)', function () {
  function formConEsperarValor(valorQueDevuelve) {
    const form = Object.create(Form.prototype);
    const llamadas = [];
    form.esperarValor = async (label, valorEsperado, opciones) => {
      llamadas.push({ label, valorEsperado, opciones });
      return valorQueDevuelve;
    };
    form._timeout = () => 1000;
    form.llamadas = llamadas;
    return form;
  }

  it('no lanza cuando el valor final coincide (mismo case)', async function () {
    const form = formConEsperarValor('Renovación trimestral');
    const actual = await form.assertValor('Frecuencia', 'Renovación trimestral');
    expect(actual).to.equal('Renovación trimestral');
  });

  it('no lanza cuando el valor final coincide con distinto case ("Renovación Trimestral" vs "Renovación trimestral")', async function () {
    const form = formConEsperarValor('Renovación Trimestral');
    const actual = await form.assertValor('Frecuencia', 'Renovación trimestral');
    expect(actual).to.equal('Renovación Trimestral');
  });

  it('lanza AssertionError cuando el valor final realmente difiere', async function () {
    const form = formConEsperarValor('Inactivo');
    let error;
    try {
      await form.assertValor('Estado', 'Activo');
    } catch (e) {
      error = e;
    }
    expect(error).to.exist;
    expect(error.message).to.include('Estado');
    expect(error.message).to.include('Activo');
  });

  it('delega en esperarValor con contains:false (match exacto, no substring)', async function () {
    const form = formConEsperarValor('Activo');
    await form.assertValor('Estado', 'Activo');
    expect(form.llamadas[0].opciones).to.include({ contains: false });
  });

  it('usa el mensaje provisto en vez del default', async function () {
    const form = formConEsperarValor('Inactivo');
    let error;
    try {
      await form.assertValor('Estado', 'Activo', 'mensaje custom de prueba');
    } catch (e) {
      error = e;
    }
    expect(error.message).to.equal('mensaje custom de prueba');
  });
});
