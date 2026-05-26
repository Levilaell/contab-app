import Link from 'next/link';
import { ChevronLeft, Cloud, CheckCircle2 } from 'lucide-react';
import { getConfig } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DisconnectButton } from './disconnect-button';

export const dynamic = 'force-dynamic';

export default async function OneDriveSettingsPage() {
  const config = await getConfig(true);
  const isMock = process.env.MOCK_ONEDRIVE === 'true';

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para configurações
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">OneDrive (Microsoft)</h1>
        <p className="text-sm text-muted-foreground">
          Storage final para documentos classificados
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Conexão
          </CardTitle>
          <CardDescription>
            {isMock
              ? 'Mock ativo: uploads são simulados'
              : 'OAuth com sua conta Microsoft pessoal/business'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.onedrive_active ? (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Conectado{config.onedrive_user_id && ` como ${config.onedrive_user_id}`}
              </div>
              <DisconnectButton />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Você ainda não conectou o OneDrive. Documentos não serão arquivados até conectar.
              </p>
              <Button render={<a href="/api/oauth/onedrive/start" />}>
                Conectar OneDrive
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estrutura de pastas</CardTitle>
          <CardDescription>
            Documentos são organizados automaticamente assim:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto">
{`/Contabilliza/
  └── [Razão Social]/
        └── [AAAA-MM]/
              ├── NFe/
              ├── NFSe/
              ├── Comprovante/
              └── Outros/`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
