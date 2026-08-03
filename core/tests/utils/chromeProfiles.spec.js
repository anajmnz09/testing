const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const { barrerViejos, limpiarPerfiles, contarPerfiles } = require('../../utils/chromeProfiles');

/**
 * Limpieza de perfiles temporales de Chrome.
 *
 * La regla que importa: borrar los perfiles HUÉRFANOS viejos (de corridas cuyo
 * proceso se mató) sin tocar los de una corrida activa ni carpetas ajenas. Es
 * lógica de fs pura: se prueba en memoria con un directorio temporal, sin abrir
 * Chrome ni Selenium.
 */
describe('chromeProfiles.barrerViejos (unitario)', function () {
  let base;

  beforeEach(function () {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'triple-chrome-test-'));
  });

  afterEach(function () {
    try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) { /* ya no está */ }
  });

  function crearPerfil(nombre, edadMs) {
    const dir = path.join(base, nombre);
    fs.mkdirSync(dir, { recursive: true });
    const t = (Date.now() - edadMs) / 1000; // segundos para utimes
    fs.utimesSync(dir, t, t);
    return dir;
  }

  it('borra los perfiles más viejos que el umbral y conserva los recientes', function () {
    const viejo = crearPerfil('profile-viejo', 2 * 60 * 60 * 1000); // 2h
    const nuevo = crearPerfil('profile-nuevo', 5 * 60 * 1000); // 5min

    const borrados = barrerViejos(base, 60 * 60 * 1000); // umbral 1h

    expect(borrados).to.equal(1);
    expect(fs.existsSync(viejo)).to.equal(false);
    expect(fs.existsSync(nuevo)).to.equal(true);
  });

  it('NO toca carpetas ajenas (solo las que son perfiles del framework)', function () {
    const ajeno = path.join(base, 'reportes-importantes');
    fs.mkdirSync(ajeno);
    const t = (Date.now() - 5 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(ajeno, t, t);

    barrerViejos(base, 60 * 60 * 1000);

    expect(fs.existsSync(ajeno), 'no debe borrar carpetas que no son perfiles').to.equal(true);
  });

  it('no rompe si la carpeta base no existe (devuelve 0)', function () {
    expect(barrerViejos(path.join(base, 'no-existe'), 1000)).to.equal(0);
  });

  describe('limpiarPerfiles (post-corrida) + contarPerfiles', function () {
    it('elimina TODOS los perfiles del framework y cuenta lo recuperado', function () {
      crearPerfil('profile-a', 0);
      crearPerfil('profile-b', 0);
      require('fs').writeFileSync(path.join(base, 'profile-a', 'data.bin'), Buffer.alloc(1024));

      expect(contarPerfiles(base)).to.equal(2);
      const r = limpiarPerfiles(base);

      expect(r.eliminados).to.equal(2);
      expect(r.advertencias).to.deep.equal([]);
      expect(r.mbRecuperados).to.be.a('number');
      expect(contarPerfiles(base)).to.equal(0); // sin residuales
    });

    it('NO toca carpetas que no son perfiles del framework', function () {
      const ajeno = path.join(base, 'reportes');
      fs.mkdirSync(ajeno);
      crearPerfil('profile-x', 0);

      limpiarPerfiles(base);

      expect(fs.existsSync(ajeno)).to.equal(true);
      expect(contarPerfiles(base)).to.equal(0);
    });

    it('no rompe si la carpeta base no existe', function () {
      const r = limpiarPerfiles(path.join(base, 'no-existe'));
      expect(r).to.deep.equal({ eliminados: 0, mbRecuperados: 0, advertencias: [] });
    });
  });
});
