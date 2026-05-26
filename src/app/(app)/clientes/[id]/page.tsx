import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { ClienteForm } from '@/components/clientes/cliente-form';
import { ContatosSection } from '@/components/clientes/contatos-section';
import type { ExternalClient, ExternalClientContact } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ClienteEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = createServiceClient();
  const [{ data: cliente }, { data: contatos }] = await Promise.all([
    sb.from('external_clients').select('*').eq('id', id).maybeSingle(),
    sb.from('external_client_contacts').select('*').eq('external_client_id', id).order('ordem').order('nome'),
  ]);

  if (!cliente) notFound();
  const typed = cliente as ExternalClient;
  const contatosTyped = (contatos ?? []) as ExternalClientContact[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{typed.razao_social}</h1>
        <p className="text-sm text-muted-foreground">
          {typed.nome_fantasia ?? 'Editar cliente'}
        </p>
      </div>

      <ClienteForm cliente={typed} />
      <ContatosSection externalClientId={typed.id} contatos={contatosTyped} />
    </div>
  );
}
