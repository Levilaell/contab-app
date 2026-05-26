'use client';

import { useRef, useState, useTransition } from 'react';
import { Upload } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { importClientesCSV } from '@/app/(app)/clientes/actions';

export function CSVImporter() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleFile() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        startTransition(async () => {
          const r = await importClientesCSV(result.data);
          if (r.created > 0) {
            toast.success(`${r.created} clientes importados`);
          }
          if (r.errors.length > 0) {
            toast.error(`${r.errors.length} erros — checa o console`);
             
            console.error('CSV import errors:', r.errors);
          }
          setOpen(false);
          if (inputRef.current) inputRef.current.value = '';
          router.refresh();
        });
      },
      error: () => toast.error('Erro lendo CSV'),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Upload className="h-4 w-4" />
            Importar CSV
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar clientes via CSV</DialogTitle>
          <DialogDescription>
            Colunas esperadas: <code>cnpj</code>, <code>razao_social</code>,{' '}
            <code>nome_fantasia</code> (opcional), <code>dominio_codigo_empresa</code> (opcional).
            CNPJs existentes serão atualizados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleFile} disabled={pending}>
            {pending ? 'Importando...' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
