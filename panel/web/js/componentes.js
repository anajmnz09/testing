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
    el("span", { class: "chev" }, "▸"),
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
