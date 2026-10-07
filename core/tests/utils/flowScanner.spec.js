const { expect } = require('chai');
const { escanearFuente } = require('../../utils/flowScanner');

const IMPORTA = "const flowContext = require('@triple/core/context/flowContext');\n";
const scan = (cuerpo, importa = IMPORTA) => escanearFuente(importa + cuerpo);

describe('utils/flowScanner — produces derivado del código, sin ejecutar el test (unitario)', function () {
  describe('lo que se detecta con certeza', function () {
    it('flowContext.publish con tipo literal', function () {
      const r = scan("flowContext.publish('requisicion', { nombre });");
      expect(r.produces).to.deep.equal(['requisicion']);
      expect(r.indeterminado).to.deep.equal([]);
    });

    it('flowContext.update con tipo literal (comillas dobles y backticks sin ${})', function () {
      expect(scan('flowContext.update("solicitud", { a: 1 });').produces).to.deep.equal(['solicitud']);
      expect(scan('flowContext.update(`solicitud`, { a: 1 });').produces).to.deep.equal(['solicitud']);
    });

    it('tolera saltos de línea y espacios entre el receptor, el método y el argumento', function () {
      const r = scan("flowContext\n  .publish(\n    'empleado',\n    { codigo }\n  );");
      expect(r.produces).to.deep.equal(['empleado']);
    });

    it('varias llamadas: tipos únicos, en orden de aparición', function () {
      const r = scan("flowContext.publish('a', {});\nflowContext.update('b', {});\nflowContext.update('a', {});");
      expect(r.produces).to.deep.equal(['a', 'b']);
    });

    it('una llamada dentro de un if/función sigue siendo estática', function () {
      const r = scan("if (flowContext.activo()) {\n  flowContext.publish('solicitud', {});\n}");
      expect(r.produces).to.deep.equal(['solicitud']);
    });

    it('un test sin publicar nada no produce nada', function () {
      const r = scan("describe('x', () => { it('y', async () => {}); });");
      expect(r.produces).to.deep.equal([]);
      expect(r.indeterminado).to.deep.equal([]);
    });

    it('las lecturas explícitas flowContext.get/entidad se reportan (evidencia informativa)', function () {
      expect(scan("const s = flowContext.get('solicitud'); flowContext.entidad('x');").lecturas).to.deep.equal(['solicitud', 'x']);
    });
  });

  describe('lo que NO cuenta (falsos positivos)', function () {
    it('una llamada en un comentario de línea o de bloque', function () {
      const r = scan("// flowContext.publish('falso', {});\n/* flowContext.update('falso2', {}); */\n");
      expect(r.produces).to.deep.equal([]);
    });

    it('una llamada dentro de un string, un template o una regex', function () {
      const r = scan("const a = \"flowContext.publish('x', 1)\";\nconst b = `flowContext.update('y', 2)`;\nconst c = /flowContext\\.publish\\('z'/;\n");
      expect(r.produces).to.deep.equal([]);
      expect(r.indeterminado).to.deep.equal([]);
    });

    it('un // dentro de un string (URL) no se toma por comentario', function () {
      const r = scan("const u = 'https://x.test/a'; flowContext.publish('real', {});");
      expect(r.produces).to.deep.equal(['real']);
    });

    it('un método con otro nombre (flowContext.publicado, .actualizar) no cuenta', function () {
      expect(scan("flowContext.publicado('x'); flowContext.actualizar('y');").produces).to.deep.equal([]);
    });

    it('otro receptor llamado igual (otro.publish) no cuenta', function () {
      expect(scan("evento.publish('x'); bus.update('y');").produces).to.deep.equal([]);
    });
  });

  describe('lo que NO se puede determinar estáticamente (se reporta, no se adivina)', function () {
    it('tipo en una variable', function () {
      const r = scan("const tipo = 'solicitud'; flowContext.publish(tipo, {});");
      expect(r.produces).to.deep.equal([]);
      expect(r.indeterminado).to.have.length(1);
      expect(r.indeterminado[0].motivo).to.contain('no es un string literal');
      expect(r.indeterminado[0].linea).to.equal(2);
    });

    it('tipo en una plantilla con interpolación o concatenado', function () {
      expect(scan('flowContext.publish(`a${b}`, {});').indeterminado).to.have.length(1);
      expect(scan("flowContext.publish('a' + b, {});").indeterminado).to.have.length(1);
    });

    it('acceso por corchetes', function () {
      expect(scan("flowContext['publish']('x', {});").indeterminado.length).to.be.greaterThan(0);
    });

    it('alias: flowContext asignado, pasado como valor o importado con otro nombre', function () {
      expect(scan("const fc = flowContext; fc.publish('x', {});").indeterminado.length).to.be.greaterThan(0);
      expect(scan('ayuda(flowContext);').indeterminado.length).to.be.greaterThan(0);
      expect(scan("fc.publish('x', {});", "const fc = require('@triple/core/context/flowContext');\n").indeterminado.length).to.be.greaterThan(0);
    });

    it('publish/update desestructurados o llamados sobre require(...) en línea', function () {
      expect(scan("publish('x', {});", "const { publish } = require('@triple/core/context/flowContext');\n").indeterminado.length).to.be.greaterThan(0);
      expect(scan("", "require('@triple/core/context/flowContext').publish('x', {});\n").indeterminado.length).to.be.greaterThan(0);
    });

    it('usar flowContext solo para activo()/get() NO es indeterminado', function () {
      const r = scan("if (flowContext.activo()) { const s = flowContext.get('solicitud'); }");
      expect(r.indeterminado).to.deep.equal([]);
    });
  });

  describe('requires: lo que el código demuestra', function () {
    it('lectura tipada con literal: flowContext.get/entidad(\'solicitud\') → lecturas', function () {
      const r = scan("const s = flowContext.get('solicitud'); const e = flowContext.entidad('empleado');");
      expect(r.lecturas).to.deep.equal(['solicitud', 'empleado']);
    });

    it('una lectura con tipo no literal NO se convierte en requires (no se adivina)', function () {
      const r = scan('const t = elegir(); flowContext.get(t);');
      expect(r.lecturas).to.deep.equal([]);
    });

    it('registrarCaso: clave con entidad+campo se detecta; una clave suelta NO dice de qué entidad es', function () {
      const r = scan("testContext.registrarCaso(CASO, ['codigo', { clave: 'cod2', entidad: 'solicitud', campo: 'codigo' }, { clave: 'm', multivalor: true }]);");
      expect(r.claves).to.deep.equal(['codigo', 'cod2', 'm']);
      expect(r.declaraciones).to.deep.equal([{ clave: 'cod2', entidad: 'solicitud', campo: 'codigo', linea: 2 }]);
      expect(r.invalidas).to.deep.equal([]);
    });

    it('auto:false se conserva; entidad sin campo (o no literal) es una declaración INVÁLIDA', function () {
      const r = scan("registrarCaso(CASO, [{ clave: 'a', entidad: 'x', campo: 'y', auto: false }, { clave: 'b', entidad: 'x' }, { clave: 'c', entidad: T, campo: 'y' }]);");
      expect(r.declaraciones.map((d) => [d.clave, d.auto])).to.deep.equal([['a', false]]);
      expect(r.invalidas).to.have.length(2);
    });

    it('ignora declaraciones dentro de comentarios y strings', function () {
      const r = scan("// registrarCaso(CASO, [{ clave: 'a', entidad: 'x', campo: 'y' }]);\nconst t = \"registrarCaso(CASO, [{ clave: 'b', entidad: 'x', campo: 'y' }])\";");
      expect(r.declaraciones).to.deep.equal([]);
    });

    it('ESTRATEGIAS de un Page Object: entradas con entidad+campo', function () {
      const { leerEstrategias } = require('../../utils/flowScanner');
      const r = leerEstrategias("const ESTRATEGIAS = {\n  'Tipo ID': 'directSelect',\n  Requisición: { estrategia: 'searchAndSelect', entidad: 'requisicion', campo: 'nombre' },\n  Etiquetas: { estrategia: 'custom', fn: (f, l, v) => f.x(l, v) },\n};");
      expect(r.declaraciones).to.deep.equal([{ clave: 'Requisición', entidad: 'requisicion', campo: 'nombre', linea: 1 }]);
    });
  });

  describe('campos que publica una entidad', function () {
    it('objeto literal: sus claves de primer nivel (con shorthand), unidas entre publish y update', function () {
      const r = scan("flowContext.publish('s', { codigo: a, nombre, extra: { x: 1 } }); flowContext.update('s', { etapa: 'E' });");
      expect(r.camposPublicados).to.deep.equal({ s: ['codigo', 'nombre', 'extra', 'etapa'] });
    });

    it('con spread o variable: null (no se puede validar el campo)', function () {
      expect(scan("flowContext.publish('s', { ...base, a: 1 });").camposPublicados).to.deep.equal({ s: null });
      expect(scan("flowContext.publish('s', datos);").camposPublicados).to.deep.equal({ s: null });
    });
  });
});
