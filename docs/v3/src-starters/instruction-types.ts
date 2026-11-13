export type InstructionCategory = "PAYMENT"|"MEAL"|"BILLING"|"ROOM"|"ARRIVAL"|"IMPORTANT"|"EXTRA"|"CONFIDENTIAL"|"GENERAL";
export type Priority = "LOW"|"NORMAL"|"HIGH"|"CRITICAL";
export type Status = "NEW"|"ACKNOWLEDGED"|"IN_PROGRESS"|"COMPLETED"|"DISMISSED"|"NEEDS_CLARIFICATION";
export type ExecutionMoment = "PRE_ARRIVAL"|"CHECK_IN"|"DURING_STAY"|"CHECK_OUT";
export interface ParsedInstructionSuggestion {
  category: InstructionCategory; title: string; body: string; priority: Priority;
  status: "NEW"|"NEEDS_CLARIFICATION"; sourcePhrase: string; confidence: number;
  requiresHumanConfirmation: true;
  actionType?: "PAYMENT_PREAUTHORIZATION"|"VERIFY_PAYMENT"|"BILLING_TASK"|"ARRIVAL_REMINDER";
  executionMoment?: ExecutionMoment;
  paymentMethod?: "CREDIT_CARD"|"PIX"|"CASH"|"BANK_TRANSFER"|"UNKNOWN";
}
export interface ParsedSourceNote { originalText: string; parserVersion: string; suggestions: ParsedInstructionSuggestion[]; warnings: string[]; }
