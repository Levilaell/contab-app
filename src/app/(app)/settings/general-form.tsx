'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { saveGeneral } from './actions';

export function GeneralForm({
  nomeEscritorio,
  contactEmail,
}: {
  nomeEscritorio: string;
  contactEmail: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await saveGeneral(fd);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Salvo');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geral</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome_escritorio">Nome do escritório</Label>
              <Input
                id="nome_escritorio"
                name="nome_escritorio"
                required
                defaultValue={nomeEscritorio}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email de contato</Label>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                defaultValue={contactEmail ?? ''}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
