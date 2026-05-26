'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { triggerEscrituracao } from './actions';

export function TriggerEscrituracaoButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await triggerEscrituracao();
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          if (r.documentos === 0) {
            toast.info('Nenhum documento pronto pra escriturar');
          } else {
            toast.success(`${r.batches} lote(s), ${r.documentos} documento(s)`);
          }
          router.refresh();
        });
      }}
    >
      <Play className="h-4 w-4" />
      {pending ? 'Processando...' : 'Rodar agora'}
    </Button>
  );
}
