const fs = require('fs');
const { expect } = require('chai');
const { crearProyecto } = require('../support/proyectoTemporal');
const { crearDriver } = require('../support/fakeDriver');

/**
 * Metadata de pantallas AUTOGESTIONADA.
 *
 * El comportamiento que importa es una sola promesa: "nunca hay que borrar
 * JSONs a mano, y una metadata vigente no se vuelve a capturar". Se prueba
 * contando cuántas veces se inspecciona realmente el DOM en cada situación.
 */
describe('screenMetadata + screenInspector (unitario)', function () {
  let proyecto;
  let screenMetadata;
  let screenInspector;

  beforeEach(function () {
    proyecto = crearProyecto();
    screenMetadata = proyecto.importar('../../utils/screenMetadata');
    screenInspector = proyecto.importar('../../utils/screenInspector');
  });

  afterEach(function () {
    proyecto.limpiar();
  });

  /** Driver que cuenta cuántas radiografías se tomaron. */
  function driverQueCuenta() {
    const driver = crearDriver('<div class="forms-header"><div class="dx-button">Editar</div></div>');
    driver.inspecciones = 0;
    const original = driver.executeScript.bind(driver);
    driver.executeScript = async (script, ...args) => {
      if (typeof script === 'function') driver.inspecciones += 1;
      return original(script, ...args);
    };
    return driver;
  }

  describe('validez de la caché', function () {
    it('considera inválida una pantalla que nunca se inspeccionó', function () {
      const estado = screenMetadata.esValida('pantalla-nueva', screenInspector.sello());

      expect(estado.valida).to.equal(false);
      expect(estado.motivo).to.equal('no-existe');
    });

    it('considera válida la metadata recién generada por este inspector', async function () {
      await screenInspector.inspeccionarYGuardar(driverQueCuenta(), 'pantalla-demo');
      const estado = screenMetadata.esValida('pantalla-demo', screenInspector.sello());

      expect(estado.valida).to.equal(true);
      expect(estado.motivo).to.equal('vigente');
    });

    it('detecta metadata ANTIGUA: la generada antes de que existiera el sello', function () {
      screenMetadata.guardar('pantalla-vieja', { botones: [] }); // sin sello, formato anterior
      const estado = screenMetadata.esValida('pantalla-vieja', screenInspector.sello());

      expect(estado.valida).to.equal(false);
      expect(estado.motivo).to.equal('sin-sello-de-inspector');
    });

    it('detecta metadata CORRUPTA sin lanzar', function () {
      const ruta = screenMetadata.rutaDe('pantalla-rota');
      fs.mkdirSync(require('path').dirname(ruta), { recursive: true });
      fs.writeFileSync(ruta, '{ esto no es json', 'utf8');

      const estado = screenMetadata.esValida('pantalla-rota', screenInspector.sello());

      expect(estado.valida).to.equal(false);
      expect(estado.motivo).to.equal('json-corrupto');
    });

    it('detecta que cambió la FIRMA del inspector (código distinto)', function () {
      screenMetadata.guardar('pantalla-demo', { botones: [] }, { version: 2, firma: 'firmavieja01' });
      const estado = screenMetadata.esValida('pantalla-demo', { version: 2, firma: 'firmanueva9' });

      expect(estado.valida).to.equal(false);
      expect(estado.motivo).to.contain('firma-distinta');
    });

    it('detecta que cambió la VERSIÓN del inspector', function () {
      screenMetadata.guardar('pantalla-demo', { botones: [] }, { version: 1, firma: 'abc' });
      const estado = screenMetadata.esValida('pantalla-demo', { version: 2, firma: 'abc' });

      expect(estado.valida).to.equal(false);
      expect(estado.motivo).to.contain('version-distinta');
    });
  });

  describe('regeneración automática', function () {
    it('inspecciona la primera vez y persiste el sello del inspector', async function () {
      const driver = driverQueCuenta();
      const resultado = await screenInspector.inspeccionarYGuardar(driver, 'pantalla-demo');

      expect(driver.inspecciones).to.equal(1);
      expect(resultado.desdeCache).to.equal(false);

      const doc = proyecto.leerJson(screenMetadata.rutaDe('pantalla-demo'));
      expect(doc.inspector).to.deep.equal(screenInspector.sello());
      expect(doc.pantalla).to.equal('pantalla-demo');
    });

    it('NO re-inspecciona mientras la caché siga vigente', async function () {
      const driver = driverQueCuenta();
      await screenInspector.inspeccionarYGuardar(driver, 'pantalla-demo');
      await screenInspector.inspeccionarYGuardar(driver, 'pantalla-demo');
      const tercera = await screenInspector.inspeccionarYGuardar(driver, 'pantalla-demo');

      expect(driver.inspecciones).to.equal(1);
      expect(tercera.desdeCache).to.equal(true);
    });

    it('regenera sola cuando la firma guardada no coincide, sin borrar nada a mano', async function () {
      const driver = driverQueCuenta();
      await screenInspector.inspeccionarYGuardar(driver, 'pantalla-demo');

      // simula que cambió el inspector: se altera el sello persistido
      const ruta = screenMetadata.rutaDe('pantalla-demo');
      const doc = proyecto.leerJson(ruta);
      doc.inspector.firma = 'otra-firma';
      fs.writeFileSync(ruta, JSON.stringify(doc), 'utf8');

      const resultado = await screenInspector.inspeccionarYGuardar(driver, 'pantalla-demo');

      expect(driver.inspecciones).to.equal(2);
      expect(resultado.desdeCache).to.equal(false);
      expect(resultado.motivo).to.contain('firma-distinta');
      expect(proyecto.leerJson(ruta).inspector).to.deep.equal(screenInspector.sello());
    });

    it('regenera una metadata corrupta en vez de romper la corrida', async function () {
      const driver = driverQueCuenta();
      fs.mkdirSync(screenMetadata.METADATA_DIR, { recursive: true });
      fs.writeFileSync(screenMetadata.rutaDe('pantalla-demo'), '{roto', 'utf8');

      const resultado = await screenInspector.inspeccionarYGuardar(driver, 'pantalla-demo');

      expect(resultado.motivo).to.equal('json-corrupto');
      expect(driver.inspecciones).to.equal(1);
    });

    it('`forzar` re-inspecciona aunque esté vigente', async function () {
      const driver = driverQueCuenta();
      await screenInspector.inspeccionarYGuardar(driver, 'pantalla-demo');
      const resultado = await screenInspector.inspeccionarYGuardar(driver, 'pantalla-demo', { forzar: true });

      expect(driver.inspecciones).to.equal(2);
      expect(resultado.motivo).to.equal('forzado');
    });
  });

  describe('firma del inspector', function () {
    it('es estable entre llamadas si el código no cambió', function () {
      expect(screenInspector.firma()).to.equal(screenInspector.firma());
    });

    it('el sello incluye versión y firma', function () {
      const sello = screenInspector.sello();

      expect(sello).to.have.property('version').that.is.a('number');
      expect(sello).to.have.property('firma').that.is.a('string');
      expect(sello.firma).to.have.length.above(6);
    });
  });

  describe('almacenamiento', function () {
    it('normaliza el nombre de la pantalla al nombre de archivo', function () {
      expect(screenMetadata.slug('Requisiciones — Detalle')).to.equal('requisiciones-detalle');
      expect(screenMetadata.slug('  Acción Múltiple  ')).to.equal('accion-multiple');
    });

    it('guarda trazabilidad de cuándo y contra qué ambiente se capturó', function () {
      process.env.BASE_URL = 'https://test.triple.com.do/';
      const ruta = screenMetadata.guardar('pantalla-demo', { botones: [] });
      const doc = proyecto.leerJson(ruta);

      expect(doc.baseUrl).to.equal('https://test.triple.com.do/');
      expect(new Date(doc.capturadoEn).toString()).to.not.equal('Invalid Date');
    });

    it('lista las pantallas cacheadas y devuelve null para las que no existen', function () {
      screenMetadata.guardar('pantalla-a', {});
      screenMetadata.guardar('pantalla-b', {});

      expect(screenMetadata.listar()).to.have.members(['pantalla-a', 'pantalla-b']);
      expect(screenMetadata.leer('pantalla-z')).to.equal(null);
    });
  });
});
