/**
 * Contrato base de una Selection Strategy.
 *
 * Una estrategia sabe CÓMO se le pone un valor a un tipo de control. El test
 * nunca conoce esa mecánica: solo dice "quiero este valor en este campo".
 *
 * Para agregar soporte a un control nuevo NO se toca ni un test ni el Form:
 * se crea una subclase y se la registra (principio Open/Closed).
 *
 *   class MiEstrategia extends SelectionStrategy {
 *     async aplicar(form, label, valor) { ... }
 *   }
 *   strategies.registrar('miEstrategia', new MiEstrategia());
 */
class SelectionStrategy {
  /** Nombre con el que se registra/resuelve la estrategia. */
  get nombre() {
    return this.constructor.name;
  }

  /**
   * Aplica `valor` al control identificado por `label`.
   *
   * @param {Form}   form   componente Form del core (da acceso al driver y a
   *                        las primitivas ya verificadas de la app)
   * @param {string} label  label del control
   * @param {*}      valor  valor deseado (lo provee el test o el Execution Context)
   * @param {object} opciones extras específicos de la estrategia
   * @returns {Promise<*>}  valor efectivamente aplicado (útil cuando la
   *                        estrategia elige por su cuenta, ej. primera opción)
   */
  async aplicar(form, label, valor, opciones = {}) {
    throw new Error(`La estrategia "${this.nombre}" no implementa aplicar()`);
  }
}

module.exports = SelectionStrategy;
