// Primitivas de UI reutilizables (vanilla, sin framework). Una sola definición
// por componente para mantener consistencia visual.

/** Crea un elemento: el('div', {class:'x', onclick:fn}, hijo1, hijo2…). */
export function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const h of hijos.flat()) {
    if (h == null) continue;
    n.append(h.nodeType ? h : document.createTextNode(h));
  }
  return n;
}

/**
 * Chevron (∨) — ÚNICO componente de "desplegar" de toda la app: menú lateral,
 * árbol, colapsables y consola lo reutilizan. Trazo grueso y abierto. La
 * rotación (apunta abajo = abierto; a la derecha = colapsado) la maneja el CSS
 * según el estado del contenedor.
 */
export function chevron() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", "chevron");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", "M3.5 6 L8 10.5 L12.5 6");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2.2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

/** Capitalización SOLO visual (inicial mayúscula). Los nombres internos no cambian. */
export function capitalizar(s) {
  s = String(s || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const ESTADOS = {
  passed: ["Aprobado", "chip--exito"],
  failed: ["Falló", "chip--error"],
  running: ["Ejecutando", "chip--info"],
  "sin-ejecutar": ["Sin ejecutar", "chip--neutro"],
  cancelled: ["Cancelado", "chip--warn"],
  pending: ["Pendiente", "chip--neutro"],
};

export function chipEstado(estado) {
  const [txt, cls] = ESTADOS[estado] || ESTADOS["sin-ejecutar"];
  return el("span", { class: `chip ${cls}` }, txt);
}

/** Botón. Solo el CTA principal usa variante 'primario' (una alta atención). */
export function boton(texto, { variante = "secundario", onClick, icono } = {}) {
  return el("button", { class: `btn btn--${variante}`, onclick: onClick }, icono ? el("span", {}, icono) : null, texto);
}

/** Sección colapsable; el contenido se construye perezosamente al abrir. */
export function colapsable(titulo, contador, contenidoFn, abierto = false) {
  const cuerpo = el("div", { class: "colap-cuerpo" });
  const construir = () => {
    if (cuerpo.dataset.cargado) return;
    cuerpo.dataset.cargado = "1";
    contenidoFn(cuerpo);
  };
  const cab = el(
    "button",
    {
      class: "colap-cab",
      onclick: () => {
        wrap.classList.toggle("abierto");
        if (wrap.classList.contains("abierto")) construir();
      },
    },
    chevron(),
    el("span", { class: "colap-tit" }, titulo),
    contador != null ? el("span", { class: "colap-num" }, String(contador)) : null
  );
  const wrap = el("div", { class: "colap" + (abierto ? " abierto" : "") }, cab, cuerpo);
  if (abierto) construir();
  return wrap;
}

export function vacio(mensaje, accion) {
  return el("div", { class: "vacio" }, el("div", { class: "vacio-ico" }, "▢"), el("p", {}, mensaje), accion || null);
}

export function confirmar(mensaje, fn) {
  if (window.confirm(mensaje)) fn();
}
