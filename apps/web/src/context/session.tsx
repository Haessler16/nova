'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  completeMfaLogin,
  fetchAuthMode,
  getAuthMode,
  loginLocal as requestLocalLogin,
  logoutSession,
  setAuthMode,
  setDevUserId,
  type LocalLoginResult,
  type SessionInfo,
} from '@/lib/api';
import type {
  Actor,
  AuthMode,
  MeResponse,
  OrganizationSummary,
  PropertySummary,
} from '@/lib/types';

const ORGANIZATION_STORAGE_KEY = 'nova.organizationId';

function propertyStorageKey(organizationId: string): string {
  return `nova.propertyId.${organizationId}`;
}

type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

interface SessionState {
  status: SessionStatus;
  authMode: AuthMode | null;
  actor: Actor | null;
  me: MeResponse | null;
  organizations: OrganizationSummary[];
  organizationId: string | null;
  properties: PropertySummary[];
  propertyId: string | null;
}

export interface SessionContextValue extends SessionState {
  organization: OrganizationSummary | null;
  property: PropertySummary | null;
  tenant: { organizationId: string | null; propertyId: string | null };
  login: (email: string, password: string, mfaCode?: string) => Promise<LocalLoginResult>;
  completeMfa: (challengeToken: string, code: string) => Promise<void>;
  loginDev: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (organizationId: string) => Promise<void>;
  selectProperty: (propertyId: string) => void;
  refresh: () => Promise<void>;
}

const INITIAL_STATE: SessionState = {
  status: 'loading',
  authMode: null,
  actor: null,
  me: null,
  organizations: [],
  organizationId: null,
  properties: [],
  propertyId: null,
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function loadTenant(): Promise<{
  me: MeResponse;
  organizations: OrganizationSummary[];
  organizationId: string | null;
  properties: PropertySummary[];
  propertyId: string | null;
}> {
  const me = await api<MeResponse>('/api/v1/me');
  const organizationsResponse = await api<{ items: OrganizationSummary[] }>(
    '/api/v1/organizations',
  );
  const organizations = organizationsResponse.items;

  const storedOrganization =
    typeof window !== 'undefined' ? window.localStorage.getItem(ORGANIZATION_STORAGE_KEY) : null;
  const organizationId =
    organizations.find((organization) => organization.id === storedOrganization)?.id ??
    organizations[0]?.id ??
    null;

  let properties: PropertySummary[] = [];
  let propertyId: string | null = null;

  if (organizationId !== null) {
    const response = await api<{ items: PropertySummary[] }>('/api/v1/properties', {
      tenant: { organizationId },
    });
    properties = response.items;

    const storedProperty =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(propertyStorageKey(organizationId))
        : null;
    propertyId = properties.find((property) => property.id === storedProperty)?.id ?? null;
    if (propertyId === null && properties[0] !== undefined) {
      propertyId = properties[0].id;
    }
  }

  if (typeof window !== 'undefined') {
    if (organizationId !== null) {
      window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
    }
    if (organizationId !== null && propertyId !== null) {
      window.localStorage.setItem(propertyStorageKey(organizationId), propertyId);
    }
  }

  return { me, organizations, organizationId, properties, propertyId };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  const applySession = useCallback(async (session: SessionInfo) => {
    setAuthMode(session.authentication);
    const tenant = await loadTenant();
    setState({
      status: 'authenticated',
      authMode: session.authentication,
      actor: session.user,
      ...tenant,
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const session = await api<SessionInfo>('/api/v1/auth/session', {
        suppressAuthEvent: true,
      });
      await applySession(session);
    } catch {
      setState((current) => ({ ...current, status: 'anonymous', authMode: getAuthMode() }));
    }
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      let mode: AuthMode | null = null;
      try {
        mode = await fetchAuthMode();
      } catch {
        mode = null;
      }

      if (cancelled) {
        return;
      }
      setState((current) => ({ ...current, authMode: mode }));

      try {
        const session = await api<SessionInfo>('/api/v1/auth/session', {
          suppressAuthEvent: true,
        });
        if (!cancelled) {
          await applySession(session);
        }
      } catch {
        if (!cancelled) {
          setState((current) => ({ ...current, status: 'anonymous', authMode: mode }));
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  useEffect(() => {
    function handleUnauthorized(): void {
      setState((current) => ({
        ...current,
        status: 'anonymous',
        actor: null,
        me: null,
        organizations: [],
        organizationId: null,
        properties: [],
        propertyId: null,
      }));
    }

    window.addEventListener('nova:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nova:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(
    async (email: string, password: string, mfaCode?: string) => {
      const result = await requestLocalLogin(email, password, mfaCode);
      if (result.kind === 'session') {
        await refresh();
      }
      return result;
    },
    [refresh],
  );

  const completeMfa = useCallback(
    async (challengeToken: string, code: string) => {
      const session = await completeMfaLogin(challengeToken, code);
      await applySession(session);
    },
    [applySession],
  );

  const loginDev = useCallback(
    async (userId: string) => {
      setDevUserId(userId);
      try {
        const session = await api<SessionInfo>('/api/v1/auth/session', {
          suppressAuthEvent: true,
        });
        await applySession(session);
      } catch (error) {
        setDevUserId(null);
        throw error;
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await logoutSession();
    setState((current) => ({
      ...INITIAL_STATE,
      status: 'anonymous',
      authMode: current.authMode,
    }));
  }, []);

  const selectOrganization = useCallback(async (organizationId: string) => {
    const response = await api<{ items: PropertySummary[] }>('/api/v1/properties', {
      tenant: { organizationId },
    });
    const properties = response.items;
    const storedProperty = window.localStorage.getItem(propertyStorageKey(organizationId));
    const propertyId =
      properties.find((property) => property.id === storedProperty)?.id ??
      properties[0]?.id ??
      null;

    window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
    if (propertyId !== null) {
      window.localStorage.setItem(propertyStorageKey(organizationId), propertyId);
    }

    setState((current) =>
      current.status === 'authenticated'
        ? { ...current, organizationId, properties, propertyId }
        : current,
    );
  }, []);

  const selectProperty = useCallback((propertyId: string) => {
    setState((current) => {
      if (current.organizationId === null) {
        return current;
      }
      window.localStorage.setItem(propertyStorageKey(current.organizationId), propertyId);
      return { ...current, propertyId };
    });
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const organization =
      state.organizations.find((item) => item.id === state.organizationId) ?? null;
    const property = state.properties.find((item) => item.id === state.propertyId) ?? null;

    return {
      ...state,
      organization,
      property,
      tenant: { organizationId: state.organizationId, propertyId: state.propertyId },
      login,
      completeMfa,
      loginDev,
      logout,
      selectOrganization,
      selectProperty,
      refresh,
    };
  }, [state, login, completeMfa, loginDev, logout, selectOrganization, selectProperty, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error('useSession must be used inside SessionProvider.');
  }
  return context;
}
