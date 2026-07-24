const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Página PÚBLICA de la vacante (portal externo `empleos.test.triple.com.do`), la
 * que abre el enlace compartido de una requisición publicada. Es una pantalla
 * distinta de la app interna, por eso vive en su propio Page Object.
 *
 * El nombre de la requisición se muestra en `.detail-title` (verificado en el
 * DOM real del portal público).
 */
const NOMBRE = By.css('.detail-title');

class VacantePublicaPage extends BasePage {
  /** Espera a que el portal público cargue y el título tenga texto. */
  async esperarCarga(timeout = config.timeouts.explicitWaitMs) {
    await this.waitVisible(NOMBRE, timeout);
    await this.driver.wait(async () => !!(await this.getNombre()), timeout).catch(() => {});
    logger.info('VacantePublicaPage: vacante pública cargada');
    return this;
  }

  /** Nombre de la requisición tal como se ve en la vacante pública. */
  async getNombre() {
    const els = await this.driver.findElements(NOMBRE);
    if (!els.length) return '';
    return (await els[0].getText()).trim();
  }
}

module.exports = VacantePublicaPage;
