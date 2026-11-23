'use client';

/**
 * Shared UI primitives. The pieces live in focused modules so each file stays
 * readable; this barrel keeps the existing `@/components/ui` import surface.
 */
export { EmptyState, ErrorAlert, QueryFeedback } from './ui-feedback';
export { AlertItem, MetricCard, StatusBadge } from './ui-metrics';
export { Field, RowActionButton, RowActionLink } from './ui-controls';
export { KeyValue, PageHeader, SectionCard } from './ui-layout';
