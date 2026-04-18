import { invoke } from '@tauri-apps/api/core';

export type RustEncryptedMessage = {
  message_type: number;
  body: number[];
};

export type RustPrekeyBundle = {
  registrationId: number;
  identityKey: string;
  signedPrekey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePrekey?: {
    keyId: number;
    publicKey: string;
  };
  kyberPrekey?: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
};

export type RustRegistrationKeys = {
  registrationId: number;
  identityPublicKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
};

export type RustUploadPrekeys = {
  registrationId: number;
  identityPublicKey: string;
  signedPrekey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePrekeys: Array<{
    keyId: number;
    publicKey: string;
  }>;
  kyberPrekey?: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
};

export class RustSignalRuntime {
  async setCurrentUser(userId: string): Promise<void> {
    await invoke('set_current_user_command', { userId });
  }

  async initializeIdentity(): Promise<void> {
    await invoke('initialize_identity_command');
  }

  async getRegistrationKeys(): Promise<RustRegistrationKeys> {
    const raw = await invoke<{
      registration_id: number;
      identity_public_key: string;
      signed_pre_key: string;
      signed_pre_key_signature: string;
    }>('get_registration_keys_command');
    return {
      registrationId: raw.registration_id,
      identityPublicKey: raw.identity_public_key,
      signedPreKey: raw.signed_pre_key,
      signedPreKeySignature: raw.signed_pre_key_signature,
    };
  }

  async getLocalPrekeyUploadPackage(): Promise<RustUploadPrekeys> {
    const raw = await invoke<{
      registration_id: number;
      identity_public_key: string;
      signed_prekey: { key_id: number; public_key: string; signature: string };
      one_time_prekeys: Array<{ key_id: number; public_key: string }>;
      kyber_prekey?: { key_id: number; public_key: string; signature: string };
    }>('get_prekey_bundle_command');
    return {
      registrationId: raw.registration_id,
      identityPublicKey: raw.identity_public_key,
      signedPrekey: {
        keyId: raw.signed_prekey.key_id,
        publicKey: raw.signed_prekey.public_key,
        signature: raw.signed_prekey.signature,
      },
      oneTimePrekeys: raw.one_time_prekeys.map((item) => ({
        keyId: item.key_id,
        publicKey: item.public_key,
      })),
      kyberPrekey: raw.kyber_prekey
        ? {
            keyId: raw.kyber_prekey.key_id,
            publicKey: raw.kyber_prekey.public_key,
            signature: raw.kyber_prekey.signature,
          }
        : undefined,
    };
  }

  async establishSession(
    recipientId: string,
    recipientDeviceId: string,
    prekeyBundle: RustPrekeyBundle,
  ): Promise<boolean> {
    return await invoke('establish_session_command', {
      recipientId,
      recipientDeviceId,
      prekeyBundle: {
        registration_id: prekeyBundle.registrationId,
        identity_key: prekeyBundle.identityKey,
        signed_prekey: {
          key_id: prekeyBundle.signedPrekey.keyId,
          public_key: prekeyBundle.signedPrekey.publicKey,
          signature: prekeyBundle.signedPrekey.signature,
        },
        one_time_prekey: prekeyBundle.oneTimePrekey
          ? {
              key_id: prekeyBundle.oneTimePrekey.keyId,
              public_key: prekeyBundle.oneTimePrekey.publicKey,
            }
          : undefined,
        kyber_prekey: prekeyBundle.kyberPrekey
          ? {
              key_id: prekeyBundle.kyberPrekey.keyId,
              public_key: prekeyBundle.kyberPrekey.publicKey,
              signature: prekeyBundle.kyberPrekey.signature,
            }
          : undefined,
      },
    });
  }

  async encryptMessage(
    recipientId: string,
    recipientDeviceId: string,
    plaintext: string,
  ): Promise<RustEncryptedMessage> {
    return await invoke('encrypt_message_command', {
      recipientId,
      recipientDeviceId,
      plaintext,
    });
  }

  async decryptMessage(
    senderId: string,
    senderDeviceId: string,
    encrypted: RustEncryptedMessage,
  ): Promise<string> {
    return await invoke('decrypt_message_command', {
      senderId,
      senderDeviceId,
      encrypted,
    });
  }
}

function uint8ArrayToBase64(arr: Uint8Array): string {
  const binary = Array.from(arr, byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeRustEnvelope(encrypted: RustEncryptedMessage): string {
  const normalized = {
    v: 1,
    impl: 'rust',
    mt: encrypted.message_type,
    body: uint8ArrayToBase64(new Uint8Array(encrypted.body)),
  };
  return JSON.stringify(normalized);
}

export function decodeRustEnvelope(payload: string): RustEncryptedMessage | null {
  try {
    const parsed = JSON.parse(payload);
    if (parsed?.impl !== 'rust' || typeof parsed?.mt !== 'number' || typeof parsed?.body !== 'string') {
      return null;
    }
    return {
      message_type: parsed.mt,
      body: Array.from(base64ToUint8Array(parsed.body)),
    };
  } catch {
    return null;
  }
}
