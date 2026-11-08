'use client';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Code,
  Divider,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  TableContainer,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useMemo, useState, type FormEvent } from 'react';
import { Field, PageHeader, QueryFeedback, SectionCard, StatusBadge } from '@/components/ui';
import { useSession } from '@/context/session';
import { api, errorMessage } from '@/lib/api';
import {
  RECORD_STATUS_COLORS,
  RECORD_STATUS_LABELS,
  SEVERITY_COLORS,
  formatDateTime,
  formatJson,
} from '@/lib/format';
import type { Membership, Role, SecurityEvent, SessionSummary } from '@/lib/types';
import { useAsyncData } from '@/lib/use-async-data';

function permissionLabel(permission: string): string {
  return permission.split('.').join(' · ');
}

function AdminContent() {
  const { tenant, properties } = useSession();
  const toast = useToast();
  const adminTenant = useMemo(
    () => ({ organizationId: tenant.organizationId }),
    [tenant.organizationId],
  );

  const memberships = useAsyncData<{ items: Membership[] }>(
    () => api<{ items: Membership[] }>('/api/v1/admin/memberships', { tenant: adminTenant }),
    `admin:memberships:${tenant.organizationId}`,
  );
  const roles = useAsyncData<{ items: Role[] }>(
    () => api<{ items: Role[] }>('/api/v1/admin/roles', { tenant: adminTenant }),
    `admin:roles:${tenant.organizationId}:${memberships.data !== null}`,
  );
  const permissions = useAsyncData<{ items: string[] }>(
    () => api<{ items: string[] }>('/api/v1/admin/permissions', { tenant: adminTenant }),
    `admin:permissions:${tenant.organizationId}`,
  );

  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const securityEvents = useAsyncData<{ items: SecurityEvent[]; nextCursor: string | null }>(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (severityFilter !== '') params.set('severity', severityFilter);
    if (typeFilter.trim() !== '') params.set('type', typeFilter.trim());
    return api<{ items: SecurityEvent[]; nextCursor: string | null }>(
      `/api/v1/admin/security-events?${params.toString()}`,
      { tenant: adminTenant },
    );
  }, `admin:security:${tenant.organizationId}:${severityFilter}:${typeFilter}`);

  // Member create/edit
  const memberModal = useDisclosure();
  const [editingMember, setEditingMember] = useState<Membership | null>(null);
  const [memberForm, setMemberForm] = useState({
    email: '',
    name: '',
    roleId: '',
    status: 'ACTIVE',
  });
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Property assignment
  const propertyModal = useDisclosure();
  const [propertyMember, setPropertyMember] = useState<Membership | null>(null);
  const [propertyForm, setPropertyForm] = useState({ propertyId: '', roleId: '' });

  // Sessions
  const sessionsModal = useDisclosure();
  const [sessionMember, setSessionMember] = useState<Membership | null>(null);
  const memberSessions = useAsyncData<{ items: SessionSummary[] }>(
    () =>
      sessionMember === null
        ? Promise.resolve({ items: [] })
        : api<{ items: SessionSummary[] }>(
            `/api/v1/admin/memberships/${sessionMember.id}/sessions`,
            { tenant: adminTenant },
          ),
    `admin:sessions:${sessionMember?.id ?? 'none'}`,
  );

  // Roles
  const roleModal = useDisclosure();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({ key: '', name: '', permissions: [] as string[] });

  // Security metadata
  const eventModal = useDisclosure();
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const permission of permissions.data?.items ?? []) {
      const [head] = permission.split('.');
      const key = head ?? permission;
      groups.set(key, [...(groups.get(key) ?? []), permission]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions.data]);

  function openCreateMember(): void {
    setEditingMember(null);
    setInvitationToken(null);
    setMemberForm({
      email: '',
      name: '',
      roleId: roles.data?.items.find((role) => role.key === 'RECEPTION')?.id ?? '',
      status: 'ACTIVE',
    });
    memberModal.onOpen();
  }

  function openEditMember(member: Membership): void {
    setEditingMember(member);
    setInvitationToken(null);
    setMemberForm({
      email: member.user.email,
      name: member.user.name,
      roleId: member.roleId ?? '',
      status: member.status,
    });
    memberModal.onOpen();
  }

  async function saveMember(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingMember === null) {
        const result = await api<{
          membership: unknown;
          invitation?: { token?: string; expiresAt: string };
        }>('/api/v1/admin/memberships', {
          method: 'POST',
          tenant: adminTenant,
          body: {
            email: memberForm.email.trim(),
            ...(memberForm.name.trim() !== '' ? { name: memberForm.name.trim() } : {}),
            ...(memberForm.roleId !== '' ? { roleId: memberForm.roleId } : {}),
          },
        });
        setInvitationToken(result.invitation?.token ?? null);
        toast({ title: 'Membresía creada', status: 'success' });
        memberships.reload();
      } else {
        await api<unknown>(`/api/v1/admin/memberships/${editingMember.id}`, {
          method: 'PATCH',
          tenant: adminTenant,
          body: {
            status: memberForm.status as 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
            ...(memberForm.roleId !== '' ? { roleId: memberForm.roleId } : {}),
          },
        });
        toast({ title: 'Membresía actualizada', status: 'success' });
        memberModal.onClose();
        memberships.reload();
      }
    } catch (cause) {
      toast({
        title: 'No se pudo guardar',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  function openPropertyModal(member: Membership): void {
    setPropertyMember(member);
    setPropertyForm({ propertyId: '', roleId: '' });
    propertyModal.onOpen();
  }

  async function addPropertyAssignment(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (propertyMember === null) {
      return;
    }
    if (propertyForm.propertyId === '' || propertyForm.roleId === '') {
      toast({ title: 'Elegí propiedad y rol', status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api<unknown>(`/api/v1/admin/properties/${propertyForm.propertyId}/memberships`, {
        method: 'POST',
        tenant: adminTenant,
        body: { userId: propertyMember.userId, roleId: propertyForm.roleId },
      });
      toast({ title: 'Asignación creada', status: 'success' });
      propertyModal.onClose();
      memberships.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo asignar',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function revokeMemberSession(session: SessionSummary): Promise<void> {
    if (sessionMember === null) {
      return;
    }
    try {
      await api<void>(`/api/v1/admin/memberships/${sessionMember.id}/sessions/${session.id}`, {
        method: 'DELETE',
        tenant: adminTenant,
      });
      toast({ title: 'Sesión revocada', status: 'success' });
      memberSessions.reload();
    } catch (cause) {
      toast({ title: 'No se pudo revocar', description: errorMessage(cause), status: 'error' });
    }
  }

  function openCreateRole(): void {
    setEditingRole(null);
    setRoleForm({ key: '', name: '', permissions: [] });
    roleModal.onOpen();
  }

  function openEditRole(role: Role): void {
    setEditingRole(role);
    setRoleForm({ key: role.key, name: role.name, permissions: role.permissions });
    roleModal.onOpen();
  }

  async function saveRole(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingRole === null) {
        await api<Role>('/api/v1/admin/roles', {
          method: 'POST',
          tenant: adminTenant,
          body: {
            key: roleForm.key.trim(),
            name: roleForm.name.trim(),
            permissions: roleForm.permissions,
          },
        });
        toast({ title: 'Rol creado', status: 'success' });
      } else {
        await api<Role>(`/api/v1/admin/roles/${editingRole.id}`, {
          method: 'PATCH',
          tenant: adminTenant,
          body: { name: roleForm.name.trim(), permissions: roleForm.permissions },
        });
        toast({ title: 'Rol actualizado', status: 'success' });
      }
      roleModal.onClose();
      roles.reload();
    } catch (cause) {
      toast({
        title: 'No se pudo guardar el rol',
        description: errorMessage(cause),
        status: 'error',
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Administración"
        description="Membresías, roles y eventos de seguridad. Esta pantalla usa contexto de organización, sin propiedad seleccionada."
      />

      <Tabs colorScheme="purple" variant="enclosed">
        <TabList>
          <Tab>Miembros</Tab>
          <Tab>Roles</Tab>
          <Tab>Eventos de seguridad</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <SectionCard>
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="semibold">Membresías de la organización</Text>
                <HStack>
                  <Button size="sm" variant="ghost" onClick={memberships.reload}>
                    Actualizar
                  </Button>
                  <Button size="sm" colorScheme="purple" onClick={openCreateMember}>
                    Nuevo miembro
                  </Button>
                </HStack>
              </HStack>
              <QueryFeedback
                loading={memberships.loading}
                error={memberships.error}
                onRetry={memberships.reload}
                isEmpty={(memberships.data?.items.length ?? 0) === 0}
                emptyText="La organización no tiene membresías."
              >
                <TableContainer>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Usuario</Th>
                        <Th>Rol de organización</Th>
                        <Th>Propiedades</Th>
                        <Th>Estado</Th>
                        <Th>Alta</Th>
                        <Th />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {memberships.data?.items.map((member) => (
                        <Tr key={member.id}>
                          <Td>
                            <Text fontWeight="medium">{member.user.name}</Text>
                            <Text fontSize="xs" color="gray.500">
                              {member.user.email}
                            </Text>
                          </Td>
                          <Td>{member.role?.name ?? 'Sin rol'}</Td>
                          <Td>
                            <HStack spacing={1} wrap="wrap">
                              {member.propertyMemberships.length === 0 && (
                                <Text fontSize="xs" color="gray.500">
                                  Sin asignaciones
                                </Text>
                              )}
                              {member.propertyMemberships.map((assignment) => (
                                <Badge key={assignment.id} colorScheme="gray" textTransform="none">
                                  {assignment.property.code} · {assignment.role.name}
                                </Badge>
                              ))}
                            </HStack>
                          </Td>
                          <Td>
                            <StatusBadge
                              color={RECORD_STATUS_COLORS[member.status] ?? 'gray'}
                              label={RECORD_STATUS_LABELS[member.status] ?? member.status}
                            />
                          </Td>
                          <Td>
                            <Text fontSize="xs" color="gray.500">
                              {formatDateTime(member.createdAt)}
                            </Text>
                          </Td>
                          <Td>
                            <HStack spacing={1} justify="flex-end">
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => openEditMember(member)}
                              >
                                Editar
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => void openPropertyModal(member)}
                              >
                                Propiedades
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                  setSessionMember(member);
                                  sessionsModal.onOpen();
                                }}
                              >
                                Sesiones
                              </Button>
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </QueryFeedback>
            </SectionCard>
          </TabPanel>

          <TabPanel px={0}>
            <SectionCard>
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="semibold">Roles de organización</Text>
                <Button size="sm" colorScheme="purple" onClick={openCreateRole}>
                  Nuevo rol
                </Button>
              </HStack>
              <QueryFeedback
                loading={roles.loading}
                error={roles.error}
                onRetry={roles.reload}
                isEmpty={(roles.data?.items.length ?? 0) === 0}
                emptyText="No hay roles."
              >
                <TableContainer>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Rol</Th>
                        <Th>Key</Th>
                        <Th isNumeric>Permisos</Th>
                        <Th isNumeric>Miembros</Th>
                        <Th>Tipo</Th>
                        <Th />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {roles.data?.items.map((role) => (
                        <Tr key={role.id}>
                          <Td fontWeight="medium">{role.name}</Td>
                          <Td>
                            <Code fontSize="xs">{role.key}</Code>
                          </Td>
                          <Td isNumeric>{role.permissions.length}</Td>
                          <Td isNumeric>{role.membershipCount}</Td>
                          <Td>
                            <Badge
                              colorScheme={role.system ? 'purple' : 'gray'}
                              textTransform="none"
                            >
                              {role.system ? 'Sistema' : 'Personalizado'}
                            </Badge>
                          </Td>
                          <Td>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => openEditRole(role)}
                              isDisabled={role.system}
                              title={
                                role.system ? 'Los roles de sistema son inmutables' : undefined
                              }
                            >
                              Editar
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </QueryFeedback>
              <Text fontSize="xs" color="gray.500" mt={3}>
                Un rol solo puede otorgar permisos que el administrador ya posee.
              </Text>
            </SectionCard>
          </TabPanel>

          <TabPanel px={0}>
            <SectionCard>
              <HStack wrap="wrap" spacing={2} mb={4}>
                <Select
                  size="sm"
                  width="180px"
                  aria-label="Severidad"
                  value={severityFilter}
                  onChange={(event) => setSeverityFilter(event.target.value)}
                >
                  <option value="">Todas las severidades</option>
                  <option value="INFO">Info</option>
                  <option value="WARNING">Warning</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
                <Input
                  size="sm"
                  width="260px"
                  placeholder="Tipo exacto, ej. auth.login_failed"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                />
                <Button size="sm" variant="outline" onClick={securityEvents.reload}>
                  Actualizar
                </Button>
                <Text fontSize="xs" color="gray.500" ml="auto">
                  {securityEvents.data?.items.length ?? 0} eventos
                </Text>
              </HStack>
              <QueryFeedback
                loading={securityEvents.loading}
                error={securityEvents.error}
                onRetry={securityEvents.reload}
                isEmpty={(securityEvents.data?.items.length ?? 0) === 0}
                emptyText="No hay eventos de seguridad."
              >
                <TableContainer>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Fecha</Th>
                        <Th>Severidad</Th>
                        <Th>Tipo</Th>
                        <Th>Usuario</Th>
                        <Th />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {securityEvents.data?.items.map((event) => (
                        <Tr key={event.id}>
                          <Td whiteSpace="nowrap">
                            <Text fontSize="xs">{formatDateTime(event.occurredAt)}</Text>
                          </Td>
                          <Td>
                            <Badge colorScheme={SEVERITY_COLORS[event.severity] ?? 'gray'}>
                              {event.severity}
                            </Badge>
                          </Td>
                          <Td>
                            <Text as="code" fontSize="xs">
                              {event.type}
                            </Text>
                          </Td>
                          <Td>
                            <Text fontFamily="mono" fontSize="xs">
                              {event.userId ?? '—'}
                            </Text>
                          </Td>
                          <Td>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                setSelectedEvent(event);
                                eventModal.onOpen();
                              }}
                            >
                              Detalle
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </QueryFeedback>
            </SectionCard>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Member create/edit */}
      <Modal isOpen={memberModal.isOpen} onClose={memberModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void saveMember(event)}>
          <ModalHeader>{editingMember === null ? 'Nuevo miembro' : 'Editar membresía'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Field label="Email" isRequired>
                <Input
                  type="email"
                  value={memberForm.email}
                  onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })}
                  isDisabled={editingMember !== null}
                  required
                />
              </Field>
              <Field label="Nombre" helper="Si el usuario no existe, se crea con una invitación.">
                <Input
                  value={memberForm.name}
                  onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })}
                  isDisabled={editingMember !== null}
                />
              </Field>
              <Field label="Rol de organización">
                <Select
                  value={memberForm.roleId}
                  onChange={(event) => setMemberForm({ ...memberForm, roleId: event.target.value })}
                >
                  <option value="">Sin rol de organización</option>
                  {roles.data?.items.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {editingMember !== null && (
                <Field label="Estado">
                  <Select
                    value={memberForm.status}
                    onChange={(event) =>
                      setMemberForm({ ...memberForm, status: event.target.value })
                    }
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="SUSPENDED">Suspendido</option>
                    <option value="DISABLED">Deshabilitado</option>
                  </Select>
                </Field>
              )}
              {invitationToken !== null && (
                <Alert status="success" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription fontSize="xs">
                    Invitación generada. Token de un solo uso:
                    <Code display="block" mt={1} wordBreak="break-all">
                      {invitationToken}
                    </Code>
                  </AlertDescription>
                </Alert>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={memberModal.onClose}>
              {invitationToken !== null ? 'Cerrar' : 'Cancelar'}
            </Button>
            <Button type="submit" colorScheme="purple" isLoading={saving}>
              {editingMember === null ? 'Crear membresía' : 'Guardar'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Property assignment */}
      <Modal isOpen={propertyModal.isOpen} onClose={propertyModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Asignaciones de propiedad · {propertyMember?.user.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3} mb={5}>
              {propertyMember?.propertyMemberships.map((assignment) => (
                <HStack
                  key={assignment.id}
                  justify="space-between"
                  borderWidth="1px"
                  borderRadius="md"
                  px={3}
                  py={2}
                >
                  <Box>
                    <Text fontSize="sm" fontWeight="medium">
                      {assignment.property.name}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {assignment.role.name}
                    </Text>
                  </Box>
                  <StatusBadge
                    color={RECORD_STATUS_COLORS[assignment.status] ?? 'gray'}
                    label={RECORD_STATUS_LABELS[assignment.status] ?? assignment.status}
                  />
                </HStack>
              ))}
              {(propertyMember?.propertyMemberships.length ?? 0) === 0 && (
                <Text fontSize="sm" color="gray.500">
                  Sin asignaciones de propiedad.
                </Text>
              )}
            </Stack>
            <Divider mb={4} />
            <Box as="form" onSubmit={(event) => void addPropertyAssignment(event)}>
              <SimpleGrid columns={2} spacing={3}>
                <Field label="Propiedad" isRequired>
                  <Select
                    value={propertyForm.propertyId}
                    onChange={(event) =>
                      setPropertyForm({ ...propertyForm, propertyId: event.target.value })
                    }
                    required
                  >
                    <option value="">Seleccionar…</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name} · {property.code}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Rol" isRequired>
                  <Select
                    value={propertyForm.roleId}
                    onChange={(event) =>
                      setPropertyForm({ ...propertyForm, roleId: event.target.value })
                    }
                    required
                  >
                    <option value="">Seleccionar…</option>
                    {roles.data?.items.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </SimpleGrid>
              <Text fontSize="xs" color="gray.500" mt={2}>
                El backend valida que el rol sea subconjunto de tus permisos y que el usuario sea
                miembro de la organización.
              </Text>
              <Button type="submit" size="sm" colorScheme="purple" mt={3} isLoading={saving}>
                Agregar asignación
              </Button>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={propertyModal.onClose}>
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Sessions */}
      <Modal isOpen={sessionsModal.isOpen} onClose={sessionsModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Sesiones · {sessionMember?.user.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <QueryFeedback
              loading={memberSessions.loading}
              error={memberSessions.error}
              onRetry={memberSessions.reload}
              isEmpty={(memberSessions.data?.items.length ?? 0) === 0}
              emptyText="Sin sesiones activas."
            >
              <Stack spacing={2}>
                {memberSessions.data?.items.map((session) => (
                  <HStack
                    key={session.id}
                    justify="space-between"
                    borderWidth="1px"
                    borderRadius="md"
                    px={3}
                    py={2}
                  >
                    <Box>
                      <Text fontSize="xs" color="gray.600" noOfLines={1} maxW="360px">
                        {session.userAgent ?? 'Cliente desconocido'}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Última actividad {formatDateTime(session.lastSeenAt)} · expira{' '}
                        {formatDateTime(session.expiresAt)}
                      </Text>
                    </Box>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => void revokeMemberSession(session)}
                    >
                      Revocar
                    </Button>
                  </HStack>
                ))}
              </Stack>
            </QueryFeedback>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Role create/edit */}
      <Modal isOpen={roleModal.isOpen} onClose={roleModal.onClose} size="xl">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={(event) => void saveRole(event)}>
          <ModalHeader>
            {editingRole === null ? 'Nuevo rol' : `Editar rol ${editingRole.key}`}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <SimpleGrid columns={2} spacing={4}>
                <Field label="Key" isRequired helper="Mayúsculas, números, puntos o guiones.">
                  <Input
                    value={roleForm.key}
                    onChange={(event) => setRoleForm({ ...roleForm, key: event.target.value })}
                    isDisabled={editingRole !== null}
                    required
                  />
                </Field>
                <Field label="Nombre" isRequired>
                  <Input
                    value={roleForm.name}
                    onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
                    required
                  />
                </Field>
              </SimpleGrid>
              <Divider />
              <Text fontSize="sm" fontWeight="medium">
                Permisos ({roleForm.permissions.length})
              </Text>
              <QueryFeedback
                loading={permissions.loading}
                error={permissions.error}
                onRetry={permissions.reload}
              >
                <CheckboxGroup
                  value={roleForm.permissions}
                  onChange={(values) =>
                    setRoleForm({ ...roleForm, permissions: values.map((value) => String(value)) })
                  }
                >
                  <Stack spacing={4}>
                    {permissionGroups.map(([group, items]) => (
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
              </QueryFeedback>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={roleModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="purple" isLoading={saving}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Security event metadata */}
      <Modal isOpen={eventModal.isOpen} onClose={eventModal.onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="md">Evento de seguridad</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedEvent !== null && (
              <Stack spacing={2}>
                <HStack>
                  <Badge colorScheme={SEVERITY_COLORS[selectedEvent.severity] ?? 'gray'}>
                    {selectedEvent.severity}
                  </Badge>
                  <Code fontSize="xs">{selectedEvent.type}</Code>
                </HStack>
                <Text fontSize="xs" color="gray.600">
                  {formatDateTime(selectedEvent.occurredAt)} · usuario {selectedEvent.userId ?? '—'}{' '}
                  · actor {selectedEvent.actorUserId ?? '—'}
                </Text>
                <Code display="block" whiteSpace="pre-wrap" p={3} borderRadius="md" fontSize="xs">
                  {formatJson(selectedEvent.metadata)}
                </Code>
              </Stack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function AdminPage() {
  return <AdminContent />;
}
