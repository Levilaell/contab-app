'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDateTimeBR, formatCurrency, formatPhone } from '@/lib/format';
import { StatusBadge, TipoBadge } from './classificacao-badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Documento } from '@/lib/types';

type ClienteInfo = { id: string; razao_social: string };
type Props = {
  initial: Documento[];
  clientes: ClienteInfo[];
};

export function ListaDocumentos({ initial, clientes }: Props) {
  const [docs, setDocs] = useState<Documento[]>(initial);
  const clienteMap = new Map(clientes.map((c) => [c.id, c.razao_social]));

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel('documentos:realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'documentos' },
        (payload) => {
          setDocs((prev) => [payload.new as Documento, ...prev].slice(0, 100));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documentos' },
        (payload) => {
          setDocs((prev) =>
            prev.map((d) => (d.id === (payload.new as Documento).id ? (payload.new as Documento) : d)),
          );
        },
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  if (docs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum documento recebido. Quando algum cliente mandar um arquivo, aparece aqui em tempo real.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {docs.map((d) => {
        const valor = d.metadata?.valor as number | undefined;
        return (
          <Link key={d.id} href={`/documentos/${d.id}`} className="block">
            <Card className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TipoBadge tipo={d.tipo} />
                      <StatusBadge status={d.status} />
                      {d.confidence !== null && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round((d.confidence ?? 0) * 100)}% confiança
                        </span>
                      )}
                    </div>
                    <div className="font-medium truncate">
                      {d.filename_original ?? 'sem nome'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {clienteMap.get(d.external_client_id ?? '') ?? formatPhone(d.remetente_phone)}{' '}
                      · {formatDateTimeBR(d.recebido_em)}
                    </div>
                  </div>
                  <div className="text-right">
                    {valor && (
                      <div className="font-semibold">{formatCurrency(valor)}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
