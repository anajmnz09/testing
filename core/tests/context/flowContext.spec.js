const { expect } = require('chai');
const { crearProyecto } = require('../support/proyectoTemporal');

/**
 * Resolución de un dato dentro de un FLUJO (`testContext.get` + `flowContext`).
 *
 * Prioridad en un flujo:  entidad producida por el flujo (flowContext) → undefined (automático del test)
 * Un flujo NO recibe datos específicos y el `execution-context.json` individual NO interviene en él
 * (la ejecución individual sigue leyéndolo como siempre). Fuera de un flujo todo es inerte.
 */
describe('flujo: flowContext + testContext (unitario)', function () {
  let proyecto;
  let previo; // entorno ORIGINAL, capturado una sola vez

  before(function () {
    previo = { plan: process.env.TRIPLE_FLOW_PLAN };
  });

  function cargar({ contexto, plan } = {}) {
    proyecto = crearProyecto({ archivoContexto: 'execution-context.json' });
    if (contexto) proyecto.escribir('execution-context.json', JSON.stringify(contexto));
    if (plan) process.env.TRIPLE_FLOW_PLAN = proyecto.escribir('plan.json', JSON.stringify(plan));
    else delete process.env.TRIPLE_FLOW_PLAN;
    const flowContext = proyecto.importar('../../context/flowContext');
    const testContext = proyecto.importar('../../context/testContext'); // toma los módulos recién cargados
    return { flowContext, testContext };
  }

  const PLAN = {
    bindings: [{ caso: 'consumidor', clave: 'nombre', tipo: 'requisicion', campo: 'nombre' }],
    produce: { productor: ['requisicion'] },
    requiere: { consumidor: [{ tipo: 'requisicion', clave: 'nombre' }] },
    productores: { requisicion: ['productor'] },
  };

  afterEach(function () {
    if (previo.plan === undefined) delete process.env.TRIPLE_FLOW_PLAN;
    else process.env.TRIPLE_FLOW_PLAN = previo.plan;
    proyecto.limpiar();
  });

  describe('fuera de un flujo (ejecución individual)', function () {
    it('está inactivo: publish no guarda y get no cambia', function () {
      const { flowContext, testContext } = cargar({ contexto: { consumidor: { nombre: '' } } });
      expect(flowContext.activo()).to.equal(false);
      flowContext.publish('requisicion', { nombre: 'REQ-1' });
      expect(flowContext.get('requisicion')).to.equal(undefined);
      expect(testContext.get('consumidor', 'nombre')).to.equal(undefined);
    });

    it('sigue leyendo el execution-context.json (y su sección global)', function () {
      const { testContext } = cargar({ contexto: { consumidor: { nombre: 'DEL-JSON' }, global: { g: 'GLOBAL' } } });
      expect(testContext.get('consumidor', 'nombre')).to.equal('DEL-JSON');
      expect(testContext.get('consumidor', 'g')).to.equal('GLOBAL');
    });

  });

  describe('dentro de un flujo', function () {
    it('IGNORA el execution-context.json individual (los valores guardados no se usan)', function () {
      const { testContext } = cargar({
        contexto: { consumidor: { nombre: 'RESIDUO-DEL-JSON' }, global: { nombre: 'GLOBAL-RESIDUO' } },
        plan: PLAN,
      });
      expect(testContext.get('consumidor', 'nombre')).to.equal(undefined);
      expect(testContext.valorDirigido('consumidor', 'nombre')).to.equal(undefined);
    });

    it('usa la entidad producida por el flujo', function () {
      const { flowContext, testContext } = cargar({ contexto: { consumidor: { nombre: 'RESIDUO' } }, plan: PLAN });
      flowContext.setCasoActual('productor');
      flowContext.publish('requisicion', { nombre: 'REQ-1', puesto: 'Analista' });
      expect(testContext.get('consumidor', 'nombre')).to.equal('REQ-1');
      expect(flowContext.entidad('requisicion')).to.deep.include({ version: 1, productor: 'productor' });
    });

    it('sin entidad producida: undefined (automático del test)', function () {
      const { testContext } = cargar({ contexto: { consumidor: { nombre: '' } }, plan: PLAN });
      expect(testContext.get('consumidor', 'nombre')).to.equal(undefined);
    });

    it('sin binding declarado no se inyecta nada de lo producido (sin inferencias)', function () {
      const { flowContext, testContext } = cargar({ plan: PLAN });
      flowContext.publish('requisicion', { nombre: 'REQ-1' });
      expect(testContext.get('otro', 'nombre')).to.equal(undefined);
    });

    it('publish de un tipo existente reemplaza y sube la versión (transformación)', function () {
      const { flowContext } = cargar({ plan: PLAN });
      flowContext.publish('solicitud', { codigo: 'S-1' }, 'crear');
      flowContext.publish('solicitud', { codigo: 'S-1', etapa: 'Entrevista' }, 'e1');
      expect(flowContext.entidad('solicitud')).to.deep.equal({
        datos: { codigo: 'S-1', etapa: 'Entrevista' },
        version: 2,
        productor: 'e1',
      });
    });
  });

  describe('contextos por módulo (solo siembra y lectura de claves; no dirigen valores en un flujo)', function () {
    it('registrarCaso siembra en el archivo de SU módulo y getCaso lo lee de ahí; get no usa esos valores', function () {
      proyecto = crearProyecto({ archivoContexto: 'execution-context.json' });
      const a = proyecto.escribir('modA/execution-context.json', JSON.stringify({ casoA: { dato: 'de-A' } }));
      const b = proyecto.escribir('modB/execution-context.json', JSON.stringify({ casoB: { dato: 'de-B' } }));
      proyecto.escribir('execution-context.json', JSON.stringify({ casoA: { dato: 'DEFAULT' }, casoB: { dato: 'DEFAULT' } }));
      process.env.TRIPLE_FLOW_PLAN = proyecto.escribir('plan.json', JSON.stringify({ contextos: { casoA: a, casoB: b }, bindings: [] }));
      proyecto.importar('../../context/flowContext');
      const testContext = proyecto.importar('../../context/testContext');
      expect(testContext.getCaso('casoA').dato).to.equal('de-A'); // claves por módulo (p. ej. claveConocida)
      expect(testContext.getCaso('casoB').dato).to.equal('de-B');
      expect(testContext.get('casoA', 'dato')).to.equal(undefined); // pero no dirigen nada en el flujo
      testContext.registrarCaso('casoB', ['nuevo']);
      expect(proyecto.leerJson(b).casoB).to.have.property('nuevo');
      expect(proyecto.leerJson(proyecto.ruta('execution-context.json')).casoB).to.not.have.property('nuevo');
    });

    it('un caso sin entrada en contextos usa el archivo por defecto', function () {
      proyecto = crearProyecto({ archivoContexto: 'execution-context.json' });
      proyecto.escribir('execution-context.json', JSON.stringify({ x: { dato: 'DEFAULT' } }));
      process.env.TRIPLE_FLOW_PLAN = proyecto.escribir('plan.json', JSON.stringify({ contextos: {}, bindings: [] }));
      proyecto.importar('../../context/flowContext');
      const testContext = proyecto.importar('../../context/testContext');
      expect(testContext.getCaso('x').dato).to.equal('DEFAULT');
    });
  });
});
