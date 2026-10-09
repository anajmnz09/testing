const { expect } = require('chai');
const politicas = require('../politicas');
const { ejecutarCaso } = require('../ejecutor');
const { crearMensaje, leerConfiguracion, aEntrada, aRespuesta } = require('../clienteOpenAI');
const { DEFINICIONES } = require('../navegador');

describe('ia/politicas — lo que el modelo puede hacer y cómo se consolida su resultado (unitario)', function () {
  it('navegar: solo rutas/URL del mismo origen que BASE_URL', function () {
    const base = 'https://test.triple.com.do/';
    expect(politicas.urlPermitida('/srhh/empleados', base)).to.equal('https://test.triple.com.do/srhh/empleados');
    expect(politicas.urlPermitida('https://test.triple.com.do/x', base)).to.equal('https://test.triple.com.do/x');
    expect(() => politicas.urlPermitida('https://otro.com/', base)).to.throw(/solo se permite navegar/);
    expect(() => politicas.urlPermitida('javascript:alert(1)', base)).to.throw();
    expect(() => politicas.urlPermitida('file:///C:/secreto.txt', base)).to.throw();
  });

  it('validarAccion: normaliza entradas válidas y rechaza lo que no es de la lista cerrada', function () {
    expect(politicas.validarAccion('hacer_click', { id: '3', doble: true })).to.deep.equal({ id: 3, doble: true });
    expect(politicas.validarAccion('escribir', { id: 2, texto: 'hola' })).to.deep.equal({ id: 2, texto: 'hola', borrar: true, enter: false });
    expect(politicas.validarAccion('esperar', { segundos: 99 })).to.deep.equal({ segundos: 10 });
    expect(politicas.validarAccion('inspeccionar', { captura: true })).to.deep.equal({ captura: true });
    expect(politicas.validarAccion('buscar_texto', { texto: '  Guardado  ' })).to.deep.equal({ texto: 'Guardado' });
    expect(politicas.validarAccion('leer_elemento', { id: 4 })).to.deep.equal({ id: 4 });
    expect(() => politicas.validarAccion('hacer_click', { id: -1 })).to.throw(/entero/);
    expect(() => politicas.validarAccion('buscar_texto', { texto: ' ' })).to.throw(/obligatorio/);
    expect(() => politicas.validarAccion('tecla', { tecla: 'F12' })).to.throw(/no permitida/);
    expect(() => politicas.validarAccion('ejecutar_shell', { comando: 'dir' })).to.throw(/desconocida/);
    expect(() => politicas.validarAccion('escribir', { id: 1, texto: 'x'.repeat(2001) })).to.throw(/largo/);
  });

  it('las herramientas expuestas son una lista cerrada, sin shell ni filesystem ni JS arbitrario', function () {
    const nombres = DEFINICIONES.map((d) => d.name);
    expect(nombres).to.have.members(['inspeccionar', 'buscar_texto', 'leer_elemento', 'hacer_click', 'escribir', 'tecla', 'seleccionar_opcion', 'navegar', 'esperar', 'desplazar', 'finalizar']);
    for (const prohibido of ['shell', 'comando', 'ejecutar', 'script', 'archivo', 'leer_archivo']) {
      expect(nombres.some((n) => n.includes(prohibido)), prohibido).to.equal(false);
    }
  });

  describe('consolidarResultado: verificación por observación directa; el modelo no puede inventar un PASS', function () {
    const v = (estado, evidencia = 'visto en pantalla', extra = {}) => ({ condicion: 'c', estado, evidencia, ...extra });
    it('PASS con todas las condiciones cumplidas y con evidencia textual (la captura NO es requisito)', function () {
      const r = politicas.consolidarResultado({ resultado: 'PASS', verificaciones: [v('cumplida', 'el título dice Empleados', { metodo: 'texto_visible' })] });
      expect(r.estado).to.equal('PASS');
      expect(r.verificaciones[0].metodo).to.equal('texto_visible');
    });
    it('PASS sin verificaciones -> BLOCKED', function () {
      expect(politicas.consolidarResultado({ resultado: 'PASS', verificaciones: [] }).estado).to.equal('BLOCKED');
    });
    it('"cumplida" sin ninguna evidencia cuenta como no verificada -> BLOCKED', function () {
      const r = politicas.consolidarResultado({ resultado: 'PASS', verificaciones: [v('cumplida', '  ')] });
      expect(r.estado).to.equal('BLOCKED');
      expect(r.verificaciones[0].estado).to.equal('no_verificada');
    });
    it('el texto observado citado debe existir en lo que el navegador mostró (sin importar mayúsculas ni acentos)', function () {
      const cita = (t) => ({ resultado: 'PASS', verificaciones: [v('cumplida', '', { texto_observado: t })] });
      expect(politicas.consolidarResultado(cita('Datos básicos'), { corpus: 'Empleado X | DATOS BASICOS | Guardar' }).estado).to.equal('PASS');
      expect(politicas.consolidarResultado(cita('Operación exitosa'), { corpus: 'Empleado X | Datos básicos' }).estado).to.equal('BLOCKED');
    });
    it('PASS con una incumplida -> FAIL; con una no verificada -> BLOCKED', function () {
      expect(politicas.consolidarResultado({ resultado: 'PASS', verificaciones: [v('cumplida'), v('incumplida')] }).estado).to.equal('FAIL');
      expect(politicas.consolidarResultado({ resultado: 'PASS', verificaciones: [v('cumplida'), v('no_verificada')] }).estado).to.equal('BLOCKED');
    });
    it('FAIL declarado se respeta; BLOCKED declarado se respeta; resultado desconocido -> BLOCKED', function () {
      expect(politicas.consolidarResultado({ resultado: 'FAIL', motivo: 'm', verificaciones: [v('cumplida')] }).estado).to.equal('FAIL');
      expect(politicas.consolidarResultado({ resultado: 'BLOCKED', motivo: 'sin acceso', verificaciones: [v('cumplida')] })).to.include({ estado: 'BLOCKED', motivo: 'sin acceso' });
      expect(politicas.consolidarResultado({ resultado: 'OK' }).estado).to.equal('BLOCKED');
    });
  });

  it('recortarImagenes: conserva las últimas N capturas, no toca el PDF y no muta la entrada', function () {
    const tr = (id) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: 't' }, { type: 'image', source: {} }] }] });
    const pdf = { role: 'user', content: [{ type: 'document', source: { data: 'PDF' } }, { type: 'image', source: {} }] };
    const msgs = [pdf, tr('a'), tr('b'), tr('c')];
    const out = politicas.recortarImagenes(msgs, 2);
    expect(JSON.stringify(out[1])).to.contain('omitida');
    expect(JSON.stringify(out[2])).to.contain('"image"');
    expect(JSON.stringify(out[3])).to.contain('"image"');
    expect(out[0]).to.equal(pdf);
    expect(JSON.stringify(msgs[1])).to.contain('"image"'); // sin mutar
  });
});

describe('ia/ejecutor — bucle texto del UC -> Claude -> acción -> evidencia -> resultado (unitario, sin red ni navegador)', function () {
  const estado = { url: 'https://app/x', titulo: 'T', texto: 'hola', notificaciones: [], dialogos: [], elementos: [{ id: 1, tipo: 'button', etiqueta: 'Guardar' }] };
  const nuevo = () => {
    const acciones = [];
    const caps = [];
    return {
      acciones,
      caps,
      navegador: {
        estado: async () => estado,
        captura: async () => 'AAAA',
        ejecutar: async (n, i) => {
          if (n === 'hacer_click' && i.id === 99) throw new Error('No existe el elemento 99');
          return `ok ${n}`;
        },
      },
      evidencia: { guardarCaptura: (b, e) => caps.push(e), registrarAccion: (a) => acciones.push(a) },
    };
  };
  const uso = (name, input, id = 't1') => ({ type: 'tool_use', id, name, input });
  const guion = (respuestas, peticiones = []) => async (cuerpo) => {
    peticiones.push(cuerpo);
    return respuestas.shift();
  };
  const fin = (extra = {}) => ({ content: [uso('finalizar', { resultado: 'PASS', resumen: 'r', verificaciones: [{ condicion: 'c', estado: 'cumplida', evidencia: 'e', ...extra }] })] });

  it('las instrucciones del agente fijan: solo funcionalidad observable (no código), reglas de negocio, imágenes opcionales y BLOCKED solo si es imposible', function () {
    const { SISTEMA } = require('../ejecutor');
    for (const frase of ['COMPORTAMIENTO FUNCIONAL OBSERVABLE', 'NO son pasos ni condiciones', 'REGLAS DE NEGOCIO', 'referencia visual opcional', 'Nunca por una imagen no interpretada', 'no inventes reglas de negocio']) {
      expect(SISTEMA.toLowerCase(), frase).to.contain(frase.toLowerCase());
    }
  });

  it('el TEXTO del caso llega al modelo como fuente principal; sin imágenes relevantes no se envía el PDF', async function () {
    const e = nuevo();
    const peticiones = [];
    const texto = 'Paso 1: abrir el módulo Empleados.\nResultado esperado: se muestra el listado.';
    const r = await ejecutarCaso({ crearMensaje: guion([fin()], peticiones), ...e, texto });
    const primero = peticiones[0].messages[0].content;
    expect(primero[0].type).to.equal('text');
    expect(primero[0].text).to.contain('ESPECIFICACIÓN DEL CASO DE USO').and.contain(texto).and.contain('FUENTE PRINCIPAL').and.contain('REFERENCIAS VISUALES');
    expect(primero.some((b) => b.type === 'document')).to.equal(false);
    expect(primero.some((b) => b.type === 'image')).to.equal(true); // captura inicial de la APP (no del PDF)
    expect(r.estado).to.equal('PASS');
  });

  it('con imágenes en el PDF (o texto insuficiente) se adjunta el PDF como referencia visual OPCIONAL, después del texto', async function () {
    const e = nuevo();
    const peticiones = [];
    await ejecutarCaso({ crearMensaje: guion([fin()], peticiones), ...e, texto: 'Caso con captura de referencia.', pdfBase64: 'UERG', imagenes: 2 });
    const primero = peticiones[0].messages[0].content;
    expect(primero[0].text).to.contain('referencia cuando aporten').and.contain('No dependas de ellas');
    expect(primero[1]).to.deep.include({ type: 'document' });
    expect(primero[1].source).to.deep.include({ type: 'base64', media_type: 'application/pdf', data: 'UERG' });
  });

  it('ciclo completo: acción -> resultado con el estado en TEXTO -> finalizar; guarda evidencia de cada paso', async function () {
    const e = nuevo();
    const peticiones = [];
    const crear = guion(
      [
        { content: [{ type: 'text', text: 'voy' }, uso('hacer_click', { id: 1 }, 'a')], usage: { input_tokens: 10, output_tokens: 2 } },
        { content: [uso('finalizar', { resultado: 'PASS', resumen: 'r', verificaciones: [{ condicion: 'c', estado: 'cumplida', evidencia: 'e' }] }, 'b')] },
      ],
      peticiones
    );
    const r = await ejecutarCaso({ crearMensaje: crear, ...e, texto: 'x' });
    expect(r).to.include({ estado: 'PASS', acciones: 1 });
    expect(r.uso).to.deep.equal({ entrada: 10, salida: 2 });
    const resultado = peticiones[1].messages[2].content[0];
    expect(resultado).to.include({ type: 'tool_result', tool_use_id: 'a' });
    expect(resultado.content.some((c) => c.type === 'text' && c.text.includes('Elementos interactivos'))).to.equal(true);
    expect(e.caps).to.include.members(['estado inicial', '1 hacer_click', 'estado final']); // la evidencia en disco siempre se guarda
    expect(e.acciones.map((a) => a.accion)).to.deep.equal(['hacer_click', 'finalizar']);
  });

  it('capturas hacia el modelo solo cuando aportan; las lecturas (buscar_texto) no cambian la página y responden solo con lo leído', async function () {
    const e = nuevo();
    let n = 0;
    e.navegador.estado = async () => ({ ...estado, url: n++ === 2 ? 'https://app/otra' : 'https://app/x' }); // inicial, tras acción 1 (igual), tras acción 2 (URL nueva)
    e.navegador.ejecutar = async (nom) => (nom === 'buscar_texto' ? 'El texto aparece 1 vez.' : 'ok');
    const peticiones = [];
    const crear = guion(
      [
        { content: [uso('hacer_click', { id: 1 }, 'a')] },
        { content: [uso('hacer_click', { id: 1 }, 'b')] },
        { content: [uso('buscar_texto', { texto: 'x' }, 'c')] },
        fin(),
      ],
      peticiones
    );
    await ejecutarCaso({ crearMensaje: crear, ...e, texto: 'x' });
    const ultimo = (i) => JSON.stringify(peticiones[i].messages.slice(-1)[0]);
    expect(ultimo(1)).to.not.contain('"type":"image"'); // acción 1: sin cambio relevante
    expect(ultimo(2)).to.contain('"type":"image"'); // acción 2: cambió la URL
    expect(ultimo(3)).to.not.contain('Elementos interactivos'); // lectura: solo el resultado
    expect(ultimo(3)).to.not.contain('"type":"image"');
    expect(e.caps.filter((c) => c.includes('hacer_click'))).to.have.length(2); // aun así queda evidencia en disco
  });

  it('un BLOCKED se cuestiona una vez: el modelo sigue, comprueba con una lectura directa (sin captura) y llega a PASS', async function () {
    const e = nuevo();
    e.navegador.ejecutar = async (nom) => (nom === 'buscar_texto' ? 'El texto aparece 1 vez. Contexto: ["listado de empleados"]' : 'ok');
    const peticiones = [];
    const crear = guion(
      [
        { content: [uso('finalizar', { resultado: 'BLOCKED', resumen: '', motivo: 'no tengo captura del listado', verificaciones: [] }, 'a')] },
        { content: [uso('buscar_texto', { texto: 'listado de empleados' }, 'b')] },
        { content: [uso('finalizar', { resultado: 'PASS', resumen: 'ok', verificaciones: [{ condicion: 'Se muestra el listado', estado: 'cumplida', metodo: 'texto_visible', texto_observado: 'listado de empleados' }] }, 'c')] },
      ],
      peticiones
    );
    const r = await ejecutarCaso({ crearMensaje: crear, ...e, texto: 'x' });
    expect(peticiones[1].messages[2].content[0]).to.include({ is_error: true });
    expect(JSON.stringify(peticiones[1].messages[2].content[0])).to.contain('Aún no se acepta BLOCKED');
    expect(r.estado).to.equal('PASS');
    expect(r.verificaciones[0]).to.include({ metodo: 'texto_visible' });
  });

  it('un BLOCKED confirmado tras el cuestionamiento se acepta con su motivo (no se insiste más)', async function () {
    const e = nuevo();
    const bloqueo = (id) => ({ content: [uso('finalizar', { resultado: 'BLOCKED', resumen: '', motivo: 'El caso exige otro usuario', verificaciones: [] }, id)] });
    const r = await ejecutarCaso({ crearMensaje: guion([bloqueo('a'), bloqueo('b')]), ...e, texto: 'x' });
    expect(r).to.include({ estado: 'BLOCKED', motivo: 'El caso exige otro usuario' });
  });

  it('un texto "observado" que el navegador nunca mostró NO se acepta como cumplido (anti-invención)', async function () {
    const e = nuevo();
    const mal = () => ({ content: [uso('finalizar', { resultado: 'PASS', resumen: 'r', verificaciones: [{ condicion: 'Aparece Guardado', estado: 'cumplida', metodo: 'mensaje_app', texto_observado: 'Registro guardado con éxito' }] }, 'a')] });
    const r = await ejecutarCaso({ crearMensaje: guion([mal(), mal(), mal()]), ...e, texto: 'x' });
    expect(r.estado).to.equal('BLOCKED');
    expect(r.verificaciones[0].estado).to.equal('no_verificada');
  });

  it('una acción inválida o fallida se devuelve al modelo como error (no revienta ni se ejecuta)', async function () {
    const e = nuevo();
    const peticiones = [];
    const crear = guion(
      [
        { content: [uso('ejecutar_shell', { comando: 'dir' }, 'a')] },
        { content: [uso('hacer_click', { id: 99 }, 'b')] },
        { content: [uso('finalizar', { resultado: 'BLOCKED', resumen: '', motivo: 'no pude', verificaciones: [] }, 'c')] },
        { content: [uso('finalizar', { resultado: 'BLOCKED', resumen: '', motivo: 'no pude', verificaciones: [] }, 'd')] },
      ],
      peticiones
    );
    const r = await ejecutarCaso({ crearMensaje: crear, ...e, texto: 'x' });
    expect(peticiones[1].messages[2].content[0]).to.include({ is_error: true });
    expect(JSON.stringify(peticiones[1].messages[2].content[0])).to.contain('desconocida');
    expect(peticiones[2].messages[4].content[0]).to.include({ is_error: true });
    expect(r.estado).to.equal('BLOCKED');
  });

  it('límite de acciones -> BLOCKED con el motivo', async function () {
    const e = nuevo();
    const crear = async () => ({ content: [uso('inspeccionar', {})] });
    const r = await ejecutarCaso({ crearMensaje: crear, ...e, texto: 'x', maxAcciones: 3 });
    expect(r.estado).to.equal('BLOCKED');
    expect(r.motivo).to.match(/máximo de acciones \(3\)/);
    expect(r.acciones).to.equal(3);
  });

  it('límite de tiempo y error de la API -> BLOCKED; terminar sin finalizar -> BLOCKED', async function () {
    let t = 0;
    const e1 = nuevo();
    const r1 = await ejecutarCaso({ crearMensaje: async () => ({ content: [uso('inspeccionar', {})] }), ...e1, texto: 'x', maxMs: 10, ahora: () => (t += 100) });
    expect(r1.motivo).to.match(/tiempo máximo/);
    const e2 = nuevo();
    const r2 = await ejecutarCaso({ crearMensaje: async () => { throw new Error('API caída'); }, ...e2, texto: 'x' });
    expect(r2).to.include({ estado: 'BLOCKED' });
    expect(r2.motivo).to.contain('API caída');
    const e3 = nuevo();
    const r3 = await ejecutarCaso({ crearMensaje: async () => ({ content: [{ type: 'text', text: 'listo' }] }), ...e3, texto: 'x' });
    expect(r3.estado).to.equal('BLOCKED');
  });
});

describe('ia/clienteOpenAI — API Responses de OpenAI (unitario, fetch simulado)', function () {
  const cfg = { apiKey: 'sk-secreta', modelo: 'm', baseUrl: 'https://api.test', maxTokens: 100, razonamiento: '' };
  const resp = (status, cuerpo) => ({ ok: status < 300, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) });

  it('envía POST /v1/responses con la key SOLO en Authorization, sin estado en servidor y con las herramientas traducidas', async function () {
    let visto;
    const fetchImpl = async (url, o) => {
      visto = { url, o };
      return resp(200, { output: [] });
    };
    const tools = [{ name: 'hacer_click', description: 'd', input_schema: { type: 'object', properties: { id: { type: 'number' } } } }];
    await crearMensaje({ system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: 'hola' }] }], tools }, { config: cfg, fetchImpl });
    expect(visto.url).to.equal('https://api.test/v1/responses');
    expect(visto.o.headers.authorization).to.equal('Bearer sk-secreta');
    const body = JSON.parse(visto.o.body);
    expect(body).to.include({ model: 'm', instructions: 's', store: false, parallel_tool_calls: false, max_output_tokens: 100 });
    expect(body.input).to.deep.equal([{ role: 'user', content: [{ type: 'input_text', text: 'hola' }] }]);
    expect(body.tools[0]).to.include({ type: 'function', name: 'hacer_click' });
    expect(body.tools[0].parameters).to.deep.equal(tools[0].input_schema);
    expect(visto.o.body).to.not.contain('sk-secreta');
  });

  it('traduce el historial: PDF/imagen -> input_file/input_image; tool_use/tool_result -> function_call/function_call_output; capturas como mensaje de usuario', function () {
    const entrada = aEntrada([
      { role: 'user', content: [{ type: 'text', text: 'UC' }, { type: 'document', source: { media_type: 'application/pdf', data: 'PDF' } }] },
      { role: 'assistant', content: [{ type: 'razonamiento', item: { type: 'reasoning', id: 'rs1' } }, { type: 'text', text: 'voy' }, { type: 'tool_use', id: 'c1', name: 'hacer_click', input: { id: 3 } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', is_error: true, content: [{ type: 'text', text: 'fallo' }, { type: 'image', source: { media_type: 'image/png', data: 'IMG' } }] }] },
    ]);
    expect(entrada[0].content[1]).to.deep.equal({ type: 'input_file', filename: 'caso-de-uso.pdf', file_data: 'data:application/pdf;base64,PDF' });
    expect(entrada[1]).to.deep.equal({ type: 'reasoning', id: 'rs1' });
    expect(entrada[2]).to.deep.equal({ role: 'assistant', content: [{ type: 'output_text', text: 'voy' }] });
    expect(entrada[3]).to.deep.equal({ type: 'function_call', call_id: 'c1', name: 'hacer_click', arguments: '{"id":3}' });
    expect(entrada[4]).to.deep.equal({ type: 'function_call_output', call_id: 'c1', output: 'ERROR: fallo' });
    expect(entrada[5].role).to.equal('user');
    expect(entrada[5].content[1]).to.deep.equal({ type: 'input_image', image_url: 'data:image/png;base64,IMG', detail: 'auto' });
  });

  it('traduce la respuesta: function_call -> tool_use (argumentos parseados), message -> text, reasoning conservado, usage', function () {
    const r = aRespuesta({
      output: [
        { type: 'reasoning', id: 'rs1' },
        { type: 'message', content: [{ type: 'output_text', text: 'hola' }] },
        { type: 'function_call', call_id: 'c9', name: 'esperar', arguments: '{"ms":500}' },
      ],
      usage: { input_tokens: 7, output_tokens: 3 },
    });
    expect(r.content.map((b) => b.type)).to.deep.equal(['razonamiento', 'text', 'tool_use']);
    expect(r.content[2]).to.deep.equal({ type: 'tool_use', id: 'c9', name: 'esperar', input: { ms: 500 } });
    expect(r.usage).to.deep.equal({ input_tokens: 7, output_tokens: 3 });
  });

  it('reintenta 429/5xx con espera y falla con un mensaje sin la key', async function () {
    let n = 0;
    const fetchImpl = async () => (++n < 3 ? resp(503, { error: { message: 'overloaded' } }) : resp(200, { output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] }));
    const r = await crearMensaje({ messages: [] }, { config: cfg, fetchImpl, esperas: [0, 0, 0] });
    expect(n).to.equal(3);
    expect(r.content).to.deep.equal([{ type: 'text', text: 'ok' }]);
    try {
      await crearMensaje({ messages: [] }, { config: cfg, fetchImpl: async () => resp(400, { error: { message: 'mal pedido' } }), esperas: [0] });
      expect.fail('debía fallar');
    } catch (e) {
      expect(e.message).to.contain('400').and.contain('mal pedido');
      expect(e.message).to.not.contain('sk-secreta');
    }
  });

  it('sin OPENAI_API_KEY falla antes de llamar a la red; la configuración sale del entorno', async function () {
    let llamado = false;
    try {
      await crearMensaje({ messages: [] }, { config: { ...cfg, apiKey: '' }, fetchImpl: async () => { llamado = true; } });
      expect.fail('debía fallar');
    } catch (e) {
      expect(e.message).to.contain('OPENAI_API_KEY');
    }
    expect(llamado).to.equal(false);
    expect(leerConfiguracion({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'otro' })).to.include({ apiKey: 'k', modelo: 'otro', baseUrl: 'https://api.openai.com' });
  });
});
