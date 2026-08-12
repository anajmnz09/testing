const fs = require('fs');
const { createDriver, authFlow, navigationFlow, quitDriver } = require('@triple/core');
const SRHHNavBar = require('@triple/core/components/SRHHNavBar');
const { By } = require('selenium-webdriver');

(async () => {
  const driver = await createDriver();
  try {
    await authFlow.login(driver);
    await navigationFlow.abrirModulo(driver, 'Reclutamiento');
    const navBar = new SRHHNavBar(driver);
    await navBar.ir('Banco de candidatos');
    await driver.sleep(1500);

    // Ubicar el botón "Agregar" junto al título (SrhhGenericBar)
    const botones = await driver.findElements(By.xpath("//*[contains(@class,'SrhhGenericBar')]//button | //*[contains(@class,'SrhhGenericBar')]//div[contains(@class,'dx-button')]"));
    console.log('BOTONES_EN_BARRA', botones.length);
    for (const b of botones) {
      try {
        const txt = await b.getText();
        const aria = await b.getAttribute('aria-label');
        const title = await b.getAttribute('title');
        console.log('BOTON', JSON.stringify({ txt, aria, title }));
      } catch (e) {}
    }

    const agregarBtn = await driver.findElement(By.xpath("//*[normalize-space(.)='Agregar'][contains(@class,'dx-button') or self::button]"));
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', agregarBtn);
    await agregarBtn.click();
    await driver.sleep(1500);

    const overlay = await driver.findElements(By.css('.dx-popup-wrapper, .dx-overlay-wrapper'));
    console.log('OVERLAYS', overlay.length);

    const html = await driver.executeScript(() => {
      const overlays = Array.from(document.querySelectorAll('.dx-popup-wrapper, .dx-overlay-wrapper'));
      const visible = overlays.find((o) => {
        const r = o.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && window.getComputedStyle(o).display !== 'none';
      });
      return visible ? visible.outerHTML : '(no overlay visible)';
    });
    fs.writeFileSync('C:/Users/Anabel/Desktop/desarrollo/testing/reclutamiento/tests/_probe-modal.html', html);
    console.log('HTML_LEN', html.length);

    // Título del modal
    const titulo = await driver.executeScript(() => {
      const t = document.querySelector('.dx-popup-wrapper .dx-popup-title, .dx-overlay-wrapper .dx-popup-title');
      return t ? t.textContent : null;
    });
    console.log('TITULO_MODAL', titulo);

    // Labels de campos dentro del modal
    const labels = await driver.executeScript(() => {
      const overlays = Array.from(document.querySelectorAll('.dx-popup-wrapper, .dx-overlay-wrapper'));
      const visible = overlays.find((o) => {
        const r = o.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (!visible) return [];
      const items = Array.from(visible.querySelectorAll('.dx-field-item, .group-field'));
      return items.map((it) => {
        const lbl = it.querySelector('.dx-field-item-label, label, .group-field-label');
        return {
          label: lbl ? lbl.textContent.trim() : null,
          cls: it.className,
        };
      });
    });
    console.log('CAMPOS', JSON.stringify(labels, null, 2));

    // Botones dentro del modal (Guardar, Importar CV, etc.)
    const botonesModal = await driver.executeScript(() => {
      const overlays = Array.from(document.querySelectorAll('.dx-popup-wrapper, .dx-overlay-wrapper'));
      const visible = overlays.find((o) => {
        const r = o.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (!visible) return [];
      const btns = Array.from(visible.querySelectorAll('.dx-button, button'));
      return btns.map((b) => ({
        texto: b.textContent.trim(),
        aria: b.getAttribute('aria-label'),
        title: b.getAttribute('title'),
      }));
    });
    console.log('BOTONES_MODAL', JSON.stringify(botonesModal, null, 2));
  } catch (e) {
    console.log('ERROR', e.message);
  } finally {
    await quitDriver(driver);
  }
})();
