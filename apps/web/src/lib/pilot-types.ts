export type PilotFeedbackCategory = 'BUG' | 'UX' | 'QUESTION' | 'OTHER';
export type PilotFeedbackStatus = 'OPEN' | 'REVIEWED' | 'ARCHIVED';

export interface PilotFeedback {
  id: string;
  category: PilotFeedbackCategory;
  message: string;
  rating: number | null;
  context: Record<string, unknown> | null;
  status: PilotFeedbackStatus;
  userId: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
