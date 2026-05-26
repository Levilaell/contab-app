'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { triggerAgendar, triggerEnvio } from './actions';

export function TriggerButtons() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const r = await triggerAgendar();
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            toast.success(`${r.agendadas} solicitação(ões) agendada(s)`);
            router.refresh();
          });
        }}
      >
        <CalendarClock className="h-4 w-4" />
        Agendar agora
      </Button>
      <Button
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const r = await triggerEnvio();
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            toast.success(`${r.enviadas} enviada(s), ${r.erros} erro(s)`);
            router.refresh();
          });
        }}
      >
        <Send className="h-4 w-4" />
        Enviar pendentes
      </Button>
    </div>
  );
}
