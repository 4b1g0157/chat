// E2EE Cryptography Utilities using Web Crypto API

// Helper: Convert ArrayBuffer to Base64 String
export function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Helper: Convert Base64 String to ArrayBuffer
export function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Helper: Convert ArrayBuffer to Hex String
export function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// 1. Generate 2048-bit RSA-OAEP Key Pair
export async function generateRsaKeyPair() {
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true, // extractable
        ["encrypt", "decrypt"]
    );
}

// Export Public Key to SPKI (Base64 string)
export async function exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    return arrayBufferToBase64(exported);
}

// Import Public Key from SPKI (Base64 string)
export async function importPublicKey(spkiBase64) {
    const buffer = base64ToArrayBuffer(spkiBase64);
    return await window.crypto.subtle.importKey(
        "spki",
        buffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        true,
        ["encrypt"]
    );
}

// 2. PBKDF2 Key Derivation (Passphrase -> KEK)
export async function deriveKek(passphrase, salt) {
    const encoder = new TextEncoder();
    const passphraseBuffer = encoder.encode(passphrase);
    
    // Import raw passphrase bytes
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        passphraseBuffer,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    
    // Derive AES key
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// 3. Encrypt Private Key (PKCS#8) using Passphrase KEK
export async function encryptPrivateKey(privateKey, passphrase) {
    // Export raw PKCS#8 private key
    const pkcs8Buffer = await window.crypto.subtle.exportKey("pkcs8", privateKey);
    
    // Generate random salt and IV
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Derive KEK
    const kek = await deriveKek(passphrase, salt);
    
    // Encrypt private key with AES-GCM
    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        kek,
        pkcs8Buffer
    );
    
    // Package bundle as JSON
    return JSON.stringify({
        salt: arrayBufferToBase64(salt),
        iv: arrayBufferToBase64(iv),
        ciphertext: arrayBufferToBase64(ciphertext)
    });
}

// 4. Decrypt Private Key using Passphrase
export async function decryptPrivateKey(encryptedKeyJson, passphrase) {
    const bundle = JSON.parse(encryptedKeyJson);
    const salt = base64ToArrayBuffer(bundle.salt);
    const iv = base64ToArrayBuffer(bundle.iv);
    const ciphertext = base64ToArrayBuffer(bundle.ciphertext);
    
    // Derive KEK
    const kek = await deriveKek(passphrase, salt);
    
    // Decrypt PKCS#8 private key
    const pkcs8Buffer = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        kek,
        ciphertext
    );
    
    // Import Private Key object
    return await window.crypto.subtle.importKey(
        "pkcs8",
        pkcs8Buffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        true,
        ["decrypt"]
    );
}

// 5. Encrypt Message using Hybrid Encryption (AES-GCM + RSA-OAEP)
export async function encryptMessage(plaintext, receiverPubSpki, senderPubSpki) {
    // Generate random AES key and IV
    const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const aesIv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt plaintext with AES key
    const encoder = new TextEncoder();
    const plaintextBuffer = encoder.encode(plaintext);
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: aesIv
        },
        aesKey,
        plaintextBuffer
    );
    
    // Export raw AES key to encrypt it with RSA
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    
    // Import public keys
    const receiverPublicKey = await importPublicKey(receiverPubSpki);
    const senderPublicKey = await importPublicKey(senderPubSpki);
    
    // Encrypt AES key using Receiver's RSA Public Key
    const encryptedKeyReceiverBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        receiverPublicKey,
        rawAesKey
    );
    
    // Encrypt AES key using Sender's RSA Public Key
    const encryptedKeySenderBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        senderPublicKey,
        rawAesKey
    );
    
    // Return data package along with the raw AES key and IV (only used by the local Visualizer panel!)
    return {
        payload: {
            ciphertext: arrayBufferToBase64(ciphertextBuffer),
            aes_iv: arrayBufferToBase64(aesIv),
            encrypted_key_receiver: arrayBufferToBase64(encryptedKeyReceiverBuffer),
            encrypted_key_sender: arrayBufferToBase64(encryptedKeySenderBuffer)
        },
        debug: {
            rawAesKeyHex: arrayBufferToHex(rawAesKey),
            rawAesKeyBase64: arrayBufferToBase64(rawAesKey),
            aesIvHex: arrayBufferToHex(aesIv),
            ciphertextHex: arrayBufferToHex(ciphertextBuffer)
        }
    };
}

// 6. Decrypt Message using RSA Private Key & AES-GCM
export async function decryptMessage(ciphertextBase64, aesIvBase64, encryptedKeyBase64, privateKeyObj) {
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);
    const aesIv = base64ToArrayBuffer(aesIvBase64);
    const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
    
    // Decrypt AES key using RSA Private Key
    const rawAesKey = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKeyObj,
        encryptedKey
    );
    
    // Import AES Key
    const aesKey = await window.crypto.subtle.importKey(
        "raw",
        rawAesKey,
        { name: "AES-GCM" },
        true,
        ["decrypt"]
    );
    
    // Decrypt plaintext using AES Key
    const plaintextBuffer = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: aesIv
        },
        aesKey,
        ciphertext
    );
    
    const plaintext = new TextDecoder().decode(plaintextBuffer);
    
    return {
        plaintext: plaintext,
        debug: {
            rawAesKeyHex: arrayBufferToHex(rawAesKey),
            rawAesKeyBase64: arrayBufferToBase64(rawAesKey),
            aesIvHex: arrayBufferToHex(aesIv),
            ciphertextHex: arrayBufferToHex(ciphertext)
        }
    };
}
