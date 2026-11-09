# NOVA PMS — Runbook de piloto

Guía operativa para acompañar las primeras sesiones con un hotel piloto. Todo el entorno descrito es local o de staging: nunca apuntes estos comandos a producción sin aprobación explícita.

## 1. Antes de empezar

- Verificá que PostgreSQL y Redis estén arriba: `pnpm infra:up` y `pnpm infra:logs`.
- Aplicá migraciones y datos sintéticos: `pnpm db:migrate:deploy && pnpm db:seed`.
- Verificá la integridad manual: `pnpm db:verify`.
- Arrancá API y web: `pnpm dev`. API en `http://localhost:3001`, web en `http://localhost:3000`.
- La UI usa selector de organización y propiedad; el backend resuelve el tenant y rechaza cabeceras ajenas.

## 2. Onboarding operativo

La página `/pilot` contiene el checklist persistido en el navegador:

1. Revisar propiedad (timezone, moneda y hora de corte).
2. Configurar tipos de habitación y habitaciones.
3. Registrar un huésped sintético.
4. Crear una reserva con fechas y ocupación.
5. Probar check-in, room rack y check-out.
6. Abrir un folio, postear un cargo y registrar un pago parcial.
7. Abrir caja, registrar movimientos y cerrar con el importe contado.
8. Ejecutar el cierre del día operativo y, si hace falta, un reopen controlado.

Cada paso enlaza al flujo real. El checklist es una ayuda de adopción, no una autorización: la API sigue mandando.

## 2.1 Importación de huéspedes por CSV

1. Ir a `/imports` con la propiedad correcta.
2. Descargar o copiar la plantilla: `fullName,email,phone,documentType,documentNumber,notes` (coma o punto y coma).
3. Generar la vista previa: muestra filas válidas, inválidas y el motivo por fila. Nada se guarda todavía.
4. Corregir el CSV si hay errores y volver a previsualizar; el botón de confirmación solo se habilita sin errores.
5. Confirmar. La importación es todo o nada, máximo 500 filas / 512 KB, y usa una clave de idempotencia: reintentar con el mismo archivo no duplica huéspedes.

Límites y privacidad: el CSV no se persiste, la auditoría guarda solo conteos y los documentos duplicados dentro del mismo archivo se rechazan. Duplicados entre archivos distintos quedan a revisión humana.

## 2.2 Comportamiento sin conexión

- El indicador de conexión muestra `Sin conexión`.
- La vista previa y cualquier mutación se bloquean antes de enviar la request; no hay outbox ni confirmaciones optimistas.
- El shell y la página `/offline` pueden servirse desde cache; las respuestas de API nunca se cachean.
- Al recuperar conexión, reintentar la operación. Las claves de idempotencia evitan duplicados en folios, caja, cierre e importaciones.

## 2.3 Exportaciones, auditoría y diagnóstico

- Huéspedes, Reservas y Folios tienen **Exportar CSV** en la cabecera; respeta los filtros visibles y descarga un archivo con BOM UTF-8.
- Límite: 5000 filas por exportación. Si se supera, acotar por fecha, estado o búsqueda; no se trunca en silencio.
- Cada exportación queda en auditoría como `export.guests`, `export.reservations` o `export.folios`, solo con `rowCount` (sin datos personales).
- En `/audit` se puede filtrar por acción, entidad, actor y rango de fechas, y cargar más páginas con cursor. Los días se interpretan en UTC.
- `GET /health/version` informa versión, commit, uptime, timezone y última migración. Es información de soporte: no contiene secretos ni datos de huéspedes.
- Para soporte, adjuntar la salida de `/health/version`, el `correlationId` del request y el evento de auditoría; nunca adjuntar CSV con datos reales.

## 3. Sandbox demo aislado

```bash
CONFIRM_DEMO_SANDBOX=1 pnpm demo:sandbox
```

- Crea el schema PostgreSQL `demo_sandbox`, aplica las mismas migraciones y ejecuta el seed sintético.
- Imprime la `DATABASE_URL` del sandbox y los usuarios demo (`NovaDemo!2026`).
- Reejecutarlo vuelve a aplicar migraciones y seed idempotente; no toca el schema de trabajo.
- El script rechaza bases no locales y exige `CONFIRM_DEMO_SANDBOX=1`.
- Los datos son sintéticos. Nunca copies datos reales de huéspedes al sandbox.

## 4. Monitoreo

| Señal              | Dónde                           | Uso                                            |
| ------------------ | ------------------------------- | ---------------------------------------------- |
| Liveness           | `GET /health/live`              | Proceso vivo                                   |
| Readiness          | `GET /health/ready`             | DB y Redis disponibles                         |
| Métricas           | `GET /metrics`                  | Prometheus; `METRICS_ENABLED`, `METRICS_TOKEN` |
| Logs estructurados | stdout API                      | `event=http_request`, `correlationId`, status  |
| Auditoría          | `/audit` y `AuditEvent`         | Mutaciones críticas, append-only               |
| Seguridad          | `/admin` → eventos de seguridad | Logins fallidos, bloqueos, sesiones            |

Señales de alerta para el piloto:

- readiness en error más de 1 minuto;
- tasa de 5xx creciente o p95 de requests por encima de 1 s en flujos de recepción;
- `cash_session_already_open` inesperado o varianzas de caja sin motivo;
- eventos de seguridad repetidos para el mismo usuario.

Las métricas son in-process: con varias réplicas hace falta un scraper/agregador real.

## 5. Backup y restore drill

```bash
pnpm db:backup
CONFIRM_RESTORE_DRILL=1 pnpm db:restore:drill backups/nova-pms-nova_pms-<timestamp>.dump
```

- `db:backup` usa `pg_dump` dentro del contenedor local y escribe en `backups/`.
- El drill crea una base temporal, restaura el dump, ejecuta conteos y verifica el trigger append-only, y luego elimina la base temporal.
- Ambos scripts rechazan `DATABASE_URL` que no parezca local.
- El resultado del último drill queda registrado en `docs/PHASE_6_REPORT.md`.

Restore real (solo con aprobación y ventana de mantenimiento): detener API, restaurar sobre una base nueva, apuntar `DATABASE_URL`, aplicar migraciones pendientes, verificar `pnpm db:verify` y recién entonces reabrir tráfico.

## 6. Concurrencia y carga

`pnpm test:e2e:all:isolated` incluye `pilot-hardening.e2e-spec.ts`, que verifica bajo requests paralelos:

- una sola apertura de folio activa por reserva (`409` en la segunda);
- ningún sobrepago cuando dos pagos compiten por el mismo saldo;
- una sola caja abierta por propiedad (índice único parcial);
- métricas sin datos de huéspedes.

Antes de un piloto con más de una decena de usuarios concurrentes, ejecutar el suite contra staging y medir latencia de los flujos de recepción. No se agregó una herramienta de load testing externa en esta fase.

## 7. Feedback del piloto

- Cada usuario con `pilot.feedback.submit` envía feedback desde `/pilot` (categoría, mensaje y valoración opcional).
- Administradores y managers con `pilot.feedback.manage` lo marcan como revisado.
- El feedback queda limitado a organización y propiedad; no modifica folios, cajas ni reservas.
- El contexto enviado por la UI se limita a ruta y versión; el backend rechaza contextos mayores a 4 KB.

## 8. Incidentes

1. Contener: si hay riesgo financiero, pausar caja/folios en la propiedad afectada y avisar al responsable.
2. Diagnosticar: revisar readiness, `/metrics`, logs con `correlationId`, auditoría y eventos de seguridad.
3. Decidir: bug de aplicación → rollback del build anterior; dato corrupto → restore drill y plan de recuperación con aprobación.
4. Comunicar: estado, impacto y hora estimada al hotel piloto.
5. Cerrar: postmortem breve, acción correctiva y test de regresión.

Nunca edites ni borres `AuditEvent`, `RoomStatusHistory`, `ReservationHistory` ni `SecurityEvent`: son append-only por diseño y por trigger.

## 9. Rollback

- La aplicación se revierte desplegando el build anterior; las migraciones son forward-only.
- Si una migración nueva causó el incidente, no la edites: creá una migración correctiva y verificá `pnpm db:verify`.
- Si hay pérdida de datos, usá el backup más reciente y el drill como ensayo previo.

## 10. Limitaciones conocidas

- El cierre operativo se dispara manualmente; no hay scheduler con reintentos.
- Una moneda por folio y por caja; sin FX ni conciliación bancaria.
- Sin tokenización de tarjetas ni documentos fiscales.
- La UI no oculta acciones por permiso; la API responde `403`.
- El sandbox comparte la instancia PostgreSQL y aísla por schema, no por cluster.
- El CI remoto no fue observado desde este entorno.
