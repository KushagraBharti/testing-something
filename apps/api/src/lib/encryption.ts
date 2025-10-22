
const encoder = new TextEncoder();

const toBase64 = (buffer: ArrayBuffer): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return btoa(binary);
};

const fromBase64 = (value: string): ArrayBuffer => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64');
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const deriveKey = async (secret: string): Promise<CryptoKey> => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

export const encryptSecret = async (plaintext: string, secret: string): Promise<string> => {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoder.encode(plaintext),
  );

  return `${toBase64(iv)}:${toBase64(encrypted)}`;
};

export const decryptSecret = async (payload: string, secret: string): Promise<string> => {
  const [ivB64, cipherB64] = payload.split(':');
  const key = await deriveKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(fromBase64(ivB64)),
    },
    key,
    fromBase64(cipherB64),
  );

  return new TextDecoder().decode(decrypted);
};
