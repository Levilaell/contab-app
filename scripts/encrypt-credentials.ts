/**
 * CLI: criptografa um valor com a ENCRYPTION_KEY do .env.local
 * usage: pnpm encrypt
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { encrypt } from '../src/lib/crypto';
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('valor a criptografar: ', (val) => {
  try {
    const out = encrypt(val);
    console.log('\nencrypted:', out);
  } catch (e) {
    console.error(e);
  }
  rl.close();
});
