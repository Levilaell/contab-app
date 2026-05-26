'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sincronizarOneDrive } from './actions';

export function SyncOneDriveButton({ documentoId }: { documentoId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await sincronizarOneDrive(documentoId);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success('Sincronizado');
          router.refresh();
        });
      }}
    >
      <Cloud className="h-4 w-4" />
      {pending ? 'Sincronizando...' : 'Sincronizar OneDrive'}
    </Button>
  );
}
