# FNRH Digital — Sesión de validación con recepción

- Estado: **guía de sesión y registro de hallazgos; sesión aún no ejecutada**.
- Fecha de preparación: 2026-11-15.
- Objetivo: validar con recepción el flujo de fiesta de la reserva, menores, supervisión y separación entre check-in hotelero y FNRH.
- Material: `prototypes/fnrh-party/index.html` (datos sintéticos, sin backend).
- Plan de tareas relacionado: `FNRH_PARTY_IMPLEMENTATION_TASKS.md`.
- Diseño de referencia: `FNRH_GUEST_UI_FLOW.md`.

> Esta sesión valida interacción y lenguaje operativo. No valida identidad, documentos reales, autorizaciones legales, reglas de Serpro ni envío FNRH. Tampoco sustituye las aprobaciones de producto, DPO/legal o seguridad.

## 1. Resultado esperado

Al terminar la sesión deben existir:

1. Hallazgos observados con evidencia y severidad, no opiniones genéricas.
2. Decisiones de producto o preguntas abiertas separadas de los defectos de UI.
3. Tareas accionables enlazadas a `FNRH_PARTY_IMPLEMENTATION_TASKS.md`.
4. Una lista explícita de casos que requieren legal/DPO o Serpro antes de implementarse.
5. Un acta breve con acuerdos, responsables y fecha de seguimiento.

## 2. Participantes y roles

| Rol                      | Responsabilidad en la sesión                                                            |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Facilitador              | Explica el objetivo, da las tareas y evita inducir la respuesta. No defiende el diseño. |
| Recepción (2–3 personas) | Recorre los escenarios como lo haría en mostrador; piensa en voz alta.                  |
| Observador de producto   | Registra fricciones, lenguaje y decisiones de alcance.                                  |
| Observador técnico       | Anota comportamiento, estados y posibles bugs; no improvisa cambios durante la sesión.  |
| DPO/legal (opcional)     | Escucha casos de menores/autorizaciones y marca lo que requiere revisión formal.        |

Recomendación: una sesión con 2–3 personas de recepción de turnos distintos. Evitar mezclar recepción con quien tomó las decisiones de diseño en la misma mesa.

## 3. Antes de la sesión

- [ ] Confirmar fecha, sala o videollamada y duración de 75 minutos.
- [ ] Enviar el prototipo y una nota de que todos los datos son sintéticos.
- [ ] Abrir el prototipo en el navegador y probar los escenarios rápidos.
- [ ] Tener una laptop y, si es posible, un teléfono para probar el ancho móvil.
- [ ] Preparar el registro de hallazgos y el acta.
- [ ] Confirmar que no se grabarán datos personales ni se pedirán documentos reales.
- [ ] Acordar que las decisiones legales no se toman en la sesión.

## 4. Reglas de facilitación

- Pedir “pensá en voz alta”; no explicar el flujo antes de que la persona lo intente.
- Usar tareas, no preguntas que sugieran la respuesta. Ejemplo: “Agregá a esta persona a la reserva”, no “¿Ves el botón de acompañante?”.
- Registrar primero la observación literal y después la interpretación.
- No corregir en el momento salvo que la persona quede bloqueada; anotar la ayuda brindada.
- No usar datos reales de huéspedes ni documentos. Si aparece un caso real, registrar sólo un identificador ficticio.
- Separar “no entiendo la pantalla” de “la regla de negocio no es correcta” y de “falta una aprobación legal”.
- Cerrar cada escenario con: qué esperaba, qué pasó y qué cambiaría.

## 5. Agenda (75 minutos)

| Minutos | Bloque                                      | Salida                                                    |
| ------- | ------------------------------------------- | --------------------------------------------------------- |
| 0–5     | Bienvenida, consentimiento y objetivo       | Participantes entienden que es un prototipo sintético.    |
| 5–10    | Contexto breve del flujo                    | Lenguaje común; sin explicar cada control.                |
| 10–25   | Escenarios 1–2: alta de adultos             | Hallazgos sobre búsqueda, duplicados y creación.          |
| 25–45   | Escenarios 3–4: menores y autorización      | Hallazgos sobre responsable, supervisión y bloqueo legal. |
| 45–55   | Escenario 5: check-in con FNRH incompleta   | Confirmar que check-in y FNRH se perciben separados.      |
| 55–65   | Escenarios 6–7: conversión, bajas y conteos | Hallazgos sobre edad, dependientes y discrepancias.       |
| 65–70   | Prueba rápida en móvil/teclado              | Fricciones de acceso o desborde.                          |
| 70–75   | Cierre y priorización                       | Top 3 problemas y acuerdos.                               |

Si hay poco tiempo, priorizar escenarios 3, 4 y 5; son los que combinan riesgo legal y operación real.

## 6. Escenarios de validación

### S1 — Agregar un adulto que ya existe

**Tarea para recepción:** “Esta reserva es para Ana. Agregá a João, que ya se hospedó antes.”

**Observar:** si encuentra la búsqueda, si entiende que está reutilizando una ficha, si intenta crear un duplicado, si el documento visible le da confianza.

**Señal de éxito:** vincula a João sin crear una ficha nueva y sin pedir datos que ya existen.

**Preguntar al final:** “¿Cómo supiste que era la misma persona?”

**Riesgo:** búsqueda por documento demasiado técnica o resultados que no distinguen homónimos.

### S2 — Agregar un adulto nuevo

**Tarea:** “Agregá a Mariana, que nunca se hospedó en el hotel.”

**Observar:** campos obligatorios, fecha de nacimiento, documento, claridad sobre qué se guarda y qué no.

**Señal de éxito:** crea la ficha dentro de la reserva sin salir del detalle y sin inventar documento.

**Preguntar:** “¿Qué harías si no tiene documento ahora?”

**Riesgo:** que la fecha de nacimiento se perciba como dato innecesario o que se complete mal por apuro.

### S3 — Agregar una menor acompañada

**Tarea:** “Agregá a Lia, de 14 años, que viaja con Ana.”

**Observar:** si entiende que Lia no tiene FNRH propia, si el responsable se elige solo o requiere explicación, si la supervisión “acompañada” es clara.

**Señal de éxito:** crea a Lia como dependiente de Ana con supervisión acompañada y sin acción de check-in FNRH individual.

**Preguntar:** “¿Qué esperás que pase con la FNRH de Lia?”

**Riesgo:** que recepción crea que debe crear una ficha o un check-in separado para la menor.

### S4 — Menor sin autorización y luego autorizado

**Tarea A:** “Lia viaja sin Ana y no hay autorización registrada. Intentá hacer el check-in.”

**Tarea B:** “Ahora recibiste la autorización. Registrala y volvé a intentar.”

**Observar:** si distingue el bloqueo legal de un dato faltante, si comprende que no hay botón para omitirlo, si la referencia interna le resulta suficiente.

**Señal de éxito:** el check-in queda bloqueado en A; en B se registra la referencia y el bloqueo desaparece.

**Preguntar:** “¿Qué documento o dato necesitás tener a mano para registrar esta autorización?”

**Riesgo:** que la referencia interna se confunda con adjuntar el documento; que el bloqueo se perciba como error del sistema.

**Dependencia:** la política de autorizaciones y retención sigue sujeta a L-04/DPO.

### S5 — FNRH incompleta, check-in hotelero permitido

**Tarea:** “La persona no tiene CPF o pasaporte cargado. ¿Podés hacer el check-in?”

**Observar:** si intenta completar la FNRH antes de permitir la llegada, si entiende que el check-in no envía la FNRH, si el mensaje “FNRH pendiente” le da una acción concreta.

**Señal de éxito:** hace el check-in, ve que la FNRH sigue pendiente y entiende que no se envió nada.

**Preguntar:** “¿Qué harías después para completar la FNRH?”

**Riesgo:** que recepción crea que el check-in ya generó la FNRH o que el sistema la enviará sin intervención.

### S6 — Menor que cumple 18 al check-in

**Tarea:** “Esta persona tenía 17 cuando se creó la reserva, pero cumple 18 antes de llegar. Revisá la fiesta.”

**Observar:** si el aviso de conversión aparece en el momento correcto, si entiende por qué deja de ser dependiente, si encuentra la acción.

**Señal de éxito:** convierte a la persona en adulta y la fiesta deja de tratarla como menor.

**Preguntar:** “¿Cuándo esperabas que el sistema te avisara?”

**Riesgo:** que la conversión quede escondida en edición o que recepción no sepa quién debe hacerla.

### S7 — Quitar a un adulto responsable y corregir conteos

**Tarea A:** “Quitá a João, que es responsable de Lia.”

**Tarea B:** “La reserva declara 2 adultos y 1 menor, pero en la fiesta hay 1 adulto y 1 menor. Corregí la diferencia.”

**Observar:** si entiende por qué no puede quitar al responsable sin reasignar; si busca un botón para “crear” el adulto faltante; si comprende que el conteo no crea personas.

**Señal de éxito:** reasigna o entiende el bloqueo; no inventa un huésped para cuadrar el número.

**Preguntar:** “¿Quién debería corregir el conteo: recepción, reservas o el sistema?”

**Riesgo:** que la discrepancia se resuelva editando el número sin registrar a la persona real.

**Dependencia:** la política de edición de conteos requiere decisión de producto (T-09).

### S8 — Prueba rápida de acceso

**Tarea:** recorrer S3 en un teléfono y con teclado, sin mouse.

**Observar:** desborde horizontal, foco visible, orden de tabulación, textos que se cortan, botones fuera de pantalla.

**Señal de éxito:** completa el alta del menor en móvil y con teclado.

**Riesgo:** que el modal quede inaccesible o que el botón principal quede tapado por el teclado virtual.

## 7. Registro de hallazgos

Completar una fila por observación. No agrupar problemas distintos en una sola fila.

| Campo            | Uso                                                                           |
| ---------------- | ----------------------------------------------------------------------------- |
| ID               | `V-01`, `V-02`, …                                                             |
| Escenario        | S1–S8                                                                         |
| Observación      | Qué hizo o dijo la persona, en lenguaje concreto.                             |
| Evidencia        | Cita, captura o paso reproducible; sin datos personales.                      |
| Tipo             | Fricción de UI, bug, regla de negocio, decisión de producto, requisito legal. |
| Impacto          | Bloquea la tarea, genera riesgo, sólo molesta o es una mejora.                |
| Acción propuesta | Cambio concreto y acotado.                                                    |
| Tarea            | ID de `FNRH_PARTY_IMPLEMENTATION_TASKS.md` o “nueva”.                         |
| Responsable      | Producto, ingeniería, diseño, DPO/legal, Serpro.                              |
| Dependencia      | G-01 a G-05, T-01 a T-18 o “ninguna”.                                         |
| Estado           | Abierto, en análisis, aceptado, descartado, bloqueado.                        |

### 7.1 Hallazgos iniciales del prototipo (hipótesis a confirmar)

Estos hallazgos salen de la revisión del prototipo y de la documentación, **no de una sesión con recepción**. La sesión debe confirmarlos, ajustarlos o descartarlos.

| ID   | Hipótesis                                                                       | Evidencia actual                                                             | Acción si se confirma                                                                   | Tarea / dependencia   |
| ---- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------- |
| V-01 | Vincular un huésped existente puede confundirse con crear uno nuevo.            | Dos caminos de alta en el prototipo.                                         | Unificar el alta con búsqueda primero y “crear nuevo” como salida secundaria.           | T-11 / producto       |
| V-02 | El bloqueo legal y la FNRH incompleta pueden percibirse como el mismo problema. | Ambos usan alertas y estados de color similares.                             | Separar copy, color y acción; el bloqueo legal no debe tener escape.                    | T-07, T-13 / producto |
| V-03 | La discrepancia de conteos no ofrece una acción operativa clara.                | El prototipo muestra el conteo declarado separado de la fiesta.              | Definir si recepción corrige el conteo o sólo registra personas; no crear placeholders. | T-09 / G-01           |
| V-04 | La conversión de menor a adulto no es evidente hasta abrir la ficha.            | Acción disponible en la tarjeta, sin aviso previo al check-in.               | Evaluar aviso proactivo en llegadas y confirmación antes de convertir.                  | T-12 / producto       |
| V-05 | La “referencia de autorización” no tiene un formato operativo acordado.         | El prototipo pide texto libre.                                               | Definir qué se registra, quién lo verifica y qué no se adjunta.                         | T-02 / L-04           |
| V-06 | Las bajas después del check-in o de un envío FNRH no están cerradas en backend. | El prototipo deshabilita el botón; el backend sólo edita en `CONFIRMED`.     | Aprobar política de baja y aplicar la misma regla en API y UI.                          | T-10 / G-01, G-02     |
| V-07 | No está definido qué roles pueden ver documentos y datos de menores.            | El prototipo no modela roles; la API exige permisos de reservas y huéspedes. | Aprobar permiso específico, enmascaramiento y auditoría de lectura.                     | T-03 / G-02, G-03     |
| V-08 | La accesibilidad del flujo real no fue probada con lector de pantalla.          | Sólo se verificó responsive y foco básico en el prototipo.                   | Prueba con teclado y lector; corregir foco del modal y anuncios.                        | T-14 / operaciones    |

## 8. Priorización al cierre

Clasificar cada hallazgo con una de estas etiquetas:

- **P0 — Bloquea la operación o genera riesgo legal:** no se implementa nada que dependa de él sin aprobación.
- **P1 — Impide completar la tarea en mostrador:** corregir antes de la primera entrega interna.
- **P2 — Genera errores o retrabajo:** planificar en la siguiente iteración.
- **P3 — Mejora de claridad o eficiencia:** backlog, sin bloquear.

Registrar también los **descartados** y el motivo. Un hallazgo sin decisión no debe quedar como “pendiente” indefinido.

## 9. Acta de la sesión

- Fecha:
- Duración:
- Participantes (roles, sin datos personales innecesarios):
- Facilitador:
- Observadores:
- Versión del prototipo:
- Escenarios ejecutados:
- Escenarios omitidos y motivo:
- Top 3 problemas priorizados:
- Decisiones tomadas:
- Preguntas que requieren producto:
- Preguntas que requieren DPO/legal:
- Preguntas que requieren Serpro:
- Tareas nuevas o modificadas:
- Fecha de seguimiento:
- Responsable del seguimiento:

## 10. Después de la sesión

1. Transcribir el registro en un plazo de 24–48 horas, separando observación de interpretación.
2. Revisar con producto y DPO/legal los hallazgos P0/P1.
3. Crear o actualizar tareas en `FNRH_PARTY_IMPLEMENTATION_TASKS.md`; no abrir implementación de FNRH por un hallazgo aislado.
4. Confirmar si algún hallazgo invalida una decisión P-01 a P-06 o requiere una nueva decisión.
5. Actualizar `FNRH_GUEST_UI_FLOW.md` y el backlog sólo con acuerdos, no con opiniones sin validar.
6. No usar los hallazgos para afirmar que el flujo está aprobado por recepción hasta que el acta esté firmada.
