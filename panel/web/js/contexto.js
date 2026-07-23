import { el, boton } from "./componentes.js";
import * as api from "./api.js";

// Editor de Execution Context: renderiza el Input Model (degradado a la sección
// del caso mientras el Input Model formal no exista en el framework — ver
// docs/panel-de-control-web-arquitectura.md §10). Nunca inventa campos.
export function render(c, nodo, contexto) {
  const claves = contexto.claves || [];
  if (!claves.length) {
    c.append(el("p", { class: "vacio-min" }, "Este caso no requiere datos de entrada."));
    return;
  }

  const form = el("div", { class: "form" });
  const lectores = {};
  for (const k of claves) {
    let control;
    if (k.tipo === "switch") {
      control = el("input", { type: "checkbox", ...(k.valor ? { checked: "" } : {}) });
      lectores[k.nombre] = () => control.checked;
    } else {
      control = el("input", {
        type: "text",
        value: k.valor == null ? "" : String(k.valor),
        placeholder: "(vacío ⇒ automático)",
      });
      lectores[k.nombre] = () => control.value;
    }
    form.append(el("label", { class: "campo" }, el("span", { class: "campo-lbl" }, k.nombre), control));
  }

  const estado = el("span", { class: "form-estado" });
  const guardar = boton("Guardar", {
    onClick: async () => {
      const valores = {};
      for (const k of claves) valores[k.nombre] = lectores[k.nombre]();
      await api.guardarContexto(nodo.modulo, nodo.id, valores);
      estado.textContent = "Guardado";
      setTimeout(() => (estado.textContent = ""), 1600);
    },
  });

  c.append(form, el("div", { class: "form-acc" }, guardar, estado));
}
