import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { Button } from '@/components/ui/button';
import { ClienteTable } from '@/components/clientes/cliente-table';
import { CSVImporter } from '@/components/clientes/csv-importer';
import type { ExternalClient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const sb = createServiceClient();
  const { data: clientes } = await sb
    .from('external_clients')
    .select('*')
    .order('razao_social');

  const list = (clientes ?? []) as ExternalClient[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {list.length} {list.length === 1 ? 'cliente' : 'clientes'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CSVImporter />
          <Button render={<Link href="/clientes/novo" />}>
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        </div>
      </div>

      <ClienteTable clientes={list} />
    </div>
  );
}
