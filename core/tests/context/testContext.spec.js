const { expect } = require('chai');
const { crearProyecto, capturandoConsola } = require('../support/proyectoTemporal');

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

    it('recorta espacios al inicio/final del valor (el usuario los deja fácil al tipear en el Panel)', function () {
      const ctx = conContexto({
        caso: {
          finalConEspacio: 'DEPARTAMENTO QA ',
          ambosLados: '  Transporte  ',
          soloInterno: 'DEPARTAMENTO QA',
        },
      });

      // Un espacio de sobra al final/inicio no debe distinguirse del valor limpio.
      expect(ctx.get('caso', 'finalConEspacio')).to.equal('DEPARTAMENTO QA');
      expect(ctx.get('caso', 'ambosLados')).to.equal('Transporte');
      // El espacio INTERNO (entre palabras) nunca se toca.
      expect(ctx.get('caso', 'soloInterno')).to.equal('DEPARTAMENTO QA');
      expect(ctx.get('caso', 'soloInterno')).to.not.equal('DEPARTAMENTOQA');
      // Una diferencia REAL (no solo de espacios en los extremos) sigue siendo una diferencia.
      expect(ctx.get('caso', 'finalConEspacio')).to.not.equal('DEPARTAMENTO RRHH');
    });

    it('recorta también el valor tomado de `global`', function () {
      const ctx = conContexto({ global: { empresa: '  Camsoft  ' } });

      expect(ctx.get('caso-sin-dato', 'empresa')).to.equal('Camsoft');
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

    it('avisa (sin borrar) cuando una clave ya persistida no la declara el código actual — ej. tras un rename', async function () {
      // Simula el incidente real: un caso ya registrado con "nombre", el
      // código luego se renombra a una clave más específica.
      const ctx = conContexto({ 'editar-empleado': { nombre: '' } });

      const [linea] = await capturandoConsola(() =>
        ctx.registrarCaso('editar-empleado', ['Nombre de Empleado a editar'])
      );

      expect(linea).to.contain('ADVERTENCIA');
      expect(linea).to.contain('editar-empleado');
      expect(linea).to.contain('nombre');
      // La huérfana NO se borra (mismo criterio "nunca pisa/borra" del resto
      // del framework) — sigue en el archivo, solo advertida.
      expect(ctx.getCaso('editar-empleado')).to.deep.equal({
        nombre: '',
        'Nombre de Empleado a editar': '',
      });
    });

    it('NO avisa sobre una clave declarada de nuevo con el mismo nombre (nada huérfano)', async function () {
      const ctx = conContexto({ caso: { clave: 'valor' } });

      const lineas = await capturandoConsola(() => ctx.registrarCaso('caso', ['clave']));

      expect(lineas).to.deep.equal([]);
    });

    it('NO avisa al crear un caso nuevo (no hay nada previo con qué comparar)', async function () {
      const ctx = conContexto({});

      const lineas = await capturandoConsola(() => ctx.registrarCaso('caso-nuevo', ['clave']));

      expect(lineas.some((l) => l.includes('ADVERTENCIA'))).to.equal(false);
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
      'Compañías permitidas': { estrategia: 'searchAndSelect', multiple: true },
    };

    it('siembra las claves con los LABELS REALES del formulario', function () {
      const ctx = conContexto({});
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES);

      expect(ctx.getCaso('crear-req')).to.deep.equal({
        'Nombre de requisición': '',
        Puesto: '',
        Rotativo: false,
        'Compañías permitidas': '',
      });
    });

    it('siembra un control "switch" con `false` (no \'\'), para que el Panel lo detecte como checkbox', function () {
      const ctx = conContexto({});
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES);

      expect(ctx.getCaso('crear-req').Rotativo).to.equal(false);
      // El seed `false` sigue sin dirigir la prueba (mismo criterio que '' para texto).
      expect(ctx.get('crear-req', 'Rotativo')).to.equal(undefined);
      expect(ctx.tiene('crear-req', 'Rotativo')).to.equal(false);
    });

    it('un `true` explícito en un control "switch" SÍ dirige la prueba', function () {
      const ctx = conContexto({ 'crear-req': { Rotativo: true } });
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES);

      expect(ctx.get('crear-req', 'Rotativo')).to.equal(true);
      expect(ctx.tiene('crear-req', 'Rotativo')).to.equal(true);
    });

    it('siembra un control "checkbox" con `false` igual que "switch" (mismo widget booleano, DevExtreme distinto)', function () {
      const CONTROLES_CON_CHECKBOX = { ...CONTROLES, 'Indicador Comision': 'checkbox' };
      const ctx = conContexto({});
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES_CON_CHECKBOX);

      expect(ctx.getCaso('crear-req')['Indicador Comision']).to.equal(false);
      expect(ctx.tiene('crear-req', 'Indicador Comision')).to.equal(false);
    });

    it('agrega las claves extra que no son del formulario', function () {
      const ctx = conContexto({});
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES, ['maxEmpleados']);

      expect(Object.keys(ctx.getCaso('crear-req'))).to.include('maxEmpleados');
    });

    it('pone `clavesExtra` PRIMERO — el Panel debe mostrar la clave de búsqueda ("X a editar") antes que los campos del formulario, no al final', function () {
      const ctx = conContexto({});
      ctx.registrarCasoDesdeFormulario('editar-req', CONTROLES, ['Nombre de Requisición a editar']);

      expect(Object.keys(ctx.getCaso('editar-req'))).to.deep.equal([
        'Nombre de Requisición a editar',
        'Nombre de requisición',
        'Puesto',
        'Rotativo',
        'Compañías permitidas',
      ]);
    });

    it('NO pisa los valores que el usuario ya cargó (misma garantía que registrarCaso)', function () {
      const ctx = conContexto({ 'crear-req': { Puesto: 'ANALISTA DE MERCADO' } });
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES);

      expect(ctx.get('crear-req', 'Puesto')).to.equal('ANALISTA DE MERCADO');
      expect(ctx.getCaso('crear-req')['Nombre de requisición']).to.equal('');
    });

    it('es idempotente: no reescribe si ya están todas las claves', function () {
      const ctx = conContexto({
        'crear-req': { 'Nombre de requisición': '', Puesto: '', Rotativo: false, 'Compañías permitidas': '' },
        _camposMultivalor: { 'crear-req': ['Compañías permitidas'] },
      });

      expect(ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES)).to.equal(false);
    });

    it('detecta un control `{ multiple: true }` y lo registra como multivalor, sin tocar su valor sembrado', function () {
      const ctx = conContexto({});
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES);

      // El valor sembrado sigue siendo un string vacío normal — el "es
      // multivalor" vive APARTE (`_camposMultivalor`), no en el valor.
      expect(ctx.getCaso('crear-req')['Compañías permitidas']).to.equal('');
      expect(ctx.todo()._camposMultivalor).to.deep.equal({ 'crear-req': ['Compañías permitidas'] });
    });

    it('un valor con "|" en un campo multivalor se lee tal cual (el parseo es responsabilidad del test, no de testContext)', function () {
      const ctx = conContexto({ 'crear-req': { 'Compañías permitidas': 'Cia_001 | Cia_002' } });
      ctx.registrarCasoDesdeFormulario('crear-req', CONTROLES);

      expect(ctx.get('crear-req', 'Compañías permitidas')).to.equal('Cia_001 | Cia_002');
    });
  });

  describe('registrarCaso con `multivalor` explícito (casos sin ESTRATEGIAS, ej. un popup manual)', function () {
    it('marca la clave como multivalor cuando se pasa `{ clave, multivalor: true }`', function () {
      const ctx = conContexto({});
      ctx.registrarCaso('agregar-permiso', ['Módulo', { clave: 'Roles', multivalor: true }]);

      expect(ctx.getCaso('agregar-permiso')).to.deep.equal({ Módulo: '', Roles: '' });
      expect(ctx.todo()._camposMultivalor).to.deep.equal({ 'agregar-permiso': ['Roles'] });
    });

    it('no marca nada como multivalor si ninguna entrada lo pide', function () {
      const ctx = conContexto({});
      ctx.registrarCaso('caso-simple', ['a', 'b']);

      expect(ctx.todo()._camposMultivalor).to.equal(undefined);
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
