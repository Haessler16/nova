'use client';

import { Box, Checkbox, CheckboxGroup, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { permissionLabel } from '../_lib/admin';

export function RolePermissionPicker({
  groups,
  selected,
  onChange,
}: {
  groups: Array<[string, string[]]>;
  selected: string[];
  onChange: (permissions: string[]) => void;
}) {
  return (
    <CheckboxGroup
      value={selected}
      onChange={(values) => onChange(values.map((value) => String(value)))}
    >
      <Stack spacing={4}>
        {groups.map(([group, items]) => (
          <Box key={group}>
            <Text
              fontSize="xs"
              textTransform="uppercase"
              color="gray.500"
              fontWeight="semibold"
              mb={1}
            >
              {group}
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={1}>
              {items.map((permission) => (
                <Checkbox key={permission} value={permission} size="sm">
                  <Text fontSize="xs">{permissionLabel(permission)}</Text>
                </Checkbox>
              ))}
            </SimpleGrid>
          </Box>
        ))}
      </Stack>
    </CheckboxGroup>
  );
}
