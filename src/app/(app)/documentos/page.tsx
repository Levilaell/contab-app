import Link from 'next/link';
import { FileText, ClipboardList } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { Button } from '@/components/ui/button';
import { ListaDocumentos } from '@/components/documentos/lista-documentos';
import type { Documento, ExternalClient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DocumentosPage() {
  const sb = createServiceClient();
  const [{ data: docs }, { data: clientes }] = await Promise.all([
    sb.from('documentos').select('*').order('recebido_em', { ascending: false }).limit(100),
    sb.from('external_clients').select('id, razao_social'),
  ]);

  const docList = (docs ?? []) as Documento[];
  const clienteList = (clientes ?? []) as Pick<ExternalClient, 'id' | 'razao_social'>[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DocFlow</h1>
          <p className="text-sm text-muted-foreground">
            Caixa de entrada — atualizada em tempo real
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/documentos/solicitacoes" />}>
            <ClipboardList className="h-4 w-4" />
            Solicitações
          </Button>
          <Button variant="outline" render={<Link href="/documentos/escrituracao" />}>
            <FileText className="h-4 w-4" />
            Escrituração
          </Button>
        </div>
      </div>

      <ListaDocumentos initial={docList} clientes={clienteList} />
    </div>
  );
}
