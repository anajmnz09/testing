const path = require('path');
const { expect } = require('chai');

/**
 * CONTRATO DE LA SUITE UNITARIA.
 *
 * Estas pruebas no verifican un componente: verifican que la suite unitaria
 * siga siendo unitaria. Es la red que impide que, con el tiempo, alguien
 * "resuelva" una prueba importando el driver real y termine abriendo Chrome
 * dentro del proyecto que debería correr en memoria.
 *
 * Mocha carga TODOS los archivos de spec antes de ejecutar el primero, así que
 * para cuando esto corre, `require.cache` ya refleja todo lo que la suite
 * importó.
 */
describe('contrato de la suite unitaria', function () {
  const cargados = () => Object.keys(require.cache).map((r) => r.toLowerCase());

  it('ningún spec importa el creador de drivers de Selenium', function () {
    const driverCore = path.join('core', 'utils', 'driver.js').toLowerCase();
    const culpables = cargados().filter((r) => r.endsWith(driverCore));

    expect(
      culpables,
      'Alguna prueba unitaria importó utils/driver.js (o el barrel @triple/core, que lo arrastra). ' +
        'Importá el submódulo concreto que estés probando.'
    ).to.be.empty;
  });

  it('no se carga chromedriver ni se lanza un navegador', function () {
    const culpables = cargados().filter((r) => r.includes(`${path.sep}chromedriver${path.sep}`));

    expect(culpables, 'Una prueba unitaria cargó chromedriver: eso pertenece a las pruebas E2E').to.be.empty;
  });

  it('no depende de credenciales ni de la URL de la aplicación', function () {
    // Si estas pruebas necesitaran un `.env`, dejarían de correr en cualquier
    // máquina y en CI. El entorno unitario las deja explícitamente vacías.
    expect(process.env.BASE_URL || '').to.equal('');
    expect(process.env.APP_USERNAME || '').to.equal('');
    expect(process.env.PASSWORD || '').to.equal('');
  });

  it('los artefactos de la corrida no se escriben dentro del repositorio', function () {
    const paths = require('../utils/paths');
    const repo = path.resolve(__dirname, '..', '..');

    expect(
      paths.REPORTS_ROOT_DIR.startsWith(repo),
      `Los reportes de la corrida unitaria apuntan al repo (${paths.REPORTS_ROOT_DIR})`
    ).to.equal(false);
  });
});
