import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  // Em dev (sem app secret), aceita sem verificar
  if (!appSecret) return true;
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace('sha256=', '');
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex'),
    );
  } catch {
    return false;
  }
}
