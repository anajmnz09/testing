const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { crearProyecto } = require('../support/proyectoTemporal');
const { sanitizeFileName } = require('../../utils/screenshot');

/**
 * Utilidades chicas pero críticas: nombres de archivo e historial de reportes.
 *
 * `sanitizeFileName` decide el nombre de CADA screenshot y evidencia: si deja
 * pasar un carácter inválido, la corrida entera falla al escribir en Windows.
 * La retención decide qué historial se conserva: si se equivoca, borra
 * reportes que el usuario todavía necesitaba.
 */
describe('utilidades de archivos y reportes (unitario)', function () {
  describe('sanitizeFileName', function () {
    it('quita acentos en vez de reemplazarlos por guiones bajos', function () {
      expect(sanitizeFileName('Publicación Exitosa')).to.equal('publicacion_exitosa');
      expect(sanitizeFileName('Requisición Nº 5')).to.equal('requisicion_n_5');
    });

    it('reemplaza por "_" todo lo que no sea alfanumérico', function () {
      expect(sanitizeFileName('caso: a/b\\c|d?*"<>')).to.equal('caso_a_b_c_d');
    });

    it('no deja guiones bajos sueltos al principio ni al final', function () {
      expect(sanitizeFileName('  ¿Guardar? ')).to.equal('guardar');
      expect(sanitizeFileName('***')).to.equal('');
    });

    it('normaliza a minúsculas para que el nombre sea estable entre sistemas', function () {
      expect(sanitizeFileName('Screenshot FINAL')).to.equal('screenshot_final');
    });

    it('colapsa separadores repetidos en uno solo', function () {
      expect(sanitizeFileName('a   ---   b')).to.equal('a_b');
    });
  });

  describe('historial de reportes', function () {
    let proyecto;
    let paths;

    beforeEach(function () {
      proyecto = crearProyecto();
      paths = proyecto.importar('../../utils/paths');
    });

    afterEach(function () {
      proyecto.limpiar();
    });

    const crearCorrida = (runId) => fs.mkdirSync(paths.getRunDir(runId), { recursive: true });

    it('genera un RUN_ID ordenable cronológicamente como string', function () {
      const id = paths.generateRunId(new Date(2026, 6, 21, 9, 5, 3));

      expect(id).to.equal('2026-07-21_09-05-03');
      expect(paths.generateRunId(new Date(2026, 0, 1)) < id).to.equal(true);
    });

    it('lista las corridas sin contar la carpeta `latest`', function () {
      crearCorrida('2026-07-20_10-00-00');
      crearCorrida('2026-07-21_10-00-00');
      fs.mkdirSync(paths.LATEST_DIR, { recursive: true });

      expect(paths.listRuns()).to.deep.equal(['2026-07-20_10-00-00', '2026-07-21_10-00-00']);
      expect(paths.getLatestRunId()).to.equal('2026-07-21_10-00-00');
    });

    it('la retención conserva las N más recientes y borra las viejas', function () {
      ['2026-07-18', '2026-07-19', '2026-07-20', '2026-07-21'].forEach(crearCorrida);

      const borradas = paths.pruneOldRuns(2);

      expect(borradas).to.deep.equal(['2026-07-18', '2026-07-19']);
      expect(paths.listRuns()).to.deep.equal(['2026-07-20', '2026-07-21']);
    });

    it('la retención no borra nada si todavía no se llegó al límite', function () {
      ['2026-07-20', '2026-07-21'].forEach(crearCorrida);

      expect(paths.pruneOldRuns(5)).to.be.empty;
      expect(paths.listRuns()).to.have.lengthOf(2);
    });

    it('un límite inválido no borra nada (nunca destruye el historial por error)', function () {
      crearCorrida('2026-07-21');

      [0, -1, NaN, undefined].forEach((limite) => expect(paths.pruneOldRuns(limite)).to.be.empty);
      expect(paths.listRuns()).to.have.lengthOf(1);
    });

    it('`latest` refleja el contenido de la última corrida', function () {
      const runDir = paths.getRunDir('2026-07-21');
      fs.mkdirSync(path.join(runDir, 'html'), { recursive: true });
      fs.writeFileSync(path.join(runDir, 'html', 'index.html'), '<h1>reporte</h1>');

      paths.updateLatest('2026-07-21');

      const copiado = path.join(paths.LATEST_DIR, 'html', 'index.html');
      expect(fs.existsSync(copiado)).to.equal(true);
      expect(fs.readFileSync(copiado, 'utf8')).to.equal('<h1>reporte</h1>');
    });

    it('crea todas las carpetas que la corrida necesita (JSON, screenshots, logs, evidencias)', function () {
      const p = paths.ensureRunDirs('2026-07-21');

      [p.jsonDir, p.screenshotsDir, p.logsDir, p.evidenceDir].forEach((dir) =>
        expect(fs.existsSync(dir), dir).to.equal(true)
      );
    });

    it('NO crea la carpeta html (el reporte HTML de Mochawesome se descontinuó)', function () {
      const p = paths.ensureRunDirs('2026-07-21');
      expect(fs.existsSync(p.htmlDir)).to.equal(false);
    });

    it('los reportes cuelgan del proyecto que corre los tests, no del core', function () {
      expect(paths.REPORTS_ROOT_DIR).to.equal(path.join(proyecto.raiz, 'reports'));
      expect(paths.REPORTS_DIR).to.equal(paths.REPORTS_ROOT_DIR); // alias retrocompatible
    });
  });
});
