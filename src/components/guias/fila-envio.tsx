'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GuiaStatusBadge } from './status-badge';
import { formatPhone, formatDateTimeBR, formatDateBR } from '@/lib/format';
import type { Guia, GuiaEnvio, ExternalClient, ExternalClientContact } from '@/lib/types';

type Props = {
  guias: Guia[];
  envios: GuiaEnvio[];
  clientes: Pick<ExternalClient, 'id' | 'razao_social' | 'cnpj'>[];
  contatos: Pick<ExternalClientContact, 'id' | 'nome' | 'whatsapp' | 'external_client_id'>[];
};

export function FilaEnvio({ guias, envios: initEnvios, clientes, contatos }: Props) {
  const [envios, setEnvios] = useState<GuiaEnvio[]>(initEnvios);

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel('guia_envios:realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guia_envios' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEnvios((prev) => [payload.new as GuiaEnvio, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setEnvios((prev) =>
              prev.map((e) =>
                e.id === (payload.new as GuiaEnvio).id ? (payload.new as GuiaEnvio) : e,
              ),
            );
          }
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const clienteMap = useMemo(
    () => new Map(clientes.map((c) => [c.id, c])),
    [clientes],
  );
  const contatoMap = useMemo(
    () => new Map(contatos.map((c) => [c.id, c])),
    [contatos],
  );
  const guiaMap = useMemo(() => new Map(guias.map((g) => [g.id, g])), [guias]);

  const porCliente = useMemo(() => {
    const groups = new Map<
      string,
      { cliente: Pick<ExternalClient, 'id' | 'razao_social'>; guias: Map<string, GuiaEnvio[]> }
    >();
    for (const envio of envios) {
      const guia = guiaMap.get(envio.guia_id);
      if (!guia) continue;
      const cliente = guia.external_client_id ? clienteMap.get(guia.external_client_id) : undefined;
      const clienteKey = cliente?.id ?? '__orfas__';
      if (!groups.has(clienteKey)) {
        groups.set(clienteKey, {
          cliente: cliente ?? { id: '__orfas__', razao_social: 'Sem cliente identificado' },
          guias: new Map(),
        });
      }
      const grupo = groups.get(clienteKey)!;
      if (!grupo.guias.has(envio.guia_id)) grupo.guias.set(envio.guia_id, []);
      grupo.guias.get(envio.guia_id)!.push(envio);
    }
    return groups;
  }, [envios, guiaMap, clienteMap]);

  if (envios.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum envio agendado. Rode uma coleta pra começar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {Array.from(porCliente.values()).map(({ cliente, guias: guiaGroups }) => (
        <Card key={cliente.id}>
          <CardHeader>
            <CardTitle className="text-base">{cliente.razao_social}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from(guiaGroups.entries()).map(([guiaId, enviosGuia]) => {
              const guia = guiaMap.get(guiaId);
              if (!guia) return null;
              return (
                <div
                  key={guiaId}
                  className="rounded-md border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Link
                      href={`/guias/${guiaId}`}
                      className="font-medium text-sm hover:underline"
                    >
                      {guia.tipo} · venc. {formatDateBR(guia.vencimento)}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {enviosGuia.length} contato(s)
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {enviosGuia.map((envio) => {
                      const c = contatoMap.get(envio.contact_id);
                      return (
                        <li
                          key={envio.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span>
                            {c?.nome ?? '?'}{' '}
                            <span className="text-muted-foreground">
                              ({formatPhone(c?.whatsapp ?? '')})
                            </span>
                            {envio.numero_followup > 0 && (
                              <span className="ml-1 text-amber-600">
                                follow-up #{envio.numero_followup}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {envio.enviado_at && (
                              <span className="text-muted-foreground">
                                {formatDateTimeBR(envio.enviado_at)}
                              </span>
                            )}
                            <GuiaStatusBadge status={envio.status} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
