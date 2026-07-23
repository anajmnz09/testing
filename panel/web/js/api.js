// Cliente de los endpoints del anfitrión. El frontend nunca conoce comandos ni
// el motor: pide datos y devuelve el `run` opaco que recibió en el descriptor.
const j = (u, o) => fetch(u, o).then((r) => r.json());
const enc = encodeURIComponent;

export const arbol = () => j("/api/arbol");
export const caso = (modulo, caso) => j(`/api/caso?modulo=${enc(modulo)}&caso=${enc(caso)}`);
export const codigo = (ruta) => j(`/api/codigo?ruta=${enc(ruta)}`);
export const historial = (modulo) => j(`/api/historial?modulo=${enc(modulo)}`);
export const corrida = (modulo, runId) => j(`/api/corrida?modulo=${enc(modulo)}&runId=${enc(runId)}`);

export const ejecutar = (run) =>
  j("/api/ejecutar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run }),
  });
export const cancelar = () => j("/api/cancelar", { method: "POST" });
export const guardarContexto = (modulo, caso, valores) =>
  j("/api/contexto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modulo, caso, valores }),
  });

/** Suscribe a la corrida en vivo (SSE). Devuelve el EventSource. */
export function vivo(onLinea, onFin) {
  const es = new EventSource("/api/vivo");
  es.addEventListener("linea", (e) => onLinea(JSON.parse(e.data).texto));
  es.addEventListener("fin", (e) => {
    onFin(JSON.parse(e.data).codigo);
    es.close();
  });
  es.addEventListener("inactiva", () => es.close());
  return es;
}
