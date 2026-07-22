const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { crearProyecto } = require('../support/proyectoTemporal');
const { crearDriver, PNG_BASE64 } = require('../support/fakeDriver');

/**
 * Evidencias.
 *
 * Lo observable: dónde queda el archivo, con qué nombre, y QUÉ se adjunta al
 * reporte (Data URI embebido para imágenes, contenido para texto/JSON,
 * referencia por ruta para lo que Mochawesome no sabe mostrar).
 *
 * Se usa un "contexto de Mocha" simulado —un objeto con la misma forma que el
 * `this` de un it()— y se verifica el `context` que Mochawesome le cuelga.
 */
describe('evidence (unitario)', function () {
  let proyecto;
  let evidence;
  let paths;

  /** Contexto equivalente al `this` de un it(), como espera addContext. */
  function contextoDeMocha(titulo = 'Suite caso: hace algo') {
    const test = { title: titulo, fullTitle: () => titulo, type: 'test' };
    return { test, currentTest: test };
  }

  const adjuntos = (ctx) => [].concat(ctx.test.context || []);

  beforeEach(function () {
    proyecto = crearProyecto();
    paths = proyecto.importar('../../utils/paths');
    evidence = proyecto.importar('../../utils/evidence');
  });

  afterEach(function () {
    proyecto.limpiar();
  });

  describe('guardado de archivos', function () {
    it('guarda la evidencia agrupada en una carpeta por test', function () {
      const ctx = contextoDeMocha('Reclutamiento pausar-requisicion: pausa una requisición');
      const ruta = evidence.saveEvidenceBuffer('json', ctx, '{"a":1}', {
        label: 'estado-final',
        encoding: 'utf8',
      });

      expect(fs.existsSync(ruta)).to.equal(true);
      expect(path.dirname(ruta)).to.contain('Reclutamiento pausar-requisicion');
      expect(fs.readFileSync(ruta, 'utf8')).to.equal('{"a":1}');
    });

    it('usa la extensión propia de cada tipo y un nombre de archivo sin caracteres inválidos', function () {
      const ctx = contextoDeMocha();
      const json = evidence.saveEvidenceBuffer('json', ctx, '{}', { label: 'Acción: fallida?', encoding: 'utf8' });
      const log = evidence.saveEvidenceBuffer('log', ctx, 'linea', { label: 'ejecución', encoding: 'utf8' });

      expect(path.extname(json)).to.equal('.json');
      expect(path.extname(log)).to.equal('.log');
      expect(path.basename(json)).to.match(/^accion_fallida__/);
      expect(path.basename(json)).to.not.match(/[<>:"/\\|?*]/);
    });

    it('cada tipo va a su propia carpeta dentro de la corrida', function () {
      const ctx = contextoDeMocha();
      const json = evidence.saveEvidenceBuffer('json', ctx, '{}', { encoding: 'utf8' });
      const imagen = evidence.saveEvidenceBuffer('image', ctx, PNG_BASE64, {});

      expect(json).to.contain(path.join('evidence', 'json'));
      expect(imagen).to.contain(paths.SCREENSHOTS_DIR);
    });

    it('sanea el nombre de la carpeta cuando el título del test trae caracteres de ruta', function () {
      expect(evidence.sanitizeFolderName('caso: a/b\\c|d?')).to.equal('caso_ a_b_c_d_');
    });

    it('rechaza un tipo de evidencia no registrado, con un mensaje accionable', function () {
      const ctx = contextoDeMocha();

      expect(() => evidence.saveEvidenceBuffer('excel', ctx, 'x', {})).to.throw(
        /Tipo de evidencia no registrado: "excel"/
      );
      expect(() => evidence.saveEvidenceBuffer('excel', ctx, 'x', {})).to.throw(/registerEvidenceType/);
    });
  });

  describe('qué se adjunta al reporte', function () {
    it('una imagen se embebe como Data URI PNG', function () {
      const ctx = contextoDeMocha();
      const ruta = evidence.saveEvidenceBuffer('image', ctx, PNG_BASE64, { label: 'captura' });
      evidence.attach('image', ctx, ruta, { label: 'Screenshot: antes de guardar' });

      const [adjunto] = adjuntos(ctx);
      expect(adjunto.title).to.equal('Screenshot: antes de guardar');
      expect(adjunto.value).to.match(/^data:image\/png;base64,/);
      // el Data URI reconstruye exactamente el contenido guardado
      expect(adjunto.value).to.equal(`data:image/png;base64,${PNG_BASE64}`);
    });

    it('un video se embebe como Data URI mp4', function () {
      const ctx = contextoDeMocha();
      const ruta = evidence.saveEvidenceBuffer('video', ctx, PNG_BASE64, {});
      evidence.attach('video', ctx, ruta, {});

      expect(adjuntos(ctx)[0].value).to.match(/^data:video\/mp4;base64,/);
    });

    it('un JSON se adjunta con su contenido legible', function () {
      const ctx = contextoDeMocha();
      const ruta = evidence.saveEvidenceBuffer('json', ctx, '{\n  "estado": "Pausada"\n}', { encoding: 'utf8' });
      evidence.attach('json', ctx, ruta, { label: 'estado-final' });

      expect(adjuntos(ctx)[0].value).to.contain('"estado": "Pausada"');
    });

    it('un PDF no se embebe: se referencia por ruta relativa y se avisa', function () {
      const ctx = contextoDeMocha();
      const ruta = evidence.saveEvidenceBuffer('pdf', ctx, PNG_BASE64, { label: 'comprobante' });
      evidence.attach('pdf', ctx, ruta, { label: 'Comprobante' });

      const [adjunto] = adjuntos(ctx);
      expect(adjunto.title).to.contain('Mochawesome no embebe');
      expect(adjunto.value).to.contain('Archivo generado:');
      expect(adjunto.value).to.not.contain('\\'); // ruta normalizada con /
    });

    it('agrupa varias evidencias del mismo test', function () {
      const ctx = contextoDeMocha();
      const a = evidence.saveEvidenceBuffer('json', ctx, '{}', { label: 'a', encoding: 'utf8' });
      const b = evidence.saveEvidenceBuffer('text', ctx, 'hola', { label: 'b', encoding: 'utf8' });
      evidence.attach('json', ctx, a, { label: 'A' });
      evidence.attach('text', ctx, b, { label: 'B' });

      expect(adjuntos(ctx).map((c) => c.title)).to.deep.equal(['A', 'B']);
    });
  });

  describe('extensibilidad (registrar un tipo nuevo)', function () {
    it('permite registrar un tipo propio sin tocar el framework', function () {
      const ctx = contextoDeMocha();
      evidence.registerEvidenceType('excel', {
        extension: 'xlsx',
        dir: () => path.join(paths.EVIDENCE_DIR, 'excel'),
        embed: () => null,
      });

      const ruta = evidence.saveEvidenceBuffer('excel', ctx, 'datos', { label: 'reporte', encoding: 'utf8' });
      evidence.attach('excel', ctx, ruta, { label: 'Reporte' });

      expect(path.extname(ruta)).to.equal('.xlsx');
      expect(ruta).to.contain(path.join('evidence', 'excel'));
      expect(adjuntos(ctx)[0].value).to.contain('Archivo generado:');
    });
  });

  describe('screenshot desde un driver', function () {
    it('captura, guarda y adjunta el Data URI en un solo paso', async function () {
      const ctx = contextoDeMocha();
      const ruta = await evidence.attachScreenshot(crearDriver(''), ctx, { label: 'Tras pausar' });

      expect(fs.existsSync(ruta)).to.equal(true);
      expect(adjuntos(ctx)[0].title).to.equal('Screenshot: Tras pausar');
      expect(adjuntos(ctx)[0].value).to.equal(`data:image/png;base64,${PNG_BASE64}`);
    });
  });

  describe('resolución del contexto de Mocha', function () {
    it('acepta el `this` de un it() (con currentTest o con test)', function () {
      const test = { fullTitle: () => 'x', type: 'test' };

      expect(evidence.resolveTest({ currentTest: test })).to.equal(test);
      expect(evidence.resolveTest({ test })).to.equal(test);
      expect(evidence.resolveTest(test), 'un test ya resuelto se devuelve tal cual').to.equal(test);
    });
  });
});
