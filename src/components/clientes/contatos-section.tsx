'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatPhone } from '@/lib/format';
import type { ExternalClientContact } from '@/lib/types';
import {
  addContact,
  updateContact,
  deleteContact,
} from '@/app/(app)/clientes/actions';

type Props = {
  externalClientId: string;
  contatos: ExternalClientContact[];
};

export function ContatosSection({ externalClientId, contatos }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contatos</CardTitle>
        <ContatoDialog externalClientId={externalClientId} />
      </CardHeader>
      <CardContent>
        {contatos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum contato. Adiciona o primeiro pra começar a receber documentos e guias.
          </p>
        ) : (
          <ul className="space-y-2">
            {contatos.map((c) => (
              <ContatoRow key={c.id} contato={c} externalClientId={externalClientId} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ContatoRow({
  contato,
  externalClientId,
}: {
  contato: ExternalClientContact;
  externalClientId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Apagar contato ${contato.nome}?`)) return;
    startTransition(async () => {
      const result = await deleteContact(contato.id, externalClientId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Contato apagado');
      router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="space-y-1">
        <div className="font-medium text-sm">{contato.nome}</div>
        <div className="text-xs text-muted-foreground">
          {formatPhone(contato.whatsapp)} · {contato.papel}
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          {contato.receber_guias && <Tag>guias</Tag>}
          {contato.receber_solicitacoes && <Tag>solicitações</Tag>}
          {!contato.ativo && <Tag muted>inativo</Tag>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <ContatoDialog
          externalClientId={externalClientId}
          contato={contato}
          trigger={
            <Button variant="ghost" size="icon">
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={pending}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}

function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={
        muted
          ? 'rounded bg-muted px-1.5 py-0.5 text-muted-foreground'
          : 'rounded bg-accent px-1.5 py-0.5 text-accent-foreground'
      }
    >
      {children}
    </span>
  );
}

function ContatoDialog({
  externalClientId,
  contato,
  trigger,
}: {
  externalClientId: string;
  contato?: ExternalClientContact;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [ativo, setAtivo] = useState(contato?.ativo ?? true);
  const [receberGuias, setReceberGuias] = useState(contato?.receber_guias ?? true);
  const [receberSolicitacoes, setReceberSolicitacoes] = useState(
    contato?.receber_solicitacoes ?? false,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('ativo', ativo ? 'true' : 'false');
    fd.set('receber_guias', receberGuias ? 'true' : 'false');
    fd.set('receber_solicitacoes', receberSolicitacoes ? 'true' : 'false');

    startTransition(async () => {
      const result = contato
        ? await updateContact(contato.id, externalClientId, fd)
        : await addContact(externalClientId, fd);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(contato ? 'Contato atualizado' : 'Contato adicionado');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Novo contato
            </button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contato ? 'Editar contato' : 'Novo contato'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                name="nome"
                required
                defaultValue={contato?.nome}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                required
                defaultValue={contato?.whatsapp}
                placeholder="11999999999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="papel">Papel</Label>
              <Input
                id="papel"
                name="papel"
                defaultValue={contato?.papel ?? 'outro'}
                placeholder="ex: dono, financeiro"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={contato?.email ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ordem">Ordem</Label>
              <Input
                id="ordem"
                name="ordem"
                type="number"
                defaultValue={contato?.ordem ?? 0}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Toggle
              label="Contato ativo"
              checked={ativo}
              onChange={setAtivo}
            />
            <Toggle
              label="Recebe guias"
              checked={receberGuias}
              onChange={setReceberGuias}
            />
            <Toggle
              label="Recebe solicitações mensais"
              checked={receberSolicitacoes}
              onChange={setReceberSolicitacoes}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-1.5">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
