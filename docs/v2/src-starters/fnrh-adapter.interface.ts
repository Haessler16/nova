/**
 * Design starter only — NOT an official FNRH API contract and not compiled
 * as part of the application. See `docs/v2/docs/FNRH_INTEGRATION_PLAN.md`.
 *
 * The HTTP provider is the only place allowed to know official paths, headers
 * and payload names. These internal operations describe NOVA use cases.
 */
export type FnrhEnvironment = 'HOMOLOGATION' | 'PRODUCTION';

export interface FnrhConnectionConfig {
  propertyId: string;
  environment: FnrhEnvironment;
  baseUrl: string;
  credentialRef: string; // secret manager/KMS reference; never the raw credential
  timeoutMs: number;
}

export interface FnrhOperationMeta {
  operationId: string;
  localKey: string;
  correlationId: string;
  actorUserId: string;
}

export interface FnrhReservationInput {
  numeroReserva: string;
  numeroReservaOta?: string;
  dataEntrada: string; // YYYY-MM-DD
  dataSaida: string; // YYYY-MM-DD
  quantidadeHospedeAdulto: number;
  quantidadeHospedeMenor: number;
  origemReservaId: string; // confirmed values include MEIOHOSPEDAGEM / OTA; exact spelling to verify
}

export interface FnrhDocumentInput {
  tipo: string; // use GET /dominios/pessoas/tipos_documento
  numero: string;
}

export interface FnrhAddressInput {
  paisResidenciaId?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidadeIbge?: string;
}

export interface FnrhPersonInput {
  nome: string;
  nomeSocial?: string;
  paisNacionalidadeId?: string;
  generoId?: string;
  dataNascimento?: string; // YYYY-MM-DD
  racaId?: string;
  deficienciaId?: string;
  tipoDeficienciaId?: string;
  documento: FnrhDocumentInput;
  email?: string;
  telefone?: string;
  endereco?: FnrhAddressInput;
}

export interface FnrhGuestLinkInput {
  pessoaId: string;
  isPrincipal: boolean;
  situacaoHospedeId?: string;
  checkinEm?: string; // ISO 8601 UTC
  checkoutEm?: string; // ISO 8601 UTC
  responsavelId?: string;
}

export interface FnrhReservation {
  id: string;
  numeroReserva: string;
  situacao?: string;
  linkPreCheckin?: string;
}

export interface FnrhPerson {
  id: string;
}

export interface FnrhGuest {
  id: string;
  situacao?: string;
}

export interface FnrhError {
  code: string;
  httpStatus?: number;
  message: string; // safe message only; no PII or credential
}

export type FnrhResult<T> =
  | { ok: true; data: T; externalReference?: string }
  | {
      ok: false;
      error: FnrhError;
      retryable: boolean;
      /** True when a POST may have reached FNRH; reconcile before retrying. */
      ambiguous?: boolean;
    };

export interface FnrhProvider {
  healthCheck(
    config: FnrhConnectionConfig,
  ): Promise<FnrhResult<{ reachable: boolean; apiVersion?: string }>>;
  createReservation(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    input: FnrhReservationInput,
  ): Promise<FnrhResult<FnrhReservation>>;
  updateReservation(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    externalReservationId: string,
    input: FnrhReservationInput,
  ): Promise<FnrhResult<void>>;
  cancelReservation(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    externalReservationId: string,
  ): Promise<FnrhResult<void>>;
  findReservationByCode(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    numeroReserva: string,
  ): Promise<FnrhResult<FnrhReservation | null>>;
  getReservation(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    externalReservationId: string,
  ): Promise<FnrhResult<FnrhReservation>>;
  createPerson(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    input: FnrhPersonInput,
  ): Promise<FnrhResult<FnrhPerson>>;
  findPersonByDocument(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    document: FnrhDocumentInput,
  ): Promise<FnrhResult<FnrhPerson | null>>;
  linkGuest(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    externalReservationId: string,
    input: FnrhGuestLinkInput,
  ): Promise<FnrhResult<FnrhGuest>>;
  checkInReservation(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    externalReservationId: string,
    dataHora: string,
  ): Promise<FnrhResult<FnrhGuest[]>>;
  checkOutReservation(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    externalReservationId: string,
    dataHora: string,
  ): Promise<FnrhResult<FnrhGuest[]>>;
  noShowReservation(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    externalReservationId: string,
  ): Promise<FnrhResult<FnrhGuest[]>>;
  listFichas(
    config: FnrhConnectionConfig,
    meta: FnrhOperationMeta,
    pageNumber: number,
  ): Promise<FnrhResult<{ items: unknown[]; totalPages?: number }>>;
}
