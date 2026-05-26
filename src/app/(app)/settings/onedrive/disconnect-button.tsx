'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { disconnectOneDrive } from '../actions';

export function DisconnectButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm('Desconectar OneDrive? Novos uploads pararão até reconectar.')) return;
        startTransition(async () => {
          const r = await disconnectOneDrive();
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success('Desconectado');
          router.refresh();
        });
      }}
    >
      {pending ? 'Desconectando...' : 'Desconectar'}
    </Button>
  );
}
