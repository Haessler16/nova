# Fase 6 — Sistema de mensajes, modales y confirmaciones

**Fecha:** 2026-11-17
**Ficha:** `docs/v4/NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md`, sección «Fase 6 — Sistema de mensajes, modales y confirmaciones».
**Estado:** ejecutada sobre Front Office. Backend sin cambios; UI, pruebas y documentación en el mismo incremento.
**Rama:** `main`.

---

## 1. Resumen

Las operaciones de Front Office usaban modales escritos a mano: cada uno repetía cabecera, pie y botones,
el error de una mutación sólo aparecía como toast que se desvanecía y el foco inicial caía en el primer
elemento del formulario. Ahora existe un único `ActionDialog` con tres tonos (`info`, `warning`,
`critical`) que aporta la jerarquía visual y el comportamiento comunes: icono y etiqueta semántica,
título específico, resumen de una o dos frases con la consecuencia, detalle en el cuerpo, acción
primaria con verbo concreto y acción secundaria diferenciada.

El componente codifica las reglas de interacción de la ficha: foco inicial en la acción segura, Escape
y clic en el overlay bloqueados para acciones críticas y durante una petición en vuelo, botón de
confirmación como `submit` deshabilitado mientras carga (un doble clic no puede enviar dos mutaciones)
y errores del servidor renderizados dentro del diálogo.

No se creó un modal nuevo por cada variante: la ficha pide el patrón, no cuatro copias. Un tono nuevo
es un valor, no un componente nuevo (ADR-057).

---

## 2. Existente / falta / se modifica

| Requisito de la ficha                         | Antes                       | Ahora                                                                                                             |
| --------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Componente reutilizable de información        | No existía                  | `ActionDialog` con `tone="info"` y una sola acción de cierre; usado al resolver incidencias                       |
| Componente de advertencia                     | Modales ad hoc              | `tone="warning"`; usado en no-show                                                                                |
| Componente de confirmación                    | Modales ad hoc              | `ActionDialog` con `onConfirm`; usado en cambio de habitación y resolución                                        |
| Acción crítica                                | Sin distinción              | `tone="critical"`: icono/eyebrow de peligro, Escape y overlay deshabilitados, cierre explícito; usado en checkout |
| Título corto y específico                     | Sí, variable                | Encabezado con eyebrow semántico + título + resumen                                                               |
| Icono semántico                               | No                          | Icono local (`InfoIcon`, `AlertTriangleIcon`) con color y etiqueta; el color nunca es el único indicador          |
| Resumen de una o dos frases                   | Texto largo a veces         | `summary` obligatorio en la práctica; el detalle operativo va en el cuerpo                                        |
| Acción primaria con verbo concreto            | Sí                          | `confirmLabel` explícito («Confirmar check-out», «Confirmar no-show», «Cambiar habitación», «Resolver»)           |
| Acción secundaria diferenciada                | Sí                          | Cancelar en `variant="ghost"`, siempre a la izquierda; se oculta cuando no aplica                                 |
| Explicar consecuencia en operaciones críticas | Parcial                     | El resumen crítico describe la transacción y qué pasa si falla                                                    |
| Foco inicial apropiado                        | Primer campo del formulario | Cancelar/cerrar recibe el foco; confirmar nunca lo roba                                                           |
| Retorno del foco al cerrar                    | Chakra lo hacía de facto    | Cubierto por prueba Playwright                                                                                    |
| Escape sólo cuando la operación lo permite    | Siempre cerraba             | Bloqueado en crítico y mientras hay una petición en vuelo                                                         |
| Evitar cierre accidental del crítico          | No                          | Sin Escape, sin overlay y sin botón X mientras es crítico o hay carga                                             |
| Botones con loading/disabled y doble submit   | Sólo `isLoading` visual     | `submit` con guarda + `isDisabled` durante la carga; probado con doble clic y conteo de requests                  |
| Errores dentro del contexto                   | Toast efímero               | `error`/`errorText` en el diálogo; el modal sigue abierto y editable                                              |
| Toast/banner no bloqueante                    | Existía (`useToast`)        | Se conserva para confirmaciones de éxito y avisos simples                                                         |
| Inline validation                             | Existía (`Field`)           | Se conserva; el diálogo no duplica reglas de validación                                                           |
| No usar modal para todo                       | Parcial                     | Resoluciones y confirmaciones críticas en diálogo; avisos simples siguen como toast                               |

---

## 3. Contrato del componente

`apps/web/src/components/action-dialog.tsx`

| Prop                           | Uso                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `isOpen`, `onClose`            | Control por `useDisclosure` como el resto de la app                                                        |
| `tone`                         | `info` (azul), `warning` (ámbar), `critical` (rojo); define icono, eyebrow y color de confirmación         |
| `title`, `summary`             | Decisión primero, detalle después                                                                          |
| `children`                     | Contenido operativo: cuentas, filtros, formularios, resultados                                             |
| `onConfirm`, `confirmLabel`    | Obligatorios: verbo concreto. El componente no tiene un modo «sólo informativo» porque ningún flujo lo usa |
| `hideCancel`                   | Resultado de una operación ya aplicada: sólo «Cerrar» (label fijo)                                         |
| `hasUnsavedChanges`            | Si hay texto escrito, cancelar/Escape/overlay/X piden confirmación de descarte antes de cerrar             |
| `isLoading`, `confirmDisabled` | Anti doble submit y validaciones de disponibilidad                                                         |
| `error`                        | Mensaje ya localizado; el llamador mapea código de API → texto. Un solo canal de error                     |
| `size`                         | `md` para decisiones, `4xl` para el cambio de habitación                                                   |

El color de la acción primaria se deriva del tono (`info` → brand, `warning` → warning, `critical` →
`danger`); no hay prop de color. Cancelar usa siempre `variant="ghost"` y el mismo label.

Comportamiento fijo, no configurable por pantalla: foco inicial en la acción segura, foco atrapado por
Chakra mientras está abierto, retorno del foco al disparador, `Escape`/overlay bloqueados en crítico o
en vuelo, y cierre del modal sólo después de que el backend confirma.

---

## 4. Adopción

| Flujo                                | Tono       | Cambio observable                                                                                        |
| ------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------- |
| Check-out (`/front-office`, en casa) | `critical` | Consecuencia explícita, Escape/overlay/X bloqueados, error de readiness dentro del diálogo               |
| Cambio de habitación                 | `info`     | Resumen de revalidación; el error de conflicto se muestra dentro y se conserva el refresco de candidatas |
| Marcar no-show                       | `warning`  | Consecuencia de la reserva, Escape permitido, confirmación única                                         |
| Resolver incidencia                  | `info`     | Título como resumen, descripción y resolución; error del servidor inline                                 |

Los modales de alta de incidencia y el wizard de check-in no se convirtieron: el primero es un
formulario de creación con múltiples campos y el segundo un flujo de pasos; ambos mantienen su
composición actual. Se convierten cuando su interacción sea una decisión, no un formulario.

Cuando el operador ya escribió notas o un motivo, cancelar, `Escape`, el overlay o la X abren
«¿Descartar lo escrito?» («Seguir editando» / «Descartar») en lugar de cerrar el diálogo. El cierre
tras una operación exitosa lo sigue haciendo la pantalla, sin pasar por el aviso, y el formulario
se reinicia al abrir como antes.

---

## 5. Pruebas

Nueva suite `apps/web/e2e/action-dialog.spec.ts` (Playwright, API + web reales, sin mocks en rutas
productivas; sólo se intercepta la respuesta del endpoint para forzar el estado de error):

1. **Atención** — abre no-show sobre una llegada vencida del seed: eyebrow `ATENCIÓN`, resumen y
   foco inicial en Cancelar; Escape cierra y devuelve el foco al disparador, sin mutar la reserva.
2. **Información / envío único** — crea una incidencia sintética, intercepta `resolve` con 600 ms de
   retardo, confirma una vez y verifica que el botón queda deshabilitado, el toast de éxito aparece y
   el endpoint recibió **una** petición.
3. **Error del servidor** — `resolve` responde `409`: el diálogo permanece abierto, muestra el mensaje
   recibido y el botón vuelve a estar habilitado; se cancela sin perder contexto.
4. **Acción crítica** — abre checkout: eyebrow `ACCIÓN CRÍTICA`, consecuencia visible, foco en
   Cancelar, Escape no cierra, Cancelar cierra y el foco vuelve a la fila que abrió el diálogo.
5. **Descarte con motivo** — escribe el motivo del no-show, cancela: aparece «¿Descartar lo
   escrito?»; «Seguir editando» conserva el texto y el diálogo, «Descartar» cierra ambos.
6. **Descarte de notas de salida** — escribe notas en checkout, cancela y descarta: no se envía
   ninguna confirmación y, al reabrir, las notas están vacías (reset entre huéspedes intacto).

Verificación adicional en navegador: el modal de cambio de habitación renderiza `INFORMACIÓN`, el
resumen y el botón de confirmación deshabilitado hasta elegir destino, con foco en Cancelar; el
checkout crítico muestra icono/eyebrow rojos, la consecuencia y el detalle de cuenta.

### Comandos ejecutados

| Comando                                                                  | Resultado                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `pnpm --filter @nova/web typecheck`                                      | OK                                                            |
| `pnpm --filter @nova/web lint`                                           | OK                                                            |
| `pnpm --filter @nova/web exec playwright test e2e/action-dialog.spec.ts` | **6/6 OK**                                                    |
| `pnpm --filter @nova/web exec playwright test`                           | **14/14 OK** (action-dialog, check-in, reservas e inventario) |

---

## 6. Estado de aceptación (Fase 6)

| Criterio de la ficha                                               | Estado    | Evidencia                                                                                |
| ------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------- |
| Componentes reutilizables de info/advertencia/confirmación/crítico | `PROBADO` | `ActionDialog` con tres tonos adoptado en cuatro flujos                                  |
| Título, icono, color semántico, resumen y acciones diferenciadas   | `PROBADO` | Captura del checkout y de cambio de habitación; componente                               |
| Color nunca como único indicador                                   | `PROBADO` | Eyebrow textual + icono + etiqueta                                                       |
| Explicar consecuencia en operación crítica                         | `PROBADO` | Resumen del checkout y de no-show                                                        |
| Foco inicial y retorno del foco                                    | `PROBADO` | Tests 1 y 4                                                                              |
| Escape sólo cuando corresponde                                     | `PROBADO` | Test 1 (cierra) y test 4 (no cierra)                                                     |
| Doble submit imposible                                             | `PROBADO` | Test 2: botón deshabilitado y una sola request                                           |
| Errores dentro del diálogo                                         | `PROBADO` | Test 3                                                                                   |
| Teclado y lectores de pantalla                                     | `PARCIAL` | Foco, Escape y `aria-hidden` en iconos; sin revisión con lector de pantalla real         |
| Cambios sin guardar advertidos                                     | `PROBADO` | `hasUnsavedChanges` abre «¿Descartar lo escrito?» antes de cerrar; tests 5 y 6           |
| Toasts/banners para avisos simples                                 | `PROBADO` | `useToast` conservado; éxito de no-show y resolución                                     |
| Adopción en toda la aplicación                                     | `PARCIAL` | Front Office convertido; Reservas, Caja, Huéspedes y Catálogo siguen con modales propios |

---

## 7. Limitaciones y decisiones abiertas

- **Alcance**: sólo Front Office. Convertir Reservas/Caja/Catálogo implica reescribir formularios
  completos y excede esta fase; la ficha permite avanzar por pantallas.
- **Detalle del descarte**: el aviso cubre texto escrito (notas, motivo, resolución) y se dispara
  ante cualquier intento de cierre (Cancelar, Escape, overlay, X); el checkout crítico solo permite
  intentarlo con Cancelar. Elegir un destino en el cambio de habitación no cuenta como contenido y
  no abre el aviso. El reset entre huéspedes no cambió: al reabrir, el formulario sigue vacío.
- **Detalle plegable**: el contrato admite `children` largos pero no un acordeón «Ver detalle»;
  ninguno de los flujos actuales lo necesita todavía.
- **Mensajes de API en inglés**: los errores y advertencias del backend (`This stay has no account…`)
  se muestran tal cual dentro del diálogo; la traducción `pt-BR` sigue en la Fase 7.
- **Doble submit**: el guard cubre el botón del diálogo; las acciones fuera del diálogo mantienen su
  propio `isLoading`, como antes.
- **Accesibilidad**: foco y Escape están cubiertos por pruebas; no se ejecutó un lector de pantalla ni
  una auditoría de contraste en esta pasada.
- **Enlace «Detalle» de Reservas**: los 3 casos de `reservation-party.spec.ts` esperaban un botón,
  pero la pantalla renderiza un enlace. Al adaptarlos se encontró que el enlace navegaba a
  `?reservation=` y el drawer solo se abría en carga completa, no en navegación cliente. Se corrigió
  `RowActionLink` con un `onClick` opcional y Reservas ahora invoca `openDetail`, conservando el deep
  link. La suite UI queda 12/12.

---

## 8. Siguiente paso recomendado

Fase 7 (i18n `pt-BR`) puede apoyarse en el contrato de `ActionDialog`: los textos visibles ya están
centralizados por flujo (título, resumen, etiquetas de acción) y los mensajes del backend son el
principal resto sin traducir.
