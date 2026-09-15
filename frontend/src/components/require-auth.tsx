'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth, type RoleName } from '@/lib/auth-context';

/**
 * Client-side route guard. Tokens live in localStorage (no server-readable cookie yet —
 * see docs/API_ARCHITECTURE.md open questions), so enforcement happens here rather than
 * in Next.js middleware; the API itself is the real authorization boundary regardless.
 */
export function RequireAuth({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: RoleName[];
}) {
  const { user, isLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (allowedRoles && !hasRole(...allowedRoles)) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, allowedRoles, hasRole, router]);

  if (isLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading…</div>;
  }

  if (allowedRoles && !hasRole(...allowedRoles)) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
