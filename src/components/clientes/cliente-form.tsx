"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCNPJ } from "@/lib/format";
import type { ExternalClient } from "@/lib/types";
import {
  createCliente,
  updateCliente,
  deleteCliente,
} from "@/app/(app)/clientes/actions";

type Props = {
  cliente?: ExternalClient;
};

export function ClienteForm({ cliente }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [solicitarDocs, setSolicitarDocs] = useState(
    cliente?.solicitar_documentos ?? true,
  );
  const [ativo, setAtivo] = useState(cliente?.ativo ?? true);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("solicitar_documentos", solicitarDocs ? "true" : "false");
    formData.set("ativo", ativo ? "true" : "false");

    startTransition(async () => {
      const result = cliente
        ? await updateCliente(cliente.id, formData)
        : await createCliente(formData);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(cliente ? "Cliente atualizado" : "Cliente criado");
      if (cliente) router.refresh();
    });
  }

  async function handleDelete() {
    if (!cliente) return;
    if (!confirm("Apagar este cliente?")) return;
    startTransition(async () => {
      const result = await deleteCliente(cliente.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cliente apagado");
      router.replace("/clientes");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados do cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="razao_social">Razão social</Label>
            <Input
              id="razao_social"
              name="razao_social"
              required
              defaultValue={cliente?.razao_social}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              name="cnpj"
              required
              defaultValue={cliente ? formatCNPJ(cliente.cnpj) : ""}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome_fantasia">Nome fantasia</Label>
            <Input
              id="nome_fantasia"
              name="nome_fantasia"
              defaultValue={cliente?.nome_fantasia ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dominio_codigo_empresa">Código Domínio</Label>
            <Input
              id="dominio_codigo_empresa"
              name="dominio_codigo_empresa"
              defaultValue={cliente?.dominio_codigo_empresa ?? ""}
              placeholder="ex: 1234"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border px-4 py-2">
            <Label htmlFor="ativo" className="cursor-pointer">
              Cliente ativo
            </Label>
            <Switch
              id="ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
              name="ativo"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DocFlow</CardTitle>
          <CardDescription>
            Solicitação automática de documentos
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border px-4 py-2 md:col-span-2">
            <Label htmlFor="solicitar_documentos" className="cursor-pointer">
              Solicitar documentos automaticamente
            </Label>
            <Switch
              id="solicitar_documentos"
              checked={solicitarDocs}
              onCheckedChange={setSolicitarDocs}
              name="solicitar_documentos"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dia_solicitacao">Dia do mês</Label>
            <Input
              id="dia_solicitacao"
              name="dia_solicitacao"
              type="number"
              min={1}
              max={28}
              defaultValue={cliente?.dia_solicitacao ?? 5}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GuiaFlow</CardTitle>
          <CardDescription>Como enviar guias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modo_envio_guias">Modo</Label>
            <select
              id="modo_envio_guias"
              name="modo_envio_guias"
              defaultValue={
                cliente?.modo_envio_guias ?? "individual_automatico"
              }
              className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
            >
              <option value="individual_automatico">
                Individual automático (1 mensagem por guia)
              </option>
              <option value="desativado">Desativado</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="grupo_whatsapp_nome">Grupo WhatsApp (envio assistido)</Label>
            <Input
              id="grupo_whatsapp_nome"
              name="grupo_whatsapp_nome"
              defaultValue={cliente?.grupo_whatsapp_nome ?? ""}
              placeholder="Nome exato do grupo no WhatsApp"
            />
            <p className="text-xs text-muted-foreground">
              Quando preenchido, aparece o botão &quot;Preparar envio em grupo&quot; na fila do
              GuiaFlow. Requer helper local rodando.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        {cliente ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            disabled={pending}
            className="text-destructive hover:text-destructive"
          >
            Apagar
          </Button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </form>
  );
}
