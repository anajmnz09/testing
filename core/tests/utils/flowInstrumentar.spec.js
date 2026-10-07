const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

/**
 * Capa COMÚN de publicación (`core/utils/flowInstrumentar.js`): dirigida por el contrato `ENTIDAD_FLUJO`, sin
 * que ningún test agregue una línea. Se prueba con Page Objects de juguete (sin Selenium).
 */
describe('utils/flowInstrumentar — publicación común de creadores / editores / eliminadores (unitario)', function () {
  let previo;
  let dir;

  const fresco = (ruta) => {
    const resuelta = require.resolve(ruta, { paths: [__dirname] });
    delete require.cache[resuelta];
    return require(resuelta);
  };

  /** Carga flowContext + flowInstrumentar EN FRÍO; con `plan` el flujo está activo, sin él todo es inerte. */
  function cargar({ plan = true } = {}) {
    if (plan) {
      fs.mkdirSync(dir, { recursive: true });
      const f = path.join(dir, 'plan.json');
      fs.writeFileSync(f, JSON.stringify({ bindings: [] }));
      process.env.TRIPLE_FLOW_PLAN = f;
    } else delete process.env.TRIPLE_FLOW_PLAN;
    const flowContext = fresco('../../context/flowContext');
    const { instrumentar } = fresco('../../utils/flowInstrumentar');
    class Base {
      constructor() {
        instrumentar(this);
      }
    }
    flowContext.setCasoActual('caso-uno');
    return { flowContext, Base };
  }

  before(function () {
    previo = process.env.TRIPLE_FLOW_PLAN;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'triple-instrumentar-'));
  });
  after(function () {
    if (previo === undefined) delete process.env.TRIPLE_FLOW_PLAN;
    else process.env.TRIPLE_FLOW_PLAN = previo;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creador + formulario con confirmador: la creación armada se publica al confirmar el guardado (datos leídos ANTES)', async function () {
    const { flowContext, Base } = cargar();
    class Listado extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'banco', referencia: 'nombre', creadores: ['crear'] };
      }
      async crear() {
        return 'form';
      }
    }
    let abierto = true;
    class Form extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'banco', referencia: 'nombre', metodos: [], confirmadores: [{ metodo: 'guardar', leer: 'antes', capturar: true }, { metodo: 'resultadoGuardado', datos: null }] };
      }
      async _datosFlujo() {
        if (!abierto) throw new Error('el formulario ya se cerró');
        return { nombre: 'BANCO-1' };
      }
      async guardar() {
        abierto = false;
        return { popupConfirmado: true };
      }
      async resultadoGuardado() {
        return { exito: true };
      }
    }
    await new Listado().crear();
    expect(flowContext.pendiente()).to.deep.include({ modo: 'crear', tipo: 'banco' });
    const form = new Form();
    await form.guardar();
    await form.resultadoGuardado();
    expect(flowContext.get('banco')).to.deep.equal({ nombre: 'BANCO-1' });
    expect(flowContext.pendiente()).to.equal(null);
  });

  it('un guardado que NO tuvo éxito no publica y deja la operación pendiente', async function () {
    const { flowContext, Base } = cargar();
    class Listado extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'x', referencia: 'nombre', creadores: ['crear'], confirmadores: [{ metodo: 'resultadoGuardado', leer: 'antes' }] };
      }
      async crear() {}
      async _datosFlujo() {
        return { nombre: 'N' };
      }
      async resultadoGuardado() {
        return { exito: false };
      }
    }
    const l = new Listado();
    await l.crear();
    await l.resultadoGuardado();
    expect(flowContext.get('x')).to.equal(undefined);
    expect(flowContext.pendiente()).to.not.equal(null);
  });

  it('un confirmador de OTRA entidad no resuelve la operación pendiente', async function () {
    const { flowContext, Base } = cargar();
    class A extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'a', referencia: 'n', creadores: ['crear'] };
      }
      async crear() {}
    }
    class B extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'b', referencia: 'n', metodos: [], confirmadores: [{ metodo: 'ok', leer: 'antes' }] };
      }
      async _datosFlujo() {
        return { n: 'B' };
      }
      async ok() {
        return { exito: true };
      }
    }
    await new A().crear();
    await new B().ok();
    expect(flowContext.get('b')).to.equal(undefined);
    expect(flowContext.get('a')).to.equal(undefined);
    expect(flowContext.pendiente().tipo).to.equal('a');
  });

  it('creador que PERSISTE: publica la referencia tomada de un argumento; con argumento+valor solo la entidad que corresponde', async function () {
    const { flowContext, Base } = cargar();
    class Detalle extends Base {
      static get ENTIDAD_FLUJO() {
        return [
          { tipo: 'educacion', referencia: 'nombre', metodos: [], creadores: [{ metodo: 'agregar', argumento: 0, valor: 'Educación', persiste: true, referenciaArg: '1.titulo' }] },
          { tipo: 'experiencia', referencia: 'nombre', metodos: [], creadores: [{ metodo: 'agregar', argumento: 0, valor: 'Experiencia', persiste: true, referenciaArg: '1.titulo' }] },
        ];
      }
      async agregar() {
        return { exito: true };
      }
    }
    const d = new Detalle();
    await d.agregar('Experiencia', { titulo: 'Gerente' });
    expect(flowContext.get('experiencia')).to.deep.equal({ nombre: 'Gerente' });
    expect(flowContext.get('educacion')).to.equal(undefined);
  });

  it('referenciaArg con :basename (archivo adjunto) y un fallo del método no publica', async function () {
    const { flowContext, Base } = cargar();
    class Adjuntos extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'doc', referencia: 'nombre', metodos: [], creadores: [{ metodo: 'adjuntar', persiste: true, referenciaArg: '0:stem' }] };
      }
      async adjuntar(ruta) {
        return { exito: ruta.includes('ok') };
      }
    }
    const a = new Adjuntos();
    await a.adjuntar('C:\\tmp\\falla.pdf');
    expect(flowContext.get('doc')).to.equal(undefined);
    await a.adjuntar('C:\\tmp\\ok.pdf');
    expect(flowContext.get('doc')).to.deep.equal({ nombre: 'ok' }); // sin extensión: la app puede renombrar el archivo
  });

  it('eliminador: tras eliminar con éxito la entidad deja de estar disponible (y se sabe quién la eliminó)', async function () {
    const { flowContext, Base } = cargar();
    class Detalle extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'cap', referencia: 'nombre', metodos: [], eliminadores: ['eliminar'] };
      }
      async eliminar(nombre) {
        return { exito: nombre !== 'MAL' };
      }
    }
    flowContext.publish('cap', { nombre: 'C1' }, 'creador');
    const d = new Detalle();
    await d.eliminar('MAL');
    expect(flowContext.get('cap')).to.deep.equal({ nombre: 'C1' });
    await d.eliminar('C1');
    expect(flowContext.get('cap')).to.equal(undefined);
    expect(flowContext.entidad('cap')).to.equal(undefined);
    expect(flowContext.eliminadaPor('cap')).to.equal('caso-uno');
    // si el test que eliminó FALLA (la app no confirmó nada), flowHooks deshace la eliminación
    flowContext.restaurarEliminacionesDe('caso-uno');
    expect(flowContext.get('cap')).to.deep.equal({ nombre: 'C1' });
    expect(flowContext.eliminadaPor('cap')).to.equal(undefined);
  });

  it('editor: abre la edición y el guardado confirmado ACTUALIZA la entidad (nueva versión)', async function () {
    const { flowContext, Base } = cargar();
    class Detalle extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'cap', referencia: 'nombre', metodos: [], editores: ['editar'], confirmadores: [{ metodo: 'guardar', leer: 'antes' }] };
      }
      async editar() {}
      async _datosFlujo() {
        return { nombre: 'C1-editada' };
      }
      async guardar() {
        return { exito: true };
      }
    }
    flowContext.publish('cap', { nombre: 'C1', extra: 1 }, 'creador');
    flowContext.setCasoActual('editar');
    const d = new Detalle();
    await d.editar();
    await d.guardar();
    expect(flowContext.get('cap')).to.deep.equal({ nombre: 'C1-editada', extra: 1 });
    expect(flowContext.entidad('cap').version).to.equal(2);
  });

  it('un test que guarda (captura) y pasa SIN pedir el resultado del guardado se resuelve al terminar (flowHooks)', async function () {
    const { flowContext, Base } = cargar();
    class Detalle extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'grupo', referencia: 'nombre', metodos: [], editores: ['editar'], confirmadores: [{ metodo: 'guardar', leer: 'antes', capturar: true }, { metodo: 'resultadoGuardado', datos: null }] };
      }
      async editar() {}
      async _datosFlujo() {
        return { nombre: 'G-nuevo' };
      }
      async guardar() {}
    }
    flowContext.publish('grupo', { nombre: 'G-viejo' }, 'creador');
    flowContext.setCasoActual('editar-grupo');
    const d = new Detalle();
    await d.editar();
    expect(flowContext.resolverPendienteGuardado()).to.equal(false); // aún no guardó
    await d.guardar();
    expect(flowContext.resolverPendienteGuardado()).to.equal(true);
    expect(flowContext.get('grupo')).to.deep.equal({ nombre: 'G-nuevo' });
  });

  it('cada subclase usa SU tipo aunque comparta el método de la base (listado de Configuración)', async function () {
    const { flowContext, Base } = cargar();
    class Listado extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: this.TIPO, referencia: 'nombre', creadores: ['crear'] };
      }
      async crear() {}
    }
    class Bancos extends Listado {
      static get TIPO() {
        return 'banco';
      }
    }
    class Puestos extends Listado {
      static get TIPO() {
        return 'puesto';
      }
    }
    await new Bancos().crear();
    expect(flowContext.pendiente().tipo).to.equal('banco');
    await new Puestos().crear();
    expect(flowContext.pendiente().tipo).to.equal('puesto');
  });

  it('INERTE fuera de un flujo: no envuelve nada ni publica', async function () {
    const { flowContext, Base } = cargar({ plan: false });
    class Listado extends Base {
      static get ENTIDAD_FLUJO() {
        return { tipo: 'banco', referencia: 'nombre', creadores: ['crear'] };
      }
      async crear() {
        return 'form';
      }
    }
    const original = Listado.prototype.crear;
    expect(await new Listado().crear()).to.equal('form');
    expect(Listado.prototype.crear).to.equal(original);
    expect(flowContext.activo()).to.equal(false);
    expect(flowContext.pendiente()).to.equal(null);
  });

  it('la publicación común y una publicación explícita posterior del mismo paso se FUSIONAN (sin versión nueva)', function () {
    const { flowContext } = cargar();
    flowContext.setCasoActual('crear');
    flowContext.publish('requisicion', { nombre: 'R1' });
    flowContext.publish('requisicion', { nombre: 'R1', puesto: 'Analista' });
    expect(flowContext.entidad('requisicion')).to.deep.include({ version: 1, productor: 'crear' });
    expect(flowContext.get('requisicion')).to.deep.equal({ nombre: 'R1', puesto: 'Analista' });
    flowContext.setCasoActual('otro-paso');
    flowContext.publish('requisicion', { nombre: 'R1', puesto: 'Gerente' });
    expect(flowContext.entidad('requisicion').version).to.equal(2); // otro paso: transformación normal
  });
});
