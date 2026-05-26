import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, TipoBadge } from '@/components/documentos/classificacao-badge';
import { formatDateTimeBR, formatCurrency, formatPhone, formatCNPJ } from '@/lib/format';
import { ReclassificarButton } from './reclassificar-button';
import { EscriturarButton } from './escriturar-button';
import { SyncOneDriveButton } from './sync-onedrive-button';
import type { Documento, ExternalClient } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DocumentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = createServiceClient();
  const { data: doc } = await sb.from('documentos').select('*').eq('id', id).maybeSingle();
  if (!doc) notFound();
  const typed = doc as Documento;

  let cliente: Pick<ExternalClient, 'id' | 'razao_social' | 'cnpj'> | null = null;
  if (typed.external_client_id) {
    const { data } = await sb
      .from('external_clients')
      .select('id, razao_social, cnpj')
      .eq('id', typed.external_client_id)
      .maybeSingle();
    if (data) cliente = data as Pick<ExternalClient, 'id' | 'razao_social' | 'cnpj'>;
  }

  const { data: signed } = await sb.storage
    .from('documentos')
    .createSignedUrl(typed.storage_path, 3600);

  const meta = typed.metadata ?? {};
  const m = meta as Record<string, string | number | undefined>;
  const valor = typeof m.valor === 'number' ? m.valor : m.valor ? Number(m.valor) : undefined;
  const isImage = typed.mime_type.startsWith('image/');
  const isPdf = typed.mime_type.includes('pdf');

  return (
    <div className="space-y-6">
      <Link
        href="/documentos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar pra caixa de entrada
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{typed.filename_original ?? 'documento sem nome'}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    Recebido em {formatDateTimeBR(typed.recebido_em)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <TipoBadge tipo={typed.tipo} />
                  <StatusBadge status={typed.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {typed.reasoning && (
                <p className="text-muted-foreground italic">&ldquo;{typed.reasoning}&rdquo;</p>
              )}
              {typed.confidence !== null && (
                <div className="text-xs text-muted-foreground">
                  Confiança: {Math.round((typed.confidence ?? 0) * 100)}% ·
                  Modelo: {typed.modelo_ia ?? '?'}
                </div>
              )}
            </CardContent>
          </Card>

          {signed?.signedUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Visualizador</CardTitle>
              </CardHeader>
              <CardContent>
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signed.signedUrl}
                    alt={typed.filename_original ?? 'documento'}
                    className="rounded border max-h-[600px] mx-auto"
                  />
                ) : isPdf ? (
                  <iframe
                    src={signed.signedUrl}
                    className="w-full h-[600px] rounded border"
                  />
                ) : (
                  <a
                    href={signed.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    Abrir arquivo
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <ReclassificarButton documentoId={typed.id} />
              {(typed.status === 'erro_dominio' || typed.status === 'pronto_envio') && (
                <EscriturarButton documentoId={typed.id} />
              )}
              <SyncOneDriveButton documentoId={typed.id} />
              {signed?.signedUrl && (
                <Button render={<a href={signed.signedUrl} target="_blank" rel="noopener noreferrer" />}>
                  <ExternalLink className="h-4 w-4" />
                  Abrir original
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Remetente" value={formatPhone(typed.remetente_phone)} />
              {cliente && (
                <Row
                  label="Cliente"
                  value={
                    <Link href={`/clientes/${cliente.id}`} className="hover:underline">
                      {cliente.razao_social}
                    </Link>
                  }
                />
              )}
              {m.numero && <Row label="Número" value={String(m.numero)} />}
              {valor !== undefined && <Row label="Valor" value={formatCurrency(valor)} />}
              {m.cnpj_emitente && (
                <Row label="CNPJ emitente" value={formatCNPJ(String(m.cnpj_emitente))} />
              )}
              {m.cnpj_destinatario && (
                <Row label="CNPJ destinatário" value={formatCNPJ(String(m.cnpj_destinatario))} />
              )}
              {typed.chave_acesso_nfe && (
                <Row label="Chave NFe" value={<code className="text-xs">{typed.chave_acesso_nfe}</code>} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Escrituração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {typed.escriturado ? (
                <>
                  <div className="text-emerald-600">✓ Escriturado</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTimeBR(typed.escriturado_em)}
                    {typed.escriturado_via && ` via ${typed.escriturado_via}`}
                  </div>
                </>
              ) : typed.escrituracao_erro ? (
                <div className="text-xs text-destructive">{typed.escrituracao_erro}</div>
              ) : (
                <div className="text-xs text-muted-foreground">Aguardando</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OneDrive</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {typed.onedrive_uploaded_at ? (
                <>
                  <div className="text-emerald-600">✓ Arquivado</div>
                  <div className="text-xs text-muted-foreground break-all">
                    {typed.onedrive_path}
                  </div>
                </>
              ) : typed.onedrive_erro ? (
                <div className="text-xs text-destructive">{typed.onedrive_erro}</div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Aguardando upload
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right truncate">{value}</span>
    </div>
  );
}
