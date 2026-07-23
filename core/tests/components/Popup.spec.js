const { expect } = require('chai');
const Popup = require('../../components/Popup');
const { crearDriver } = require('../support/fakeDriver');

/**
 * Popup — diálogo/modal genérico de DevExtreme.
 *
 * Comportamiento observable: identifica el popup correcto (por un `contiene`),
 * acciona un botón por su nombre accesible sin adivinar por posición, no clickea
 * deshabilitados, y sabe si sigue abierto.
 */
const TIMEOUT = 60;
const BTN = 'dx-widget dx-button dx-button-mode-contained';

// popup visible del import de documentos (simplificado, estructura real)
function popupImport({ guardarDeshabilitado = true } = {}) {
  return `
    <div class="dx-overlay-wrapper dx-popup-wrapper dx-overlay-modal">
      <div class="dx-selectbox clasificacionSelecBox"><input placeholder="Seleccione una clasificacion"></div>
      <div class="${BTN}" aria-label="Buscar en sistema" id="buscar">Buscar en sistema</div>
      <div class="${BTN}" aria-label="Descartar" id="descartar">Descartar</div>
      <div class="button-comunes customButton${guardarDeshabilitado ? '-disabled' : ''}" id="guardar-custom">Guardar</div>
      <div class="${BTN}${guardarDeshabilitado ? ' dx-state-disabled' : ''}" aria-label="Guardar" id="guardar">Guardar</div>
    </div>`;
}

describe('Popup (unitario)', function () {
  describe('visibilidad', function () {
    it('detecta el popup visible que contiene el selector pedido', async function () {
      const driver = crearDriver(popupImport());
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });

      expect(await popup.estaVisible()).to.equal(true);
      await popup.esperarVisible(TIMEOUT); // no lanza
    });

    it('NO lo considera visible si está oculto (d-none)', async function () {
      const driver = crearDriver(
        `<div class="dx-popup-wrapper d-none"><div class="clasificacionSelecBox"></div></div>`
      );
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });

      expect(await popup.estaVisible()).to.equal(false);
    });

    it('distingue el popup objetivo de otro modal abierto sin ese contenido', async function () {
      const driver = crearDriver(
        `<div class="dx-popup-wrapper"><div class="otra-cosa"></div></div>` + popupImport()
      );
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });

      expect(await popup.estaVisible()).to.equal(true);
    });

    it('esperarVisible lanza si el popup nunca aparece', async function () {
      const driver = crearDriver(`<div class="pantalla"></div>`);
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });

      let error = null;
      try { await popup.esperarVisible(TIMEOUT); } catch (e) { error = e; }
      expect(error, 'debía lanzar').to.not.equal(null);
    });

    it('esperarCerrado no lanza cuando el popup ya no está', async function () {
      const driver = crearDriver(`<div class="pantalla"></div>`);
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });
      await popup.esperarCerrado(TIMEOUT);
    });
  });

  describe('accionar botones', function () {
    it('clickea un botón por su aria-label', async function () {
      const driver = crearDriver(popupImport());
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });

      const info = await popup.accionar('descartar', { timeout: TIMEOUT });

      expect(info.encontrado).to.equal(true);
      expect(driver.traza.clicks[0].id).to.equal('descartar');
    });

    it('NO clickea el "Guardar" mientras está deshabilitado, pero informa que existe', async function () {
      const driver = crearDriver(popupImport({ guardarDeshabilitado: true }));
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });

      const info = await popup.accionar('guardar', { timeout: TIMEOUT });

      expect(info.encontrado).to.equal(true);
      expect(info.deshabilitado).to.equal(true);
      expect(driver.traza.clicks).to.be.empty;
    });

    it('clickea "Guardar" cuando ya está habilitado', async function () {
      const driver = crearDriver(popupImport({ guardarDeshabilitado: false }));
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });

      const info = await popup.accionar('guardar', { timeout: TIMEOUT });

      expect(info.encontrado).to.equal(true);
      expect(info.deshabilitado).to.equal(false);
      // hay dos "Guardar" habilitados; clickea el PRIMERO en orden de DOM (el
      // botón visible `button-comunes`), nunca uno deshabilitado.
      expect(driver.traza.clicks).to.have.lengthOf(1);
      expect(driver.traza.clicks[0].id).to.equal('guardar-custom');
    });

    it('no adivina: botón inexistente -> encontrado:false + inventario', async function () {
      const driver = crearDriver(popupImport());
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });

      const info = await popup.esperarBoton('exportar', { timeout: TIMEOUT });

      expect(info.encontrado).to.equal(false);
      expect(info.botones.map((b) => b.nombre)).to.include.members(['Buscar en sistema | Buscar en sistema', 'Descartar | Descartar']);
      expect(driver.traza.clicks).to.be.empty;
    });

    it('reporta popup-no-visible si no hay popup', async function () {
      const driver = crearDriver(`<div class="pantalla"></div>`);
      const popup = new Popup(driver, { contiene: '.clasificacionSelecBox' });

      const info = await popup.ubicarBoton('guardar');
      expect(info.encontrado).to.equal(false);
      expect(info.motivo).to.equal('popup-no-visible');
    });
  });
});
