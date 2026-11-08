/**
 * PIN-locks a journal entry with AES-GCM; the key comes from the PIN via PBKDF2.
 * This keeps cache locations private from someone browsing the phone or a backup file.
 * A short numeric PIN can be brute-forced by a determined attacker with the data: use 6+ characters.
 */
import type { Sealed } from '../db/types';

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const PBKDF2_ITERATIONS = 250000;

async function key(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(value: unknown, pin: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pin, salt), enc.encode(JSON.stringify(value)));
  return { salt: b64(salt), iv: b64(iv), data: b64(data) };
}

/** Throws if the PIN is wrong. */
export async function unseal<T>(s: Sealed, pin: string): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, await key(pin, unb64(s.salt)), unb64(s.data));
  return JSON.parse(dec.decode(plain)) as T;
}
