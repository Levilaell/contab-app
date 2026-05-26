'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatDateTimeBR } from '@/lib/format';
import { saveDominio } from '../actions';

type Props = {
  integrationId: string | null;
  apiKeySet: boolean;
  active: boolean;
  watchFolderPath: string | null;
  watchActive: boolean;
  lastScanAt: string | null;
};

export function DominioForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(props.active);
  const [watchActive, setWatchActive] = useState(props.watchActive);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('dominio_active', active ? 'true' : 'false');
    fd.set('dominio_watch_active', watchActive ? 'true' : 'false');
    startTransition(async () => {
      const r = await saveDominio(fd);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Salvo');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API REST de escrituração</CardTitle>
          <CardDescription>
            Credenciais usadas para enviar lotes de NFe automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dominio_integration_id">Integration ID</Label>
            <Input
              id="dominio_integration_id"
              name="dominio_integration_id"
              defaultValue={props.integrationId ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dominio_api_key">
              API Key{' '}
              {props.apiKeySet && (
                <span className="text-xs text-muted-foreground">(configurado)</span>
              )}
            </Label>
            <Input
              id="dominio_api_key"
              name="dominio_api_key"
              type="password"
              placeholder={props.apiKeySet ? '••••••' : 'sk_...'}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border px-4 py-2 md:col-span-2">
            <Label>Integração ativa</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Watch folder (GuiaFlow)</CardTitle>
          <CardDescription>
            Pasta do OneDrive onde o Domínio salva as guias PDF
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dominio_watch_folder_path">Caminho da pasta</Label>
            <Input
              id="dominio_watch_folder_path"
              name="dominio_watch_folder_path"
              defaultValue={props.watchFolderPath ?? ''}
              placeholder="/Contabilliza/Guias-Domínio"
            />
          </div>
          {props.lastScanAt && (
            <p className="text-xs text-muted-foreground">
              Última varredura: {formatDateTimeBR(props.lastScanAt)}
            </p>
          )}
          <div className="flex items-center justify-between rounded-md border px-4 py-2">
            <Label>Scan automático (hourly)</Label>
            <Switch checked={watchActive} onCheckedChange={setWatchActive} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
