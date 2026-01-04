// CONVO Encryption Helper (Mock)
// In a production app, we would use window.crypto.subtle
// with a library like 'libsodium' or 'signal-protocol-javascript'.

export const encryptMessage = (text, key) => {
    // Simple mock: base64 + "enc" suffix
    return btoa(text) + ".convo_enc";
};

export const decryptMessage = (cipher, key) => {
    if (cipher.endsWith(".convo_enc")) {
        return atob(cipher.replace(".convo_enc", ""));
    }
    return cipher; // Return as is if not encrypted
};
