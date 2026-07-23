import { el } from "./componentes.js";

// Visores de artefactos ya generados por el framework. No se re-renderiza nada:
// el reporte Mochawesome se embebe tal cual; los demás se muestran/enlazan.

/** Última ejecución: verdad primero (error + captura del fallo). */
export function ultima(c, ult) {
  if (ult.estado === "failed" && ult.error) {
    c.append(el("div", { class: "err-headline" }, el("strong", {}, "Falló: "), ult.error.mensaje));
  }
  const clave = ult.screenshots.find((s) => s.esFallo) || ult.screenshots[ult.screenshots.length - 1];
  if (clave) c.append(el("img", { class: "shot-destacada", src: clave.url, alt: clave.label }));
  else c.append(el("p", { class: "vacio-min" }, "Sin captura para esta corrida."));
}

export function screenshots(c, shots) {
  if (!shots.length) {
    c.append(el("p", { class: "vacio-min" }, "Sin capturas para esta corrida."));
    return;
  }
  const g = el("div", { class: "galeria" });
  for (const s of shots) {
    const im = el("img", {
      class: "thumb" + (s.esFallo ? " thumb--fallo" : ""),
      src: s.url,
      alt: s.label,
      title: s.label,
      onclick: () => lightbox(s),
    });
    g.append(el("figure", {}, im, el("figcaption", {}, s.label)));
  }
  c.append(g);
}

function lightbox(s) {
  const ov = el("div", { class: "lightbox", onclick: () => ov.remove() }, el("img", { src: s.url, alt: s.label }));
  document.body.append(ov);
}

export async function log(c, logRef) {
  try {
    const t = await fetch(logRef.url).then((r) => r.text());
    c.append(el("pre", { class: "logbox" }, t));
  } catch (e) {
    c.append(el("p", { class: "vacio-min" }, "No se pudo leer el log."));
  }
}

export function evidencias(c, evs) {
  if (!evs.length) {
    c.append(el("p", { class: "vacio-min" }, "Sin evidencias."));
    return;
  }
  const l = el("div", {});
  for (const e of evs) {
    l.append(
      el(
        "div",
        { class: "evrow" },
        el("span", { class: "evtipo" }, e.tipo),
        el("span", { class: "evnom" }, e.nombre),
        el("a", { class: "btn btn--ghost", href: e.url, target: "_blank" }, "Ver")
      )
    );
  }
  c.append(l);
}

/** El reporte pesa: se carga bajo demanda o se abre en pestaña. */
export function reporteHtml(c, urlReporte) {
  c.append(
    el(
      "button",
      {
        class: "btn btn--secundario",
        onclick: () => {
          c.innerHTML = "";
          c.append(
            el("div", { class: "rep-bar" }, el("a", { class: "btn btn--ghost", href: urlReporte, target: "_blank" }, "Abrir ↗")),
            el("iframe", { class: "rep-frame", src: urlReporte })
          );
        },
      },
      "Cargar reporte"
    )
  );
}
