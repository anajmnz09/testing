const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { testContext, evidence } = require('@triple/core');
const fixtures = require('../support/fixtures');

const CASO = 'agregar-foto-usuario';
// Fixture genérica del framework (avatar neutro, sin datos personales) —
// misma imagen que usa `agregar-foto-solicitud-empleo`
// (reclutamiento/data/fixtures/avatar-qa.png), copiada acá para no acoplar
// este módulo a otro.
const FOTO_QA = path.join(__dirname, '..', 'data', 'fixtures', 'avatar-qa.png');

// Entradas del caso: `nombre` dirige a un Usuario puntual (sin él, se elige
// el PRIMERO del listado). `archivo` permite dirigir la prueba a otra
// imagen; sin él, se usa la fixture QA.
testContext.registrarCaso(CASO, ['nombre', 'archivo']);

/**
 * Sube una foto a un Usuario EXISTENTE (no crea ninguno) y confirma que
 * quedó aplicada — mismo mecanismo que `agregar-foto-solicitud-empleo`
 * (Reclutamiento): MISMO componente de foto compartido por la app
 * (`UserImage_user_image_component__R8CsV`, `input#file-upload` oculto),
 * confirmado con Selenium real. Requiere entrar en modo Editar primero (a
 * diferencia de Solicitudes, acá el acceso a Editar es vía
 * `#usuario-form-dropdown-acciones` — ver `UsuarioDetallePage`).
 *
 * OJO — confirmado con evidencia real (2026-08-21): esta pantalla NO
 * refresca el `<img>` de la foto en el lugar tras Guardar, aunque la foto sí
 * quedó aplicada de verdad en el servidor (confirmado navegando fuera del
 * registro y reabriéndolo, y con `driver.navigate().refresh()`: ambos
 * muestran el `src` nuevo correcto). Por eso, tras guardar, este test
 * recarga la pantalla ANTES de leer `getFotoSrc()` — leer en el lugar,
 * inmediatamente después de `guardar()`, reproduce un falso fallo (ver nota
 * en `UsuarioDetallePage.getFotoSrc`).
 *
 * La verificación final NO compara "src antes" vs "src después": si el
 * Usuario elegido ya tenía subida esta MISMA fixture de una corrida
 * anterior (fixture fija, re-subida sobre el mismo registro), ambos valores
 * son idénticos byte a byte y esa comparación falla en falso sin que haya
 * ningún problema real (confirmado con evidencia real, 2026-08-21, sobre
 * "petronila"). La foto recién aplicada por la app SIEMPRE se sirve como
 * `data:image/...;base64,…` (nunca como URL), mientras que el placeholder
 * por defecto es SIEMPRE una URL (`.../SRH-PFP-Negro...png`) — por eso la
 * señal confiable de "se aplicó una foto real" es que el `src` final sea un
 * data URI de imagen, sin importar cuál era el valor antes.
 */
describe('Configuración - Agregar Foto a Usuario', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoUsuarios();

  it(`${CASO}: sube una foto a un Usuario existente y confirma que quedó aplicada`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    const nombreUsado = nombreDirigido || (await detalle.getNombre());

    const archivoIndicado = testContext.get(CASO, 'archivo');
    let rutaFoto = FOTO_QA;
    if (archivoIndicado) {
      rutaFoto = path.resolve(archivoIndicado);
      if (!fs.existsSync(rutaFoto)) {
        throw new Error(
          `${CASO}: el archivo indicado en el Execution Context no existe: "${rutaFoto}". ` +
            'Corregí la ruta o dejá el campo "archivo" vacío para usar la fixture QA.'
        );
      }
    }

    const srcAntes = await detalle.getFotoSrc();

    await detalle.editar();
    await detalle.subirFoto(rutaFoto);
    await detalle.guardar();

    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba guardado exitoso para "${nombreUsado}". Notify: "${res.notify}"`);

    // La pantalla no refresca la foto en el lugar tras guardar (ver nota de
    // `UsuarioDetallePage.getFotoSrc`) — recargar antes de leer el resultado.
    await ctx.driver.navigate().refresh();
    await detalle.estaCargado();

    const srcDespues = await detalle.getFotoSrc();
    await evidence.attachScreenshot(ctx.driver, this, { label: 'Foto aplicada' });

    assert.ok(
      !srcDespues.includes('SRH-PFP-Negro'),
      `La foto de "${nombreUsado}" sigue mostrando el placeholder por defecto tras guardar (src: "${srcDespues}").`
    );
    assert.ok(
      srcDespues.startsWith('data:image/'),
      `La foto de "${nombreUsado}" no quedó aplicada como imagen embebida tras guardar (src: "${srcDespues}", antes: "${srcAntes}").`
    );
  });
});
