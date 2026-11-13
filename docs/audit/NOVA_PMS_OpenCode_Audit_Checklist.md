# NOVA PMS — Auditoría y criterios de aceptación para OpenCode

Estados: `NO INICIADO` · `PARCIAL` · `IMPLEMENTADO` · `PROBADO`.

## INSTRUCCIÓN PRINCIPAL

Audita antes de modificar. No asumas que los paquetes preparados ya están implementados. Para cada requisito informa estado, archivos/rutas, endpoints, migraciones, pruebas ejecutadas y resultado. No inventes evidencia ni hagas refactors destructivos.

## FUNDACIÓN Y SEGURIDAD

[ ] Multi-tenant Organization → Properties → Users y aislamiento backend.
[ ] Autenticación y RBAC por acción/propiedad.
[ ] Auditoría de acciones críticas e historial.
[ ] Validación server-side y transacciones DB.
[ ] Migraciones reproducibles; demo aislada.
[ ] LGPD: minimización, permisos, retención y registro de acceso.

## DISEÑO Y EXPERIENCIA

[ ] Light SaaS / balanced density / hybrid modals.
[ ] AppShell, tokens y componentes compartidos.
[ ] Desktop recepción y tablet responsive.
[ ] Dialogs/drawers accesibles, foco, teclado, scroll y unsaved changes.
[ ] Loading/empty/error/success/offline; sin controles muertos.
[ ] Mocks separados de APIs reales.

## DASHBOARD Y RECEPCIÓN

[ ] KPIs reales: ocupación, llegadas, salidas y habitaciones disponibles.
[ ] Alertas/acciones rápidas conectadas.
[ ] Búsqueda de huésped/documento/código con permisos.
[ ] Check-in guiado, revisión final y anti doble-submit.
[ ] Validar reserva, huésped, habitación, servicios y pagos.
[ ] Éxito solo tras confirmación del servidor.

## ROOM RACK Y CONCURRENCIA

[ ] Grid/lista y filtros por piso/tipo/estado.
[ ] Ocupación y housekeeping separados.
[ ] Drawer contextual.
[ ] Lock temporal con expiración/liberación.
[ ] Validación atómica en backend al confirmar.
[ ] Prueba real: dos recepcionistas intentan asignar misma habitación; solo una confirma.

## RESERVAS Y HUÉSPEDES

[ ] Calendario/lista, filtros y búsqueda.
[ ] Crear/editar reserva y validar disponibilidad.
[ ] Instrucciones visibles en detalle de reserva.
[ ] Perfil con historial y reservas vinculadas.
[ ] Notas del huésped separadas de instrucciones de reserva.

## NOTES & INSTRUCTIONS

[ ] Texto original preservado.
[ ] Parser determinista pt-BR y diccionario versionado.
[ ] Categoría, prioridad, estado, origen, visibilidad y eventos.
[ ] Revisión humana ante baja confianza.
[ ] “PGTO DIRETO NO HOTEL” crea tarea pendiente de preautorización con tarjeta en check-in; no pago ni autorización ya realizada.
[ ] Parser nunca crea pagos/cargos/caja/preautorizaciones.
[ ] Datos de tarjeta/NSU/authcode no se copian a notas.

## DOCUMENTOS, PDF Y REPORTES

[ ] Ficha interna de huésped y firma.
[ ] PDF/impresión con preview y errores.
[ ] Reportes con filtros, periodo, totales y exportación.
[ ] FNRH separado del documento interno.
[ ] Integración oficial solo al validar contrato/API/credenciales.

## CAJA Y PAGOS

[ ] Folio, cargos, pagos y saldo.
[ ] Preautorización ≠ captura/pago.
[ ] Idempotencia, webhooks, reversos y conciliación.
[ ] Proveedor/tokenización; nunca PAN/CVV.
[ ] Confirmación y auditoría.

## NO MARCAR COMO TERMINADO SIN PRUEBAS

[ ] Offline multi-terminal y NOVA Edge.
[ ] Recuperación ante caída eléctrica/WAN.
[ ] NOVA Academy aislada.
[ ] OCR/importación con revisión humana.
[ ] Night audit/cierre operativo.
[ ] Integraciones FNRH, PIX, NFS-e, PMWeb/OTAs.

## FORMATO DE ENTREGA

Tabla obligatoria: ID | estado | archivos/rutas | endpoints | migraciones | pruebas/resultados | capturas | limitaciones | siguiente acción. Si usa mocks, marcar MOCK/PARCIAL.

## REGLA FINAL

Una pantalla no equivale a una función terminada. Para PROBADO se requiere persistencia, permisos, validaciones, errores controlados y pruebas acordes al riesgo.

## Formato de respuesta

ID | estado | archivos/rutas | endpoints | migraciones | pruebas/resultados | capturas | limitaciones | siguiente acción.
