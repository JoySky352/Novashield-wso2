import { webcrypto } from "node:crypto";

/**
 * Generates a random code verifier for PKCE.
 * @param length Length of the verifier (43-128 characters)
 */
export function generateCodeVerifier(length = 64): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = new Uint8Array(length);
    webcrypto.getRandomValues(values);
    return Array.from(values)
        .map((x) => charset[x % charset.length])
        .join('');
}

/**
 * Generates a SHA-256 code challenge from a code verifier.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);

    const base64 = Buffer.from(hashBuffer).toString('base64');
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
