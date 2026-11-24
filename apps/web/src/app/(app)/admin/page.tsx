'use client';

import { Tab, TabList, TabPanel, TabPanels, Tabs, useDisclosure } from '@chakra-ui/react';
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { useSession } from '@/context/session';
import { useI18n } from '@/lib/i18n';
import type { SecurityEvent } from '@/lib/types';
import { AdminMembersPanel } from './_components/admin-members-panel';
import { AdminRolesPanel } from './_components/admin-roles-panel';
import { AdminSecurityPanel } from './_components/admin-security-panel';
import { MemberModal } from './_components/member-modal';
import { MemberSessionsModal } from './_components/member-sessions-modal';
import { PropertyAssignmentModal } from './_components/property-assignment-modal';
import { RoleModal } from './_components/role-modal';
import { SecurityEventModal } from './_components/security-event-modal';
import { useAdminData } from './_hooks/use-admin-data';
import { useMemberEditor } from './_hooks/use-member-editor';
import { useMemberSessions } from './_hooks/use-member-sessions';
import { usePropertyAssignment } from './_hooks/use-property-assignment';
import { useRoleEditor } from './_hooks/use-role-editor';

function AdminContent() {
  const { t } = useI18n();
  const { properties } = useSession();
  const data = useAdminData();
  const memberEditor = useMemberEditor(data.adminTenant, data.roles.data?.items, () =>
    data.memberships.reload(),
  );
  const assignment = usePropertyAssignment(data.adminTenant, () => data.memberships.reload());
  const memberSessions = useMemberSessions(data.adminTenant);
  const roleEditor = useRoleEditor(data.adminTenant, () => data.roles.reload());

  const eventModal = useDisclosure();
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  function openEvent(event: SecurityEvent): void {
    setSelectedEvent(event);
    eventModal.onOpen();
  }

  return (
    <>
      <PageHeader title={t('admin.title')} description={t('admin.description')} />

      <Tabs colorScheme="brand" variant="enclosed">
        <TabList>
          <Tab>{t('admin.tab.members')}</Tab>
          <Tab>{t('admin.tab.roles')}</Tab>
          <Tab>{t('admin.tab.security')}</Tab>
        </TabList>
        <TabPanels>
          <AdminMembersPanel
            data={data}
            onCreate={memberEditor.openCreate}
            onEdit={memberEditor.openEdit}
            onProperties={assignment.open}
            onSessions={memberSessions.open}
          />
          <AdminRolesPanel
            data={data}
            onCreate={roleEditor.openCreate}
            onEdit={roleEditor.openEdit}
          />
          <AdminSecurityPanel data={data} onSelect={openEvent} />
        </TabPanels>
      </Tabs>

      <MemberModal editor={memberEditor} roles={data.roles.data?.items} />

      <PropertyAssignmentModal
        assignment={assignment}
        roles={data.roles.data?.items}
        properties={properties}
      />

      <MemberSessionsModal sessions={memberSessions} />

      <RoleModal editor={roleEditor} data={data} />

      <SecurityEventModal
        isOpen={eventModal.isOpen}
        onClose={eventModal.onClose}
        event={selectedEvent}
      />
    </>
  );
}

export default function AdminPage() {
  return <AdminContent />;
}
