'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { retentarEscrituracao } from './actions';

export function EscriturarButton({ documentoId }: { documentoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await retentarEscrituracao(documentoId);
          if (!r.ok) {
            toast.error('Erro');
            return;
          }
          toast.success('Reagendado pra escrituração');
          router.refresh();
        });
      }}
    >
      <RotateCw className="h-4 w-4" />
      Re-tentar escrituração
    </Button>
  );
}
