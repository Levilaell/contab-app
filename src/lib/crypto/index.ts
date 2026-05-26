import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY env var não setada');
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY precisa ter 32 bytes (base64)');
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // formato: iv:tag:ciphertext (base64 cada)
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decrypt(payload: string): string {
  if (!payload) return '';
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Payload encriptado inválido');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function tryDecrypt(payload: string | null | undefined): string {
  if (!payload) return '';
  try {
    return decrypt(payload);
  } catch {
    return '';
  }
}
