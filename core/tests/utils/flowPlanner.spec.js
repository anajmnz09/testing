const { expect } = require('chai');
const { planificar } = require('../../utils/flowPlanner');

const sel = (...casos) => casos.map((caso) => ({ caso }));
const orden = (p) => p.orden.map((s) => s.caso);
const req = (tipo, extra = {}) => ({ tipo, clave: tipo, campo: tipo, ...extra });

describe('utils/flowPlanner (unitario)', function () {
  const cadena = {
    A: { produces: ['requisicion'] },
    B: { requires: [req('requisicion')], produces: ['solicitud'] },
    C: { requires: [req('solicitud')], produces: ['empleado'] },
    D: { requires: [req('empleado')] },
  };

  it('Caso A: cadena completa en orden A → B → C → D', function () {
    const p = planificar(sel('A', 'B', 'C', 'D'), cadena);
    expect(p.errores).to.deep.equal([]);
    expect(orden(p)).to.deep.equal(['A', 'B', 'C', 'D']);
  });

  it('reordena una selección desordenada (D, A, C, B) por dependencias', function () {
    expect(orden(planificar(sel('D', 'A', 'C', 'B'), cadena))).to.deep.equal(['A', 'B', 'C', 'D']);
  });

  it('Caso B: flujo que empieza a mitad (sin A) funciona si hay automático', function () {
    const p = planificar(sel('B', 'C'), cadena);
    expect(p.errores).to.deep.equal([]);
    expect(orden(p)).to.deep.equal(['B', 'C']);
    expect(p.avisos.join(' ')).to.contain('"B" requiere "requisicion" sin productor');
  });

  it('Caso C: independientes conservan el orden de selección', function () {
    const m = { A: { produces: ['requisicion'] }, X: { produces: ['configuracion'] }, D: {} };
    expect(orden(planificar(sel('X', 'D', 'A'), m))).to.deep.equal(['X', 'D', 'A']);
  });

  it('Caso D: productor no seleccionado → el consumidor sigue (automático)', function () {
    const p = planificar(sel('B'), cadena);
    expect(p.errores).to.deep.equal([]);
    expect(orden(p)).to.deep.equal(['B']);
  });

  it('Caso E: sin productor y sin automático → error de diagnóstico', function () {
    const m = { B: { requires: [req('entidadX', { auto: false })] } };
    const p = planificar(sel('B'), m);
    expect(p.errores).to.have.length(1);
    expect(p.errores[0]).to.contain('"B" requiere "entidadX"');
  });

  it('Caso E: sin productor pero con automático → aviso, no error', function () {
    const m = { B: { requires: [req('entidadX')] } };
    const p = planificar(sel('B'), m);
    expect(p.errores).to.deep.equal([]);
    expect(p.avisos.join(' ')).to.contain('"B" requiere "entidadX"').and.contain('automático');
  });

  it('un requires SIN clave (consumo detectado por lectura tipada) ordena pero no crea binding', function () {
    const m = { A: { produces: ['solicitud'] }, B: { requires: [{ tipo: 'solicitud' }] } };
    const p = planificar(sel('B', 'A'), m, { claveConocida: () => false });
    expect(p.errores).to.deep.equal([]);
    expect(orden(p)).to.deep.equal(['A', 'B']);
    expect(p.bindings).to.deep.equal([]);
    expect(p.avisos).to.deep.equal([]);
  });

  it('varios originadores del mismo tipo con consumidor → error de ambigüedad', function () {
    const m = { A: { produces: ['requisicion'] }, B: { produces: ['requisicion'] }, C: { requires: [req('requisicion')] } };
    const p = planificar(sel('A', 'B', 'C'), m);
    expect(p.errores.join(' ')).to.contain('Ambigüedad').and.contain('A, B');
  });

  it('varios originadores SIN consumidor no son ambiguos', function () {
    const m = { A: { produces: ['requisicion'] }, B: { produces: ['requisicion'] } };
    expect(planificar(sel('A', 'B'), m).errores).to.deep.equal([]);
  });

  it('transformaciones solicitud → solicitud NO son ciclo y se encadenan', function () {
    const m = {
      crear: { requires: [req('requisicion')], produces: ['solicitud'] },
      e1: { requires: [req('solicitud')], produces: ['solicitud'] },
      e2: { requires: [req('solicitud')], produces: ['solicitud'] },
      empleado: { requires: [req('solicitud')], produces: ['empleado'] },
    };
    const p = planificar(sel('e2', 'empleado', 'e1', 'crear'), m);
    expect(p.errores).to.deep.equal([]);
    expect(orden(p)).to.have.length(4);
    expect(orden(p)[0]).to.equal('crear');
    expect(orden(p)[3]).to.equal('empleado');
  });

  describe('orden explícito de la secuencia de transformación (`produces: [{ tipo, orden }]`)', function () {
    const S = req('solicitud');
    const trans = (orden) => ({ requires: [S], produces: [{ tipo: 'solicitud', orden }] });
    const m = {
      crear: { produces: ['solicitud'] },
      primera: trans(20),
      segunda: trans(30),
      tercera: trans(40),
      oferta: trans(50),
      empleado: { requires: [S], produces: ['empleado'] },
    };

    it('corrige entrevistas elegidas desordenadas: Tercera, Primera, Segunda → Primera, Segunda, Tercera', function () {
      const p = planificar(sel('tercera', 'primera', 'segunda'), m);
      expect(p.errores).to.deep.equal([]);
      expect(orden(p)).to.deep.equal(['primera', 'segunda', 'tercera']);
    });

    it('con el resto de la cadena, en cualquier orden de selección', function () {
      const p = planificar(sel('empleado', 'oferta', 'tercera', 'primera', 'crear', 'segunda'), m);
      expect(orden(p)).to.deep.equal(['crear', 'primera', 'segunda', 'tercera', 'oferta', 'empleado']);
    });

    it('si falta un paso (sin Segunda) igual respeta el orden de los que hay', function () {
      expect(orden(planificar(sel('tercera', 'primera'), m))).to.deep.equal(['primera', 'tercera']);
    });

    it('un transformador SIN orden conserva el orden de selección y no se mezcla con los ordenados', function () {
      const m2 = { ...m, libre1: { requires: [S], produces: ['solicitud'] }, libre2: { requires: [S], produces: ['solicitud'] } };
      const p = planificar(sel('libre2', 'tercera', 'libre1', 'primera'), m2);
      const o = orden(p);
      expect(o.indexOf('primera')).to.be.lessThan(o.indexOf('tercera'));
      expect(o.indexOf('libre2')).to.be.lessThan(o.indexOf('libre1'));
      expect(p.errores).to.deep.equal([]);
    });

    it('el mismo orden en dos pasos avisa y desempata por selección', function () {
      const p = planificar(sel('b', 'a'), { a: trans(20), b: trans(20) });
      expect(orden(p)).to.deep.equal(['b', 'a']);
      expect(p.avisos.join(' ')).to.contain('mismo orden');
    });

    it('`produce` sigue exponiendo solo los tipos (strings), para el runtime', function () {
      expect(planificar(sel('primera'), m).produce).to.deep.equal({ primera: ['solicitud'] });
    });

    it('no es un ciclo ni un error: es una transformación de la misma entidad', function () {
      expect(planificar(sel('segunda', 'primera'), m).errores).to.deep.equal([]);
    });
  });

  it('detecta dependencias circulares', function () {
    const m = {
      A: { requires: [req('y')], produces: ['x'] },
      B: { requires: [req('x')], produces: ['y'] },
    };
    const p = planificar(sel('A', 'B'), m);
    expect(p.errores.join(' ')).to.contain('circular');
  });

  it('rechaza un caso seleccionado dos veces', function () {
    expect(planificar(sel('A', 'A'), cadena).errores.join(' ')).to.contain('más de una vez');
  });

  it('avisa (sin romper) si un binding apunta a una clave que no existe en el contexto del caso', function () {
    const m = { B: { requires: [req('requisicion', { clave: 'Clave vieja' })] } };
    const p = planificar(sel('B'), m, { claveConocida: () => false });
    expect(p.errores).to.deep.equal([]);
    expect(p.avisos.join(' ')).to.contain('"Clave vieja" no figura en su Execution Context');
    // sin poder saberlo (sección aún no sembrada) no avisa
    expect(planificar(sel('B'), m, { claveConocida: () => null }).avisos.join(' ')).to.not.contain('no figura');
  });

  it('un caso SIN metadata es un paso independiente y no rompe el plan', function () {
    const p = planificar(sel('X', 'A'), { A: { produces: ['requisicion'] } });
    expect(p.errores).to.deep.equal([]);
    expect(orden(p)).to.deep.equal(['X', 'A']);
  });

  it('expone bindings, productores y requiere para el runtime', function () {
    const p = planificar(sel('A', 'B'), cadena);
    expect(p.bindings).to.deep.include({ caso: 'B', clave: 'requisicion', tipo: 'requisicion', campo: 'requisicion' });
    expect(p.productores).to.deep.equal({ requisicion: ['A'], solicitud: ['B'] });
    expect(p.requiere.B).to.deep.equal([{ tipo: 'requisicion', clave: 'requisicion' }]);
  });
});
