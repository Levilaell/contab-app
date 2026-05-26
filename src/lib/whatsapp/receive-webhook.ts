import { createServiceClient } from '@/lib/supabase/service';
import { downloadMedia } from './download-media';
import { sendText } from './send-template';
import { toE164 } from '@/lib/format';

export type WhatsAppMessage = {
  id: string;
  from: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | string;
  timestamp?: string;
  text?: { body: string };
  document?: { id: string; mime_type: string; filename?: string };
  image?: { id: string; mime_type: string; sha256?: string };
  audio?: { id: string; mime_type: string };
};

export type WhatsAppStatus = {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code: number; title: string }>;
};

type Contact = {
  id: string;
  external_client_id: string;
  nome: string;
};

async function findContactByPhone(phone: string): Promise<Contact | null> {
  const sb = createServiceClient();
  const e164 = toE164(phone);
  const variants = Array.from(
    new Set([phone, e164, e164.replace(/^55/, ''), phone.replace(/^55/, '')]),
  );
  const { data } = await sb
    .from('external_client_contacts')
    .select('id, external_client_id, nome')
    .in('whatsapp', variants)
    .limit(1)
    .maybeSingle();
  return (data as Contact | null) ?? null;
}

export async function processReceivedMessage(message: WhatsAppMessage) {
  const sb = createServiceClient();
  const fromPhone = message.from;
  const contact = await findContactByPhone(fromPhone);

  // 1. Histórico
  await sb.from('bot_messages').insert({
    remetente_phone: fromPhone,
    external_client_id: contact?.external_client_id ?? null,
    direcao: 'recebida',
    tipo: message.type,
    conteudo: message.text?.body ?? message.document?.filename ?? null,
    wa_message_id: message.id,
  });

  // 2. Marca solicitações enviadas como respondidas
  if (contact) {
    await sb
      .from('solicitacoes_documentos')
      .update({
        status: 'respondida',
        respondida_at: new Date().toISOString(),
      })
      .eq('contact_id', contact.id)
      .eq('status', 'enviada')
      .is('respondida_at', null);

    // 3. Cancela envios de guia pendentes/agendados deste contato
    await sb
      .from('guia_envios')
      .update({
        status: 'cancelado',
        cancelado_motivo: 'cliente_respondeu',
        respondido_at: new Date().toISOString(),
      })
      .eq('contact_id', contact.id)
      .eq('status', 'pendente');
  }

  // 4. Se for documento/imagem, processa
  if (message.type === 'document' || message.type === 'image') {
    await processDocument(message, contact);
  }
}

async function processDocument(message: WhatsAppMessage, contact: Contact | null) {
  const sb = createServiceClient();
  const media = message.document ?? message.image;
  if (!media) return;

  const mediaId = media.id;
  const mimeType = media.mime_type;
  const filename = ('filename' in media && media.filename) || `media_${mediaId}`;

  try {
    const { buffer } = await downloadMedia(mediaId);

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${Date.now()}_${safeName}`;

    const { error: uploadError } = await sb.storage
      .from('documentos')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
       
      console.error('upload error', uploadError);
      return;
    }

    const { data: doc, error: insertError } = await sb
      .from('documentos')
      .insert({
        external_client_id: contact?.external_client_id ?? null,
        contact_id: contact?.id ?? null,
        remetente_phone: message.from,
        remetente_nome: contact?.nome ?? null,
        wa_message_id: message.id,
        storage_path: storagePath,
        mime_type: mimeType,
        filename_original: filename,
        file_size_bytes: buffer.byteLength,
        status: 'recebido',
      })
      .select('id')
      .single();

    if (insertError || !doc) {
       
      console.error('doc insert error', insertError);
      return;
    }

    const { classifyDocument } = await import('@/lib/ia/classify-documento');
    classifyDocument((doc as { id: string }).id).catch((err) =>
       
      console.error('classify error', err),
    );
  } catch (error) {
     
    console.error('processDocument error', error);
    if (contact) {
      await sendText({
        to: message.from,
        text: 'Recebi seu arquivo, mas tive um problema baixando. Pode mandar de novo?',
      });
    }
  }
}

export async function processStatusUpdate(status: WhatsAppStatus) {
  const sb = createServiceClient();
  const messageId = status.id;
  if (!messageId) return;

  const patch: Record<string, unknown> = { status: status.status };
  if (status.status === 'delivered') patch.entregue_at = new Date().toISOString();
  if (status.status === 'read') patch.lido_at = new Date().toISOString();
  if (status.status === 'failed') {
    patch.status = 'erro';
    patch.erro_mensagem = status.errors?.[0]?.title ?? 'falha na entrega';
  }

  await sb.from('guia_envios').update(patch).eq('wa_message_id', messageId);

  if (status.status === 'failed') {
    await sb
      .from('solicitacoes_documentos')
      .update({
        status: 'erro',
        erro_mensagem: status.errors?.[0]?.title ?? 'falha na entrega',
      })
      .eq('wa_message_id', messageId);
  }
}
