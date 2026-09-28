const { By, Key } = require('selenium-webdriver');
const { createDriver, authFlow, navigationFlow, quitDriver } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const EmpleadosPage = require('../pages/EmpleadosPage');

(async () => {
  const driver = await createDriver();
  try {
    await authFlow.login(driver);
    await navigationFlow.abrirModulo(driver, 'Empleados');
    const lista = await new EmpleadosPage(driver).listo();
    const detalle = await lista.abrirPrimero();
    await detalle.abrirSeccion('Dependientes');
    await detalle.esperarTituloContenido('Dependientes');
    const form = await detalle.abrirAgregarDependiente();

    const f = new Form(driver);
    await f.seleccionar('Tipo ID', 'Cedula');
    await driver.sleep(500);

    // Estado del input de Identificación ANTES de tocar nada.
    const antes = await driver.executeScript(() => {
      const labels = Array.from(document.querySelectorAll('label')).filter((l) => /identificaci[oó]n/i.test(l.textContent || ''));
      const item = labels[0] ? labels[0].closest('.dependiente-form-item') : null;
      const input = item ? item.querySelector('input') : null;
      return {
        itemHTML: item ? item.outerHTML.slice(0, 600) : null,
        inputValue: input ? input.value : null,
        inputAttrs: input ? { placeholder: input.placeholder, maxlength: input.maxLength, readonly: input.readOnly, disabled: input.disabled } : null,
      };
    });
    console.log('ANTES', JSON.stringify(antes, null, 2));

    // Intento 1: click + sendKeys dígito por dígito.
    const input = await driver.findElement(By.xpath("//label[contains(.,'Identificación')]/ancestor::div[contains(@class,'dependiente-form-item')]//input"));
    await input.click();
    for (const ch of '00170333939') {
      await input.sendKeys(ch);
      await driver.sleep(50);
    }
    await driver.sleep(300);
    const tras1 = await input.getAttribute('value');
    console.log('TRAS_SENDKEYS_DIGITO_A_DIGITO', JSON.stringify(tras1));

    // Estado completo del contenedor tras el intento.
    const dump1 = await driver.executeScript((sel) => {
      const el = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      return el ? el.outerHTML.slice(0, 700) : null;
    }, "//label[contains(.,'Identificación')]/ancestor::div[contains(@class,'dependiente-form-item')]");
    console.log('DUMP_CONTENEDOR_TRAS_INTENTO1', dump1);
  } catch (e) {
    console.log('ERROR_FATAL', e.message, e.stack);
  } finally {
    await quitDriver(driver);
  }
})();
