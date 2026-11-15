# FNRH Digital — Revisión de producto y legal del modelo de huéspedes

- Estado: **paquete de revisión; sin aprobaciones registradas**.
- Decisiones de producto: **cerradas para planificación (P-01 a P-06)**; ratificación del product owner pendiente.
- Fecha: 2026-11-13.
- Alcance: revisar `FNRH_GUEST_MODEL.md` antes de implementar la migración o el adapter.
- Este documento no sustituye la aprobación de producto, operaciones, DPO/legal ni seguridad. Las filas de firma están deliberadamente vacías.
- Flujo de UI propuesto: `FNRH_GUEST_UI_FLOW.md`; no implementado.
- Evidencia oficial consultada: Portaria MTur 41/2025, FAQ oficial, Módulo Hóspede y manual API 2.4.2.

## 1. Resultado de la revisión

La documentación oficial cierra la mayor parte de las dudas del modelo, pero **no** autoriza por sí sola el tratamiento de datos de menores ni el uso del CPF del operador. El diseño queda técnicamente más preciso y legalmente condicionado.

Decisiones que cambian respecto del primer borrador:

1. **Los menores no tienen una FNRH independiente.** Se vinculan a la FNRH del responsável legal (Portaria, art. 29, parágrafo único; art. 37, § 1º; FAQ 2.2). El modelo puede guardar su identidad y vínculo, pero no debe crear una ficha FNRH separada para ellos.
2. **El huésped principal debe ser mayor de edad.** La FAQ exige un responsável maior de idade; la API usa `responsavel_id` para persona menor de 18 años. Un menor no puede ser `PRIMARY`.
3. **FNRH sólo acepta CPF o PASSPORT como documento de persona.** El dominio oficial devuelve `CPF` y `PASSPORTE`; RG, `NATIONAL_ID`, licencia y `OTHER` quedan como documentos internos y no se envían como documento FNRH.
4. **Personas legalmente incapaces también se vinculan al responsable**, no sólo los menores. El modelo necesita un flag explícito y un responsable.
5. **`cpf_solicitante` es el CPF del usuario que realiza el registro**, no el del huésped. Es un dato del operador y requiere decisión legal/operativa sobre su origen y minimización.
6. **La corrección de datos ocurre antes de confirmar el check-in** (art. 33). Después del check-in no se debe prometer corrección libre mediante `PUT` de reserva.
7. **El check-in en lote incluye a todos los huéspedes registrados**; la API también permite check-in individual. La primera versión puede usar lote, pero debe registrar a todos los adultos y dependientes antes.

## 2. Decisiones cerradas por documentación oficial

| ID   | Decisión                                                                                     | Evidencia                                                            | Consecuencia en el modelo                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Una FNRH por hóspede; menores e incapaces se vinculan a la FNRH del responsable              | Portaria art. 29, parágrafo único; art. 37, § 1º; FAQ 2.2            | `ReservationGuest` para menores, sin ficha FNRH independiente                                                              |
| D-02 | El principal/responsable debe ser mayor de edad                                              | FAQ 2.2; manual API (`responsavel_id` para menor de 18)              | `PRIMARY` exige `ageGroup=ADULT` y `legalIncapacity=false`; el `UNKNOWN` legacy se bloquea en readiness hasta clasificarlo |
| D-03 | FNRH usa CPF o pasaporte; extranjero puede usar pasaporte sin CPF/gov.br                     | Manual API, dominio de tipos de documento; Portaria art. 34; FAQ 2.4 | `GuestDocumentType` con `CPF`/`PASSPORT`; legacy no se envía                                                               |
| D-04 | La FNRH del responsable informa cantidad de menores/incapaces, acompañamiento y autorización | Portaria art. 37, § 1º; Anexo I, bloque 6                            | Agregar `legalIncapacity`, `minorSupervision` y referencia de autorización                                                 |
| D-05 | `cpf_solicitante` es el CPF de quien realiza el registro                                     | Manual API, `POST /pessoas` y `GET /pessoas/documento`               | No es un campo del huésped; se trata en configuración/operación                                                            |
| D-06 | Las correcciones se hacen antes de confirmar el check-in                                     | Portaria art. 33                                                     | El flujo FNRH no debe prometer edición posterior irrestricta                                                               |
| D-07 | No-show no produce efectos de estada                                                         | Portaria art. 32, parágrafo único                                    | No crear ficha/estada FNRH para no-show                                                                                    |
| D-08 | Datos de menores requieren acceso restringido y controles adicionales                        | Portaria art. 17; LGPD art. 14                                       | Permiso/acceso restringido y auditoría específica                                                                          |

## 3. Decisiones de producto

Estas decisiones quedan **cerradas para planificación**. La ratificación del product owner sigue siendo necesaria para autorizar implementación; no se registra como aprobada en la matriz de firmas.

| ID   | Decisión de planificación                                                                                                         | Motivo                                                                                                 | Estado                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| P-01 | Calcular la edad a la fecha de check-in usando `birthDate`; si falta, bloquear sólo el envío FNRH, no el check-in hotelero        | La FNRH se confirma en la llegada y la edad puede cambiar entre reserva y check-in                     | **Decidida para planificación**         |
| P-02 | Exigir que todos los adultos y dependientes estén registrados antes del check-in en lote; si falta alguno, no enviar el lote FNRH | El lote incluye a todos los huéspedes registrados; agregar después requiere flujo individual           | **Decidida para planificación**         |
| P-03 | No crear una FNRH independiente para menores; la UI los captura como dependientes del responsable                                 | Evita fichas duplicadas y refleja la Portaria                                                          | **Decidida para planificación**         |
| P-04 | Diferir `StayGuest` y usar check-in/check-out por reserva en la primera versión                                                   | Reduce alcance; la API soporta lote, aunque también check-in individual                                | **Decidida para planificación**         |
| P-05 | Resolver el CPF del operador en la configuración de integración (`requesterCpfRef`), no en el perfil público del usuario          | Minimiza PII y evita exponer CPF en la UI; debe confirmarse si Serpro acepta un usuario de integración | **Decidida para planificación; Serpro** |
| P-06 | No sincronizar retroactivamente reservas históricas; activar FNRH sólo para reservas con check-in desde el cutover                | Evita asumir edad/documentos de datos legacy y reduce el backfill de PII                               | **Decidida para planificación**         |

### Criterios de aceptación de las decisiones P

- **P-01:** en el check-in, la edad se deriva de `birthDate` y de la fecha local de check-in; los límites 17/18 se prueban. Sin `birthDate`, la reserva puede hacer check-in hotelero pero queda `PROFILE_INCOMPLETE` y no se envía a FNRH.
- **P-02:** el check-in en lote de FNRH falla completo si falta un adulto o dependiente registrado; no hay envío parcial silencioso. El check-in hotelero sigue disponible con advertencia.
- **P-03:** un menor aparece sólo como dependiente del responsable; no tiene QR, ficha ni acción de check-in FNRH independiente.
- **P-04:** `Stay` sigue siendo único por reserva; no se agregan timestamps de estada por huésped ni una tabla `StayGuest` en v1.
- **P-05:** `requesterCpfRef` es una referencia a secreto; no se devuelve en APIs, no se muestra en UI y no se registra en logs. Serpro debe confirmar que el usuario de integración es aceptable.
- **P-06:** el flag FNRH sólo considera reservas con `checkInDate >= cutoverDate`; las históricas no se envían automáticamente y muestran una advertencia si se intenta forzar.

## 4. Decisiones que requieren legal/DPO

| ID   | Decisión                                                                                                                 | Riesgo si no se cierra                               | Estado         |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------- |
| L-01 | Base legal y aviso de tratamiento para FNRH; confirmar obligación legal y finalidad                                      | No se puede justificar la captura de datos sensibles | **Bloqueante** |
| L-02 | Tratamiento de datos de menores e incapaces conforme LGPD art. 14 y Portaria art. 17; mejor interés y acceso restringido | Exposición de menores y sanciones                    | **Bloqueante** |
| L-03 | Retención local del perfil FNRH y de la copia de datos en NOVA; plazo, anonimización y borrado                           | Retención indefinida o incompatible                  | **Bloqueante** |
| L-04 | Política para autorizaciones de menores: guardar sólo referencia/estado, no scans, salvo aprobación expresa              | Almacenamiento excesivo de documentos sensibles      | **Bloqueante** |
| L-05 | Origen, almacenamiento y enmascaramiento de `cpf_solicitante`; quién puede verlo                                         | PII de empleados en logs/DB                          | **Bloqueante** |
| L-06 | Controles de acceso y auditoría para el perfil FNRH y datos de menores                                                   | Acceso interno indebido                              | **Bloqueante** |

## 5. Decisiones de ingeniería/seguridad

| ID   | Decisión                                                                                                 | Estado    |
| ---- | -------------------------------------------------------------------------------------------------------- | --------- |
| E-01 | `ReservationGuest` con `PRIMARY` adulto y `COMPANION`; menores/incapaces con responsable                 | Propuesto |
| E-02 | `GuestFnrhProfile` 1:1 opcional, con acceso restringido y sin exponerlo en `GET /guests`                 | Propuesto |
| E-03 | Backfill sólo del principal, `ageGroup=UNKNOWN`, sin placeholders                                        | Propuesto |
| E-04 | Trigger diferido para principal, responsable y misma reserva                                             | Propuesto |
| E-05 | `CPF`/`PASSPORT` como únicos documentos enviables a FNRH; legacy queda bloqueado con código de readiness | Propuesto |
| E-06 | No agregar `StayGuest` en esta fase                                                                      | Propuesto |

## 6. Matriz de firma

Completar sólo después de la revisión. Una celda vacía significa “no aprobado”, no “sin objeción”.

| Rol                        | Nombre | Decisión | Fecha | Estado    |
| -------------------------- | ------ | -------- | ----- | --------- |
| Product owner              |        |          |       | Pendiente |
| Operaciones / Front Office |        |          |       | Pendiente |
| DPO / Legal                |        |          |       | Pendiente |
| Seguridad / Ingeniería     |        |          |       | Pendiente |

## 7. Agenda mínima de revisión

1. Ratificar que menores no tendrán ficha FNRH independiente y revisar el flujo de dependientes.
2. Ratificar edad a check-in y tratamiento de `birthDate` faltante.
3. Ratificar la exigencia de registrar acompañantes antes del check-in.
4. Revisar base legal, retención, acceso y autorizaciones de menores/incapaces.
5. Definir origen y visibilidad de `cpf_solicitante`.
6. Ratificar el diferimiento de `StayGuest` para la primera versión.

## 8. Resolución de las open questions del modelo

| Pregunta                                | Resolución                                                                                                                                   | Estado                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ¿Menores tienen documento/ficha propia? | No tienen FNRH propia; se vinculan al responsable. Pueden requerir identificación para verificar edad/vínculo; no crear ficha independiente. | **Cerrada por Portaria/FAQ**; revisar si el API exige documento propio en homologación |
| ¿Edad a check-in o reserva?             | Check-in. La FNRH se confirma en la llegada y la edad puede cambiar.                                                                         | **Decidida para planificación**; confirmar con Serpro                                  |
| ¿Principal menor?                       | No. El principal debe ser adulto y capaz.                                                                                                    | **Cerrada por FAQ/API**                                                                |
| ¿Acompañantes antes del check-in?       | Sí para check-in en lote; si falta alguno, no se envía el lote FNRH. El flujo individual queda para una fase posterior.                      | **Decidida para planificación**                                                        |
| ¿`StayGuest`?                           | Diferido; primera versión usa `Stay` por reserva.                                                                                            | **Decidida: diferida**                                                                 |
| ¿Extranjeros?                           | Pasaporte, sin CPF/gov.br; documento internacional según manual.                                                                             | **Cerrada por Portaria/FAQ/manual**                                                    |
| ¿`cpf_solicitante`?                     | Es el CPF del operador que registra, no del huésped; se referencia desde la configuración de integración.                                    | **Decidida**; Serpro y legal/DPO pendientes                                            |

## 9. Puerta para implementar

No iniciar migración ni adapter hasta que:

- [ ] Producto ratifica P-01 a P-06 (decisiones de planificación ya registradas).
- [ ] DPO/legal aprueba L-01 a L-06.
- [ ] Seguridad aprueba acceso, enmascaramiento, auditoría y retención.
- [ ] Se confirma con Serpro si el check-in en lote acepta menores vinculados y qué documento exige.
- [ ] Se documenta la versión exacta del manual y el changelog usados.
- [ ] Se revisa el preflight con datos agregados de una copia segura.

## 10. Evidencia

- [Portaria MTur 41/2025](https://www.in.gov.br/web/dou/-/portaria-mtur-n-41-de-14-de-novembro-de-2025-670238654): arts. 17, 29, 31, 32, 33, 34, 37 y Anexo I.
- [FAQ oficial](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/faq): preguntas 2.2, 2.3 y 2.4.
- [Módulo Hóspede](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/gestao-do-hospede-1/gestao-do-hospede): cada maior de 18 completa su ficha; menores como dependientes.
- [Manual API 2.4.2](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/ficha-nacional-de-registro-de-hospedes/modulo-meio-de-hospedagem/meios-de-hospedagem-com-pms/documentacao-api-v2-4-2.pdf/@@display-file/file): dominios de documento, `responsavel_id`, check-in em lote, `cpf_solicitante`.

## 11. Limitaciones de esta revisión

- No hubo una reunión real con producto, operaciones ni legal; las firmas siguen pendientes.
- No se validó el flujo con una cuenta de homologación ni con datos reales.
- La interpretación de edad a check-in es una recomendación, no una cita literal del manual.
- La base legal concreta y la retención deben ser confirmadas por el DPO; este documento no las decide.
