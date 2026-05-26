import { ClienteForm } from '@/components/clientes/cliente-form';

export default function NovoClientePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
        <p className="text-sm text-muted-foreground">Cadastre um novo cliente.</p>
      </div>
      <ClienteForm />
    </div>
  );
}
