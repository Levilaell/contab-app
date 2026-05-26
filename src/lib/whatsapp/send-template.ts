import { callGraph, isMockWhatsApp, type WhatsAppOutboundResult } from './cloud-api';
import { getConfig } from '@/lib/config';
import { toE164 } from '@/lib/format';
import { randomBytes } from 'node:crypto';

type TemplateParam = { name: string; value: string };

export async function sendTemplate(opts: {
  to: string;
  templateName: string;
  languageCode?: string;
  params?: TemplateParam[];
  components?: Array<{ type: 'header' | 'body'; parameters: unknown[] }>;
}): Promise<WhatsAppOutboundResult> {
  const to = toE164(opts.to);

  if (isMockWhatsApp()) {
    return {
      ok: true,
      mock: true,
      messageId: `mock_${randomBytes(8).toString('hex')}`,
    };
  }

  const config = await getConfig();
  if (!config.wa_phone_number_id) {
    return { ok: false, error: 'wa_phone_number_id não configurado' };
  }

  const components =
    opts.components ??
    (opts.params && opts.params.length > 0
      ? [
          {
            type: 'body',
            parameters: opts.params.map((p) => ({
              type: 'text',
              parameter_name: p.name,
              text: p.value,
            })),
          },
        ]
      : []);

  try {
    const result = await callGraph<{ messages: Array<{ id: string }> }>(
      `${config.wa_phone_number_id}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: opts.templateName,
            language: { code: opts.languageCode ?? 'pt_BR' },
            components,
          },
        }),
      },
    );
    return { ok: true, messageId: result.messages[0]?.id ?? '' };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function sendText(opts: {
  to: string;
  text: string;
}): Promise<WhatsAppOutboundResult> {
  const to = toE164(opts.to);

  if (isMockWhatsApp()) {
    return {
      ok: true,
      mock: true,
      messageId: `mock_${randomBytes(8).toString('hex')}`,
    };
  }

  const config = await getConfig();
  if (!config.wa_phone_number_id) {
    return { ok: false, error: 'wa_phone_number_id não configurado' };
  }

  try {
    const result = await callGraph<{ messages: Array<{ id: string }> }>(
      `${config.wa_phone_number_id}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: opts.text },
        }),
      },
    );
    return { ok: true, messageId: result.messages[0]?.id ?? '' };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
