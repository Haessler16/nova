# API Contracts — Draft

Paths propostos; adaptar ao padrão existente. Não duplicar rotas atuais.

> **Status de implementação (2026-11-13).** Os contratos executáveis usam os headers de tenant `X-Organization-Id` e `X-Property-Id`, não `propertyId` na rota. Documents está implementado em `/api/v1/documents`; Reports em `/api/v1/reports`. As rotas abaixo de `properties/:propertyId/...`, `GET /reports/exports/:exportId` e `downloadUrl` assinada são propostas do draft que **não** foram implementadas: o download de documento é autenticado por request e os relatórios são transmitidos na própria resposta de exportação. Não há endpoints de escrita de template na v1.

## Rotas implementadas

| Método | Rota                                                              | Permissão                                        |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------ |
| GET    | `/api/v1/documents/templates?type=GUEST_REGISTRATION`             | `documents.read`                                 |
| POST   | `/api/v1/documents/preview`                                       | `documents.generate`                             |
| POST   | `/api/v1/documents`                                               | `documents.generate`                             |
| GET    | `/api/v1/documents?reservationId=&guestId=&stayId=&documentType=` | `documents.read`                                 |
| GET    | `/api/v1/documents/:id`                                           | `documents.read`                                 |
| GET    | `/api/v1/documents/:id/download`                                  | `documents.read`                                 |
| POST   | `/api/v1/documents/:id/print-events`                              | `documents.manage`                               |
| POST   | `/api/v1/documents/:id/physical-signature-received`               | `documents.manage`                               |
| GET    | `/api/v1/reports`                                                 | `reports.read`                                   |
| GET    | `/api/v1/reports/executions`                                      | `reports.read`                                   |
| POST   | `/api/v1/reports/:reportKey/run`                                  | `reports.read`                                   |
| POST   | `/api/v1/reports/:reportKey/exports`                              | `reports.read` (+ `reports.financial` para caja) |

Los payloads implementados mantienen `filters`, `type`, `reservationId`, `templateId`, `locale`, `format` y `page`/`pageSize`; `source` anidado no se implementó. La respuesta de generación incluye `id`, `number`, `status`, `mimeType`, `pageCount`, `sha256` y metadatos, pero no `downloadUrl`.

## Documents

`GET /api/v1/properties/:propertyId/document-templates?type=GUEST_REGISTRATION`

`POST /api/v1/properties/:propertyId/documents/preview`

```json
{
  "type": "GUEST_REGISTRATION",
  "source": { "reservationId": "res_123", "guestId": "guest_456" },
  "locale": "pt-BR"
}
```

`POST /api/v1/properties/:propertyId/documents`

```json
{
  "type": "GUEST_REGISTRATION",
  "source": { "reservationId": "res_123", "guestId": "guest_456" },
  "locale": "pt-BR",
  "templateId": "tpl_guest_registration_v1"
}
```

Response: `{ "id":"doc_123", "status":"GENERATED", "mimeType":"application/pdf", "pageCount":1, "sha256":"server-hash", "downloadUrl":"short-lived-url" }`

`GET /api/v1/properties/:propertyId/documents?reservationId=res_123`

`POST /api/v1/properties/:propertyId/documents/:documentId/physical-signature-received`

```json
{ "receivedAt": "2026-11-10T21:05:00-03:00", "notes": "Documento assinado recebido." }
```

Server defines receivedBy from auth, never trust client user ID.

`POST /api/v1/properties/:propertyId/documents/:documentId/print-events`

```json
{ "event": "PRINT_DIALOG_OPENED", "reason": "Via entregue ao hóspede" }
```

Do not claim physical print completed from browser dialog.

## Reports

`GET /api/v1/properties/:propertyId/reports`

`POST /api/v1/properties/:propertyId/reports/:reportKey/run`

```json
{
  "filters": { "from": "2026-11-01", "to": "2026-11-10", "status": ["CONFIRMED", "CHECKED_IN"] },
  "page": 1,
  "pageSize": 50
}
```

Response should include executionId, reportKey, generatedAt, timezone, filters, summary, rows, pagination.

`POST /api/v1/properties/:propertyId/reports/:reportKey/exports`

```json
{ "format": "PDF", "filters": { "from": "2026-11-01", "to": "2026-11-10" } }
```

`GET /api/v1/properties/:propertyId/reports/exports/:exportId`

## Contracts

- Auth required; property scope and RBAC enforced server-side.
- User/tenant IDs derived from auth, not body.
- Validate payloads with existing validation library.
- No permanent public storage URLs or raw storage keys.
- Limit range, page size and export size.
- Idempotency key for generation/retry where needed.
- Use existing NOVA error response shape; possible codes: DOCUMENT_TEMPLATE_NOT_FOUND, DOCUMENT_SOURCE_NOT_FOUND, DOCUMENT_GENERATION_FAILED, DOCUMENT_ACCESS_DENIED, REPORT_FILTER_INVALID, REPORT_EXECUTION_LIMIT_EXCEEDED, REPORT_EXPORT_FAILED, PROPERTY_SCOPE_MISMATCH.
