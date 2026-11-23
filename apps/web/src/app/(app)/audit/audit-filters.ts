export interface AuditFilters {
  action: string;
  entityType: string;
  actorUserId: string;
  fromDate: string;
  toDate: string;
}

export const EMPTY_FILTERS: AuditFilters = {
  action: '',
  entityType: '',
  actorUserId: '',
  fromDate: '',
  toDate: '',
};
