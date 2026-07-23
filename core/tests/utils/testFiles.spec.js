const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const testFiles = require('../../utils/testFiles');

/**
 * testFiles — resolución de archivos para cargas.
 *
 * Comportamiento observable: misma filosofía que el Execution Context. Si el
 * usuario indica un archivo válido se usa ese; si no indica nada, el framework
 * genera uno por defecto; si indica uno que no existe, FALLA explícito (no
 * sustituye en silencio, que sería un falso verde).
 */
describe('testFiles (unitario)', function () {
  describe('archivo por defecto', function () {
    it('genera un .txt válido y devuelve su ruta absoluta', function () {
      const ruta = testFiles.archivoPorDefecto('txt');

      expect(path.isAbsolute(ruta)).to.equal(true);
      expect(fs.existsSync(ruta)).to.equal(true);
      expect(path.extname(ruta)).to.equal('.txt');
      expect(fs.statSync(ruta).size).to.be.greaterThan(0);
    });

    it('genera un .png válido (empieza con la firma PNG)', function () {
      const ruta = testFiles.archivoPorDefecto('png');
      const buf = fs.readFileSync(ruta);

      expect(path.extname(ruta)).to.equal('.png');
      // firma PNG: 89 50 4E 47
      expect([buf[0], buf[1], buf[2], buf[3]]).to.deep.equal([0x89, 0x50, 0x4e, 0x47]);
    });

    it('genera nombres DISTINTOS por `base` (para validar cargas por clasificación)', function () {
      const cv = testFiles.archivoPorDefecto('txt', { base: 'documento-CV|Currículum Vitae' });
      const otro = testFiles.archivoPorDefecto('txt', { base: 'documento-Otro' });

      expect(path.basename(cv)).to.not.equal(path.basename(otro));
      // el base se normaliza a un nombre de archivo seguro (sin acentos ni símbolos)
      expect(path.basename(cv)).to.equal('documento-cv-curriculum-vitae.txt');
      expect(fs.existsSync(cv)).to.equal(true);
    });

    it('rechaza un tipo no soportado con un mensaje accionable', function () {
      expect(() => testFiles.archivoPorDefecto('exe')).to.throw(/no soportado/);
      expect(() => testFiles.archivoPorDefecto('exe')).to.throw(/txt/); // lista los soportados
    });

    it('no vive dentro del repositorio (se genera en el temp del SO)', function () {
      const repo = path.resolve(__dirname, '..', '..', '..');
      expect(testFiles.archivoPorDefecto('txt').startsWith(repo)).to.equal(false);
      expect(testFiles.DIR_FIXTURES.startsWith(os.tmpdir())).to.equal(true);
    });
  });

  describe('resolver', function () {
    it('sin datos, usa el archivo por defecto (porDefecto: true)', function () {
      const r = testFiles.resolver();

      expect(r.porDefecto).to.equal(true);
      expect(fs.existsSync(r.ruta)).to.equal(true);
      expect(r.nombre).to.equal(path.basename(r.ruta));
    });

    it('con string vacío o espacios, también cae al por defecto', function () {
      expect(testFiles.resolver({ ruta: '' }).porDefecto).to.equal(true);
      expect(testFiles.resolver({ ruta: '   ' }).porDefecto).to.equal(true);
    });

    it('usa el archivo indicado por el usuario cuando existe', function () {
      const tmp = path.join(os.tmpdir(), `triple-userfile-${Date.now()}.txt`);
      fs.writeFileSync(tmp, 'archivo del usuario', 'utf8');
      try {
        const r = testFiles.resolver({ ruta: tmp });
        expect(r.porDefecto).to.equal(false);
        expect(r.ruta).to.equal(path.resolve(tmp));
        expect(r.nombre).to.equal(path.basename(tmp));
      } finally {
        fs.rmSync(tmp, { force: true });
      }
    });

    it('resuelve rutas relativas a absolutas', function () {
      const r = testFiles.resolver({ ruta: 'package.json' }); // existe en el cwd del core
      expect(path.isAbsolute(r.ruta)).to.equal(true);
    });

    it('FALLA explícito si el archivo indicado no existe (no lo sustituye)', function () {
      expect(() => testFiles.resolver({ ruta: '/ruta/que/no/existe/doc.pdf' })).to.throw(/no existe/);
    });

    it('respeta el tipo pedido para el archivo por defecto', function () {
      const r = testFiles.resolver({ tipo: 'png' });
      expect(path.extname(r.ruta)).to.equal('.png');
    });
  });
});
