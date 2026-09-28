const { createDriver, authFlow, navigationFlow, quitDriver } = require('@triple/core');
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

    const abierta = await detalle.abrirSeccion('Dependientes');
    console.log('SECCION_ACTIVADA', JSON.stringify(abierta));
    await driver.sleep(1200);

    // Dump general de la sección: clase contenedora, botones visibles, si hay grid.
    const info = await driver.executeScript(() => {
      const candidatos = Array.from(document.querySelectorAll('[class*="dependiente"], [class*="Dependiente"]'));
      const contenedores = candidatos.filter((el) => el.offsetParent).map((el) => el.className);
      const botones = Array.from(document.querySelectorAll('button, .dx-button, [role="button"]'))
        .filter((b) => b.offsetParent)
        .map((b) => ({ texto: (b.textContent || '').trim(), title: b.getAttribute('title'), cls: b.className }))
        .filter((b) => b.texto || b.title);
      const grids = Array.from(document.querySelectorAll('.dx-datagrid')).filter((g) => g.offsetParent).length;
      return { contenedoresClases: [...new Set(contenedores)], botones, cantidadGridsVisibles: grids };
    });
    console.log('INFO_SECCION', JSON.stringify(info, null, 2));

    // Header del/de los grid(s) visibles, para encontrar la firma de columnas de Dependientes.
    const headers = await driver.executeScript(() => {
      return Array.from(document.querySelectorAll('.dx-datagrid'))
        .filter((g) => g.offsetParent)
        .map((g) => ({
          clase: g.className,
          headers: Array.from(g.querySelectorAll('.dx-header-row td')).map((h) => (h.textContent || '').trim()),
          filas: g.querySelectorAll('.dx-data-row').length,
        }));
    });
    console.log('HEADERS_GRIDS', JSON.stringify(headers, null, 2));

    // Click en "Agregar" -> ver si abre inline (como Capacitación) o popup.
    const clickAgregar = await driver.executeScript(() => {
      const btn = Array.from(document.querySelectorAll('button, .dx-button, [role="button"]')).find(
        (b) => b.offsetParent && /^agregar$/i.test((b.textContent || '').trim())
      );
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      return true;
    });
    console.log('CLICK_AGREGAR', clickAgregar);
    await driver.sleep(1500);

    const tituloUrl = await driver.getCurrentUrl();
    console.log('URL_TRAS_AGREGAR', tituloUrl);

    // Dump de labels/campos del form que haya aparecido (inline o popup).
    const formInfo = await driver.executeScript(() => {
      const popup = Array.from(document.querySelectorAll('.dx-popup-wrapper, .dx-overlay-wrapper')).filter((p) => p.offsetWidth > 0).pop();
      const zona = popup || document.body;
      const labels = Array.from(zona.querySelectorAll('label, [class*="label"]'))
        .filter((l) => l.offsetParent)
        .map((l) => (l.textContent || '').trim())
        .filter(Boolean);
      const spans = Array.from(zona.querySelectorAll('span'))
        .filter((s) => s.offsetParent && /:\s*$/.test((s.textContent || '').trim()))
        .map((s) => (s.textContent || '').trim());
      const botonesForm = Array.from(zona.querySelectorAll('button, .dx-button, [role="button"]'))
        .filter((b) => b.offsetParent)
        .map((b) => (b.textContent || '').trim())
        .filter(Boolean);
      return { hayPopup: !!popup, labels, spansConDosPuntos: spans, botonesForm };
    });
    console.log('FORM_INFO', JSON.stringify(formInfo, null, 2));

    // Para cada label, inspeccionar el tipo de editor DevExtreme real.
    const camposInfo = await driver.executeScript(() => {
      const resultado = [];
      const items = Array.from(document.querySelectorAll('.dependiente-form-item')).filter((i) => i.offsetParent);
      for (const item of items) {
        const labelEl = item.querySelector('label, [class*="label"]');
        const labelTxt = labelEl ? (labelEl.textContent || '').trim() : null;
        if (!labelTxt) continue;
        const editor = item.querySelector(
          '.dx-selectbox, .dx-datebox, .dx-numberbox, .dx-switch, .dx-checkbox, .dx-tagbox, .dx-textbox, .dx-texteditor'
        );
        resultado.push({
          label: labelTxt,
          editorClases: editor ? editor.className : null,
          disabled: item.className.includes('disabled') || (editor && editor.className.includes('dx-state-disabled')),
        });
      }
      return resultado;
    });
    console.log('CAMPOS_INFO', JSON.stringify(camposInfo, null, 2));

    // Fallback: encontrar el label "Parentesco" y volcar su contenedor ancestro.
    const dumpParentesco = await driver.executeScript(() => {
      const labels = Array.from(document.querySelectorAll('label, [class*="label"]')).filter(
        (l) => l.offsetParent && /parentesco/i.test((l.textContent || '').trim())
      );
      if (!labels.length) return null;
      const l = labels[0];
      let anc = l.parentElement;
      const cadena = [];
      for (let i = 0; i < 4 && anc; i++) {
        cadena.push(anc.className);
        anc = anc.parentElement;
      }
      // contenedor "razonable": 2-3 niveles arriba del label
      const contenedor = l.closest('div');
      return { labelHTML: l.outerHTML, cadenaClases: cadena, contenedorHTML: contenedor ? contenedor.outerHTML.slice(0, 800) : null };
    });
    console.log('DUMP_PARENTESCO', JSON.stringify(dumpParentesco, null, 2));
  } catch (e) {
    console.log('ERROR_FATAL', e.message, e.stack);
  } finally {
    await quitDriver(driver);
  }
})();
