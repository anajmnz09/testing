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

  describe('producción estructural: crear / editar / eliminar', function () {
    const esc2 = (mapa) => (archivo) => ({ produces: [], lecturas: [], claves: [], declaraciones: [], estructurales: [], creaciones: [], ediciones: [], eliminaciones: [], confirmaciones: [], confirmables: [], exclusiones: [], invalidas: [], indeterminado: [], ...(mapa[archivo.split('/').pop().replace('.test.js', '')] || {}) });
    const crea = (entidad, extra = {}) => ({ entidad, via: 'P.crear', linea: 0, ...extra });
    const consume = { estructurales: [{ clave: 'k', entidad: 'padre', campo: 'nombre', via: 'P.abrirDetalle', linea: 0 }] };

    it('una creación estructural hace productor al test (sin publish ni metadata)', function () {
      const r = resolverMetadata(sel('c'), {}, { escanear: esc2({ c: { creaciones: [crea('banco')] } }) });
      expect(r.errores).to.deep.equal([]);
      expect(r.metadata.c.produces).to.deep.equal([{ tipo: 'banco' }]);
    });

    it('una creación de respaldo (el test también consume ese tipo) NO lo vuelve productor', function () {
      const r = resolverMetadata(sel('c'), {}, {
        escanear: esc2({ c: { creaciones: [crea('doc')], estructurales: [{ clave: 'd', entidad: 'doc', campo: 'nombre', via: 'P.d', linea: 0 }] } }),
      });
      expect(r.metadata.c.produces).to.deep.equal([]);
      expect(r.derivado.c.respaldo).to.deep.equal(['doc']);
    });

    it('si el guardado lo confirma una capa común, abrir el formulario sin confirmarlo no cuenta como creación ni edición', function () {
      const sin = resolverMetadata(sel('c'), {}, { escanear: esc2({ c: { creaciones: [crea('banco')], ediciones: [crea('banco')], confirmables: ['banco'] } }) });
      expect(sin.metadata.c.produces).to.deep.equal([]);
      const con = resolverMetadata(sel('c'), {}, { escanear: esc2({ c: { creaciones: [crea('banco')], confirmables: ['banco'], confirmaciones: [{ entidad: 'banco', via: 'F.guardar', linea: 0 }] } }) });
      expect(con.metadata.c.produces).to.deep.equal([{ tipo: 'banco' }]);
    });

    it('un creador `persiste` no necesita confirmación', function () {
      const r = resolverMetadata(sel('c'), {}, { escanear: esc2({ c: { creaciones: [crea('edu', { persiste: true })], confirmables: ['edu'] } }) });
      expect(r.metadata.c.produces).to.deep.equal([{ tipo: 'edu' }]);
    });

    it('editar = transformación: requires + produces la misma entidad', function () {
      const r = resolverMetadata(sel('e'), {}, {
        escanear: esc2({ e: { ediciones: [crea('padre')], confirmaciones: [{ entidad: 'padre', via: 'F.g', linea: 0 }], ...consume } }),
      });
      expect(r.metadata.e.produces).to.deep.equal([{ tipo: 'padre' }]);
      expect(r.metadata.e.requires.map((q) => q.tipo)).to.deep.equal(['padre']);
    });

    it('eliminar queda en `elimina` y NO produce', function () {
      const r = resolverMetadata(sel('d'), {}, { escanear: esc2({ d: { eliminaciones: [{ entidad: 'padre', via: 'P.e', linea: 0 }], ...consume } }) });
      expect(r.metadata.d.elimina).to.deep.equal(['padre']);
      expect(r.metadata.d.produces).to.deep.equal([]);
    });

    it('CONTRADICCIÓN: la estructura crea "banco" pero el test publica otra entidad que no consume → error de plan', function () {
      const r = resolverMetadata(sel('c'), {}, { escanear: esc2({ c: { creaciones: [crea('banco')], produces: ['empleado'] } }) });
      expect(r.errores[0]).to.contain('Contradicción de produces').and.contain('banco').and.contain('empleado');
    });

    it('una publicación explícita SIN operación estructural es válida (cambio de etapa que crea un empleado)', function () {
      const r = resolverMetadata(sel('x'), {}, { escanear: esc2({ x: { produces: ['empleado'], lecturas: ['solicitud'] } }) });
      expect(r.errores).to.deep.equal([]);
      expect(r.metadata.x.produces).to.deep.equal([{ tipo: 'empleado' }]);
    });

    it('un test que publica la misma entidad que crea estructuralmente no se duplica', function () {
      const r = resolverMetadata(sel('c'), {}, { escanear: esc2({ c: { creaciones: [crea('requisicion')], produces: ['requisicion'] } }) });
      expect(r.errores).to.deep.equal([]);
      expect(r.metadata.c.produces).to.deep.equal([{ tipo: 'requisicion' }]);
    });

    it('INTEGRACIÓN con el planner: C(consumidor), D(eliminador), A(creador), B(transformador) → A, B, C, D', function () {
      const e = esc2({
        A: { creaciones: [crea('padre')], confirmaciones: [{ entidad: 'padre', via: 'x', linea: 0 }] },
        B: { ediciones: [crea('padre')], confirmaciones: [{ entidad: 'padre', via: 'x', linea: 0 }], ...consume },
        C: { ...consume },
        D: { eliminaciones: [{ entidad: 'padre', via: 'P.e', linea: 0 }], ...consume },
      });
      const seleccion = sel('D', 'C', 'B', 'A');
      const { metadata, errores } = resolverMetadata(seleccion, {}, { escanear: e });
      expect(errores).to.deep.equal([]);
      const plan = planificar(seleccion, metadata);
      expect(plan.errores).to.deep.equal([]);
      expect(plan.orden.map((x) => x.caso)).to.deep.equal(['A', 'B', 'C', 'D']);
      expect(plan.elimina.D).to.deep.equal(['padre']);
    });

    it('dos eliminadores de la misma entidad → error de plan; dos creadores con consumidor → ambigüedad (se mantiene)', function () {
      const e = esc2({
        D1: { eliminaciones: [{ entidad: 'padre', via: 'x', linea: 0 }], ...consume },
        D2: { eliminaciones: [{ entidad: 'padre', via: 'x', linea: 0 }], ...consume },
        A1: { creaciones: [crea('padre')] },
        A2: { creaciones: [crea('padre')] },
        K: { ...consume },
      });
      const s1 = sel('D1', 'D2');
      expect(planificar(s1, resolverMetadata(s1, {}, { escanear: e }).metadata).errores.join(' ')).to.contain('Eliminación múltiple');
      const s2 = sel('A1', 'A2', 'K');
      expect(planificar(s2, resolverMetadata(s2, {}, { escanear: e }).metadata).errores.join(' ')).to.contain('Ambigüedad');
    });
  });
});
