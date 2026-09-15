'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/customers', label: 'Customers', icon: '🏥' },
  { href: '/aging', label: 'Outstanding / Aging', icon: '⏱' },
  { href: '/follow-ups', label: 'Follow-ups Today', icon: '📞' },
  { href: '/reminders', label: 'Reminders', icon: '🔔' },
  { href: '/reports', label: 'Reports', icon: '📊' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-gray-200 bg-white print:hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
            BW
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">BioWaste Manager</p>
            <p className="text-xs text-gray-500">Billing &amp; Collections</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-4">
          <p className="truncate text-sm font-medium text-gray-900">{user?.fullName}</p>
          <p className="truncate text-xs text-gray-500">{user?.roles.join(', ')}</p>
          <button
            onClick={() => void logout()}
            className="mt-3 w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden p-8 print:p-0">{children}</main>
    </div>
  );
}
