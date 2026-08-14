const { By } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const config = require('../config');

/**
 * Toast de notificación de la app (clase `notify_record`). Aparece en TODAS las
 * pantallas (guardar, validar, publicar, errores), así que vive en el core como
 * componente reutilizable en vez de repetirse en cada Page Object.
 *
 * Textos observados en la app: "Operación Exitosa", "Formulario Inválido",
 * "Error en el sistema".
 */
class Notify extends BaseComponent {
  constructor(driver) {
    super(driver);
    this.locator = By.css('[class*="notify_record"]');
  }

  /**
   * Texto del notify visible ahora mismo ('' si no hay). No espera.
   *
   * Ignora a propósito cualquier nodo `notify_record` cuyo texto matchee el
   * widget de fondo "Generación de nómina" — confirmado con evidencia real
   * (Grados Académicos y Horarios, ambiente actual): este widget usa la
   * MISMA clase `notify_record` que el toast real de Guardar, pero es un
   * status de un proceso de nómina AJENO al test (de otro usuario/sesión,
   * "Usuario: Lyanne"), se mantiene visible varios segundos y va mutando su
   * propio texto ("Cargando Nómina..." → "Cargando Períodos..."). Sin este
   * filtro, `querySelector` puede devolver ESE nodo en vez del notify real
   * de la acción, y el test falla clasificando una notificación que no le
   * pertenece.
   */
  async getTexto() {
    return this.driver.executeScript(() => {
      const nodos = document.querySelectorAll('[class*="notify_record"]');
      // El widget de fondo es un MISMO nodo que va mutando su contenido en
      // etapas ("Generación de nómina" -> "Verificando proceso..." ->
      // "Nómina:Cargando Nómina...Período:Cargando Períodos..." -> ...) —
      // confirmado con evidencia real que un match de solo el título inicial
      // no alcanza (en otra corrida, el mismo poll cayó en una etapa donde
      // el texto YA no incluía "Generación de nómina", solo "Nómina:
      // Cargando..."). Se excluye por la estructura común a TODAS las
      // etapas observadas ("Nómina:"/"Período:" con dos puntos, o
      // "Verificando proceso"), no por el texto completo.
      for (const n of nodos) {
        const t = (n.textContent || '').trim();
        if (t && !/n[oó]mina\s*:|per[ií]odo\s*:|verificando proceso/i.test(t)) return t;
      }
      return '';
    });
  }

  /** Espera a que aparezca un notify (real, ver `getTexto`) y devuelve su texto ('' si no aparece). */
  async esperarTexto(timeoutMs = config.timeouts.explicitWaitMs) {
    let texto = '';
    await this.driver
      .wait(async () => {
        texto = await this.getTexto();
        return !!texto;
      }, timeoutMs)
      .catch(() => {});
    return texto;
  }

  /** Clasifica un texto de notify según los patrones reales de la app. */
  static clasificar(texto = '') {
    return {
      notify: texto,
      exito: /exitosa|exitosamente|success/i.test(texto),
      invalido: /inv[aá]lido/i.test(texto),
      errorSistema: /error en el sistema/i.test(texto),
    };
  }

  /** Espera un notify y lo devuelve ya clasificado. */
  async esperarResultado(timeoutMs = config.timeouts.explicitWaitMs) {
    return Notify.clasificar(await this.esperarTexto(timeoutMs));
  }
}

module.exports = Notify;
