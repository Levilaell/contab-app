import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getConfig } from '@/lib/config';
import { DominioForm } from './dominio-form';

export const dynamic = 'force-dynamic';

export default async function DominioSettingsPage() {
  const config = await getConfig(true);

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para configurações
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Domínio Sistemas</h1>
        <p className="text-sm text-muted-foreground">
          API REST de escrituração + watch folder para coleta de guias
        </p>
      </div>

      <DominioForm
        integrationId={config.dominio_integration_id}
        apiKeySet={!!config.dominio_api_key_encrypted}
        active={config.dominio_active}
        watchFolderPath={config.dominio_watch_folder_path}
        watchActive={config.dominio_watch_active}
        lastScanAt={config.dominio_last_scan_at}
      />
    </div>
  );
}
