// Suggested typed context. Adapt to real NOVA domain types; include only necessary PII.
export interface PropertyDocumentIdentity {
  name: string; addressLines: string[]; phone?: string; email?: string; logoUrl?: string;
}
export interface GuestDocumentIdentity {
  fullName: string; documentDisplay?: string; nationality?: string; phone?: string; email?: string;
}
export interface StayDocumentSummary {
  reservationCode: string; arrivalDate: string; departureDate: string;
  roomLabel?: string; adults: number; children: number;
}
export interface DocumentTemplateContext {
  document: { type: string; number: string; generatedAt: string; locale: "pt-BR" | "es-ES" | "en"; templateVersion: number };
  property: PropertyDocumentIdentity;
  guest: GuestDocumentIdentity;
  stay?: StayDocumentSummary;
  terms?: { title: string; version: string; body: string; acceptedAt?: string };
  signature: { required: boolean; guestLabel: string; representativeLabel?: string; dateLabel: string };
}
