import Link from 'next/link';
import { ChevronRight, MessageSquare, FileSpreadsheet, Cloud } from 'lucide-react';
import { getConfig } from '@/lib/config';
import { GeneralForm } from './general-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const config = await getConfig(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Brand, integrações e credenciais
        </p>
      </div>

      <GeneralForm
        nomeEscritorio={config.nome_escritorio}
        contactEmail={config.contact_email}
      />

      <div className="rounded-lg border bg-card divide-y">
        <IntegrationLink
          href="/settings/whatsapp"
          icon={MessageSquare}
          title="WhatsApp Cloud API"
          status={config.wa_active ? 'Ativo' : 'Inativo'}
          active={config.wa_active}
        />
        <IntegrationLink
          href="/settings/dominio"
          icon={FileSpreadsheet}
          title="Domínio Sistemas"
          status={config.dominio_active ? 'Ativo' : 'Inativo'}
          active={config.dominio_active}
        />
        <IntegrationLink
          href="/settings/onedrive"
          icon={Cloud}
          title="OneDrive (Microsoft)"
          status={config.onedrive_active ? 'Conectado' : 'Desconectado'}
          active={config.onedrive_active}
        />
      </div>
    </div>
  );
}

function IntegrationLink({
  href,
  icon: Icon,
  title,
  status,
  active,
}: {
  href: string;
  icon: typeof MessageSquare;
  title: string;
  status: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-accent/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="font-medium">{title}</div>
          <div className={active ? 'text-xs text-emerald-600' : 'text-xs text-muted-foreground'}>
            {status}
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
