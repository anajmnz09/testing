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
