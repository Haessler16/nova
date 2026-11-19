// Boundary only: parser must NEVER call this interface.
// Implement only through existing authenticated payment module/provider.
export interface PreauthorizationCommand {
  propertyId: string;
  reservationId: string;
  guestId: string;
  amountMinorUnits: number; // explicitly confirmed by operator/policy
  currency: 'BRL';
  providerPaymentMethodToken: string;
  idempotencyKey: string;
}
export interface PreauthorizationResult {
  providerReference: string;
  status: 'AUTHORIZED' | 'DECLINED' | 'PENDING' | 'ERROR';
  authorizedAmountMinorUnits?: number;
  expiresAt?: string;
}
