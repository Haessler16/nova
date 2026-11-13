/**
 * Internal port only — NOT an official FNRH API contract.
 * Map operations only after reading the current official API manual/changelog.
 */
export type FnrhEnvironment = "HOMOLOGATION" | "PRODUCTION";

export interface FnrhConnectionConfig {
  propertyId: string;
  environment: FnrhEnvironment;
  credentialRef: string; // encrypted secret reference; never raw token
}

export interface FnrhOperationResult<T> {
  success: boolean;
  externalReference?: string;
  status?: string;
  data?: T;
  errorCode?: string;
  retryable?: boolean;
  correlationId?: string;
}

export interface FnrhProvider {
  healthCheck(config: FnrhConnectionConfig): Promise<{
    reachable: boolean;
    apiVersion?: string;
    checkedAt: string;
  }>;
  // Optional methods below are domain intentions, not verified official endpoint names.
  synchronizeReservation?(config: FnrhConnectionConfig, input: unknown): Promise<FnrhOperationResult<unknown>>;
  synchronizeGuest?(config: FnrhConnectionConfig, input: unknown): Promise<FnrhOperationResult<unknown>>;
  submitPreCheckIn?(config: FnrhConnectionConfig, input: unknown): Promise<FnrhOperationResult<unknown>>;
  confirmCheckIn?(config: FnrhConnectionConfig, input: unknown): Promise<FnrhOperationResult<unknown>>;
  confirmCheckout?(config: FnrhConnectionConfig, input: unknown): Promise<FnrhOperationResult<unknown>>;
  getRecordStatus?(config: FnrhConnectionConfig, reference: string): Promise<FnrhOperationResult<unknown>>;
}
