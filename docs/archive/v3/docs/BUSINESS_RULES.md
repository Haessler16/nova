# Diccionario inicial de negocio

| Frase | Interpretación | Acción automática |
|---|---|---|
| RSV COM CAFE/CAFÉ | Desayuno incluido | Solo sugerir atributo; reconciliar RatePlan |
| PGTO DIRETO NO HOTEL | Pago a cargo del hotel en check-in mediante preautorización con tarjeta | Crear instrucción pendiente; jamás iniciar preautorización |
| PGTO DAS DIARIAS OK LANÇADO NO CAIXA | Texto afirma pago registrado | Solicitar verificación contra ledger |
| EXTRAS DIRETO | Extras cobrados directamente al huésped | Nota/instrucción; no crear cargo |
| DEBITAR DIARIAS E EXTRAS | Routing de cargos | Requiere reglas de folio; no modificar automáticamente |
| FATURAR DIARIAS | Solicitud de facturación | Tarea; no emitir NF automáticamente |
| EMITIR NF NO CNPJ | Datos de facturación | Extraer propuesta y validar; guardar en entidad adecuada |
| NÃO CANCELAR RSV | No cancelar sin autorización | Alerta; respetar flujo excepcional autorizado |
| PAX CHEGARÁ ÀS 7H | Hora prevista de llegada | Recordatorio de llegada anticipada |
| AVISAR NO CHECK IN | Recordatorio en check-in | Tarea CHECK_IN |
| UP POR DISPO | Upgrade sujeto a disponibilidad | No prometer ni asignar upgrade |
| APTO LUXO CASAL | Categoría/tipo de habitación | Reconciliar RoomType |
| TRF DBL R$ 606 + 15% | Texto de tarifa | No modificar precio oficial |

Fechas sin año deben resolverse usando contexto de reserva con regla explícita; si hay ambigüedad, pedir revisión. Frases financieras requieren revisión humana. Preservar texto original exacto.
