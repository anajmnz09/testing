'use strict';

/**
 * Cliente mínimo de la API Responses de OpenAI (`POST /v1/responses`, HTTPS directo con `fetch`, sin dependencias nuevas).
 *
 * El bucle (`ejecutor.js`) trabaja con un formato neutro de mensajes (bloques `text` / `image` / `document` / `tool_use` /
 * `tool_result`) y este módulo es el ÚNICO que lo traduce al formato de OpenAI y de vuelta. Sin estado en el servidor
 * (`store: false`): cada turno reenvía el historial; los ítems de razonamiento del modelo viajan cifrados dentro de bloques
 * `razonamiento` para que el modelo conserve su contexto entre llamadas.
 *
 * La API key SOLO se lee aquí del entorno del proceso del runner y viaja únicamente en la cabecera `Authorization` hacia
 * la API: no se loguea, no se guarda en evidencia y nunca pasa por el Panel/frontend.
 */
const REINTENTABLES = new Set([429, 500, 502, 503, 504]);

function leerConfiguracion(env = process.env) {
  return {
    apiKey: env.OPENAI_API_KEY || '',
    modelo: env.OPENAI_MODEL || 'gpt-6.1-sol',
    baseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/+$/, ''),
    maxTokens: Number(env.IA_MAX_TOKENS) || 16000,
    razonamiento: env.OPENAI_REASONING_EFFORT || '',
  };
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const aImagen = (b) => ({ type: 'input_image', image_url: `data:${b.source.media_type || 'image/png'};base64,${b.source.data}`, detail: 'auto' });

/** Contenido de un mensaje de usuario (bloques neutros) -> partes `input_*` de OpenAI. */
function aPartes(bloques) {
  return (Array.isArray(bloques) ? bloques : [{ type: 'text', text: String(bloques) }]).map((b) => {
    if (b.type === 'image') return aImagen(b);
    if (b.type === 'document') {
      return { type: 'input_file', filename: 'caso-de-uso.pdf', file_data: `data:${b.source.media_type || 'application/pdf'};base64,${b.source.data}` };
    }
    return { type: 'input_text', text: b.text };
  });
}

/** Historial neutro -> `input` de la API Responses. */
function aEntrada(messages) {
  const items = [];
  for (const m of messages) {
    if (m.role === 'assistant') {
      const texto = m.content.filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n');
      for (const b of m.content) if (b.type === 'razonamiento') items.push(b.item);
      if (texto) items.push({ role: 'assistant', content: [{ type: 'output_text', text: texto }] });
      for (const b of m.content) {
        if (b.type === 'tool_use') items.push({ type: 'function_call', call_id: b.id, name: b.name, arguments: JSON.stringify(b.input || {}) });
      }
      continue;
    }
    const resultados = m.content.filter((b) => b.type === 'tool_result');
    const resto = m.content.filter((b) => b.type !== 'tool_result');
    const imagenes = [];
    for (const r of resultados) {
      const partes = Array.isArray(r.content) ? r.content : [{ type: 'text', text: String(r.content) }];
      const texto = partes.filter((p) => p.type === 'text').map((p) => p.text).join('\n');
      items.push({ type: 'function_call_output', call_id: r.tool_use_id, output: r.is_error ? `ERROR: ${texto}` : texto });
      partes.filter((p) => p.type === 'image').forEach((p) => imagenes.push(p));
    }
    // OpenAI no documenta imágenes dentro de function_call_output: las capturas van en un mensaje de usuario a continuación.
    const extra = [...imagenes, ...resto];
    if (extra.length) {
      const partes = [];
      if (imagenes.length) partes.push({ type: 'input_text', text: 'Captura(s) de pantalla del resultado de la última acción:' });
      partes.push(...aPartes(extra));
      items.push({ role: 'user', content: partes });
    }
  }
  return items;
}

/** Respuesta de OpenAI -> `{content, usage}` en el formato neutro del bucle. */
function aRespuesta(json) {
  const content = [];
  for (const it of json.output || []) {
    if (it.type === 'reasoning') content.push({ type: 'razonamiento', item: it });
    else if (it.type === 'message') {
      const texto = (it.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
      if (texto) content.push({ type: 'text', text: texto });
    } else if (it.type === 'function_call') {
      let input = {};
      try {
        input = JSON.parse(it.arguments || '{}');
      } catch (e) {
        input = { _argumentos_invalidos: String(it.arguments).slice(0, 200) };
      }
      content.push({ type: 'tool_use', id: it.call_id, name: it.name, input });
    }
  }
  const u = json.usage || {};
  return { content, usage: { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 }, estado: json.status, incompleto: json.incomplete_details || null };
}

const aHerramienta = (t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.input_schema, strict: false });

/**
 * @param {{system:string, messages:Array, tools:Array}} cuerpo  formato neutro del bucle
 * @param {{config?:object, fetchImpl?:Function, esperas?:number[]}} [opciones]
 * @returns {Promise<{content:Array, usage:{input_tokens:number,output_tokens:number}}>}
 */
async function crearMensaje(cuerpo, { config = leerConfiguracion(), fetchImpl = fetch, esperas = [1000, 3000, 8000] } = {}) {
  if (!config.apiKey) throw new Error('Falta OPENAI_API_KEY (variable de entorno del servidor).');
  const peticion = {
    model: config.modelo,
    instructions: cuerpo.system,
    input: aEntrada(cuerpo.messages),
    tools: (cuerpo.tools || []).map(aHerramienta),
    parallel_tool_calls: false,
    store: false,
    include: ['reasoning.encrypted_content'],
    max_output_tokens: config.maxTokens,
  };
  if (config.razonamiento) peticion.reasoning = { effort: config.razonamiento };
  let ultimo;
  for (let intento = 0; intento <= esperas.length; intento++) {
    let res;
    try {
      res = await fetchImpl(`${config.baseUrl}/v1/responses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(peticion),
      });
    } catch (e) {
      ultimo = new Error(`No se pudo contactar la API de OpenAI: ${e.message}`);
      if (intento < esperas.length) {
        await dormir(esperas[intento]);
        continue;
      }
      throw ultimo;
    }
    if (res.ok) return aRespuesta(await res.json());
    const texto = await res.text().catch(() => '');
    let detalle = texto.slice(0, 400);
    try {
      const j = JSON.parse(texto);
      if (j && j.error && j.error.message) detalle = j.error.message;
    } catch (e) {
      /* texto plano */
    }
    ultimo = new Error(`API de OpenAI respondió ${res.status}: ${detalle}`);
    ultimo.status = res.status;
    if (REINTENTABLES.has(res.status) && intento < esperas.length) {
      await dormir(esperas[intento]);
      continue;
    }
    throw ultimo;
  }
  throw ultimo;
}

module.exports = { crearMensaje, leerConfiguracion, aEntrada, aRespuesta };
