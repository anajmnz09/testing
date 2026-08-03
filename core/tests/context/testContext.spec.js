const { expect } = require('chai');
const { crearProyecto } = require('../support/proyectoTemporal');

/**
 * EXECUTION CONTEXT (datos de prueba).
 *
 * La regla que sostiene todo el framework es una sola: si el usuario definió el
 * dato se usa; si está vacío, el test se comporta como siempre y lo descubre
 * automáticamente. Estas pruebas cubren esa regla y la promesa de que
 * `registrarCaso` nunca pisa lo que el usuario cargó a mano.
 */
describe('testContext / Execution Context (unitario)', function () {
  let proyecto;
  let testContext;

  function conContexto(datos) {
    proyecto = crearProyecto({ archivoContexto: 'execution-context.json' });
    if (datos) proyecto.escribir('execution-context.json', JSON.stringify(datos, null, 2));
    testContext = proyecto.importar('../../context/testContext');
    return testContext;
  }

  afterEach(function () {
    proyecto.limpiar();
  });

  describe('lectura de datos', function () {
    it('usa el valor definido para el caso', function () {
      const ctx = conContexto({ 'pausar-requisicion': { nombreRequisicion: 'REQ-000125' } });

      expect(ctx.get('pausar-requisicion', 'nombreRequisicion')).to.equal('REQ-000125');
      expect(ctx.tiene('pausar-requisicion', 'nombreRequisicion')).to.equal(true);
    });

    it('cae en `global` cuando el caso no define el dato', function () {
      const ctx = conContexto({
        global: { empresa: 'Camsoft' },
        'pausar-requisicion': { nombreRequisicion: '' },
      });

      expect(ctx.get('pausar-requisicion', 'empresa')).to.equal('Camsoft');
    });

    it('el valor del caso gana sobre el global', function () {
      const ctx = conContexto({
        global: { empresa: 'Global SA' },
        'pausar-requisicion': { empresa: 'Camsoft' },
      });

      expect(ctx.get('pausar-requisicion', 'empresa')).to.equal('Camsoft');
    });

    it('trata como NO DEFINIDO el string vacío, los espacios, null y el array vacío', function () {
      const ctx = conContexto({
        caso: { vacio: '', espacios: '   ', nulo: null, lista: [] },
      });

      ['vacio', 'espacios', 'nulo', 'lista'].forEach((clave) => {
        expect(ctx.get('caso', clave), clave).to.equal(undefined);
        expect(ctx.tiene('caso', clave), clave).to.equal(false);
      });
    });

    it('devuelve undefined —la señal de descubrimiento automático— si no hay nada', function () {
      const ctx = conContexto({});

      expect(ctx.get('caso-inexistente', 'lo-que-sea')).to.equal(undefined);
      expect(ctx.getCaso('caso-inexistente')).to.deep.equal({});
    });

    it('no rompe la corrida si el archivo no existe', function () {
      const ctx = conContexto(null); // sin archivo en disco

      expect(ctx.get('caso', 'clave')).to.equal(undefined);
      expect(ctx.todo()).to.deep.equal({});
    });

    it('no rompe la corrida si el JSON está corrupto: lo ignora', function () {
      proyecto = crearProyecto({ archivoContexto: 'execution-context.json' });
      proyecto.escribir('execution-context.json', '{ roto');
      const ctx = proyecto.importar('../../context/testContext');

      expect(ctx.get('caso', 'clave')).to.equal(undefined);
    });
  });

  describe('getODescubrir (el patrón que usan los tests)', function () {
    it('usa el dato del contexto y NO ejecuta el descubrimiento', async function () {
      const ctx = conContexto({ 'pausar-requisicion': { nombreRequisicion: 'REQ-1' } });
      let descubrio = false;

      const valor = await ctx.getODescubrir('pausar-requisicion', 'nombreRequisicion', async () => {
        descubrio = true;
        return 'REQ-DESCUBIERTA';
      });

      expect(valor).to.equal('REQ-1');
      expect(descubrio, 'no debía descubrir nada').to.equal(false);
    });

    it('ejecuta el descubrimiento automático cuando el dato está vacío', async function () {
      const ctx = conContexto({ 'pausar-requisicion': { nombreRequisicion: '' } });

      const valor = await ctx.getODescubrir('pausar-requisicion', 'nombreRequisicion', async () => 'REQ-DESCUBIERTA');

      expect(valor).to.equal('REQ-DESCUBIERTA');
    });
  });

  describe('registrarCaso', function () {
    it('crea la sección con las claves vacías, listas para que el usuario las complete', function () {
      const ctx = conContexto({});
      const cambio = ctx.registrarCaso('caso-nuevo', ['nombreRequisicion', 'idRequisicion']);

      expect(cambio).to.equal(true);
      expect(ctx.getCaso('caso-nuevo')).to.deep.equal({ nombreRequisicion: '', idRequisicion: '' });
    });

    it('NO pisa los valores que el usuario ya cargó', function () {
      const ctx = conContexto({ 'caso-existente': { nombreRequisicion: 'REQ-MIA' } });
      ctx.registrarCaso('caso-existente', ['nombreRequisicion', 'idRequisicion']);

      expect(ctx.get('caso-existente', 'nombreRequisicion')).to.equal('REQ-MIA');
      expect(ctx.getCaso('caso-existente').idRequisicion).to.equal('');
    });

    it('NO borra las claves que el usuario agregó por su cuenta', function () {
      const ctx = conContexto({ caso: { claveDelUsuario: 'valor' } });
      ctx.registrarCaso('caso', ['otraClave']);

      expect(ctx.getCaso('caso')).to.deep.equal({ claveDelUsuario: 'valor', otraClave: '' });
    });

    it('no reescribe el archivo si no hay nada que agregar', function () {
      const ctx = conContexto({ caso: { clave: '' } });

      expect(ctx.registrarCaso('caso', ['clave'])).to.equal(false);
    });

    it('persiste en disco de forma legible y editable a mano', function () {
      const ctx = conContexto({});
      ctx.registrarCaso('caso-nuevo', ['clave']);

      const contenido = require('fs').readFileSync(ctx.CONTEXT_FILE, 'utf8');
      expect(contenido).to.contain('\n  "caso-nuevo"'); // indentado, no minificado
      expect(JSON.parse(contenido)['caso-nuevo']).to.deep.equal({ clave: '' });
    });

    it('otras secciones quedan intactas al registrar un caso nuevo', function () {
      const ctx = conContexto({ global: { empresa: 'Camsoft' }, 'caso-viejo': { a: '1' } });
      ctx.registrarCaso('caso-nuevo', ['b']);

      expect(ctx.todo()).to.deep.equal({
        global: { empresa: 'Camsoft' },
        'caso-viejo': { a: '1' },
        'caso-nuevo': { b: '' },
      });
    });
  });

  describe('registrarCasoDesdeFormulario', function () {
    // Mapa control->estrategia como el que declara un Page Object.
    const CONTROLES = {
      'Nombre de requisición': 'text',
      Puesto: 'searchAndSelect',
      Rotativo: 'switch',
    };

    it('siembra las claves con los LABELS REALES del formulario', function () {
      const ctx = conContexto({});
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES);

      expect(ctx.getCaso('crear-req')).to.deep.equal({
        'Nombre de requisición': '',
        Puesto: '',
        Rotativo: '',
      });
    });

    it('agrega las claves extra que no son del formulario', function () {
      const ctx = conContexto({});
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES, ['maxEmpleados']);

      expect(Object.keys(ctx.getCaso('crear-req'))).to.include('maxEmpleados');
    });

    it('NO pisa los valores que el usuario ya cargó (misma garantía que registrarCaso)', function () {
      const ctx = conContexto({ 'crear-req': { Puesto: 'ANALISTA DE MERCADO' } });
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES);

      expect(ctx.get('crear-req', 'Puesto')).to.equal('ANALISTA DE MERCADO');
      expect(ctx.getCaso('crear-req')['Nombre de requisición']).to.equal('');
    });

    it('es idempotente: no reescribe si ya están todas las claves', function () {
      const ctx = conContexto({ 'crear-req': { 'Nombre de requisición': '', Puesto: '', Rotativo: '' } });

      expect(ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES)).to.equal(false);
    });
  });

  describe('aislamiento', function () {
    it('`todo()` devuelve una copia: mutarla no altera el contexto', function () {
      const ctx = conContexto({ caso: { clave: 'valor' } });
      const copia = ctx.todo();
      copia.caso.clave = 'modificado';

      expect(ctx.get('caso', 'clave')).to.equal('valor');
    });

    it('`recargar()` vuelve a leer el archivo del disco', function () {
      const ctx = conContexto({ caso: { clave: 'inicial' } });
      expect(ctx.get('caso', 'clave')).to.equal('inicial');

      proyecto.escribir('execution-context.json', JSON.stringify({ caso: { clave: 'editado-a-mano' } }));
      ctx.recargar();

      expect(ctx.get('caso', 'clave')).to.equal('editado-a-mano');
    });
  });
});
