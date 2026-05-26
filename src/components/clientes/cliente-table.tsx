'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCNPJ } from '@/lib/format';
import type { ExternalClient } from '@/lib/types';

export function ClienteTable({ clientes }: { clientes: ExternalClient[] }) {
  if (clientes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum cliente cadastrado. Importa um CSV ou cria o primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Razão social</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Cód. Domínio</TableHead>
            <TableHead>Solicita docs</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((c) => (
            <TableRow key={c.id} className="cursor-pointer">
              <TableCell>
                <Link
                  href={`/clientes/${c.id}`}
                  className="font-medium hover:underline"
                >
                  {c.razao_social}
                </Link>
                {c.nome_fantasia && (
                  <div className="text-xs text-muted-foreground">{c.nome_fantasia}</div>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{formatCNPJ(c.cnpj)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.dominio_codigo_empresa || '—'}
              </TableCell>
              <TableCell>
                {c.solicitar_documentos ? (
                  <span className="text-sm">dia {c.dia_solicitacao}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">desativado</span>
                )}
              </TableCell>
              <TableCell>
                {c.ativo ? (
                  <Badge variant="secondary">Ativo</Badge>
                ) : (
                  <Badge variant="outline">Inativo</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
