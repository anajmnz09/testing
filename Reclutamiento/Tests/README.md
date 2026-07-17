# Módulo Reclutamiento — Pruebas E2E

Proyecto de pruebas automatizadas del módulo **Reclutamiento**. Consume el framework `@triple/core` (ver la documentación completa en el **[README de la raíz](../../README.md)**: arquitectura, capas, configuración, recetas y referencia de la API).

## Correr las pruebas

Desde esta carpeta (`Reclutamiento/Tests`):

```bash
npm test                                   # toda la suite del módulo
npm test -- tests/login.test.js            # un solo archivo
npm run report:open                        # abre el último reporte HTML
npm run report:clean                       # limpia el historial de reportes
```

> Si es la primera vez, corré `npm install` **en la raíz** `Selenium/` (no acá): las dependencias están hoisteadas por workspaces.

## Contenido del módulo

```
Tests/
├── pages/                                 # Page Objects propios del módulo
│   └── RequisicionesPage.js               # plantilla: extiende BasePage y compone DataGrid del core
├── tests/
│   ├── login.test.js                      # login / logout (usa authFlow del core)
│   ├── navegacion.test.js                 # abrir módulo y volver (navigationFlow del core)
│   └── reclutamiento-requisiciones.test.js# grid de Requisiciones (RequisicionesPage)
└── reports/                               # reportes generados (no se versiona)
```

## Agregar pruebas de Reclutamiento

1. Si necesitás una pantalla nueva, creá su Page Object en `pages/` siguiendo `RequisicionesPage.js` (extiende `BasePage`, compone componentes del core, expone lenguaje de negocio).
2. Creá el spec en `tests/` reutilizando `authFlow`, `navigationFlow` y los componentes del core.

Los ejemplos paso a paso (test nuevo, page nueva, flow nuevo, componente nuevo, evidencias) están en las **[recetas del README raíz](../../README.md#recetas-mini-ejemplos)**.

## Credenciales / configuración

Viven en el **`.env` global** (`Selenium/.env`), no acá. Detalle en la [sección de configuración del README raíz](../../README.md#configuración).
