'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { reenviarPendentes } from './actions';

export function ReenviarPendentes({ guiaId }: { guiaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await reenviarPendentes(guiaId);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(`${r.count} envio(s) reagendado(s)`);
          router.refresh();
        });
      }}
    >
      <RotateCw className="h-4 w-4" />
      Re-enviar pendentes
    </Button>
  );
}
