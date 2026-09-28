const { createDriver, authFlow, navigationFlow, quitDriver } = require('@triple/core');
const Notify = require('@triple/core/components/Notify');
const DataGrid = require('@triple/core/components/DataGrid');
const EmpleadosPage = require('../pages/EmpleadosPage');

(async () => {
  const driver = await createDriver();
  try {
    await authFlow.login(driver);
    await navigationFlow.abrirModulo(driver, 'Empleados');
    const lista = await new EmpleadosPage(driver).listo();
    const detalle = await lista.abrirPrimero();
    await detalle.abrirSeccion('Capacitación');
    await detalle.esperarTituloContenido('Capacitación');
    await driver.sleep(1000);

    const adjuntos = await detalle.abrirAdjuntarCapacitacion(0);
    console.log('TITULO', await adjuntos.tituloCapacitacion());
    const filasAntes = await adjuntos.leerAdjuntos();
    console.log('ADJUNTOS_ANTES', JSON.stringify(filasAntes));

    // Seleccionar checkbox de la PRIMERA fila -> verificar clase dx-selection ANTES de tocar Eliminar.
    const grid = new DataGrid(driver);
    const marcado = await grid.seleccionarFila();
    console.log('CHECKBOX_MARCADO', marcado);
    await driver.sleep(500);

    const estadoSeleccion = await driver.executeScript(() => {
      const page = document.querySelector('.capacitaciones-docs-page') || document.body;
      const grid = Array.from(page.querySelectorAll('.dx-datagrid')).find((g) => g.offsetParent);
      if (!grid) return { hayGrid: false };
      const filas = Array.from(grid.querySelectorAll('.dx-data-row'));
      return {
        hayGrid: true,
        totalFilas: filas.length,
        filaSeleccionadaIdx: filas.findIndex((f) => f.className.includes('dx-selection')),
        clasesPrimeraFila: filas[0] ? filas[0].className : null,
      };
    });
    console.log('ESTADO_SELECCION', JSON.stringify(estadoSeleccion));

    const clickEliminar = await driver.executeScript(() => {
      const page = document.querySelector('.capacitaciones-docs-page') || document.body;
      const btn = Array.from(page.querySelectorAll('button, .dx-button, [role="button"]')).find(
        (b) => b.offsetParent && /^eliminar$/i.test((b.textContent || '').trim())
      );
      if (!btn) return { encontrado: false };
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      return { encontrado: true, disabled: /dx-state-disabled/.test(btn.className) };
    });
    console.log('CLICK_ELIMINAR', JSON.stringify(clickEliminar));
    await driver.sleep(1200);

    const popup = await driver.executeScript(() => {
      const p = Array.from(document.querySelectorAll('.dx-popup-wrapper, .dx-overlay-wrapper')).filter((x) => x.offsetWidth > 0).pop();
      if (!p) return null;
      const botones = Array.from(p.querySelectorAll('button, .dx-button, [role="button"]')).map((b) => (b.textContent || '').trim());
      return { texto: (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400), botones };
    });
    console.log('POPUP', JSON.stringify(popup));

    const notify = new Notify(driver);

    if (popup) {
      const clickAceptar = await driver.executeScript(() => {
        const p = Array.from(document.querySelectorAll('.dx-popup-wrapper, .dx-overlay-wrapper')).filter((x) => x.offsetWidth > 0).pop();
        const btn = Array.from(p.querySelectorAll('button, .dx-button, [role="button"]')).find((b) =>
          /aceptar|s[ií]|confirmar|eliminar/i.test((b.textContent || '').trim())
        );
        if (!btn) return { encontrado: false };
        btn.click();
        return { encontrado: true };
      });
      console.log('CLICK_ACEPTAR', JSON.stringify(clickAceptar));
    } else {
      console.log('SIN_POPUP_leyendo_notify_directo');
    }

    const texto = await notify.esperarTexto(8000);
    console.log('NOTIFY_FINAL', JSON.stringify(texto));

    const filasDespues = await adjuntos.leerAdjuntos();
    console.log('ADJUNTOS_DESPUES', JSON.stringify(filasDespues));
    console.log('SE_ELIMINO', filasDespues.length < filasAntes.length);

    // Confirmar si es lag de refresh de grid o el delete no persistió: recargar la pantalla.
    await driver.navigate().refresh();
    await new (require('../pages/CapacitacionAdjuntosPage'))(driver).estaCargado();
    await driver.sleep(1500);
    const filasTrasReload = await adjuntos.leerAdjuntos();
    console.log('ADJUNTOS_TRAS_RELOAD', JSON.stringify(filasTrasReload));
    console.log('SE_ELIMINO_REAL', filasTrasReload.length < filasAntes.length);
  } catch (e) {
    console.log('ERROR_FATAL', e.message, e.stack);
  } finally {
    await quitDriver(driver);
  }
})();
