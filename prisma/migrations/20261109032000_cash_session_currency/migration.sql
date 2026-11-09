-- Cash sessions keep their own currency so cash movements and expected amounts
-- always share one explicit currency even if the property setting changes later.
ALTER TABLE "CashSession" ADD COLUMN "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'BRL';

ALTER TABLE "CashSession"
    ADD CONSTRAINT "CashSession_currency_code_check"
    CHECK ("currencyCode" ~ '^[A-Z]{3}$');
