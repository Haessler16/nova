# Prototipo — Fiesta de la reserva

Prototipo navegable y aislado para validar con recepción el flujo de acompañantes, menores y check-in descrito en `docs/v2/docs/FNRH_GUEST_UI_FLOW.md`.

## Abrir

Abrí `prototypes/fnrh-party/index.html` directamente en un navegador. Es un archivo autocontenido: no necesita servidor, build, backend, base de datos ni credenciales.

## Qué probar

1. Agregar un adulto desde “+ Agregar adulto”.
2. Agregar un menor y elegir “Sin autorización registrada”; el check-in debe bloquearse.
3. Editar el menor a “Autorizado a viajar sin acompañante” y completar la referencia; el bloqueo debe desaparecer.
4. Revisar el check-in con FNRH incompleta: el check-in hotelero debe permitirse y la FNRH debe quedar pendiente.
5. Confirmar el check-in y verificar que la FNRH no se marque como enviada.
6. Probar los escenarios rápidos “Fiesta completa y FNRH lista” y “Menor sin autorización”.

## Límites

- Todos los nombres, documentos y fechas son sintéticos.
- El estado vive sólo en memoria: recargar la página reinicia la demo.
- No valida identidad, documentos reales, autorizaciones legales, reglas de Serpro ni envío FNRH.
- No modifica Prisma, APIs ni pantallas de producción.
