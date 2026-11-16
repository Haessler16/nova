# FNRH Digital — Flujo de UI para huéspedes, acompañantes y menores

- Estado: **primera integración implementada en código y migración aplicada/verificada en base local autorizada; no aplicada en staging ni producción; envío FNRH fuera de alcance**.
- Fecha: 2026-11-15.
- Alcance: captura y edición de la fiesta de una reserva en la web actual, con el huésped principal como responsable y los menores/incapaces como dependientes.
- Fuera de alcance: implementar componentes, endpoints, migraciones, envío FNRH, escaneo de documentos o validación legal de autorizaciones.
- Modelo de datos: `FNRH_GUEST_MODEL.md`.
- Decisiones de producto: `FNRH_GUEST_MODEL_REVIEW.md` (P-01 a P-06).
- Plan de integración: `FNRH_INTEGRATION_PLAN.md`.
- Prototipo navegable: `prototypes/fnrh-party/index.html` (datos sintéticos, sin backend ni persistencia).
- Tareas derivadas del prototipo y puertas de producto/legal: `FNRH_PARTY_IMPLEMENTATION_TASKS.md`.
- Guía de validación con recepción y registro de hallazgos: `FNRH_PARTY_VALIDATION_SESSION.md`.

## 1. Objetivo y principios

El flujo debe permitir que recepción registre a **todos los ocupantes reales** de una reserva antes del check-in en lote, sin inventar huéspedes, sin duplicar fichas y sin prometer una FNRH independiente para menores.

Principios de interacción:

1. **Una fiesta por reserva.** El huésped principal sigue siendo `Reservation.guestId`; los demás son `ReservationGuest` con rol `COMPANION`.
2. **El responsable es un adulto de la fiesta.** Por defecto es el principal. Un menor o una persona legalmente incapaz siempre muestra su responsable en la misma tarjeta.
3. **Los menores no tienen ficha FNRH propia.** La UI no muestra “Crear FNRH”, QR ni check-in FNRH individual para un menor; muestra “Incluido en la ficha de [responsable]”.
4. **No se crean placeholders.** Los conteos declarados no generan “Acompañante 1” ni “Menor 1”. Si faltan identidades, se muestra una tarea para completarlas.
5. **Dos bloqueos distintos.**
   - **Datos FNRH incompletos:** el check-in hotelero puede continuar; la FNRH no se envía.
   - **Bloqueo legal:** un menor desacompañado sin autorización registrada impide el check-in y la FNRH.
6. **La edad se muestra “al check-in”.** No se usa la edad actual ni se infiere la minoría por el aspecto o por el conteo de `children`.
7. **Minimización.** No se adjuntan escaneos de autorizaciones; se guarda sólo una referencia interna. Los datos de menores se muestran únicamente a roles autorizados.
8. **Una sola captura por persona.** Si el huésped ya está en la reserva, se reutiliza la ficha; no se crea un duplicado.

## 2. Puntos de entrada

| Punto                    | Qué ve el usuario                                                              | Acción principal                                               |
| ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Reservas → Nueva reserva | Selector/creación del huésped principal, fechas y habitación                   | Crear reserva; después completar la fiesta desde el detalle    |
| Reservas → Detalle       | Nueva sección “Huéspedes de la reserva” antes de notas/habitación              | Agregar adulto, agregar menor, editar o quitar                 |
| Front Office → Llegadas  | Tarjeta de llegada con resumen de fiesta y advertencia de FNRH                 | Check-in; si falta fiesta, abrir el detalle para completarla   |
| Front Office → Check-in  | Diálogo de confirmación con checklist de fiesta, menores y FNRH                | Completar fiesta o continuar check-in según el tipo de bloqueo |
| Huéspedes → Ficha        | Datos básicos y perfil FNRH; no administra la fiesta de una reserva desde aquí | Editar identidad/perfil; la fiesta se gestiona en la reserva   |

La fiesta **no** se administra desde el listado global de huéspedes para evitar que un menor quede visible fuera de su contexto de reserva.

## 3. Flujo principal

```text
Nueva reserva
  └─ elegir/crear huésped principal
      └─ crear reserva
          └─ abrir detalle de la reserva
              ├─ Agregar adulto
              │   ├─ buscar huésped existente
              │   └─ crear huésped nuevo
              ├─ Agregar menor
              │   ├─ elegir responsable adulto
              │   ├─ registrar supervisión
              │   └─ (si corresponde) referencia de autorización
              └─ checklist de fiesta
                  ├─ completa + FNRH lista → check-in y lote FNRH
                  ├─ incompleta → check-in hotelero permitido, FNRH bloqueada
                  └─ bloqueo legal → check-in y FNRH bloqueados
```

### 3.1 Crear una reserva

El modal actual de “Nueva reserva” se mantiene, con estos cambios:

- Sigue siendo obligatorio elegir o crear el **huésped principal**.
- Se elimina la edición manual e independiente de “Adultos” y “Menores”. Esos valores pasan a ser un resumen derivado de la fiesta:
  - al crear: `1 adulto · 0 menores`;
  - después de agregar acompañantes: `2 adultos · 1 menor`.
- Si por compatibilidad el contrato de creación sigue exigiendo `adults`/`children`, el cliente envía el conteo de la fiesta y la UI no permite que difiera de las personas registradas.
- El pie del modal ofrece:
  - **Crear reserva** (acción principal);
  - **Crear y agregar huéspedes** (crea la reserva y abre el detalle con foco en la sección de fiesta).
- Un aviso corto explica: “Los acompañantes se agregan después de crear la reserva. Podés completarlos ahora o antes del check-in.”

No se crean acompañantes en el mismo formulario antes de que exista la reserva en v1: eso evita una transacción de varios pasos y permite reutilizar el detalle como único lugar de edición.

### 3.2 Detalle de la reserva

La sección “Huéspedes de la reserva” aparece después de los datos de la estadía y antes de “Notas”.

```text
Huéspedes de la reserva                    [Fiesta completa]
1 adulto · 1 menor

┌ Principal ───────────────────────────────────────────────┐
│ Ana Silva                         [Principal] [Adulta]  │
│ CPF •••.123.456-78 · ana@ejemplo.com                     │
│ Edad al check-in: 34 años                               │
│ FNRH: lista                                             │
│                                      [Editar]           │
└─────────────────────────────────────────────────────────┘

┌ Acompañante ─────────────────────────────────────────────┐
│ João Silva                        [Acompañante] [Adulto] │
│ Pasaporte ••••1234                                      │
│ FNRH: falta fecha de nacimiento                         │
│                                      [Editar] [Quitar]   │
└─────────────────────────────────────────────────────────┘

  ┌ Menor ─────────────────────────────────────────────────┐
  │ Lia Silva                              [Menor]         │
  │ Responsable: Ana Silva                                 │
  │ Supervisión: acompañada                                │
  │ FNRH: incluida en la ficha de Ana Silva                │
  │                                      [Editar] [Quitar] │
  └────────────────────────────────────────────────────────┘

[+ Agregar adulto]  [+ Agregar menor]
```

Reglas visuales:

- El principal lleva badge **Principal**; los acompañantes, **Acompañante**.
- Los menores se muestran indentados y con badge **Menor**; la indentación es sólo refuerzo, nunca el único indicador.
- Un adulto con `legalIncapacity=true` muestra **Requiere responsable** y su responsable, con el mismo tratamiento de dependencia.
- El resumen usa `Fiesta completa` o `Fiesta incompleta`; no usa sólo color.
- El botón **Quitar** no aparece para el principal. Para un acompañante con FNRH ya enviada o check-in realizado, se deshabilita con explicación.
- “Editar” abre el mismo formulario con los datos actuales; no navega fuera del drawer.
- En móvil, las tarjetas se apilan, los botones pasan a ancho completo y el drawer ocupa toda la pantalla.

### 3.3 Estado vacío o incompleto

Si sólo existe el principal:

```text
Huéspedes de la reserva                    [Fiesta incompleta]
Sólo el huésped principal

Si la reserva tiene más huéspedes, agregalos antes del check-in.
La FNRH no se enviará hasta que la fiesta esté completa.

[+ Agregar adulto]  [+ Agregar menor]
```

Si los conteos legacy no coinciden:

```text
[Advertencia] La reserva declara 2 adultos y 1 menor, pero hay 1 adulto registrado.
Completá la fiesta o corregí el conteo declarado. No creamos huéspedes automáticamente.

[Completar fiesta]  [Revisar conteos]
```

La segunda acción sólo está disponible para roles con permiso de gestión de reservas; no modifica la fiesta por sí sola.

## 4. Agregar un adulto

Se abre un drawer/modal `Agregar acompañante adulto`, con dos modos:

### 4.1 Buscar huésped existente

- Buscador por nombre, email, teléfono o documento.
- Resultados con nombre, contacto y documento; sin datos FNRH sensibles.
- Al seleccionar:
  - validar que no sea el principal ni esté ya en la fiesta;
  - validar que la ficha tenga `birthDate`; si falta, ofrecer **Completar fecha de nacimiento** en el momento;
  - calcular `Edad al check-in` con la fecha de la reserva;
  - si es menor, no permitir agregarlo como adulto: ofrecer el flujo **Agregar menor**.
- Si el huésped no tiene documento FNRH válido, se permite agregarlo como acompañante, pero la tarjeta muestra **FNRH: falta CPF o pasaporte**.

### 4.2 Crear huésped nuevo

Campos:

| Campo                | Obligatorio | Regla                                                             |
| -------------------- | ----------- | ----------------------------------------------------------------- |
| Nombre completo      | Sí          | 2–160 caracteres; no crear placeholders                           |
| Fecha de nacimiento  | Sí          | No futura; define adulto/menor al check-in                        |
| Email                | No          | Formato válido si se completa                                     |
| Teléfono             | No          | Texto libre acotado                                               |
| Tipo de documento    | No          | `CPF`, `PASSPORT`, `RG`, `NATIONAL_ID`, `DRIVER_LICENSE`, `OTHER` |
| Número de documento  | Si hay tipo | CPF: 11 dígitos; pasaporte: normalizado; legacy: texto acotado    |
| Requiere responsable | No          | Sólo para incapacidad legal declarada; muestra selector           |

Notas:

- El formulario no deduce la edad por el documento ni por el conteo de la reserva.
- Si el documento es `RG`, `NATIONAL_ID`, `DRIVER_LICENSE` u `OTHER`, se guarda como documento interno y se muestra “No válido para FNRH”.
- La fecha de nacimiento se guarda en `GuestFnrhProfile`; no se agrega al objeto público de `Guest`.
- “Requiere responsable” no es un diagnóstico médico: sólo registra una incapacidad legal ya declarada y exige un responsable adulto de la fiesta.

Al guardar:

1. Se crea/reutiliza el `Guest`.
2. Se crea `ReservationGuest` con `role=COMPANION`, `ageGroup` calculado y `origin=MANUAL` o `PRE_CHECKIN` según el momento.
3. Se actualiza el resumen de ocupación.
4. Se anuncia el resultado con `aria-live`: “João Silva agregado a la reserva”.
5. El foco vuelve a la tarjeta nueva, no al inicio del drawer.

## 5. Agregar un menor

Se abre un drawer/modal `Agregar menor`. Es un formulario distinto del adulto para evitar que un menor se guarde como adulto por defecto.

### 5.1 Campos

| Campo                      | Obligatorio | Regla                                                                                |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| Nombre completo            | Sí          | 2–160 caracteres                                                                     |
| Fecha de nacimiento        | Sí          | Debe ser menor de 18 años **a la fecha de check-in**                                 |
| Documento                  | No          | CPF/pasaporte si existe; RG u otros quedan internos                                  |
| Responsable                | Sí          | Adulto de la misma fiesta; por defecto el principal                                  |
| Supervisión                | Sí          | Acompañado / autorizado sin acompañante / sin autorización registrada                |
| Referencia de autorización | Condicional | Obligatoria si la supervisión es “autorizado sin acompañante”; máximo 120 caracteres |
| Observaciones operativas   | No          | Texto acotado; no usar para pegar datos sensibles ni scans                           |

Texto permanente bajo el título:

> Este menor se vincula al responsable y no genera una FNRH propia. La ficha FNRH del responsable informa su presencia y supervisión.

### 5.2 Supervisión

Tres opciones, con consecuencias visibles antes de guardar:

| Opción                                  | Cuándo se usa                                           | Efecto en UI                                                       |
| --------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| **Viaja acompañado por el responsable** | Caso normal                                             | Estado verde; check-in y FNRH permitidos si el resto está completo |
| **Autorizado a viajar sin acompañante** | Existe autorización escrita/firma reconocida o judicial | Exige referencia; estado ámbar; check-in permitido                 |
| **Sin autorización registrada**         | Se desconoce o no existe autorización                   | Estado rojo; check-in y FNRH bloqueados                            |

Reglas:

- La referencia de autorización es un identificador interno, no un archivo. La UI dice: “Guardá sólo la referencia. No adjuntes el documento.”
- “Sin autorización registrada” se puede guardar para reflejar la realidad operativa, pero la tarjeta queda bloqueada y el check-in no se habilita.
- No se ofrece un botón “Resolver después” que oculte el bloqueo.
- Si el menor cumple 18 años antes o en la fecha de check-in, el formulario no permite guardarlo como menor: muestra “Al check-in tendrá 18 años. Registralo como adulto.”

### 5.3 Responsable

- Selector de adultos de la fiesta; por defecto el principal.
- Si sólo hay un adulto, se muestra como texto y no como selector editable.
- Si el responsable seleccionado no es adulto o tiene incapacidad legal, se bloquea y se explica.
- Cambiar el responsable de un menor no cambia la FNRH del principal; sólo actualiza el vínculo.
- El responsable de un menor no puede ser otro menor ni la misma persona.

## 6. Edad y reclasificación

La UI muestra siempre **Edad al check-in**, calculada con la fecha de check-in de la reserva. No muestra “edad actual” como dato principal.

Casos:

1. **Menor que cumple 18 antes del check-in:** al editar la reserva o al abrir el check-in, la tarjeta muestra:
   > Al check-in tendrá 18 años. Ya no corresponde registrarlo como dependiente.
   > La acción **Convertir en adulto** quita responsable/supervisión, cambia la tarjeta a `Acompañante` y actualiza los conteos. No se envía nada a FNRH hasta confirmar.
2. **Adulto que cumple años durante la estadía:** no cambia su clasificación al check-in; la edad se congela para el check-in y la FNRH usa esa fecha.
3. **Fecha de nacimiento faltante:** la tarjeta muestra `FNRH: falta fecha de nacimiento`; el check-in hotelero sigue permitido. El botón **Completar fecha** abre el perfil FNRH, no un formulario de reserva.
4. **Fecha de nacimiento inválida o futura:** se bloquea el guardado del perfil; no se permite continuar con un valor inventado.

La clasificación se recalcula al cambiar la fecha de check-in. Si el cambio produce una reclasificación, se muestra un diálogo de confirmación antes de guardar la reserva; nunca se cambia el rol en silencio.

## 7. Check-in y bloqueos

El check-in deja de ser un botón sin contexto cuando la fiesta está incompleta o hay un bloqueo legal. Si la fiesta está completa y no hay bloqueos, se conserva la acción directa actual.

### 7.1 Diálogo de check-in

Título: `Check-in — Reserva {code}`.

Resumen:

- Huésped principal y habitación.
- `2 adultos · 1 menor`.
- Estado de la fiesta.
- Estado FNRH.

Checklist:

| Ítem                  | Estado posible                       | Acción                  |
| --------------------- | ------------------------------------ | ----------------------- |
| Huéspedes registrados | Completa / Faltan personas           | **Completar fiesta**    |
| Datos FNRH            | Lista / Incompleta                   | **Completar datos**     |
| Menores               | Sin bloqueo / Autorización pendiente | **Revisar supervisión** |

Mensajes:

- **Fiesta incompleta, sin bloqueo legal:**
  > El check-in hotelero puede continuar, pero la FNRH no se enviará hasta registrar a todos los huéspedes.
  > Acciones: **Completar fiesta** (primaria), **Continuar check-in** (secundaria).
- **Menor sin autorización registrada:**
  > No se puede hacer check-in: hay un menor sin autorización registrada. Registrá la autorización o resolvé el vínculo antes de continuar.
  > Acciones: **Revisar menor** solamente. No hay “Continuar” ni acción que lo evite.
- **Sólo datos FNRH faltantes:**
  > El check-in puede continuar. La FNRH quedará pendiente y no se enviará con datos incompletos.
  > Acciones: **Completar datos** (secundaria), **Continuar check-in** (primaria).
- **Todo listo:**
  > La fiesta está completa y los datos FNRH están listos.
  > Acción: **Confirmar check-in**.

### 7.2 Después del check-in

- El check-in hotelero no espera la respuesta de FNRH.
- La tarjeta de la reserva muestra el estado FNRH por separado: `No iniciado`, `Pendiente`, `Enviado`, `Error` o `No aplica`.
- Si la FNRH falla, el check-in no se revierte; se muestra un error accionable y se permite reintentar según el plan de integración.
- Un menor sigue sin acción FNRH propia después del check-in; su estado es el del responsable.

## 8. Matriz de estados

Códigos alineados con `FNRH_GUEST_MODEL.md`.

| Condición                               | Badge / mensaje                                        | Check-in hotelero | FNRH        | Acción principal              |
| --------------------------------------- | ------------------------------------------------------ | ----------------- | ----------- | ----------------------------- |
| `PRIMARY_MISSING`                       | “Falta el huésped principal”                           | Bloqueado         | Bloqueada   | Reparar reserva               |
| `GUEST_COUNT_MISMATCH`                  | “La reserva declara más huéspedes que los registrados” | Permitido         | Bloqueada   | Completar fiesta              |
| `MISSING_COMPANIONS`                    | “Faltan acompañantes por registrar”                    | Permitido         | Bloqueada   | Agregar adulto/menor          |
| `AGE_GROUP_UNKNOWN`                     | “Falta clasificar la edad al check-in”                 | Permitido         | Bloqueada   | Completar fecha de nacimiento |
| `PRIMARY_NOT_ADULT`                     | “El principal debe ser adulto y capaz”                 | Bloqueado         | Bloqueada   | Reemplazar principal          |
| `MINOR_RESPONSIBLE_MISSING`             | “El menor no tiene responsable”                        | Bloqueado         | Bloqueada   | Elegir responsable            |
| `MINOR_SUPERVISION_UNKNOWN`             | “Falta la supervisión del menor”                       | Bloqueado         | Bloqueada   | Completar supervisión         |
| `MINOR_AUTHORIZATION_MISSING`           | “Menor sin autorización registrada”                    | Bloqueado         | Bloqueada   | Revisar autorización          |
| `MINOR_AUTHORIZATION_REFERENCE_MISSING` | “Falta la referencia de autorización”                  | Bloqueado         | Bloqueada   | Completar referencia          |
| `LEGAL_INCAPACITY_RESPONSIBLE_MISSING`  | “Falta responsable por incapacidad legal”              | Bloqueado         | Bloqueada   | Elegir responsable            |
| `DOCUMENT_NOT_FNRH_READY`               | “Documento no válido para FNRH”                        | Permitido         | Bloqueada   | Editar documento              |
| `PROFILE_INCOMPLETE`                    | “Faltan datos FNRH”                                    | Permitido         | Bloqueada   | Completar perfil              |
| `DUPLICATE_DOCUMENT_WARNING`            | “Posible duplicado de documento”                       | Permitido         | Advertencia | Revisar ficha                 |

Precedencia visual: **bloqueo legal** > **bloqueo de integridad de la reserva** > **datos FNRH incompletos** > **advertencia**.

## 9. Validaciones de formulario

| Campo / acción          | Regla                                                   | Mensaje                                                                  |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Nombre                  | 2–160 caracteres                                        | “Ingresá nombre y apellido.”                                             |
| Fecha de nacimiento     | Obligatoria; no futura                                  | “La fecha de nacimiento es obligatoria y no puede ser futura.”           |
| Edad al check-in        | `>=18` adulto; `<18` menor                              | “Al check-in tendrá 18 años; registralo como adulto.”                    |
| Principal               | Adulto y capaz                                          | “El huésped principal debe ser mayor de edad y no requerir responsable.” |
| Menor                   | Responsable adulto de la misma reserva                  | “Elegí un responsable adulto de esta reserva.”                           |
| Supervisión             | Obligatoria para menor                                  | “Indicá cómo viaja el menor.”                                            |
| Autorización            | Referencia obligatoria si es autorizado sin acompañante | “Ingresá la referencia de la autorización.”                              |
| Documento CPF           | 11 dígitos, válido                                      | “El CPF debe tener 11 dígitos.”                                          |
| Documento pasaporte     | Normalizado, no vacío                                   | “Ingresá el número de pasaporte.”                                        |
| Duplicado en la fiesta  | Mismo `guestId` prohibido                               | “Ese huésped ya está en esta reserva.”                                   |
| Menor como principal    | Prohibido                                               | “Un menor no puede ser el huésped principal.”                            |
| Quitar principal        | Prohibido                                               | “El principal no se puede quitar; se puede reemplazar.”                  |
| Quitar con FNRH enviada | Deshabilitado                                           | “La FNRH ya fue enviada; usá el flujo de corrección.”                    |
| Conteos                 | No se editan por separado cuando hay fiesta registrada  | “El conteo se calcula desde los huéspedes registrados.”                  |

Los errores se muestran junto al campo y en un resumen al inicio del formulario cuando el envío falla. No se usa sólo un toast para errores de validación.

## 10. Permisos y privacidad

- La lectura de la fiesta requiere `reservations.read` y `guests.read`; la escritura requiere `reservations.manage` y `guests.manage`.
- Hasta que legal/DPO cierre L-06, la sección se muestra a roles con `reservations.read` y `guests.read`; los controles de alta/edición sólo aparecen con `reservations.manage` y `guests.manage`. No se agrega una permission nueva sin aprobación.
- Propuesta para L-06: permisos separados `guests.minors.read` / `guests.minors.manage`, con auditoría específica. No forman parte de esta implementación.
- El backend debe aplicar el filtro de tenant/propiedad; ocultar un botón no es control de acceso.
- Documentos y fechas de nacimiento se muestran enmascarados en listados. El detalle autorizado puede revelar el documento completo; la UI no lo registra en logs ni en analytics.
- La referencia de autorización no se muestra en listados; sólo en el detalle del menor y para roles autorizados.
- Cada alta, edición, cambio de responsable, cambio de supervisión y baja genera evento de auditoría con actor, reserva, huésped y campos modificados (sin el valor del documento).

## 11. Accesibilidad y responsive

- Todos los campos usan `FormControl`/`FormLabel`; los errores se asocian con `aria-describedby`.
- Las tarjetas usan encabezados semánticos y badges con texto; la indentación de menores no es el único indicador.
- Al abrir un drawer, el foco va al título; al cerrar, vuelve al botón que lo abrió.
- Al agregar una persona, un `aria-live="polite"` anuncia el resultado.
- El diálogo de check-in atrapa el foco y no permite cerrar con overlay si hay un bloqueo legal sin revisar.
- En móvil, drawer a pantalla completa, botones de al menos 44 px y resumen de fiesta siempre visible.
- Los colores de estado tienen texto equivalente (`Fiesta incompleta`, `Bloqueado`, `FNRH pendiente`).

## 12. Contrato interno tentativo

Nombres tentativos para la implementación; no son contrato oficial FNRH.

```text
GET    /api/v1/reservations/:id/party
POST   /api/v1/reservations/:id/party/adults
POST   /api/v1/reservations/:id/party/minors
PATCH  /api/v1/reservations/:id/party/:reservationGuestId
DELETE /api/v1/reservations/:id/party/:reservationGuestId
```

Respuesta de lectura propuesta:

```json
{
  "primary": {
    "reservationGuestId": "uuid",
    "guestId": "uuid",
    "fullName": "Ana Silva",
    "role": "PRIMARY",
    "ageAtCheckIn": 34,
    "ageGroup": "ADULT",
    "documentType": "CPF",
    "documentMasked": "***.***.***-78",
    "fnrhStatus": "READY"
  },
  "companions": [],
  "summary": {
    "adults": 1,
    "minors": 0,
    "declaredAdults": 1,
    "declaredChildren": 0
  },
  "readiness": {
    "checkIn": "ALLOWED",
    "fnrh": "READY",
    "codes": []
  }
}
```

Reglas del contrato:

- La respuesta nunca incluye `cpf_solicitante`, secretos ni documentos completos en listados.
- `ageAtCheckIn` se calcula en el servidor con la fecha de check-in y la zona horaria de la propiedad; la UI no lo recalcula como fuente de verdad.
- `POST` de menor exige `responsibleReservationGuestId`; el servidor rechaza un responsable menor o de otra reserva.
- `DELETE` del principal se rechaza; la baja de un acompañante con FNRH enviada también.
- Los conteos se derivan en el servidor y se devuelven como snapshot; la UI no los envía como verdad independiente.

## 13. Criterios de aceptación

1. Al crear una reserva sólo se puede seleccionar/crear un huésped principal adulto; un menor no puede ser principal.
2. La sección “Huéspedes de la reserva” lista principal, acompañantes y menores con badges textuales y responsable visible.
3. Agregar un adulto exige fecha de nacimiento para clasificarlo; si falta, no se inventa `ADULT`.
4. Agregar un menor exige fecha de nacimiento, responsable adulto de la misma reserva y supervisión.
5. Un menor no muestra acción para crear FNRH, QR ni check-in independiente; muestra “Incluido en la ficha de [responsable]”.
6. Un menor sin autorización registrada muestra bloqueo rojo y deshabilita el check-in; no existe acción secundaria para omitirlo.
7. Un menor autorizado sin acompañante exige referencia interna; no se adjuntan scans.
8. Si falta `birthDate`, el check-in hotelero sigue disponible y la FNRH queda bloqueada.
9. Si la fiesta está incompleta, el check-in hotelero puede continuar con advertencia, pero no se envía un lote FNRH parcial.
10. Si un menor cumple 18 al check-in, la UI exige convertirlo en adulto antes de continuar.
11. Los conteos declarados no crean huéspedes; una discrepancia muestra tarea de revisión.
12. No se puede agregar dos veces al mismo huésped ni quitar al principal.
13. La sección respeta tenant/propiedad, permisos y auditoría; los datos de menores no aparecen en listados generales.
14. El flujo es operable con teclado, lector de pantalla y ancho móvil.

## 14. Pruebas de UI propuestas

- Crear reserva con principal adulto y abrir detalle: se ve “Sólo el huésped principal / Fiesta incompleta”.
- Agregar adulto existente sin `birthDate`: se ofrece completar fecha; no se guarda como adulto por defecto.
- Agregar menor con responsable principal: tarjeta indentada, badge `Menor`, sin botón FNRH.
- Agregar menor con `UNACCOMPANIED_WITHOUT_AUTHORIZATION`: check-in deshabilitado y mensaje legal.
- Agregar menor autorizado sin referencia: error de campo; con referencia: guarda y muestra estado ámbar.
- Reserva con `children=1` sin identidad: banner de discrepancia; no se crea “Menor 1”.
- Menor que cumple 18 antes del check-in: diálogo de conversión a adulto.
- Check-in con FNRH incompleta: se permite; se muestra “FNRH no se enviará”.
- Check-in con bloqueo legal: no se permite; no hay acción de escape.
- Edición/cierre del drawer: foco vuelve al botón; se anuncia el alta.
- Cross-tenant: no se puede leer ni modificar la fiesta de otra propiedad.
- Rol sin `guests.manage`: ve la fiesta si tiene lectura, pero no los controles de alta/edición.

## 15. Decisiones abiertas antes de implementar

- Ratificación de producto de P-01 a P-06.
- L-06: permission específica y auditoría para datos de menores.
- L-04: política de autorizaciones y retención de la referencia.
- Confirmación de Serpro sobre documento requerido para menores en el check-in en lote.
- Definición de si el conteo `adults`/`children` seguirá siendo editable para reservas legacy o sólo lectura con corrección auditada.
- Flujo de corrección posterior a una FNRH enviada; esta UI no lo implementa.

## 16. Implementación actual (2026-11-15)

La sección “Huéspedes de la reserva” ya está integrada en el detalle de reservas de la web y usa persistencia real. No se implementó ningún envío a FNRH, adapter HTTP ni credenciales.

- **API:** `GET/POST /api/v1/reservations/:id/party` y `PATCH/DELETE /api/v1/reservations/:id/party/:reservationGuestId`, con tenant/propiedad, permisos y auditoría.
- **Persistencia:** `ReservationGuest` para la fiesta y `GuestFnrhProfile` para la fecha de nacimiento. El principal sigue siendo `Reservation.guestId`.
- **Check-in:** el backend bloquea el check-in sólo por códigos legales de la fiesta; una FNRH incompleta o un conteo distinto no lo impiden.
- **UI:** listado de principal, acompañantes y menores; alta de adulto existente o nuevo; alta de menor con responsable y supervisión; edición, conversión de menor a adulto al cumplir 18 y baja con bloqueo de dependientes.
- **Migración:** `prisma/migrations/20261115120000_phase10_reservation_party` está aplicada y verificada en la base local autorizada; **no** se aplicó en staging ni producción.

Límites vigentes: no hay aprobación formal de producto/legal/DPO para capturar datos de menores; no hay credenciales FNRH; no se implementó el checklist de llegadas de Front Office ni el envío por lote.
