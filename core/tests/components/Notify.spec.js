const { expect } = require('chai');
const Notify = require('../../components/Notify');
const { crearDriver } = require('../support/fakeDriver');

/**
 * Notify — el toast `notify_record` con el que la app confirma o rechaza una
 * operación. Es el primer criterio de éxito de casi todos los casos, así que su
 * clasificación tiene que ser exacta: un falso "éxito" pinta de verde un caso
 * que en realidad falló.
 */
describe('Notify (unitario)', function () {
  const TIMEOUT = 60;

  describe('clasificación de los textos reales de la app', function () {
    const casos = [
      { texto: 'Operación Exitosa', esperado: 'exito' },
      { texto: 'Registro guardado exitosamente', esperado: 'exito' },
      { texto: 'Formulario Inválido', esperado: 'invalido' },
      { texto: 'Formulario Invalido', esperado: 'invalido' },
      { texto: 'Error en el sistema', esperado: 'errorSistema' },
    ];

    casos.forEach(({ texto, esperado }) => {
      it(`clasifica "${texto}" como ${esperado}`, function () {
        const resultado = Notify.clasificar(texto);

        expect(resultado[esperado], `${esperado} debía ser true`).to.equal(true);
        ['exito', 'invalido', 'errorSistema']
          .filter((k) => k !== esperado)
          .forEach((otro) => expect(resultado[otro], `${otro} debía ser false`).to.equal(false));
      });
    });

    it('conserva el texto original para poder mostrarlo en el reporte', function () {
      expect(Notify.clasificar('Operación Exitosa').notify).to.equal('Operación Exitosa');
    });

    it('sin notify no hay éxito (nunca asume que salió bien)', function () {
      [' ', ''].forEach((texto) => {
        const resultado = Notify.clasificar(texto);
        expect(resultado.exito).to.equal(false);
        expect(resultado.invalido).to.equal(false);
        expect(resultado.errorSistema).to.equal(false);
      });
      expect(Notify.clasificar().exito).to.equal(false);
    });

    it('no confunde un texto cualquiera con un éxito', function () {
      expect(Notify.clasificar('La requisición está en revisión').exito).to.equal(false);
    });
  });

  describe('lectura del toast en pantalla', function () {
    it('lee el texto del notify visible', async function () {
      const driver = crearDriver('<div class="notify_record_success">Operación Exitosa</div>');

      expect(await new Notify(driver).getTexto()).to.equal('Operación Exitosa');
    });

    it('devuelve cadena vacía cuando no hay ningún notify', async function () {
      const driver = crearDriver('<div class="otra-cosa">nada</div>');

      expect(await new Notify(driver).getTexto()).to.equal('');
    });

    it('espera a que el notify aparezca y lo devuelve clasificado', async function () {
      const driver = crearDriver('<div id="app"></div>');
      // la app lo renderiza un instante después de la acción
      setTimeout(() => {
        driver.document.getElementById('app').innerHTML =
          '<div class="notify_record">Operación Exitosa</div>';
      }, 20);

      const resultado = await new Notify(driver).esperarResultado(TIMEOUT * 5);

      expect(resultado.exito).to.equal(true);
      expect(resultado.notify).to.equal('Operación Exitosa');
    });

    it('si el notify nunca aparece, no lanza: informa que no hubo éxito', async function () {
      const driver = crearDriver('<div id="app"></div>');

      const resultado = await new Notify(driver).esperarResultado(TIMEOUT);

      expect(resultado.notify).to.equal('');
      expect(resultado.exito).to.equal(false);
    });
  });
});
