'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GuiaStatusBadge } from './status-badge';
import { formatPhone, formatDateTimeBR, formatDateBR } from '@/lib/format';
import { prepararEnvioGrupo } from '@/app/(app)/guias/actions';
import type { Guia, GuiaEnvio, ExternalClient, ExternalClientContact } from '@/lib/types';

const HELPER_URL = process.env.NEXT_PUBLIC_HELPER_URL ?? 'http://localhost:7777';

type ClienteForFila = Pick<ExternalClient, 'id' | 'razao_social' | 'cnpj' | 'grupo_whatsapp_nome'>;

type Props = {
  guias: Guia[];
  envios: GuiaEnvio[];
  clientes: ClienteForFila[];
  contatos: Pick<ExternalClientContact, 'id' | 'nome' | 'whatsapp' | 'external_client_id'>[];
};

export function FilaEnvio({ guias, envios: initEnvios, clientes, contatos }: Props) {
  const [envios, setEnvios] = useState<GuiaEnvio[]>(initEnvios);
  const [pendingCliente, setPendingCliente] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handlePrepararGrupo(clienteId: string) {
    setPendingCliente(clienteId);
    try {
      const result = await prepararEnvioGrupo(clienteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const res = await fetch(`${HELPER_URL}/prep-envio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupoNome: result.grupoNome,
          mensagem: result.mensagem,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        toast.error(`Helper retornou ${res.status}: ${body || 'erro desconhecido'}`);
        return;
      }

      toast.success(
        `Mensagem com ${result.total_guias} guia(s) preparada no grupo "${result.grupoNome}". Confirme no WhatsApp.`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        toast.error(
          `Helper local não responde em ${HELPER_URL}. Rode "pnpm helper:start" no terminal.`,
        );
      } else {
        toast.error(`Erro: ${msg}`);
      }
    } finally {
      setPendingCliente(null);
    }
  }

  function onPrepararClick(clienteId: string) {
    startTransition(() => {
      void handlePrepararGrupo(clienteId);
    });
  }

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
    type Group = {
      cliente: { id: string; razao_social: string; grupo_whatsapp_nome: string | null };
      guias: Map<string, GuiaEnvio[]>;
    };
    const groups = new Map<string, Group>();

    // 1) Agrupa por cliente a partir das guias — garante que cliente sem envio
    // individual ainda apareça (caso de uso: cliente só recebe por grupo).
    for (const guia of guias) {
      const cliente = guia.external_client_id ? clienteMap.get(guia.external_client_id) : undefined;
      const clienteKey = cliente?.id ?? '__orfas__';
      if (!groups.has(clienteKey)) {
        groups.set(clienteKey, {
          cliente: cliente
            ? {
                id: cliente.id,
                razao_social: cliente.razao_social,
                grupo_whatsapp_nome: cliente.grupo_whatsapp_nome,
              }
            : { id: '__orfas__', razao_social: 'Sem cliente identificado', grupo_whatsapp_nome: null },
          guias: new Map(),
        });
      }
      const group = groups.get(clienteKey)!;
      if (!group.guias.has(guia.id)) group.guias.set(guia.id, []);
    }

    // 2) Encaixa envios individuais nas guias correspondentes
    for (const envio of envios) {
      const guia = guiaMap.get(envio.guia_id);
      if (!guia) continue;
      const cliente = guia.external_client_id ? clienteMap.get(guia.external_client_id) : undefined;
      const clienteKey = cliente?.id ?? '__orfas__';
      const group = groups.get(clienteKey);
      if (!group) continue;
      if (!group.guias.has(envio.guia_id)) group.guias.set(envio.guia_id, []);
      group.guias.get(envio.guia_id)!.push(envio);
    }

    return groups;
  }, [guias, envios, guiaMap, clienteMap]);

  if (guias.length === 0 && envios.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma guia coletada ainda. Rode uma coleta pra começar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {Array.from(porCliente.values()).map(({ cliente, guias: guiaGroups }) => (
        <Card key={cliente.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">{cliente.razao_social}</CardTitle>
            {cliente.grupo_whatsapp_nome && cliente.id !== '__orfas__' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPrepararClick(cliente.id)}
                disabled={pendingCliente === cliente.id}
              >
                <Users className="h-4 w-4" />
                {pendingCliente === cliente.id ? 'Preparando...' : 'Preparar envio em grupo'}
              </Button>
            )}
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
                      {enviosGuia.length === 0 ? 'só grupo' : `${enviosGuia.length} contato(s)`}
                    </span>
                  </div>
                  {enviosGuia.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Sem envio individual agendado (cliente sem contato com receber_guias).
                    </p>
                  ) : (
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
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
