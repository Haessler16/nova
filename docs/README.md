# NOVA PMS — Índice de documentación

Un solo lugar para saber qué documento manda. Si un documento histórico
contradice al código, gana el código y se actualiza el documento.

## Fuentes de verdad (mantener sincronizadas)

| Documento                                                                                                | Qué responde                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `README.md` (raíz)                                                                                       | Qué es, requisitos, cómo levantarlo y comandos                           |
| `AGENTS.md`                                                                                              | Reglas de producto, arquitectura y calidad que rigen los cambios         |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                                                       | Capas, módulos, aislamiento tenant y decisiones estructurales            |
| [DATABASE.md](DATABASE.md)                                                                               | Modelo de datos, constraints, triggers e integridad                      |
| [API.md](API.md)                                                                                         | Contrato HTTP, errores, cabeceras y flujos de autenticación              |
| [SECURITY.md](SECURITY.md)                                                                               | Autenticación, autorización, CSRF, rate limits, LGPD y limitaciones      |
| [DECISIONS.md](DECISIONS.md)                                                                             | ADR index: contexto, decisión y consecuencias                            |
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md)                                                                     | Alcance de producto y prioridades                                        |
| [BACKLOG.md](BACKLOG.md)                                                                                 | Trabajo pendiente y orden previsto                                       |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)                                                                     | Componentes, tokens y patrones de UI                                     |
| [FRONTEND_STATE.md](FRONTEND_STATE.md)                                                                   | Estado de la aplicación web                                              |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)                                                         | Plan de ejecución por fases                                              |
| [PILOT_CHECKLIST.md](PILOT_CHECKLIST.md)                                                                 | Checklist de piloto                                                      |
| [PILOT_RUNBOOK.md](PILOT_RUNBOOK.md)                                                                     | Operación del piloto                                                     |
| [APP_REFERENCE.md](APP_REFERENCE.md)                                                                     | Referencia detallada: rutas, endpoints, autenticación, estructura        |
| [v5/NOVA_IMPROVEMENT_PLAN.md](v5/NOVA_IMPROVEMENT_PLAN.md)                                               | Plan de calidad/seguridad/cobertura en ejecución                         |
| [archive/v4/NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md](archive/v4/NOVA_PMS_FICHA_04_OPENCODE_TECHNICAL.md) | Ficha operativa vigente: brechas, UX y fases 0–7 de la Fase 12           |
| [audit/APP_STATE_2026-11-24.md](audit/APP_STATE_2026-11-24.md)                                           | Estado actual de la app para revisión (implementado / parcial / ausente) |
| [audit/AUDIT_2026-11-17.md](audit/AUDIT_2026-11-17.md)                                                   | Última auditoría verificada (corregida 2026-11-24)                       |
| [audit/NOVA_PMS_OpenCode_Audit_Checklist.md](audit/NOVA_PMS_OpenCode_Audit_Checklist.md)                 | Checklist de aceptación con estados por requisito                        |

## Contribución

- [CONTRIBUTING.md](../CONTRIBUTING.md): reglas de PR, tamaño de archivos,
  `Clock`, tests por ruta y comandos de verificación.

## Histórico (no describe el estado actual)

- `docs/archive/v2/`, `docs/archive/v3/`: fichas y borradores de fases anteriores.
- `docs/archive/v4/`: informes de la Fase 12 (`FASE_0_REPORT.md` … `FASE_7_REPORT.md`),
  que documentan el trabajo posterior a la fase 11 (búsqueda `unaccent`, room rack v2,
  lease, catálogo de consumos y partes 1–4 de i18n).
- `docs/archive/PHASE_*_REPORT.md`, `docs/archive/DATE_TIMEZONE_HARDENING_REPORT.md`:
  informes de fase ya implementados.
- `docs/audit/AUDIT_2026-11-15.md`: auditoría previa, superada por
  `AUDIT_2026-11-17.md` donde haya conflicto.
- `docs/prompts/`: prompts históricos usados para arrancar el proyecto.
- `docs/prototypes/`: prototipos visuales sin valor contractual.

## Recursos

- `docs/assets/`: backlog original (`.xlsx`/`.docx`) y capturas sueltas.
- `docs/img/`: material visual del design system.
