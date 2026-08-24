import { el, boton, colapsable } from "./componentes.js";
import * as api from "./api.js";

// Pantalla de Configuración DEL PANEL (framework/entorno de pruebas) — distinta
// de la sección "Configuración" de la app bajo prueba. Mismo layout que el
// detalle de un caso (detalle.js), sin la línea de módulo (no aplica acá).
export async function abrir(cont) {
  cont.innerHTML = "";
  cont.append(el("div", { class: "cargando" }, "Cargando…"));
  const campos = await api.configuracion();
  cont.innerHTML = "";

  cont.append(
    el("div", { class: "caso-head" }, el("div", { class: "caso-titulo" }, el("h1", {}, "Configuración")))
  );

  cont.append(
    el(
      "div",
      { class: "caso-descripcion" },
      el(
        "p",
        {},
        "Configuración del framework de pruebas y del Panel: credenciales y URL de acceso a la app, comportamiento de Selenium (navegador, timeouts, reintentos), capturas de pantalla y reportes, y si el navegador debe permanecer abierto al concluir una prueba. Los cambios se guardan en el archivo .env de la raíz del proyecto y aplican desde la próxima ejecución."
      )
    )
  );

  const secciones = [...new Set(campos.map((c) => c.seccion))];
  const lectores = {};
  const seccionesEl = el("div", {});
  for (const seccion of secciones) {
    const camposSeccion = campos.filter((c) => c.seccion === seccion);
    seccionesEl.append(
      colapsable(
        seccion,
        camposSeccion.length,
        (cuerpo) => {
          const form = el("div", { class: "form" });
          for (const campo of camposSeccion) {
            let control;
            if (campo.tipo === "checkbox") {
              control = el("input", { type: "checkbox", ...(campo.valor ? { checked: "" } : {}) });
              lectores[campo.clave] = () => control.checked;
            } else if (campo.tipo === "select") {
              control = el(
                "select",
                {},
                ...campo.opciones.map((o) => el("option", { value: o, ...(o === campo.valor ? { selected: "" } : {}) }, o))
              );
              lectores[campo.clave] = () => control.value;
            } else {
              const tipoHtml = campo.tipo === "password" ? "password" : campo.tipo === "numero" ? "number" : "text";
              control = el("input", { type: tipoHtml, value: campo.valor == null ? "" : String(campo.valor) });
              lectores[campo.clave] = () => control.value;
            }
            form.append(el("label", { class: "campo" }, el("span", { class: "campo-lbl" }, campo.etiqueta), control));
          }
          cuerpo.append(form);
        },
        true
      )
    );
  }
  cont.append(seccionesEl);

  const estado = el("span", { class: "form-estado" });
  const guardar = boton("Guardar", {
    variante: "primario",
    onClick: async () => {
      const valores = {};
      for (const clave of Object.keys(lectores)) valores[clave] = lectores[clave]();
      await api.guardarConfiguracion(valores);
      estado.textContent = "Guardado";
      setTimeout(() => (estado.textContent = ""), 1600);
    },
  });
  cont.append(el("div", { class: "caso-acciones" }, guardar, estado));
}
