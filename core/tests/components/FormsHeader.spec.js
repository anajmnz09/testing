const { expect } = require('chai');
const FormsHeader = require('../../components/FormsHeader');
const { crearDriver } = require('../support/fakeDriver');

/**
 * FormsHeader — barra de acciones de las pantallas de detalle.
 *
 * Se prueba el COMPORTAMIENTO observable contra un DOM realista: qué botón
 * termina accionado, qué informa cuando no puede identificarlo con certeza, y
 * qué estado lee de un switch. No se inspeccionan métodos internos ni se
 * verifica "que llamó a tal función": se verifica QUÉ elemento quedó clickeado.
 */

const BOTON = 'dx-widget dx-button dx-button-mode-text dx-button-normal';
const SWITCH = 'dx-show-invalid-badge dx-switch dx-swipeable dx-widget';
// Ícono embebido: el caso real de esta app. El selector NUNCA debe mirarlo.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const TIMEOUT = 60; // ms: las pruebas unitarias no esperan a nadie

/** Header realista: el nombre del botón objetivo se declara por parámetro. */
function header(interior) {
  return `<div class="forms-header requisicion-header">${interior}</div>`;
}

describe('FormsHeader (unitario)', function () {
  describe('localización de botones', function () {
    it('encuentra el botón por title', async function () {
      const driver = crearDriver(
        header(`
          <div class="${BOTON}"><span>Editar</span></div>
          <div class="${BOTON}" title="Pausar requisición" id="objetivo"><img src="${PNG}"></div>`)
      );
      const resultado = await new FormsHeader(driver).accionar('pausar|pausa', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(true);
      expect(resultado.via).to.equal('nombre-accesible');
      expect(driver.traza.clicks).to.have.lengthOf(1);
      expect(driver.traza.clicks[0].id).to.equal('objetivo');
    });

    it('encuentra el botón por aria-label', async function () {
      const driver = crearDriver(
        header(`
          <div class="${BOTON}" aria-label="Pausar" id="objetivo"><img src="${PNG}"></div>
          <div class="${BOTON}"><span>Cerrar</span></div>`)
      );
      await new FormsHeader(driver).accionar('pausar|pausa', { timeout: TIMEOUT });

      expect(driver.traza.clicks[0].id).to.equal('objetivo');
    });

    it('encuentra el botón por el alt del ícono, sin mirar el base64 del src', async function () {
      const driver = crearDriver(
        header(`<div class="${BOTON}" id="objetivo"><img alt="pausa" src="${PNG}"></div>`)
      );
      const resultado = await new FormsHeader(driver).esperarBoton('pausar|pausa', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(true);
      // el nombre accesible reportado sale del alt, no del contenido de la imagen
      expect(resultado.nombre).to.contain('pausa');
      expect(resultado.nombre).to.not.contain('base64');
    });

    it('encuentra el botón por su texto visible', async function () {
      const driver = crearDriver(
        header(`
          <div class="${BOTON}"><span>Editar</span></div>
          <div class="${BOTON}" id="objetivo"><span>Pausar</span></div>`)
      );
      await new FormsHeader(driver).accionar('pausar|pausa', { timeout: TIMEOUT });

      expect(driver.traza.clicks[0].id).to.equal('objetivo');
    });

    it('acciona el contenedor clickeable cuando el nombre está en el ícono', async function () {
      const driver = crearDriver(
        header(`<div class="${BOTON}" id="objetivo"><i class="icon-pausar"></i></div>`)
      );
      const resultado = await new FormsHeader(driver).accionar('pausar|pausa', { timeout: TIMEOUT });

      expect(resultado.via).to.equal('icono-con-nombre');
      // se clickea el BOTÓN, no el <i>: clickear el ícono suelto no siempre dispara la acción
      expect(driver.traza.clicks[0].id).to.equal('objetivo');
    });

    it('ignora botones que están fuera del header', async function () {
      const driver = crearDriver(
        `<div class="${BOTON}" title="Pausar" id="fuera"><img src="${PNG}"></div>
         ${header(`<div class="${BOTON}"><span>Editar</span></div>`)}`
      );
      const resultado = await new FormsHeader(driver).accionar('pausar|pausa', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(false);
      expect(driver.traza.clicks).to.be.empty;
    });

    // La app tiene botones de acción propios que NO son .dx-button, sino
    // <div class="xxxButton" title="…"> (ej. documentoButton -> "Documentos").
    // Verificado en el DOM real de la pantalla de requisición.
    it('encuentra un botón de acción propio de la app (div.xxxButton) por su title', async function () {
      const driver = crearDriver(
        header(`
          <div class="${BOTON}" title="Pausar"><img src="${PNG}"></div>
          <div class="documentoRequisicion">
            <div class="documentoButton false" title="Documentos" id="objetivo"><img class="icon" src="${PNG}"></div>
          </div>`)
      );
      const resultado = await new FormsHeader(driver).accionar('documentos', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(true);
      expect(resultado.via).to.equal('nombre-accesible');
      expect(driver.traza.clicks[0].id).to.equal('objetivo');
    });

    it('el div.xxxButton no rompe la búsqueda de otros botones del header', async function () {
      // pedir "Pausar" con un documentoButton presente sigue resolviendo a Pausar
      const driver = crearDriver(
        header(`
          <div class="${BOTON}" title="Pausar" id="pausar"><img src="${PNG}"></div>
          <div class="documentoButton" title="Documentos" id="doc"><img src="${PNG}"></div>`)
      );
      const resultado = await new FormsHeader(driver).accionar('pausar|pausa', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(true);
      expect(driver.traza.clicks[0].id).to.equal('pausar');
    });

    it('la convención *Button (mayúscula) no matchea los internos dx-button-* de DevExtreme', async function () {
      // dx-button-content / dx-button-has-text (minúscula) NO deben tomarse como
      // acciones propias: solo el patrón real del control (title) decide.
      const driver = crearDriver(
        header(`<div class="${BOTON}"><div class="dx-button-content"><span>Editar</span></div></div>`)
      );
      const resultado = await new FormsHeader(driver).esperarBoton('documentos', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(false);
    });
  });

  describe('nunca adivina', function () {
    it('NO elige por posición: con un único botón solo-ícono anónimo, falla explícito', async function () {
      const driver = crearDriver(
        header(`
          <div class="${BOTON}"><span>Editar</span></div>
          <div class="${BOTON}" id="anonimo"><img src="${PNG}"></div>`)
      );
      const resultado = await new FormsHeader(driver).accionar('pausar|pausa', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(false);
      expect(driver.traza.clicks).to.be.empty;
    });

    it('NO elige por índice: con varios íconos anónimos tampoco clickea ninguno', async function () {
      const driver = crearDriver(
        header(`
          <div class="${BOTON}"><img src="${PNG}"></div>
          <div class="${BOTON}"><img src="${PNG}"></div>`)
      );
      const resultado = await new FormsHeader(driver).accionar('pausar|pausa', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(false);
      expect(resultado.motivo).to.contain('no se adivina');
      expect(driver.traza.clicks).to.be.empty;
    });

    it('informa el inventario del header para poder diagnosticar el fallo', async function () {
      const driver = crearDriver(
        header(`
          <div class="${BOTON}"><span>Editar</span></div>
          <div class="${BOTON} dx-state-disabled"><span>Cerrar</span></div>`)
      );
      const resultado = await new FormsHeader(driver).esperarBoton('pausar|pausa', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(false);
      expect(resultado.botones.map((b) => b.nombre)).to.deep.equal(['Editar', 'Cerrar']);
      expect(resultado.botones[1].deshabilitado).to.equal(true);
    });

    it('no clickea un botón deshabilitado, pero informa que existe', async function () {
      const driver = crearDriver(
        header(`<div class="${BOTON} dx-state-disabled" title="Pausar" id="objetivo"><img src="${PNG}"></div>`)
      );
      const resultado = await new FormsHeader(driver).accionar('pausar|pausa', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(true);
      expect(resultado.deshabilitado).to.equal(true);
      expect(driver.traza.clicks).to.be.empty;
    });

    it('sin header en la pantalla, no encuentra nada ni rompe', async function () {
      const driver = crearDriver('<div class="otra-pantalla"></div>');
      const resultado = await new FormsHeader(driver).esperarBoton('pausar', { timeout: TIMEOUT });

      expect(resultado.encontrado).to.equal(false);
      expect(resultado.motivo).to.equal('header-no-encontrado');
    });
  });

  describe('resultado de la acción', function () {
    it('devuelve el notify de éxito de la app tras accionar', async function () {
      const driver = crearDriver(
        header(`<div class="${BOTON}" title="Pausar"><img src="${PNG}"></div>`) +
          '<div class="notify_record_ok">Operación Exitosa</div>'
      );
      const resultado = await new FormsHeader(driver).accionar('pausar', { timeout: TIMEOUT });

      expect(resultado.exito).to.equal(true);
      expect(resultado.notify).to.equal('Operación Exitosa');
    });

    it('no reporta éxito cuando la app responde con un error', async function () {
      const driver = crearDriver(
        header(`<div class="${BOTON}" title="Pausar"><img src="${PNG}"></div>`) +
          '<div class="notify_record_error">Error en el sistema</div>'
      );
      const resultado = await new FormsHeader(driver).accionar('pausar', { timeout: TIMEOUT });

      expect(resultado.exito).to.equal(false);
      expect(resultado.errorSistema).to.equal(true);
    });

    it('no inventa un notify cuando la app no muestra ninguno', async function () {
      const driver = crearDriver(header(`<div class="${BOTON}" title="Pausar"></div>`));
      const resultado = await new FormsHeader(driver).accionar('pausar', { timeout: TIMEOUT });

      expect(resultado.notify).to.equal('');
      expect(resultado.exito).to.equal(false);
    });
  });

  describe('switches del header', function () {
    const conSwitch = ({
      attrs = 'aria-pressed="false"',
      clases = '',
      contenedor = 'group-field-3 grupo-publicada',
    } = {}) =>
      header(`
        <div class="${BOTON}"><span>Editar</span></div>
        <div class="${contenedor}">
          <label>Publicada:</label>
          <div class="${SWITCH} ${clases}" ${attrs} id="publicada"></div>
        </div>`) +
      `<div class="group-field-2"><label>Rotativo:</label><div class="${SWITCH} dx-state-disabled" id="rotativo"></div></div>`;

    it('ubica el switch por su contenedor propio y lee que está apagado', async function () {
      const driver = crearDriver(conSwitch());
      const info = await new FormsHeader(driver).ubicarSwitch('publicada', {
        contenedor: '[class*="grupo-publicada"]',
      });

      expect(info.encontrado).to.equal(true);
      expect(info.via).to.equal('contenedor-propio');
      expect(info.encendido).to.equal(false);
      expect(driver.document.querySelector('[data-qa="header-switch"]').id).to.equal('publicada');
    });

    it('no confunde el switch pedido con otro switch de la pantalla', async function () {
      const driver = crearDriver(conSwitch());
      await new FormsHeader(driver).ubicarSwitch('publicada', {
        contenedor: '[class*="grupo-publicada"]',
      });

      expect(driver.document.querySelector('[data-qa="header-switch"]').id).to.not.equal('rotativo');
    });

    it('lee el estado encendido tanto por aria-pressed como por clase', async function () {
      const porAria = crearDriver(conSwitch({ attrs: 'aria-pressed="true"' }));
      const porClase = crearDriver(conSwitch({ clases: 'dx-switch-on-value', attrs: '' }));
      const opciones = { contenedor: '[class*="grupo-publicada"]' };

      expect((await new FormsHeader(porAria).ubicarSwitch('publicada', opciones)).encendido).to.equal(true);
      expect((await new FormsHeader(porClase).ubicarSwitch('publicada', opciones)).encendido).to.equal(true);
    });

    it('cae en la búsqueda por etiqueta cuando no hay contenedor propio', async function () {
      const driver = crearDriver(conSwitch({ attrs: 'aria-pressed="true"', contenedor: 'otro-contenedor' }));
      const info = await new FormsHeader(driver).ubicarSwitch('^\\s*publicada\\s*:?\\s*$');

      expect(info.encontrado).to.equal(true);
      expect(info.via).to.equal('etiqueta');
      expect(info.encendido).to.equal(true);
    });

    it('no confunde una etiqueta parecida con la buscada', async function () {
      const driver = crearDriver(
        header(`<div><label>Publicada en portal web</label><div class="${SWITCH}"></div></div>`)
      );
      const info = await new FormsHeader(driver).ubicarSwitch('^\\s*publicada\\s*:?\\s*$');

      expect(info.encontrado).to.equal(false);
    });

    it('enciende el switch apagado y devuelve el notify', async function () {
      const driver = crearDriver(conSwitch() + '<div class="notify_record">Operación Exitosa</div>');
      const resultado = await new FormsHeader(driver).encenderSwitch('publicada', {
        contenedor: '[class*="grupo-publicada"]',
        timeout: TIMEOUT,
      });

      expect(resultado.yaEstaba).to.equal(false);
      expect(resultado.exito).to.equal(true);
      expect(driver.traza.clicks[0].id).to.equal('publicada');
    });

    it('no vuelve a clickear un switch que ya estaba encendido', async function () {
      const driver = crearDriver(conSwitch({ attrs: 'aria-pressed="true"' }));
      const resultado = await new FormsHeader(driver).encenderSwitch('publicada', {
        contenedor: '[class*="grupo-publicada"]',
        timeout: TIMEOUT,
      });

      expect(resultado.yaEstaba).to.equal(true);
      expect(driver.traza.clicks).to.be.empty;
    });

    it('con `obligatorio` lanza si el switch no existe (contrato de la pantalla)', async function () {
      const driver = crearDriver(header(`<div class="${BOTON}"><span>Editar</span></div>`));
      let error = null;
      try {
        await new FormsHeader(driver).esperarSwitch('publicada', { obligatorio: true, timeout: TIMEOUT });
      } catch (err) {
        error = err;
      }

      expect(error, 'debía lanzar').to.not.equal(null);
      expect(error.message).to.contain('publicada');
    });

    it('sin `obligatorio` devuelve el diagnóstico en vez de lanzar', async function () {
      const driver = crearDriver(header(`<div class="${BOTON}"><span>Editar</span></div>`));
      const info = await new FormsHeader(driver).esperarSwitch('publicada', { timeout: TIMEOUT });

      expect(info.encontrado).to.equal(false);
      expect(info.encendido).to.equal(null);
    });
  });
});
