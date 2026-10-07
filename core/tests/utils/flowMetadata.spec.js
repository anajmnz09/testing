const { expect } = require('chai');
const { resolverMetadata } = require('../../utils/flowMetadata');
const { planificar } = require('../../utils/flowPlanner');

/**
 * Metadata efectiva = `produces` derivado del código + metadata mínima (`requires`, `orden`).
 * El escáner se inyecta (no se lee ningún archivo): lo que "dice el código" lo fija cada test.
 */
describe('utils/flowMetadata — código + metadata mínima (unitario)', function () {
  const sel = (...casos) => casos.map((caso) => ({ caso, archivo: `/x/${caso}.test.js` }));
  const codigo = (mapa) => (archivo) => {
    const caso = archivo.split('/').pop().replace('.test.js', '');
    return { produces: [], lecturas: [], indeterminado: [], ...(mapa[caso] || {}) };
  };
  const SOL = { tipo: 'solicitud', clave: 'codigo', campo: 'codigo' };

  it('deriva produces del código aunque la metadata no lo declare', function () {
    const r = resolverMetadata(sel('crear'), {}, { escanear: codigo({ crear: { produces: ['requisicion'] } }) });
    expect(r.errores).to.deep.equal([]);
    expect(r.metadata.crear.produces).to.deep.equal([{ tipo: 'requisicion' }]);
  });

  it('metadata y código coinciden (forma antigua) → todo correcto', function () {
    const r = resolverMetadata(sel('a'), { a: { produces: ['solicitud'] } }, { escanear: codigo({ a: { produces: ['solicitud'] } }) });
    expect(r.errores).to.deep.equal([]);
    expect(r.metadata.a.produces).to.deep.equal([{ tipo: 'solicitud' }]);
  });

  it('DISCREPANCIA (código dice empleado, metadata dice solicitud) → error de plan, no se elige uno en silencio', function () {
    const r = resolverMetadata(sel('a'), { a: { produces: ['solicitud'] } }, { escanear: codigo({ a: { produces: ['empleado'] } }) });
    expect(r.errores).to.have.length(1);
    expect(r.errores[0]).to.contain('Discrepancia de produces en "a"').and.contain('[empleado]').and.contain('[solicitud]');
  });

  it('la metadata declara produces pero el código no publica nada → discrepancia', function () {
    const r = resolverMetadata(sel('a'), { a: { produces: ['solicitud'] } }, { escanear: codigo({}) });
    expect(r.errores[0]).to.contain('el código publica [nada]');
  });

  it('un test sin produces (ni en código ni en metadata) no produce nada y no es un error', function () {
    const r = resolverMetadata(sel('consultar'), {}, { escanear: codigo({}) });
    expect(r.errores).to.deep.equal([]);
    expect(r.metadata.consultar.produces).to.deep.equal([]);
  });

  it('`orden` de la metadata se combina con los tipos derivados del código', function () {
    const r = resolverMetadata(sel('p'), { p: { requires: [SOL], orden: { solicitud: 20 } } }, { escanear: codigo({ p: { produces: ['solicitud'] } }) });
    expect(r.errores).to.deep.equal([]);
    expect(r.metadata.p.produces).to.deep.equal([{ tipo: 'solicitud', orden: 20 }]);
    expect(r.metadata.p.requires).to.deep.equal([SOL]);
  });

  it('`orden` para un tipo que el test no produce → error', function () {
    const r = resolverMetadata(sel('p'), { p: { orden: { empleado: 10 } } }, { escanear: codigo({ p: { produces: ['solicitud'] } }) });
    expect(r.errores[0]).to.contain('orden para "empleado"');
  });

  it('forma antigua produces:[{tipo, orden}] sigue funcionando (compatibilidad)', function () {
    const r = resolverMetadata(sel('p'), { p: { produces: [{ tipo: 'solicitud', orden: 30 }] } }, { escanear: codigo({ p: { produces: ['solicitud'] } }) });
    expect(r.errores).to.deep.equal([]);
    expect(r.metadata.p.produces).to.deep.equal([{ tipo: 'solicitud', orden: 30 }]);
  });

  it('uso INDETERMINADO de flowContext + produces declarado → usa lo declarado y avisa', function () {
    const esc = codigo({ d: { indeterminado: [{ linea: 7, motivo: 'tipo no literal' }] } });
    const r = resolverMetadata(sel('d'), { d: { produces: ['solicitud'] } }, { escanear: esc });
    expect(r.errores).to.deep.equal([]);
    expect(r.metadata.d.produces).to.deep.equal([{ tipo: 'solicitud' }]);
    expect(r.avisos.join(' ')).to.contain('no se puede determinar estáticamente').and.contain('línea 7');
  });

  it('uso INDETERMINADO sin produces declarado → no produce nada (y avisa)', function () {
    const esc = codigo({ d: { indeterminado: [{ linea: 2, motivo: 'alias' }] } });
    const r = resolverMetadata(sel('d'), {}, { escanear: esc });
    expect(r.metadata.d.produces).to.deep.equal([]);
    expect(r.avisos.join(' ')).to.contain('no declara produces');
  });

  it('si no hay archivo que escanear, se usa lo declarado', function () {
    const r = resolverMetadata([{ caso: 'a' }], { a: { produces: ['x'] } }, { escanear: () => { throw new Error('no debería llamarse'); } });
    expect(r.metadata.a.produces).to.deep.equal([{ tipo: 'x' }]);
  });

  it('INTEGRACIÓN con el planner: entrevistas desordenadas se corrigen con produces derivado + orden', function () {
    const cod = codigo({
      crear: { produces: ['solicitud'] },
      primera: { produces: ['solicitud'] },
      segunda: { produces: ['solicitud'] },
      tercera: { produces: ['solicitud'] },
    });
    const declarada = {
      crear: {},
      primera: { requires: [SOL], orden: { solicitud: 20 } },
      segunda: { requires: [SOL], orden: { solicitud: 30 } },
      tercera: { requires: [SOL], orden: { solicitud: 40 } },
    };
    const seleccion = sel('tercera', 'primera', 'segunda', 'crear');
    const { metadata, errores } = resolverMetadata(seleccion, declarada, { escanear: cod });
    expect(errores).to.deep.equal([]);
    const plan = planificar(seleccion, metadata);
    expect(plan.errores).to.deep.equal([]);
    expect(plan.orden.map((x) => x.caso)).to.deep.equal(['crear', 'primera', 'segunda', 'tercera']);
  });

  describe('requires: detectado + declarado en el código + metadata', function () {
    const esc = (extra) => codigo({ t: { produces: [], ...extra } });
    const DECL = { clave: 'codigo', entidad: 'solicitud', campo: 'codigo' };

    it('lectura tipada → requires { tipo } (ordena, sin binding)', function () {
      const r = resolverMetadata(sel('t'), {}, { escanear: esc({ lecturas: ['solicitud'] }) });
      expect(r.errores).to.deep.equal([]);
      expect(r.metadata.t.requires).to.deep.equal([{ tipo: 'solicitud' }]);
    });

    it('clave declarada en el código → requires con clave y campo, sin metadata manual', function () {
      const r = resolverMetadata(sel('t'), {}, { escanear: esc({ declaraciones: [DECL] }) });
      expect(r.metadata.t.requires).to.deep.equal([SOL]);
    });

    it('lectura tipada + declaración de la misma entidad → un solo requires (con la clave)', function () {
      const r = resolverMetadata(sel('t'), {}, { escanear: esc({ lecturas: ['solicitud'], declaraciones: [DECL] }) });
      expect(r.errores).to.deep.equal([]);
      expect(r.metadata.t.requires).to.deep.equal([SOL]);
    });

    it('lo mismo declarado en el código y en la metadata (forma antigua) → sin duplicar', function () {
      const r = resolverMetadata(sel('t'), { t: { requires: [SOL] } }, { escanear: esc({ declaraciones: [DECL] }) });
      expect(r.errores).to.deep.equal([]);
      expect(r.metadata.t.requires).to.deep.equal([SOL]);
    });

    it('CONTRADICCIÓN: el código lee solicitud pero se declara empleado → error de plan', function () {
      const r = resolverMetadata(sel('t'), {}, { escanear: esc({ lecturas: ['solicitud'], declaraciones: [{ clave: 'codigo', entidad: 'empleado', campo: 'codigo' }] }) });
      expect(r.errores).to.have.length(1);
      expect(r.errores[0]).to.contain('Contradicción de requires').and.contain('[solicitud]').and.contain('"empleado"');
    });

    it('CONTRADICCIÓN: la misma clave con otra entidad/campo en el código y en la metadata → error', function () {
      const r = resolverMetadata(sel('t'), { t: { requires: [{ tipo: 'empleado', clave: 'codigo', campo: 'codigo' }] } }, { escanear: esc({ declaraciones: [DECL] }) });
      expect(r.errores[0]).to.contain('la clave "codigo"').and.contain('solicitud.codigo').and.contain('empleado.codigo');
    });

    it('declaración inválida (entidad sin campo) → error', function () {
      const r = resolverMetadata(sel('t'), {}, { escanear: esc({ invalidas: [{ linea: 3, motivo: 'declaración de flujo incompleta o no literal en "x"' }] }) });
      expect(r.errores[0]).to.contain('incompleta');
    });

    it('una clave suelta o sin señales NO crea requires (no hay deducción por nombre)', function () {
      const r = resolverMetadata(sel('t'), {}, { escanear: esc({ claves: ['codigo', 'nombre', 'Requisición'] }) });
      expect(r.metadata.t.requires).to.equal(undefined);
      expect(r.errores).to.deep.equal([]);
    });

    it('INTEGRACIÓN con el planner: requires del código + orden mínimo ordenan las entrevistas desordenadas', function () {
      const cod = codigo({
        crear: { produces: ['solicitud'] },
        e1: { produces: ['solicitud'], declaraciones: [DECL] },
        e2: { produces: ['solicitud'], declaraciones: [DECL] },
      });
      const seleccion = sel('e2', 'e1', 'crear');
      const { metadata, errores } = resolverMetadata(seleccion, { e1: { orden: { solicitud: 20 } }, e2: { orden: { solicitud: 30 } } }, { escanear: cod });
      expect(errores).to.deep.equal([]);
      const plan = planificar(seleccion, metadata);
      expect(plan.errores).to.deep.equal([]);
      expect(plan.orden.map((x) => x.caso)).to.deep.equal(['crear', 'e1', 'e2']);
      expect(plan.bindings).to.have.length(2);
    });
  });
});
