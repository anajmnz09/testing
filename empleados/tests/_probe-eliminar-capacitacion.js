const { createDriver, authFlow, navigationFlow, quitDriver } = require('@triple/core');
const Notify = require('@triple/core/components/Notify');
const EmpleadosPage = require('../pages/EmpleadosPage');

(async () => {
  const driver = await createDriver();
  try {
    await authFlow.login(driver);
    await navigationFlow.abrirModulo(driver, 'Empleados');
    const lista = await new EmpleadosPage(driver).listo();
    const detalle = await lista.abrirPrimero();
    const nombreEmpleado = await detalle.getNombre();
    console.log('EMPLEADO', nombreEmpleado);

    await driver.executeScript(() => {
      window.__probeErrors = [];
      window.addEventListener('error', (e) => window.__probeErrors.push('ERROR: ' + e.message));
      window.addEventListener('unhandledrejection', (e) => window.__probeErrors.push('REJECTION: ' + (e.reason && e.reason.message || e.reason)));
      const origFetch = window.fetch;
      window.__probeXHR = [];
      window.fetch = function (...args) {
        return origFetch.apply(this, args).then((res) => {
          if (!res.ok) window.__probeXHR.push(`FETCH ${res.status} ${args[0]}`);
          return res;
        }).catch((err) => { window.__probeXHR.push(`FETCH_ERR ${args[0]} ${err.message}`); throw err; });
      };
    });

    await detalle.abrirSeccion('Capacitación');
    await detalle.esperarTituloContenido('Capacitación');
    await driver.sleep(1000);

    // 1) Barra de título de la sección: botones Agregar/Eliminar.
    const barra = await driver.executeScript(() => {
      const page = document.querySelector('.capacitaciones-page');
      const cont = page ? page.querySelector('.record-name-and-main-btns, .list-header, .container-header') : null;
      const zona = cont || page || document.body;
      const botones = Array.from(zona.querySelectorAll('button, .dx-button, [role="button"]'))
        .filter((b) => b.offsetParent)
        .map((b) => ({ texto: (b.textContent || '').trim(), title: b.getAttribute('title'), cls: b.className }));
      return { hayPage: !!page, htmlZona: zona.outerHTML.slice(0, 2000), botones };
    });
    console.log('BARRA_CAPACITACION', JSON.stringify(barra, null, 2));

    const filas = await detalle.leerFilasCapacitacion();
    console.log('FILAS_CAPACITACION', JSON.stringify(filas));

    if (!filas.length) {
      console.log('SIN_FILAS_NO_SE_PUEDE_PROBAR_ELIMINAR');
    } else {
      // 2) Seleccionar checkbox de la primera fila del grid de Capacitación.
      const DataGrid = require('@triple/core/components/DataGrid');
      const grid = new DataGrid(driver);
      const marcado = await grid.seleccionarFila().catch((e) => {
        console.log('ERROR_SELECCIONAR_FILA', e.message);
        return false;
      });
      console.log('CHECKBOX_MARCADO', marcado);
      await driver.sleep(500);

      // Dump de la barra tras seleccionar (el botón "Eliminar" puede habilitarse recién acá).
      const barra2 = await driver.executeScript(() => {
        const page = document.querySelector('.capacitaciones-page');
        const zona = page || document.body;
        const botones = Array.from(zona.querySelectorAll('button, .dx-button, [role="button"]'))
          .filter((b) => b.offsetParent)
          .map((b) => ({ texto: (b.textContent || '').trim(), title: b.getAttribute('title'), cls: b.className, disabled: /dx-state-disabled/.test(b.className) }));
        return botones;
      });
      console.log('BOTONES_TRAS_SELECCIONAR', JSON.stringify(barra2, null, 2));

      // 3) Click en "Eliminar".
      const clickEliminar = await driver.executeScript(() => {
        const btn = Array.from(document.querySelectorAll('button, .dx-button, [role="button"]')).find(
          (b) => b.offsetParent && /^eliminar$/i.test((b.textContent || '').trim())
        );
        if (!btn) return { encontrado: false };
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        return { encontrado: true };
      });
      console.log('CLICK_ELIMINAR', JSON.stringify(clickEliminar));
      await driver.sleep(1500);

      // 4) Popup de confirmación.
      const popup = await driver.executeScript(() => {
        const p = Array.from(document.querySelectorAll('.dx-popup-wrapper, .dx-overlay-wrapper')).filter((x) => x.offsetWidth > 0).pop();
        if (!p) return null;
        const botones = Array.from(p.querySelectorAll('button, .dx-button, [role="button"]')).map((b) => (b.textContent || '').trim());
        return { texto: (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500), botones };
      });
      console.log('POPUP_CONFIRMAR', JSON.stringify(popup, null, 2));

      if (popup) {
        const clickAceptar = await driver.executeScript(() => {
          const p = Array.from(document.querySelectorAll('.dx-popup-wrapper, .dx-overlay-wrapper')).filter((x) => x.offsetWidth > 0).pop();
          if (!p) return { encontrado: false };
          const btn = Array.from(p.querySelectorAll('button, .dx-button, [role="button"]')).find((b) =>
            /aceptar|s[ií]|confirmar|eliminar/i.test((b.textContent || '').trim())
          );
          if (!btn) return { encontrado: false };
          btn.click();
          return { encontrado: true, texto: (btn.textContent || '').trim() };
        });
        console.log('CLICK_ACEPTAR', JSON.stringify(clickAceptar));
      }

      // 5) Resultado: notify real (clase notify_record, SIN sleep previo para no perderse un toast corto) + persistencia + errores JS/fetch capturados.
      const notify = new Notify(driver);
      const texto = await notify.esperarTexto(8000);
      console.log('NOTIFY_TEXTO', JSON.stringify(texto));

      const popupSigueAbierto = await driver.executeScript(() => {
        const p = Array.from(document.querySelectorAll('.dx-popup-wrapper, .dx-overlay-wrapper')).filter((x) => x.offsetWidth > 0).pop();
        return !!p;
      });
      console.log('POPUP_SIGUE_ABIERTO', popupSigueAbierto);

      const errores = await driver.executeScript(() => ({ js: window.__probeErrors, xhr: window.__probeXHR }));
      console.log('ERRORES_JS_FETCH', JSON.stringify(errores, null, 2));

      await driver.sleep(1000);
      const filasTras = await detalle.leerFilasCapacitacion().catch((e) => {
        console.log('ERROR_RELEER_FILAS', e.message);
        return null;
      });
      console.log('FILAS_TRAS_ELIMINAR', JSON.stringify(filasTras));
      console.log('SE_ELIMINO', filasTras ? filasTras.length < filas.length : 'desconocido');
    }
  } catch (e) {
    console.log('ERROR_FATAL', e.message, e.stack);
  } finally {
    await quitDriver(driver);
  }
})();
