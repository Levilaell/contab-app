import Link from 'next/link';
import { FolderClock } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { Button } from '@/components/ui/button';
import { FilaEnvio } from '@/components/guias/fila-envio';
import type {
  Guia,
  GuiaEnvio,
  ExternalClient,
  ExternalClientContact,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function GuiasPage() {
  const sb = createServiceClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [{ data: guias }, { data: envios }, { data: clientes }, { data: contatos }] =
    await Promise.all([
      sb.from('guias').select('*').gte('competencia', monthStart.toISOString().slice(0, 10)),
      sb.from('guia_envios').select('*').gte('created_at', monthStart.toISOString()),
      sb.from('external_clients').select('id, razao_social, cnpj, grupo_whatsapp_nome'),
      sb.from('external_client_contacts').select('id, nome, whatsapp, external_client_id'),
    ]);

  const guiaList = (guias ?? []) as Guia[];
  const envioList = (envios ?? []) as GuiaEnvio[];
  const clienteList = (clientes ?? []) as Pick<
    ExternalClient,
    'id' | 'razao_social' | 'cnpj' | 'grupo_whatsapp_nome'
  >[];
  const contatoList = (contatos ?? []) as Pick<
    ExternalClientContact,
    'id' | 'nome' | 'whatsapp' | 'external_client_id'
  >[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GuiaFlow</h1>
          <p className="text-sm text-muted-foreground">
            Fila de envio do mês atual — atualizada em tempo real
          </p>
        </div>
        <Button variant="outline" render={<Link href="/guias/coletas" />}>
          <FolderClock className="h-4 w-4" />
          Coletas
        </Button>
      </div>

      <FilaEnvio
        guias={guiaList}
        envios={envioList}
        clientes={clienteList}
        contatos={contatoList}
      />
    </div>
  );
}
