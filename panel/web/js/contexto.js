import { el, boton } from "./componentes.js";
import * as api from "./api.js";

// Editor de Execution Context: renderiza el Input Model (degradado a la sección
// del caso mientras el Input Model formal no exista en el framework — ver
// docs/panel-de-control-web-arquitectura.md §10). Nunca inventa campos.
//
// Flujo: editar → ejecutar. Ya NO hay "Guardar": al presionar Ejecutar, el
// detalle persiste automáticamente estos valores (ver detalle.js). El botón
// inferior es "Limpiar": vacía los valores editados sin tocar la estructura del
// archivo (conserva las claves).
//
// `crear` devuelve un handle { nodo, valores } para que el detalle lea el estado
// actual del formulario al ejecutar.

// Placeholder genérico para cualquier campo tipo "lista" (multivalor,
// separador "|" del framework — ver `parsearValoresMultiples` en
// core/strategies/builtinStrategies.js): el tipo lo infiere el anfitrión
// automáticamente (`panel/anfitrion/contexto.js#inferirTipo`) a partir de lo
// que declaró el Page Object (`{ multiple: true }` en ESTRATEGIAS) o de un
// `registrarCaso(..., { multivalor: true })` explícito — nunca hace falta
// mantener acá un mapa a mano por label.
const PLACEHOLDER_LISTA = "Opción 1 | Opción 2";

export function crear(nodo, contexto) {
  const claves = contexto.claves || [];
  const wrap = el("div", {});

  if (!claves.length) {
    wrap.append(el("p", { class: "vacio-min" }, "Este caso no requiere datos de entrada."));
    return { nodo: wrap, valores: () => ({}) };
  }

  const form = el("div", { class: "form" });
  const lectores = {};
  const controles = {};
  for (const k of claves) {
    let control;
    if (k.tipo === "switch") {
      control = el("input", { type: "checkbox", ...(k.valor ? { checked: "" } : {}) });
      lectores[k.nombre] = () => control.checked;
    } else {
      control = el("input", {
        type: "text",
        value: k.valor == null ? "" : String(k.valor),
        placeholder: k.tipo === "lista" ? PLACEHOLDER_LISTA : "(vacío ⇒ automático)",
      });
      lectores[k.nombre] = () => control.value;
    }
    controles[k.nombre] = control;
    form.append(el("label", { class: "campo" }, el("span", { class: "campo-lbl" }, k.nombre), control));
  }

  const estado = el("span", { class: "form-estado" });
  // Limpiar: vacía solo los VALORES editados por el usuario; conserva las claves
  // (estructura). Persiste el vaciado en el mismo archivo (merge no destructivo).
  const limpiar = boton("Limpiar", {
    onClick: async () => {
      const vacios = {};
      for (const k of claves) {
        const c = controles[k.nombre];
        if (k.tipo === "switch") {
          c.checked = false;
          vacios[k.nombre] = false;
        } else {
          c.value = "";
          vacios[k.nombre] = "";
        }
      }
      await api.guardarContexto(nodo.modulo, nodo.id, vacios);
      estado.textContent = "Limpiado";
      setTimeout(() => (estado.textContent = ""), 1600);
    },
  });

  wrap.append(form, el("div", { class: "form-acc" }, limpiar, estado));

  return {
    nodo: wrap,
    valores: () => {
      const v = {};
      for (const k of claves) v[k.nombre] = lectores[k.nombre]();
      return v;
    },
  };
}
