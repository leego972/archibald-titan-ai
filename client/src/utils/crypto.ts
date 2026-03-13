const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getKeyMaterial(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await getKeyMaterial(password);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  let totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  let result = new Uint8Array(totalLength);
  let offset = 0;
  for (let b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

export async function encrypt(text: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text)
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const combined = concatBuffers(salt, iv, encryptedBytes);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(data: string, password: string): Promise<string> {
  const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedBytes = combined.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedBytes
  );
  return decoder.decode(decrypted);
}
