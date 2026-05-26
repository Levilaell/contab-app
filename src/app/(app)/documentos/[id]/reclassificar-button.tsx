'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { reclassificar } from './actions';

export function ReclassificarButton({ documentoId }: { documentoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await reclassificar(documentoId);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success('Reclassificado');
          router.refresh();
        });
      }}
    >
      <Sparkles className="h-4 w-4" />
      {pending ? 'Classificando...' : 'Reclassificar com IA'}
    </Button>
  );
}
