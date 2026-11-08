# NOVA PMS — Product Brief v0.1

## 1. Visión

NOVA PMS es una plataforma SaaS para gestionar la operación hotelera desde una experiencia web moderna, confiable y fácil de aprender. El punto de entrada comercial y técnico será Front Office. La visión de largo plazo es un ecosistema modular hotelero, sin intentar construir todos los módulos en el MVP.

## 2. Usuarios iniciales

- Recepcionista: consulta disponibilidad, crea/modifica reservas, registra huéspedes, realiza check-in/out y gestiona folios.
- Supervisor/gerente de recepción: supervisa ocupación, asignaciones, caja, incidencias y actividad del equipo.
- Administrador de propiedad: configura habitaciones, tipos, tarifas, usuarios y reglas locales.
- Administrador de organización: administra varias propiedades y acceso organizacional.
- Auditor/finanzas: consulta movimientos, cierres, ajustes y trazabilidad según permisos.

## 3. Problemas a resolver

- Operaciones fragmentadas o lentas en recepción.
- Riesgo de asignar una habitación dos veces.
- Falta de visibilidad del estado real de habitaciones y reservas.
- Errores de captura y transferencia de datos de huéspedes.
- Poca trazabilidad de cambios y movimientos.
- Interrupciones de red/energía y recuperación operativa confusa.
- Curva de aprendizaje alta para personal nuevo.

## 4. Objetivos MVP

1. Administrar organización, propiedades, usuarios, roles y permisos.
2. Configurar habitaciones, tipos, tarifas y parámetros operativos básicos.
3. Crear y administrar huéspedes y reservas.
4. Consultar calendario, disponibilidad y room rack.
5. Ejecutar check-in y check-out.
6. Gestionar folios, cargos, pagos registrados y caja básica.
7. Ejecutar cierre de día operativo / night audit controlado.
8. Consultar dashboard e informes operativos básicos.
9. Mantener historial auditable de cambios relevantes.
10. Establecer una base técnica que permita resiliencia offline futura sin prometer operaciones offline inseguras.

## 5. No objetivos del MVP

- ERP hotelero completo.
- Channel manager y distribución OTA.
- Revenue management avanzado.
- Motor fiscal brasileño o emisión fiscal sin proveedor y requisitos validados.
- Procesamiento directo de tarjetas o almacenamiento de PAN/CVV.
- Automatización total mediante IA.
- Edge local en la primera versión comercial.
- Operación offline multi-terminal con consistencia garantizada sin un coordinador local.
- Migración/integración con Auto.Sky o TOTVS sin discovery técnico y comercial.

## 6. Módulos y alcance funcional

### Foundation
- Organization, Property, usuarios, membresías, roles/permisos.
- Preferencias por propiedad: timezone, moneda, hotel day, datos de contacto.
- Auditoría de acciones relevantes.
- Gestión de sesiones y seguridad.

### Inventory
- Tipos de habitación.
- Habitaciones físicas y atributos.
- Estados separados: ocupación/operación y housekeeping.
- Fuera de servicio / fuera de orden con motivo y periodo.
- Historial de cambios.

### Guests
- Perfil de huésped con datos mínimos necesarios.
- Datos de contacto y documentos solo cuando la operación y la normativa lo justifiquen.
- Deduplicación asistida, merge controlado y auditado.
- No usar documento personal como único identificador interno.

### Reservations
- Crear, consultar, modificar y cancelar reserva.
- Huéspedes asociados, ocupación, fechas, tipo de habitación, tarifa y origen.
- Estados claros y transiciones validadas.
- Disponibilidad calculada por backend.
- Asignación de habitación con control de concurrencia.
- Bloqueos temporales de selección para UX y confirmación transaccional definitiva.

### Front Office
- Room rack.
- Llegadas, salidas, huéspedes in-house, no-shows.
- Check-in y check-out con validaciones.
- Cambio de habitación controlado.
- Notas e incidencias.

### Folio / caja
- Folios por estancia/reserva.
- Cargos y ajustes auditados.
- Registro de pagos por método y referencia externa.
- Apertura/cierre de caja y movimientos básicos.
- Importes con moneda y precisión explícitas.
- No almacenar datos de tarjeta.

### Hotel day / Night audit
- Día operativo configurable por propiedad.
- Validaciones previas al cierre.
- Operaciones pendientes y excepciones visibles.
- Cierre idempotente y trazable.
- Reapertura solo con permiso elevado, motivo y auditoría.

### Reporting
- Ocupación, llegadas, salidas, huéspedes in-house, habitaciones fuera de servicio.
- Reportes derivados de datos operativos con filtros y timezone de propiedad.
- Exportaciones protegidas por permisos.

## 7. Reglas de negocio fundamentales

- Una habitación no puede tener dos estancias/reservas confirmadas incompatibles en el mismo intervalo.
- El backend valida disponibilidad en el momento de confirmar, no solo al abrir el calendario.
- Las restricciones de concurrencia deben funcionar con múltiples instancias API.
- Una operación repetida por retry no debe duplicar cargos, pagos, check-in, check-out o cierre; usar idempotencia donde corresponda.
- La cancelación no elimina el historial.
- Los cambios de tarifa, fechas, habitación, huéspedes y cargos deben ser auditables.
- Los estados de housekeeping no deben inferirse automáticamente del estado de ocupación.
- Los cambios de día operativo no deben alterar retroactivamente fechas históricas.
- Los importes no se representan con coma flotante binaria.

## 8. Importación de huéspedes (fase posterior al núcleo)

Entradas previstas: CSV, XLSX, PDF, imágenes/fotos y documentos tabulares.
Flujo: carga → detección de formato → extracción → normalización → preview editable → validación → deduplicación → asociación opcional a reserva → confirmación humana → resultado con errores y auditoría.
OCR/IA multimodal solo cuando aporte valor medible. La IA no debe confirmar ni asociar datos automáticamente sin revisión humana.
Aplicar límites de tamaño, antivirus/validación de archivos, permisos, cifrado, retención limitada y eliminación programada.

## 9. Onboarding y NOVA Academy

MVP de aprendizaje:
- tour guiado corto;
- sandbox aislado con hotel, habitaciones, huéspedes, reservas y pagos ficticios;
- ejercicios guiados de reserva, check-in, folio y check-out;
- avanzar, retroceder, omitir, retomar y reiniciar.
- indicador permanente de modo demo.
- aislamiento estricto de producción: credenciales, datos, storage, colas y proveedores separados.
Nunca permitir cobros ni envío de documentos reales desde sandbox.

## 10. Resiliencia: estrategia por etapas

### Cloud-first con capacidad offline limitada
- PWA instalable.
- Service Worker para shell y assets estáticos.
- IndexedDB solo para subconjunto mínimo, con política explícita de datos y protección.
- Outbox para acciones permitidas, idempotencia y reconciliación.
- Estado visible: online, offline, sincronizando, conflicto y error.
- Reintentos con backoff y restauración de sesión segura.

### Matriz inicial de capacidades

| Capacidad | Online | Offline inicial |
|---|---:|---:|
| Abrir shell de aplicación | Sí | Sí, si ya fue cacheado |
| Consultar datos sincronizados recientemente | Sí | Sí, solo lectura y con marca de antigüedad |
| Crear nota local no crítica | Sí | Sí, en cola |
| Ver disponibilidad actualizada | Sí | No garantizada |
| Confirmar asignación definitiva | Sí | No |
| Check-in / check-out | Sí | No inicialmente |
| Registrar pago | Sí | No |
| Cierre de caja / night audit | Sí | No |
| Modificar datos compartidos críticos | Sí | No |

La PWA no mantiene un PC, router o switch encendido cuando se corta la electricidad. La autonomía eléctrica requiere UPS para equipos de red y terminales críticos.

### NOVA Edge (fase futura)
Un coordinador/servidor local en LAN podría permitir que varias terminales sigan operando durante una caída WAN y sincronizar después con cloud. No es parte del MVP. Requiere discovery de hardware, seguridad, conflictos, backups, soporte y actualización. No resuelve un apagón si el Edge/router/terminal no tienen alimentación.

### Contexto de validación
Se observó en un hotel piloto potencial un escenario donde un corte eléctrico apaga el router y, al volver la energía, las terminales presentan errores que requieren reinicios. Es una observación puntual, no una afirmación universal sobre Auto.Sky ni sobre todos los hoteles. Investigar por separado pérdida de energía, WAN, LAN/router/switch, terminal y proveedor cloud.

## 11. Brasil: temas que requieren validación

- LGPD: base legal, minimización, retención, derechos y responsabilidades.
- PIX: proveedor, conciliación, estados, webhooks, reembolsos y manejo de idempotencia.
- NFS-e/documentos fiscales: requisitos por municipio y modelo de proveedor.
- Documentación de huéspedes y obligaciones de registro: validar con asesoría local y hoteles.
- No implementar requisitos legales o fiscales por inferencia.

## 12. Métricas iniciales

- Tiempo para crear una reserva.
- Tiempo de check-in y check-out.
- Errores de asignación/doble asignación (objetivo: cero).
- Tasa de operaciones fallidas y reintentos.
- Tiempo de recuperación tras desconexión.
- Tiempo de onboarding hasta completar flujos sin ayuda.
- Incidencias de sincronización y conflictos.
- Disponibilidad de la aplicación y latencia p95 por operación.

## 13. Criterios de éxito del piloto

- Recepción completa flujos diarios sin asistencia constante.
- No se producen dobles asignaciones en pruebas concurrentes ni piloto.
- Cada cambio crítico puede atribuirse a usuario, propiedad, fecha y motivo.
- La recuperación ante caída de red es comprensible y no duplica operaciones.
- El personal entiende claramente cuándo está online/offline y qué operaciones están restringidas.
- El piloto valida el flujo operativo antes de ampliar alcance.
