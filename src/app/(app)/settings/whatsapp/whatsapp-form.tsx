'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { saveWhatsApp } from '../actions';

type Props = {
  phoneNumberId: string | null;
  businessAccountId: string | null;
  verifyToken: string | null;
  accessTokenSet: boolean;
  active: boolean;
  webhookUrl: string;
};

export function WhatsAppForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(props.active);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('wa_active', active ? 'true' : 'false');
    startTransition(async () => {
      const r = await saveWhatsApp(fd);
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
          <CardTitle>Webhook</CardTitle>
          <CardDescription>
            Configure no Meta Developer Dashboard apontando pra esta URL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={props.webhookUrl} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(props.webhookUrl);
                toast.success('Copiado');
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa_webhook_verify_token">Verify Token (gerado se vazio)</Label>
            <Input
              id="wa_webhook_verify_token"
              name="wa_webhook_verify_token"
              defaultValue={props.verifyToken ?? ''}
              placeholder="Será preenchido automaticamente"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wa_phone_number_id">Phone Number ID</Label>
            <Input
              id="wa_phone_number_id"
              name="wa_phone_number_id"
              defaultValue={props.phoneNumberId ?? ''}
              placeholder="ex: 123456789012345"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa_business_account_id">Business Account ID</Label>
            <Input
              id="wa_business_account_id"
              name="wa_business_account_id"
              defaultValue={props.businessAccountId ?? ''}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="wa_access_token">
              Access Token{' '}
              {props.accessTokenSet && (
                <span className="text-xs text-muted-foreground">(já configurado, deixe em branco pra manter)</span>
              )}
            </Label>
            <Input
              id="wa_access_token"
              name="wa_access_token"
              type="password"
              placeholder={props.accessTokenSet ? '••••••••••••' : 'EAAxxx...'}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div className="space-y-0.5">
            <Label className="text-base">Integração ativa</Label>
            <p className="text-xs text-muted-foreground">
              Quando inativa, mensagens reais não são enviadas (use MOCK_WHATSAPP em dev)
            </p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
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
