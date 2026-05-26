import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getConfig } from '@/lib/config';
import { WhatsAppForm } from './whatsapp-form';

export const dynamic = 'force-dynamic';

export default async function WhatsAppSettingsPage() {
  const config = await getConfig(true);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Cloud API</h1>
        <p className="text-sm text-muted-foreground">
          Configure o webhook e credenciais Meta
        </p>
      </div>

      <WhatsAppForm
        phoneNumberId={config.wa_phone_number_id}
        businessAccountId={config.wa_business_account_id}
        verifyToken={config.wa_webhook_verify_token}
        accessTokenSet={!!config.wa_access_token_encrypted}
        active={config.wa_active}
        webhookUrl={`${appUrl}/api/webhook/whatsapp`}
      />
    </div>
  );
}
