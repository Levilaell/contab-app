'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/documentos', label: 'DocFlow', icon: FileText },
  { href: '/guias', label: 'GuiaFlow', icon: Receipt },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'Contabilliza';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-full w-64 border-r bg-card">
      <div className="px-6 py-5 border-b">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight"
          onClick={onNavigate}
        >
          {brandName}
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t text-xs text-muted-foreground">
        v0.1.0
      </div>
    </aside>
  );
}
