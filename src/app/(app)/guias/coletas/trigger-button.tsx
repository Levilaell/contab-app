'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { triggerColeta } from './actions';

export function TriggerColetaButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await triggerColeta();
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(`${r.arquivos} arquivos, ${r.guias} guias, ${r.orfas} órfãs`);
          router.refresh();
        });
      }}
    >
      <Play className="h-4 w-4" />
      {pending ? 'Rodando...' : 'Nova coleta manual'}
    </Button>
  );
}
