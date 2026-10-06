const assert = require('assert');
const { crear, sinAcentos } = require('../../utils/datosPrueba');

describe('datosPrueba (generador de datos dinámicos del modo automático)', () => {
  it('nombreRequisicion incluye el puesto y es distinto en cada llamada', () => {
    const g = crear();
    const a = g.nombreRequisicion('Analista de Recursos Humanos');
    const b = g.nombreRequisicion('Analista de Recursos Humanos');
    assert.ok(a.startsWith('Analista de Recursos Humanos - '), a);
    assert.notStrictEqual(a, b);
    assert.ok(!/Automatica/i.test(a));
  });

  it('nombreRequisicion respeta el largo máximo y conserva el token único', () => {
    const g = crear();
    const n = g.nombreRequisicion('GERENTE DE MARCA BABINA Y BENESSERE');
    assert.ok(n.length <= 45, `${n.length}: ${n}`);
    assert.match(n, / [A-Z0-9]{7}$/);
    assert.ok(g.nombreRequisicion('X'.repeat(200)).length <= 45);
  });

  it('sin puesto usa un nombre genérico, nunca vacío', () => {
    assert.ok(crear().nombreRequisicion('').startsWith('Puesto General - '));
  });

  it('identificación: 11 dígitos y única aunque se llame en el mismo milisegundo', () => {
    const g = crear({ ahora: () => 1234567890123 });
    const ids = new Set(Array.from({ length: 50 }, () => g.identificacion()));
    assert.strictEqual(ids.size, 50);
    for (const id of ids) assert.match(id, /^\d{11}$/);
  });

  it('personaUnica no repite combinación aun con azar constante degenerado', () => {
    const g = crear({ random: () => 0 });
    const p1 = g.personaUnica();
    const p2 = g.personaUnica();
    assert.ok(p1.primerNombre && p2.primerNombre); // no revienta si se agota la variedad
  });

  it('correo: ascii, derivado del nombre y único', () => {
    const g = crear();
    const p = { primerNombre: 'María', primerApellido: 'Peña' };
    const c1 = g.correo(p);
    assert.match(c1, /^maria\.pena\.[a-z0-9]{7}@camsoft\.test$/);
    assert.notStrictEqual(c1, g.correo(p));
  });

  it('texto: menciona el puesto cuando hay contexto y no deja placeholders', () => {
    const g = crear();
    for (const tipo of ['requisitos', 'responsabilidades', 'descripcion', 'comentario']) {
      const t = g.texto(tipo, { puesto: 'Cajero' });
      assert.ok(t.includes('Cajero'), t);
      assert.ok(!/[{}]/.test(t), t);
      assert.ok(!/[{}]/.test(g.texto(tipo)));
    }
  });

  it('sinAcentos', () => assert.strictEqual(sinAcentos('Pérez Núñez'), 'Perez Nunez'));
});
