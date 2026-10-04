import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';

export function useAuthStore() {
  const { user, isLoaded } = useUser();
  const { orgRole, signOut } = useClerkAuth();

  const roles = ['USER'];
  if (orgRole === 'org:admin') {
    roles.push('ADMINISTRATOR', 'RESPONSABLE');
  } else if (orgRole === 'org:member') {
    roles.push('RESPONSABLE');
  }

  const organization = user?.organizationMemberships?.[0]?.organization;

  const mappedUser = user ? {
    id: user.id,
    name: user.fullName || user.firstName || 'User',
    email: user.primaryEmailAddress?.emailAddress,
    roles,
    organizationId: organization?.id,
    organizationName: organization?.name || 'Organisation'
  } : null;

  return {
    user: mappedUser,
    isInitialized: isLoaded,
    logout: () => signOut()
  };
}

export function useAuth<T>(selector: (state: any) => T): T {
  const store = useAuthStore();
  return selector(store);
}
