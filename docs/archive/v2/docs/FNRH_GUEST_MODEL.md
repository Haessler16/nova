# FNRH Digital — Modelo de huéspedes, acompañantes y menores

- Estado: **modelo implementado en código y migración aplicada/verificada en base local autorizada; no aplicada en staging ni producción; envío FNRH no implementado**.
- Fecha: 2026-11-13.
- Alcance: modelo de datos y migración para representar la fiesta de una reserva, los acompañantes y los menores que FNRH exige registrar.
- Fuera de alcance: ejecutar migraciones, modificar `prisma/schema.prisma`, crear endpoints/UI, enviar datos a FNRH o decidir la base legal de `cpf_solicitante`.
- Plan general: `FNRH_INTEGRATION_PLAN.md`.
- Revisión y firmas: `FNRH_GUEST_MODEL_REVIEW.md`.
- Flujo de UI propuesto: `FNRH_GUEST_UI_FLOW.md`.

## 1. Decisión

No se puede derivar una fiesta FNRH de `Reservation.adults`/`children`. Esos campos son conteos operativos, no identidades. Tampoco se debe crear un `Guest` sintético por cada menor para “cuadrar” el conteo: eso inventaría PII y fichas que nadie verificó.

La propuesta es:

1. Mantener `Reservation.guestId` como **huésped principal canónico** y `Stay` como la verdad de ocupación/check-in/check-out.
2. Agregar `ReservationGuest`, una tabla de intención por reserva que contiene al principal y, cuando existan, a los acompañantes/menores.
3. Agregar `GuestFnrhProfile`, un perfil 1:1 opcional con los datos que FNRH necesita y que el modelo actual no tiene.
4. No tocar `adults`/`children` en la primera migración; se mantienen como snapshot operativo y se comparan contra `ReservationGuest` para calcular readiness.
5. No agregar estado de estancia por huésped en esta fase. El check-in/check-out inicial de FNRH se hace a nivel de reserva usando `Stay`; el detalle individual queda como evolución posterior.

La revisión oficial del 2026-11-13 fijó además:

- El principal debe ser **mayor de edad y capaz**; un menor no puede ser `PRIMARY`.
- Los menores **no generan una FNRH propia**: se vinculan a la FNRH del responsable (Portaria art. 29, parágrafo único; art. 37, § 1º; FAQ 2.2). Se modelan como `COMPANION` con `ageGroup=MINOR`.
- Las personas legalmente incapaces siguen la misma lógica de vínculo y requieren responsable; se representan con `legalIncapacity=true`.
- FNRH sólo acepta `CPF` o `PASSPORT` como documento de persona. `RG`, `NATIONAL_ID`, `DRIVER_LICENSE` y `OTHER` quedan como documentos internos y no se envían.

### 1.1 Decisiones de producto aplicadas

- **Edad:** se calcula a la fecha de check-in usando `birthDate`. Si falta, el check-in hotelero sigue disponible, pero la reserva no se envía a FNRH y queda `PROFILE_INCOMPLETE`.
- **Fiesta completa antes del check-in en lote:** todos los adultos y dependientes deben estar registrados. Si falta alguno, no se envía el lote FNRH; no hay envío parcial silencioso.
- **Menores como dependientes:** se capturan bajo el responsable, sin ficha, QR ni check-in FNRH independiente.
- **Sin `StayGuest` en v1:** `Stay` sigue siendo único por reserva y el check-in/check-out FNRH inicial es por lote.
- **CPF del operador:** se resuelve con `requesterCpfRef` en la configuración de integración, nunca en el perfil público del usuario. Serpro debe confirmar el usuario de integración.
- **Cutover:** sólo se sincronizan reservas con `checkInDate >= cutoverDate`; las históricas no se envían automáticamente.

## 2. Línea base actual

| Entidad             | Lo que existe                                                                     | Limitación FNRH                                                                            |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Guest`             | `fullName`, `email`, `phone`, `documentType`, `documentNumber`, `notes`, `status` | Sin nombre social, nacimiento, nacionalidad, género, raza/etnia, discapacidad ni dirección |
| `GuestDocumentType` | `PASSPORT`, `NATIONAL_ID`, `DRIVER_LICENSE`, `OTHER`                              | No distingue CPF de RG; `NATIONAL_ID` no se puede asumir como CPF                          |
| `Reservation`       | `guestId`, `adults`, `children`, fechas, `source`                                 | Un solo huésped identificado; los demás son sólo números                                   |
| `Stay`              | `reservationId @unique`, `guestId`, habitación y timestamps                       | Un huésped principal por estancia; no hay asistencia por acompañante                       |
| `Property`          | Nombre, código, timezone, moneda                                                  | No tiene configuración FNRH; no forma parte de esta migración                              |

Restricciones existentes que deben preservarse:

- `Guest` es property-scoped y tiene FKs compuestas por `(organizationId, propertyId)`.
- `Reservation.code` es único por propiedad.
- `Reservation.guestId` es obligatorio y referencia un `Guest` de la misma propiedad.
- `Stay.reservationId` es único: una estancia por reserva.
- `ReservationHistory` es append-only; la migración no debe alterarlo.
- La ocupación se deriva de `Stay` con estado `IN_HOUSE`, no de `ReservationGuest`.

## 3. Modelo objetivo

### 3.1 Enums propuestos

```prisma
enum ReservationGuestRole {
  PRIMARY
  COMPANION
}

enum GuestAgeGroup {
  ADULT
  MINOR
  UNKNOWN
}

enum ReservationGuestOrigin {
  LEGACY_BACKFILL
  MANUAL
  PRE_CHECKIN
  IMPORT
}

enum MinorSupervision {
  ACCOMPANIED
  UNACCOMPANIED_AUTHORIZED
  UNACCOMPANIED_WITHOUT_AUTHORIZATION
  UNKNOWN
}
```

`UNKNOWN` existe para no inventar la edad de huéspedes históricos. Las reservas nuevas deben exigir `ADULT` o `MINOR` antes de considerarse listas para FNRH.

`MinorSupervision` sólo aplica a `ageGroup=MINOR`; la autorización desacompañada es un requisito operativo/legal de la Portaria art. 37, no un dato opcional de marketing.

### 3.2 `GuestDocumentType`

Se propone agregar valores sin eliminar los existentes:

```prisma
enum GuestDocumentType {
  CPF
  PASSPORT
  RG
  NATIONAL_ID // legado; no es equivalente automático a CPF
  DRIVER_LICENSE
  OTHER
}
```

Reglas:

- `CPF` se normaliza a 11 dígitos y se valida; no se rellena con ceros.
- `PASSPORT` se guarda en mayúsculas y sin espacios externos.
- `RG`, `NATIONAL_ID`, `DRIVER_LICENSE` y `OTHER` pueden seguir existiendo para documentos internos, pero **no** se envían como CPF/pasaporte FNRH.
- No se migra automáticamente `NATIONAL_ID` a `CPF`. Se requiere revisión humana.
- No se agrega una restricción única de documento en la primera migración: puede haber duplicados históricos. Primero se reportan y se limpian; después se evalúa un índice único parcial.

### 3.3 `GuestFnrhProfile` (1:1 opcional)

Perfil separado para que los datos FNRH no contaminen la ficha operativa ni se expongan en listados generales.

```prisma
model GuestFnrhProfile {
  guestId                   String    @id @db.Uuid
  organizationId            String    @db.Uuid
  propertyId                String    @db.Uuid
  socialName                String?
  birthDate                 DateTime? @db.Date
  nationalityCountryCode    String?   @db.VarChar(2)
  residenceCountryCode      String?   @db.VarChar(2)
  genderCode                String?   @db.VarChar(32)
  raceCode                  String?   @db.VarChar(32)
  disabilityCode            String?   @db.VarChar(32)
  disabilityTypeCode        String?   @db.VarChar(32)
  postalCode                String?   @db.VarChar(16)
  street                    String?   @db.VarChar(160)
  number                    String?   @db.VarChar(20)
  complement                String?   @db.VarChar(80)
  district                  String?   @db.VarChar(80)
  cityIbgeCode              String?   @db.VarChar(7)
  cityName                  String?   @db.VarChar(120)
  stateCode                 String?   @db.VarChar(2)
  guest                     Guest     @relation(fields: [guestId], references: [id], onDelete: Cascade)
  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt

  @@index([organizationId, propertyId])
}
```

Notas:

- `guestId` es la PK; no hay más de un perfil por huésped.
- Los códigos (`genderCode`, `raceCode`, etc.) se almacenan como códigos internos validados contra los catálogos oficiales en el adapter; no se congelan ids externos en la UI.
- `cityIbgeCode` es la representación canónica de ciudad brasileña; `cityName` queda como apoyo de lectura, no como sustituto del código.
- El perfil puede estar incompleto; la readiness indica qué falta. No se completa con valores inventados.
- Para un menor, el perfil se limita a identidad/vínculo y no se usa para crear una ficha FNRH independiente.

### 3.4 `ReservationGuest`

Tabla de la fiesta de la reserva. Incluye siempre al principal; los acompañantes son opcionales.

```prisma
model ReservationGuest {
  id                            String                @id @default(uuid()) @db.Uuid
  organizationId                String                @db.Uuid
  propertyId                    String                @db.Uuid
  reservationId                 String                @db.Uuid
  guestId                       String                @db.Uuid
  role                          ReservationGuestRole
  ageGroup                      GuestAgeGroup         @default(UNKNOWN)
  legalIncapacity               Boolean               @default(false)
  minorSupervision              MinorSupervision?
  authorizationReference        String?               @db.VarChar(120)
  origin                        ReservationGuestOrigin @default(MANUAL)
  responsibleReservationGuestId String?               @db.Uuid
  reservation                   Reservation           @relation(fields: [reservationId], references: [id], onDelete: Restrict)
  guest                         Guest                 @relation("ReservationGuestGuest", fields: [guestId], references: [id], onDelete: Restrict)
  responsible                   ReservationGuest?     @relation("ReservationGuestResponsible", fields: [responsibleReservationGuestId], references: [id], onDelete: Restrict)
  dependents                    ReservationGuest[]    @relation("ReservationGuestResponsible")
  createdAt                     DateTime              @default(now())
  updatedAt                     DateTime              @updatedAt

  @@unique([reservationId, guestId])
  @@unique([organizationId, propertyId, id])
  @@index([organizationId, propertyId, reservationId])
  @@index([organizationId, propertyId, guestId])
  @@index([responsibleReservationGuestId])
}
```

Relaciones que se agregan a los modelos existentes:

```prisma
model Guest {
  // ...campos actuales
  fnrhProfile       GuestFnrhProfile?
  reservationGuests ReservationGuest[] @relation("ReservationGuestGuest")
}

model Reservation {
  // ...campos actuales; guestId sigue siendo el principal
  guests ReservationGuest[]
}
```

`Stay` no cambia.

### 3.5 Mapeo FNRH

| FNRH                                     | Origen propuesto                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `nome`                                   | `Guest.fullName`                                                                            |
| `nome_social`                            | `GuestFnrhProfile.socialName`                                                               |
| `data_nascimento`                        | `GuestFnrhProfile.birthDate`                                                                |
| `PaisNacionalidade_id`                   | `GuestFnrhProfile.nationalityCountryCode`                                                   |
| `PaisResidencia_id`                      | `GuestFnrhProfile.residenceCountryCode`                                                     |
| `genero_id`                              | `GuestFnrhProfile.genderCode`                                                               |
| `raca_id`                                | `GuestFnrhProfile.raceCode`                                                                 |
| `deficiencia_id` / `tipo_deficiencia_id` | `GuestFnrhProfile.disabilityCode` / `disabilityTypeCode`                                    |
| `documento`                              | `Guest.documentType` (`CPF`/`PASSPORT`) + `documentNumber`; legacy no se envía              |
| `contato`                                | `Guest.email` / `phone`                                                                     |
| `endereco`                               | Campos de dirección de `GuestFnrhProfile`                                                   |
| `is_principal`                           | `ReservationGuest.role = PRIMARY`                                                           |
| `responsavel_id`                         | `ReservationGuest.responsibleReservationGuestId`                                            |
| `hóspedes vinculados ao responsável`     | Conteo de `COMPANION` con `ageGroup=MINOR` o `legalIncapacity=true`; no genera ficha propia |
| `numero_reserva`                         | `Reservation.code`                                                                          |

`cpf_solicitante` no pertenece al huésped ni a este modelo; es un dato de la operación/credencial y se trata en el plan de integración.

Los menores y las personas legalmente incapaces **no generan una FNRH independiente**: su información se vincula a la FNRH del responsable. `ReservationGuest` conserva la identidad y el vínculo necesarios para la operación, pero la ficha FNRH se crea sólo para el responsable.

## 4. Reglas de integridad

1. **Un principal por reserva.** Exactamente una fila `role=PRIMARY`; su `guestId` debe coincidir con `Reservation.guestId`. El principal debe ser `ageGroup=ADULT` y `legalIncapacity=false`. Excepción de migración: un `PRIMARY` legacy puede quedar `ageGroup=UNKNOWN` con `origin=LEGACY_BACKFILL`; la readiness lo bloquea hasta clasificarlo.
2. **El principal no se elimina** mientras la reserva exista. Se puede reemplazar en una operación transaccional que actualice ambos lados.
3. **Un huésped no se repite** en la misma reserva: `@@unique([reservationId, guestId])`.
4. **Mismo tenant/property.** Las FKs compuestas impiden mezclar organización o propiedad.
5. **Menor o incapaz con responsable.** Si `ageGroup=MINOR` o `legalIncapacity=true`, `responsibleReservationGuestId` es obligatorio, apunta a otra fila de la misma reserva y el responsable es `ADULT` y capaz, nunca el propio dependiente. Si es menor, `minorSupervision` también es obligatorio.
6. **Edad no inventada.** `UNKNOWN` sólo se acepta para filas `LEGACY_BACKFILL`; las filas nuevas deben ser `ADULT` o `MINOR`.
7. **Conteos separados.** `Reservation.adults`/`children` no se recalculan automáticamente en esta fase. La readiness compara el conteo esperado con las filas reales.
8. **Sin placeholders.** No se crean huéspedes “Child 1”, “Acompañante 1” ni documentos falsos para satisfacer conteos.
9. **Estancia separada.** `ReservationGuest` no reemplaza `Stay`; la ocupación y el check-in/check-out operativo siguen en `Stay`.
10. **Borrado restringido.** `Guest` referenciado por `ReservationGuest` no se elimina; se desactiva. El perfil FNRH se elimina en cascada sólo cuando se elimina el `Guest` (operación administrativa controlada).
11. **Sin ficha FNRH para menores.** El menor se vincula al responsable; no se crea una ficha ni se envía como `PRIMARY`. El check-in en lote puede incluir al dependiente, pero la FNRH propia es la del responsable.
12. **Menor desacompañado sin autorización.** `minorSupervision=UNACCOMPANIED_WITHOUT_AUTHORIZATION` bloquea el check-in/FNRH; no se resuelve creando una ficha o un responsable ficticio. Requiere autorización escrita con firma reconocida o judicial, según la Portaria art. 37.

### Reglas que requieren trigger/constraint

- Un índice único parcial `WHERE role = 'PRIMARY'` por `reservationId`.
- Un trigger diferido que valide, al commit:
  - que el `PRIMARY` coincida con `Reservation.guestId`;
  - que el `PRIMARY` sea adulto y capaz, salvo el `UNKNOWN` legacy que queda bloqueado por readiness;
  - que el responsable de un menor o incapaz pertenezca a la misma reserva, sea adulto y capaz, y no sea el propio dependiente;
  - que un menor tenga `minorSupervision` distinto de `UNKNOWN`;
  - que no exista un `PRIMARY` sin fila en `ReservationGuest` después de la fase de adopción.

El trigger se agrega después de que la aplicación escriba el principal en la misma transacción; no en la primera migración aditiva.

## 5. Readiness FNRH

No se guarda un `Boolean` desnormalizado en `Reservation`. Se calcula con una consulta de readiness para evitar estados obsoletos.

| Código                                  | Condición                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PRIMARY_MISSING`                       | No hay fila `PRIMARY` o no coincide con `Reservation.guestId`                                                            |
| `GUEST_COUNT_MISMATCH`                  | `count(ReservationGuest) != adults + children`                                                                           |
| `MISSING_COMPANIONS`                    | `adults + children > 1` y sólo existe el principal                                                                       |
| `AGE_GROUP_UNKNOWN`                     | Alguna fila tiene `ageGroup=UNKNOWN`                                                                                     |
| `PRIMARY_NOT_ADULT`                     | El `PRIMARY` no es adulto o tiene `legalIncapacity=true`                                                                 |
| `MINOR_RESPONSIBLE_MISSING`             | Un menor no tiene responsable válido                                                                                     |
| `MINOR_SUPERVISION_UNKNOWN`             | Un menor no tiene `minorSupervision` definido                                                                            |
| `MINOR_AUTHORIZATION_MISSING`           | Menor desacompañado sin autorización registrada                                                                          |
| `MINOR_AUTHORIZATION_REFERENCE_MISSING` | Menor desacompañado autorizado sin referencia interna de la autorización                                                 |
| `LEGAL_INCAPACITY_RESPONSIBLE_MISSING`  | Una persona legalmente incapaz no tiene responsable válido                                                               |
| `DOCUMENT_NOT_FNRH_READY`               | Adulto/responsable sin `CPF`/`PASSPORT` o formato inválido; para menores, sólo si la homologación exige documento propio |
| `PROFILE_INCOMPLETE`                    | Faltan campos obligatorios de `GuestFnrhProfile`                                                                         |
| `DUPLICATE_DOCUMENT_WARNING`            | Hay otro `Guest` de la propiedad con el mismo tipo/número; no bloquea por sí solo, requiere revisión                     |

Una reserva con `children > 0` y sólo el principal queda `MISSING_COMPANIONS`. Es el estado esperado de los datos históricos y no se “arregla” con placeholders.

## 6. Fases de migración

### Fase 0 — Preflight, sin cambios de schema

- Ejecutar las consultas de la sección 8 en una copia de producción o en una réplica de lectura.
- Guardar sólo agregados y hashes; no exportar documentos, nombres ni fechas de nacimiento.
- Congelar el backup y verificar que el restore funciona.
- Aprobar el mapa de documentos legacy (`NATIONAL_ID`, `DRIVER_LICENSE`, `OTHER`) con operaciones.

### Fase 1 — Schema aditivo

Separar en dos migraciones por la limitación de PostgreSQL al usar un valor de enum nuevo en la misma transacción:

1. Agregar `CPF` y `RG` a `GuestDocumentType`.
2. Crear enums, `GuestFnrhProfile` y `ReservationGuest`; agregar relaciones Prisma.
3. Crear índices y FKs compuestas de tenant.
4. No agregar todavía triggers que bloqueen escrituras existentes.

Las columnas existentes no se renombran ni se eliminan. `Reservation.guestId` y `Stay` siguen siendo obligatorios.

### Fase 2 — Backfill idempotente

- Insertar una fila `PRIMARY` por cada reserva existente, con `guestId = Reservation.guestId`, `ageGroup=UNKNOWN`, `origin=LEGACY_BACKFILL`.
- No insertar acompañantes a partir de `adults`/`children`.
- No crear perfiles FNRH vacíos automáticamente; se crean al capturar datos.
- Reejecutar el backfill: `ON CONFLICT (reservationId, guestId) DO NOTHING`.
- Verificar que el número de filas sea igual al número de reservas y que cada `PRIMARY` coincida.
- El backfill no implica sincronización FNRH: no se envían reservas históricas automáticamente ni se marcan todos los principales legacy como adultos. Se clasifican sólo si producto decide sincronizarlas o al reabrirlas.

### Fase 3 — Adopción en aplicación

- Crear reserva + `PRIMARY` en la misma transacción.
- Al cambiar `Reservation.guestId`, actualizar la fila `PRIMARY` en la misma transacción.
- Agregar endpoints/servicios para acompañantes y perfil FNRH; no exponerlos en la API pública de huéspedes sin permiso.
- Actualizar el importador CSV de huéspedes para aceptar `CPF`/`RG` sin convertir automáticamente `NATIONAL_ID`; reportar filas legacy para revisión.
- Exigir la fiesta completa antes del check-in en lote; si falta un adulto/dependiente, no enviar FNRH y mantener el check-in hotelero con advertencia.
- Calcular edad a la fecha de check-in y bloquear sólo FNRH cuando `birthDate` falte.
- Aplicar el filtro de cutover (`checkInDate >= cutoverDate`) para no sincronizar reservas históricas.
- Calcular readiness en el módulo FNRH; no bloquear check-in hotelero por datos FNRH incompletos.
- Medir cuántas reservas históricas quedan incompletas antes de agregar constraints estrictos.

### Fase 4 — Constraints y limpieza

- Crear el índice único parcial de `PRIMARY` y el trigger diferido.
- Agregar checks de formato para CPF, códigos de país, CEP e IBGE.
- Evaluar un índice único de documento por propiedad sólo después de un reporte de duplicados y limpieza manual.
- No eliminar `Reservation.guestId` ni `adults`/`children` en esta iniciativa.

## 7. Esqueleto SQL de la migración (no ejecutado)

```sql
-- Migración A: valores de enum aislados.
ALTER TYPE "GuestDocumentType" ADD VALUE IF NOT EXISTS 'CPF';
ALTER TYPE "GuestDocumentType" ADD VALUE IF NOT EXISTS 'RG';

-- Migración B: tablas nuevas.
CREATE TYPE "ReservationGuestRole" AS ENUM ('PRIMARY', 'COMPANION');
CREATE TYPE "GuestAgeGroup" AS ENUM ('ADULT', 'MINOR', 'UNKNOWN');
CREATE TYPE "ReservationGuestOrigin" AS ENUM ('LEGACY_BACKFILL', 'MANUAL', 'PRE_CHECKIN', 'IMPORT');
CREATE TYPE "MinorSupervision" AS ENUM ('ACCOMPANIED', 'UNACCOMPANIED_AUTHORIZED', 'UNACCOMPANIED_WITHOUT_AUTHORIZATION', 'UNKNOWN');

CREATE TABLE "GuestFnrhProfile" (
    "guestId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "socialName" TEXT,
    "birthDate" DATE,
    "nationalityCountryCode" VARCHAR(2),
    "residenceCountryCode" VARCHAR(2),
    "genderCode" VARCHAR(32),
    "raceCode" VARCHAR(32),
    "disabilityCode" VARCHAR(32),
    "disabilityTypeCode" VARCHAR(32),
    "postalCode" VARCHAR(16),
    "street" VARCHAR(160),
    "number" VARCHAR(20),
    "complement" VARCHAR(80),
    "district" VARCHAR(80),
    "cityIbgeCode" VARCHAR(7),
    "cityName" VARCHAR(120),
    "stateCode" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuestFnrhProfile_pkey" PRIMARY KEY ("guestId")
);

CREATE TABLE "ReservationGuest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "role" "ReservationGuestRole" NOT NULL,
    "ageGroup" "GuestAgeGroup" NOT NULL DEFAULT 'UNKNOWN',
    "legalIncapacity" BOOLEAN NOT NULL DEFAULT false,
    "minorSupervision" "MinorSupervision",
    "authorizationReference" VARCHAR(120),
    "origin" "ReservationGuestOrigin" NOT NULL DEFAULT 'MANUAL',
    "responsibleReservationGuestId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReservationGuest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationGuest_reservationId_guestId_key"
    ON "ReservationGuest"("reservationId", "guestId");
CREATE UNIQUE INDEX "ReservationGuest_organizationId_propertyId_id_key"
    ON "ReservationGuest"("organizationId", "propertyId", "id");
CREATE INDEX "ReservationGuest_org_property_reservation_idx"
    ON "ReservationGuest"("organizationId", "propertyId", "reservationId");
CREATE INDEX "ReservationGuest_org_property_guest_idx"
    ON "ReservationGuest"("organizationId", "propertyId", "guestId");

-- FKs compuestas obligatorias (además de las FKs simples a Property):
-- GuestFnrhProfile (organizationId, propertyId, guestId)
--   -> Guest (organizationId, propertyId, id)
-- ReservationGuest (organizationId, propertyId, reservationId)
--   -> Reservation (organizationId, propertyId, id)
-- ReservationGuest (organizationId, propertyId, guestId)
--   -> Guest (organizationId, propertyId, id)
-- ReservationGuest (organizationId, propertyId, responsibleReservationGuestId)
--   -> ReservationGuest (organizationId, propertyId, id)

-- Backfill: sólo el principal; no se inventan acompañantes.
INSERT INTO "ReservationGuest" (
    "id", "organizationId", "propertyId", "reservationId", "guestId",
    "role", "ageGroup", "origin", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), r."organizationId", r."propertyId", r."id", r."guestId",
       'PRIMARY', 'UNKNOWN', 'LEGACY_BACKFILL', now(), now()
FROM "Reservation" r
ON CONFLICT ("reservationId", "guestId") DO NOTHING;

-- Fase 4: una sola fila principal por reserva.
CREATE UNIQUE INDEX "ReservationGuest_one_primary_per_reservation"
    ON "ReservationGuest"("reservationId")
    WHERE "role" = 'PRIMARY';
```

No se debe ejecutar este esqueleto tal cual: faltan FKs compuestas, checks de formato, trigger diferido y validación de `updatedAt`. Es material de revisión para la migración real.

## 8. Consultas de preflight (sólo agregados)

```sql
-- Reservas con más de un huésped esperado: candidatas a acompañantes faltantes.
SELECT count(*) AS reservations_with_multiple_guests
FROM "Reservation"
WHERE "adults" + "children" > 1;

-- Reservas con menores declarados, sin identidades asociadas.
SELECT count(*) AS reservations_with_minors
FROM "Reservation"
WHERE "children" > 0;

-- Distribución de tipos de documento (sin exponer números).
SELECT "documentType", count(*)
FROM "Guest"
GROUP BY "documentType"
ORDER BY count(*) DESC;

-- Posibles duplicados por documento normalizado; sólo conteos.
SELECT "documentType", count(*) AS duplicate_groups
FROM (
  SELECT "documentType", regexp_replace(upper("documentNumber"), '[^A-Z0-9]', '', 'g') AS normalized
  FROM "Guest"
  WHERE "documentNumber" IS NOT NULL
  GROUP BY "documentType", normalized
  HAVING count(*) > 1
) duplicates
GROUP BY "documentType";

-- Huéspedes reutilizados en varias reservas: no son un error, pero afectan el mapeo a persona FNRH.
SELECT count(*) AS guests_with_multiple_reservations
FROM (
  SELECT "guestId" FROM "Reservation" GROUP BY "guestId" HAVING count(*) > 1
) reused;
```

No seleccionar nombres, documentos, emails, teléfonos ni fechas de nacimiento en los reportes de preflight. Si se necesita muestreo, usar ids internos y acceso restringido.

## 9. Implicaciones de aplicación (diseño, no implementación)

- `POST /reservations` sigue aceptando `guestId`; crea además el `PRIMARY` en la misma transacción.
- `PATCH /reservations/:id` con cambio de `guestId` actualiza el `PRIMARY` y registra historial/auditoría.
- Nuevo flujo de acompañantes: listar, agregar, editar y quitar filas `COMPANION`; el principal no se elimina.
- El alta de un menor exige `birthDate` o `ageGroup=MINOR` confirmado, `minorSupervision` y un responsable adulto/capaz de la misma reserva; no crea una ficha FNRH independiente.
- El alta de una persona legalmente incapaz exige `legalIncapacity=true` y un responsable adulto/capaz de la misma reserva.
- El perfil FNRH se captura en check-in/pre-check-in o desde una pantalla de preparación FNRH; no se muestra en el listado general de huéspedes.
- La UI debe mostrar `MISSING_COMPANIONS`/`PROFILE_INCOMPLETE` como advertencia operativa, no como fallo del check-in hotelero.
- `GET /guests` no devuelve campos FNRH por defecto. Cualquier lectura del perfil requiere `guests.manage` y queda auditada.
- Reportes, exportaciones y documentos existentes siguen usando `Reservation.guestId`; no se cambia su contrato en esta fase.

## 10. Privacidad y autorización

- `GuestFnrhProfile` es finalidad-específico: existe para la obligación FNRH, no para marketing ni perfilado.
- Lectura/escritura con `guests.manage`; si operaciones necesita un permiso más granular, se evalúa `guests.fnrh` en una decisión separada. No se introduce ahora.
- Auditoría registra acción, `guestId`, campos modificados y correlación; nunca valores de documento, fecha de nacimiento, dirección o nacionalidad.
- Documentos y fechas de nacimiento se enmascaran en respuestas de listado y logs.
- Retención: el perfil sigue la política del huésped; la desactivación no borra automáticamente. El borrado/anonimización requiere procedimiento aprobado.
- Menores: acceso restringido, finalidad limitada y responsable identificado; no se amplía el tratamiento sin base legal.

## 11. Pruebas necesarias antes de implementar

### Migración

- Sobre una copia con datos: cada reserva recibe exactamente un `PRIMARY` con el mismo `guestId`.
- `children > 0` no crea filas de menores ni modifica conteos.
- Reejecutar el backfill no duplica filas.
- Un `PRIMARY` no puede tener otro `PRIMARY` en la misma reserva.
- Un `ReservationGuest` no puede apuntar a un `Guest` de otra propiedad.
- Un menor sin responsable, o con responsable de otra reserva/menor, es rechazado por el trigger.
- Un `PRIMARY` menor o legalmente incapaz es rechazado.
- Un menor con `minorSupervision=UNKNOWN` es rechazado en la validación de aplicación/trigger.
- Un menor desacompañado sin autorización bloquea check-in/FNRH; uno autorizado sin referencia también queda bloqueado.
- Cambiar `Reservation.guestId` sin actualizar el `PRIMARY` es rechazado.

### Aplicación (cuando se implemente)

- Crear reserva con principal y acompañantes; adultos/menores correctos.
- Reemplazar principal; historial y auditoría sin PII.
- Check-in sigue creando un solo `Stay` y no duplica fichas.
- Readiness devuelve `MISSING_COMPANIONS`, `AGE_GROUP_UNKNOWN`, `MINOR_RESPONSIBLE_MISSING` y `DOCUMENT_NOT_FNRH_READY` en los casos esperados.
- Un menor no genera una FNRH independiente; el vínculo se envía en la ficha del responsable.
- Una persona legalmente incapaz sin responsable devuelve `LEGAL_INCAPACITY_RESPONSIBLE_MISSING`.
- Cross-tenant: no se puede leer/escribir un huésped o perfil de otra propiedad.
- Borrado/desactivación de huésped referenciado no rompe reservas.

## 12. Rollback

- Fase 1–2: detener la escritura de las tablas nuevas y conservarlas; `Reservation.guestId`, `Stay` y los conteos no se tocaron. En desarrollo se pueden eliminar las tablas nuevas, pero en producción se prefiere dejarlas inertes.
- Fase 3: desactivar el flujo de acompañantes/perfil; el principal backfilled sigue siendo inocuo.
- Fase 4: no eliminar constraints/triggers sin antes detener escrituras y verificar que no hay filas inconsistentes.
- Nunca borrar `ReservationGuest` para “volver atrás” si ya se usó para FNRH; conservar para reconciliación/auditoría.

## 13. Criterios de aceptación del diseño

- [x] Modelo actual y restricciones identificados.
- [x] Separación entre conteos operativos y fiesta FNRH definida.
- [x] Principal, acompañantes y menores modelados sin placeholders.
- [x] Perfil FNRH separado y minimizado.
- [x] Fases de migración, backfill y rollback definidas.
- [x] Reglas de integridad y pruebas definidas.
- [x] Revisión oficial aplicada: menores sin FNRH propia, principal adulto, CPF/pasaporte y `cpf_solicitante` del operador.
- [x] Decisiones de producto P-01 a P-06 registradas para planificación (ratificación pendiente).
- [ ] Producto/operaciones aprueban el flujo de captura de acompañantes.
- [ ] Legal/LGPD aprueban finalidad, retención y acceso a datos de menores.
- [ ] Se confirma la lista exacta de campos obligatorios de FNRH para personas y menores.
- [ ] Se revisa el preflight con una copia de datos reales (sólo agregados).
- [ ] Se aprueba la migración en staging/producción y su ventana de ejecución (la migración local ya está aplicada y verificada).
- [ ] Se completan las firmas de `FNRH_GUEST_MODEL_REVIEW.md`.

## 14. Estado de las decisiones abiertas

El detalle y las firmas están en `FNRH_GUEST_MODEL_REVIEW.md`. Resumen:

| Tema                            | Estado                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ficha propia de menores         | **Cerrado**: se vinculan a la FNRH del responsable; no se crea ficha independiente                                        |
| Documento para menores          | **Pendiente de homologación**: la Portaria exige verificar edad/vínculo; el API puede exigir persona/documento. No asumir |
| Edad a check-in vs reserva      | **Default propuesto**: check-in; confirmar con Serpro                                                                     |
| Principal menor                 | **Cerrado**: no permitido; principal adulto y capaz                                                                       |
| Acompañantes antes del check-in | **Pendiente producto**: recomendado para check-in en lote                                                                 |
| `StayGuest`                     | **Diferido por producto**: primera versión usa `Stay` por reserva                                                         |
| Extranjeros                     | **Cerrado**: pasaporte, sin CPF/gov.br                                                                                    |
| `cpf_solicitante`               | **Técnicamente cerrado**: CPF del operador; origen/base legal pendiente de legal/Serpro                                   |
