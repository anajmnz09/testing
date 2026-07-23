# Panel de Control Web

Interfaz gráfica **aditiva** del framework de automatización. No reemplaza nada: descubre, muestra, ejecuta y visualiza lo que el framework ya genera. Sin dependencias (solo módulos nativos de Node), sin build, sin bundler.

## Levantarlo

Desde la raíz del monorepo:

```bash
node panel/anfitrion/servidor.js
```

Luego abrir en el navegador: **http://127.0.0.1:4599** (puerto configurable con `PANEL_PORT`).

## Qué hace (y qué no)

- **Descubre** módulos/suites/casos escaneando el filesystem (convención `tests/*.test.js`). Ningún registro manual.
- **Ejecuta** los mismos comandos que la consola (`npm test -- …`) vía `child_process`. No es una Runner API: es una pasarela transparente.
- **Visualiza** el reporte Mochawesome, screenshots, evidencias, logs, código y el historial, leyendo directamente `<módulo>/reports/`.
- **No** genera reportes propios, ni base de datos, ni métricas, ni lógica de Selenium/Mocha.

Diseño y decisiones: ver `docs/panel-de-control-web-arquitectura.md`, `docs/panel-de-control-web-experiencia-ux.md` y `docs/panel-de-control-web-ui-diseno.md`.
