# Claude Framework Guidelines

> Este documento define los principios de ingeniería del framework de automatización.
>
> Todo cambio realizado por Claude debe respetar estas directrices antes de modificar cualquier archivo del proyecto.

---

# Objetivo del Framework

Este proyecto no consiste únicamente en automatizar pruebas.

El objetivo es construir un framework de automatización reutilizable, mantenible, escalable y fácil de extender para cualquier módulo del sistema.

Cada cambio debe aportar valor al framework completo, no únicamente al caso de prueba actual.

---

# Principios Fundamentales

## 1. Comprender antes de modificar

Antes de escribir código:

- Leer el README.
- Comprender la arquitectura existente.
- Identificar componentes reutilizables.
- Entender el flujo completo antes de implementar.

Nunca asumir cómo funciona el proyecto.

---

## 2. Reutilizar siempre

Antes de crear:

- un selector,
- un helper,
- un componente,
- un flow,
- un page object,
- una utilidad,

verificar primero si ya existe algo equivalente.

Si existe, reutilizarlo.

Si no existe, evaluar si debe agregarse al Core para futuras reutilizaciones.

Nunca duplicar lógica.

---

## 3. Diseñar para el futuro

Todo código nuevo debe pensarse como si fuera a ser utilizado por decenas de pruebas futuras.

Nunca implementar soluciones exclusivas para un único caso.

Si una funcionalidad tiene potencial de reutilización, convertirla en un componente del framework.

---

## 4. Mantener compatibilidad

Todas las mejoras deben ser aditivas.

No romper:

- APIs públicas
- Componentes existentes
- Flows existentes
- Tests existentes
- Reportes
- Logger
- Evidence
- Execution Context

Si una refactorización modifica comportamiento existente, debe conservar compatibilidad hacia atrás.

---

# Arquitectura

Debe mantenerse la separación de responsabilidades.

## Core

Contiene únicamente elementos reutilizables por cualquier módulo.

Ejemplos:

- Components
- Utils
- Selection Strategies
- Metadata
- Logger
- Evidence
- Execution Context

Nunca agregar aquí lógica específica de ningun modulo.

---

## Flows

Representan procesos completos.

Ejemplos:

Login

Abrir módulo

Buscar requisición

Volver al listado

No deben contener lógica de bajo nivel del DOM.

---

## Page Objects

Representan únicamente una pantalla.

Deben conocer:

- controles
- acciones
- validaciones
- lectura de información

No deben conocer procesos completos del negocio.

---

## Tests

Los tests únicamente orquestan.

Un test debe leerse como un flujo funcional.

No debe contener lógica compleja.

---

# Componentes

Siempre que aparezca una funcionalidad reutilizable evaluar si debe convertirse en componente.

Ejemplos:

FormsHeader

Dialogs

Popup

Toolbar

Tabs

Uploader

DataGrid

NavBar

Notify

Etc.

---

# Selectores

Los selectores deben ser robustos.

Prioridad:

1. id

2. data-testid

3. aria-label

4. title

5. texto visible

6. estructura estable

Nunca utilizar:

- índices
- posiciones
- primer botón encontrado
- último botón encontrado
- base64
- estructura visual frágil

Si no existe un selector confiable:

- registrar evidencia;
- generar diagnóstico;
- fallar explícitamente.

Nunca adivinar.

---

# Metadata

Antes de inspeccionar una pantalla:

Verificar si existe metadata reutilizable.

Si la metadata es válida:

Reutilizarla.

Si está vencida:

Regenerarla mediante el mecanismo del framework.

Nunca inspeccionar innecesariamente.

---

# Execution Context

El Execution Context representa datos externos al framework.

Debe permitir:

- datos proporcionados por el usuario;
- descubrimiento automático;
- estrategias híbridas.

Nunca depender únicamente de valores fijos.

---

# Selection Strategies

Todo control seleccionable debe soportar estrategias.

Ejemplos:

- valor proporcionado
- búsqueda por texto
- búsqueda inteligente
- primera opción válida
- descubrimiento automático

Agregar nuevas estrategias nunca debe requerir modificar la arquitectura.

---

# Evidencias

Toda evidencia debe utilizar el sistema centralizado.

No crear mecanismos independientes.

Las evidencias deben poder extenderse para nuevos tipos.

Ejemplos:

- image
- video
- pdf
- download
- json
- html
- text
- log

---

# Logging

Todo evento importante debe registrarse mediante el logger del framework.

Ejemplos:

Inicio

Fin

Errores

Recuperaciones

Tiempo

Datos relevantes

No utilizar console.log para información del framework.

---

# Reportes

Los reportes son parte del framework.

Toda nueva funcionalidad debe integrarse automáticamente al sistema de reportes existente.

No crear reportes paralelos.

---

# Screenshots

Las capturas deben seguir la política del framework.

Actualmente:

- embebidas en HTML;
- PNG físico;
- organizadas por ejecución;
- organizadas por prueba.

No modificar esta política salvo mejora justificada.

---

# Pruebas Unitarias

Las pruebas unitarias validan el framework.

Nunca deben:

- abrir Selenium;
- abrir Chrome;
- depender del sistema;
- utilizar credenciales.

Solo validan comportamiento del Core.

---

# Pruebas End-to-End

Las pruebas E2E validan el sistema.

Nunca deben duplicar lógica del framework.

Deben reutilizar completamente:

- Components
- Flows
- Page Objects

---

# Convenciones

Utilizar nombres descriptivos.

Correcto:

crear-requisicion.test.js

pausar-requisicion.test.js

publicar-requisicion.test.js

Incorrecto:

TC-001

Caso1

TestNuevo

Los nombres descriptivos deben mantenerse en:

- archivos;
- logs;
- reportes;
- screenshots;
- execution context;
- evidencias.

Debe existir una única fuente de verdad para el nombre del caso.

---

# Recuperación

Cuando una prueba falle durante una edición:

Intentar recuperar el estado utilizando los mecanismos del framework.

Ejemplos:

- descartar cambios;
- volver al listado;
- cerrar diálogos.

Nunca reiniciar la aplicación innecesariamente.

---

# Antes de finalizar

Verificar:

- no existe lógica duplicada;
- no existen referencias obsoletas;
- el README sigue siendo consistente;
- los nuevos componentes son reutilizables;
- la arquitectura continúa siendo escalable.

---

# Resumen Final

Todo trabajo debe terminar con un resumen dividido en cuatro secciones.

## Cambios realizados

Qué fue implementado.

## Compatibilidad

Qué se mantuvo compatible.

## Verificación

Qué fue realmente ejecutado.

Diferenciar claramente entre:

- ejecución real;
- pruebas unitarias;
- inspección del código.

Nunca afirmar que algo funciona si no fue verificado.

## Oportunidades detectadas

No implementar automáticamente mejoras arquitectónicas adicionales.

Listarlas únicamente como recomendaciones.

---

# Principio más importante

Si una solución ya existe en el framework:

**Reutilízala.**

Si no existe:

**Diseña una solución que pueda reutilizarse en el futuro.**

Nunca implementar código pensando únicamente en el test actual.

Todo cambio debe hacer crecer el framework, no solamente resolver el problema inmediato.