'use client';

import { Button, HStack, Input, Text } from '@chakra-ui/react';
import { DateField } from '@/components/date-field';
import type { FormEvent } from 'react';
import type { AuditFilters } from '../audit-filters';

export function AuditFilterBar({
  inputs,
  total,
  onChange,
  onSubmit,
  onReset,
}: {
  inputs: AuditFilters;
  total: number;
  onChange: (filters: AuditFilters) => void;
  onSubmit: (event: FormEvent) => void;
  onReset: () => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <HStack wrap="wrap" spacing={2} mb={4} align="flex-end">
        <Input
          size="sm"
          width="230px"
          placeholder="Acción, ej. reservation.created"
          aria-label="Filtrar por acción"
          value={inputs.action}
          onChange={(event) => onChange({ ...inputs, action: event.target.value })}
        />
        <Input
          size="sm"
          width="190px"
          placeholder="Entidad, ej. Reservation"
          aria-label="Filtrar por tipo de entidad"
          value={inputs.entityType}
          onChange={(event) => onChange({ ...inputs, entityType: event.target.value })}
        />
        <Input
          size="sm"
          width="250px"
          placeholder="Actor (UUID)"
          aria-label="Filtrar por actor"
          value={inputs.actorUserId}
          onChange={(event) => onChange({ ...inputs, actorUserId: event.target.value })}
        />
        <HStack spacing={1}>
          <Text fontSize="xs" color="textSecondary">
            Desde
          </Text>
          <DateField
            size="sm"
            width="150px"
            value={inputs.fromDate}
            placeholder="dd/mm/aaaa"
            ariaLabel="Fecha desde"
            isClearable
            onChange={(fromDate) =>
              onChange({
                ...inputs,
                fromDate,
                ...(inputs.toDate !== '' && inputs.toDate <= fromDate ? { toDate: '' } : {}),
              })
            }
          />
          <Text fontSize="xs" color="textSecondary">
            Hasta
          </Text>
          <DateField
            size="sm"
            width="150px"
            value={inputs.toDate}
            {...(inputs.fromDate !== '' ? { min: inputs.fromDate } : {})}
            placeholder="dd/mm/aaaa"
            ariaLabel="Fecha hasta"
            isClearable
            onChange={(toDate) => onChange({ ...inputs, toDate })}
          />
        </HStack>
        <Button size="sm" type="submit" variant="outline">
          Filtrar
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          Limpiar
        </Button>
        <Text fontSize="xs" color="textSecondary" ml="auto">
          {total} eventos
        </Text>
      </HStack>
    </form>
  );
}
