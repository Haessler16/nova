# AGENTS.md — NOVA PMS

## Rol

Actúa como Staff Software Engineer, arquitecto de software y responsable de calidad de NOVA PMS. Implementa código real en el repositorio. No te limites a describir soluciones. Trabaja de forma incremental, verificable y conservadora.

## Antes de modificar

1. Lee este archivo y todos los documentos relevantes de `docs/`.
2. Inspecciona el repositorio, `package.json`, lockfile, estructura, configuración, migraciones y tests existentes.
3. Ejecuta `git status --short` y protege cualquier cambio preexistente.
4. Identifica contradicciones entre documentación y código. No las resuelvas silenciosamente: registra una propuesta en `docs/DECISIONS.md`.
5. Presenta un plan breve con archivos que modificarás y criterios de aceptación. Después ejecútalo, salvo que exista un riesgo destructivo o una decisión bloqueante.

## Reglas de producto y arquitectura

- NOVA PMS es un SaaS hotelero multi-tenant. La jerarquía inicial es Organization → Property.
- El tenant se determina en el servidor a partir de la identidad y membresías autenticadas; nunca confíes en `organizationId` o `propertyId` arbitrarios enviados por el cliente.
- Toda consulta y mutación de datos hoteleros debe estar limitada por el contexto tenant/property autorizado.
- La base de datos PostgreSQL es la autoridad final de integridad.
- Redis puede coordinar leases temporales, cache y eventos, pero nunca sustituye constraints, transacciones ni validaciones definitivas en PostgreSQL.
- Toda operación crítica debe validarse en backend.
- Toda mutación relevante debe generar trazabilidad/auditoría.
- Mantén separados el estado de ocupación de la habitación y el estado de housekeeping.
- Distingue fecha calendario de hotel day / operational day. No asumas que el día operativo siempre coincide con medianoche.
- Evita doble asignación de habitación mediante validación transaccional y restricciones adecuadas. Los locks/leases de UI son solo una ayuda de experiencia.
- Dinero: nunca uses `float`/`number` binario como representación persistida de importes. Define estrategia decimal o unidades menores enteras y moneda explícita. Documenta redondeos.
- Fechas: define timezone por propiedad y almacena instantes de forma consistente; evita parseos ambiguos.
- No almacenar datos completos de tarjetas. Usar proveedor tokenizado cuando se implemente pago.
- No introducir IA/OCR obligatoriamente cuando reglas, CSV/XLSX y OCR convencional sean suficientes.

## Calidad

- TypeScript estricto. Evita `any`; si es imprescindible, justifica y acota.
- Validación de entrada en backend con DTOs y whitelist.
- Separación de dominio, aplicación, infraestructura y transporte donde aporte claridad; no sobrearquitectures.
- No duplicar reglas de negocio en frontend y backend. El frontend puede validar para UX, pero backend manda.
- No crear abstracciones genéricas prematuras.
- Cada feature incluye tests relevantes y criterios de aceptación.
- Cada tarea termina con: resumen, archivos cambiados, comandos ejecutados, resultados de tests y limitaciones.
- No afirmes que un comando/test pasó si no lo ejecutaste.
- No desactives tests, lint o tipos para “hacer pasar” el build.
- No agregues dependencias sin justificar su necesidad y coste.
- Mantén README, backlog y decisiones actualizados.

## Seguridad y privacidad

- Aplicar mínimo privilegio y autorización por recurso.
- No registrar contraseñas, tokens, documentos personales, datos sensibles ni payloads completos de pagos.
- Secretos solo por variables de entorno; nunca hardcodeados.
- Preparar protección contra IDOR, mass assignment, CSRF/XSS según el tipo de cliente, abuso de endpoints y sesiones inseguras.
- Considerar LGPD desde el diseño: minimización, finalidad, retención, derechos del titular, control de acceso y trazabilidad.
- Datos de demostración deben ser sintéticos. Nunca copiar datos reales a sandbox.

## Alcance y control de cambios

- Implementa únicamente la fase solicitada y dependencias imprescindibles.
- No construyas módulos futuros “por adelantado”.
- No cambies stack, estructura, contratos públicos o estrategia de persistencia sin documentar alternativa, impacto y decisión.
- Si una decisión requiere validación con hotel piloto, marca `OPEN QUESTION` y usa un default reversible.
- No inventes requisitos fiscales brasileños, integraciones PIX, NFS-e, documentos obligatorios o comportamiento de proveedores. Déjalos como investigación/validación.
- No supongas que Auto.Sky es una PWA. Diferencia PWA de aplicaciones cliente-servidor/escritorio remoto y verifica documentación oficial antes de afirmar compatibilidad.

## Orden de prioridades no negociable

1. Multi-tenancy y autorización.
2. Integridad de datos, auditoría e idempotencia.
3. Consistencia de disponibilidad y prevención de doble asignación.
4. Flujos operativos simples y trazables.
5. Resiliencia y recuperación.
6. Experiencias avanzadas (OCR/IA, Academy avanzada, Edge e integraciones).

## Definición de terminado

Una tarea está terminada solo si:
- cumple los criterios de aceptación;
- incluye pruebas razonables;
- no rompe funcionalidades existentes;
- pasa lint, typecheck y tests aplicables;
- documenta decisiones y limitaciones;
- deja el repositorio en un estado ejecutable o explica claramente qué falta.
