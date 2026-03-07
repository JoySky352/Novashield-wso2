# @novashield352/novashield-wso2 (v2.0.0)

The **NovaShield** SDK is a powerful, agnostic tool for integrating **WSO2 Identity Server** with clean architectures. Version **2.0.0 (Security Core)** raises the security standard by implementing cryptographic validation and compliance with modern standards (SPAs/Mobile).

## 🛡️ What's New in v2 (Proactive Security)

1.  **JWT Signature Validation (JWKS)**: No longer blindly trusts the token payload. The SDK connects to WSO2 and automatically verifies cryptographic token signatures.
2.  **Native PKCE Support**: Includes `code_verifier` and `code_challenge` (S256) generators to protect applications against code interception.
3.  **Custom Error Hierarchy**: Granular errors like `Wso2AuthenticationError`, `Wso2TokenError`, and `Wso2SignatureError` for precise exception handling.
4.  **OIDC Compliance**: Extended support for verifiable issuers (`iss`) and audiences (`aud`).

## Installation

```bash
yarn add @novashield352/novashield-wso2
# Or via npm
npm install @novashield352/novashield-wso2
```

## Extended Configuration (v2)

To enable signature validation, configuring the `jwksUrl` is essential.

```typescript
const config = {
  baseUrl: "https://is-dev.novabank.global",
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET",
  callbackUrl: "http://localhost:5173/callback",
  jwksUrl: "https://is-dev.novabank.global/oauth2/jwks",
  issuer: "https://is-dev.novabank.global/oauth2/token",
  rejectUnauthorized: false,
};
```

## Using the v2 Flow with PKCE

If you're building a modern application that requires the highest level of security:

### 1. Generate Redirect URL (with PKCE)

```typescript
import {
  NovashieldAuthClient,
  generateCodeVerifier,
  generateCodeChallenge,
} from "@novashield352/novashield-wso2";

const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);

session.codeVerifier = verifier;

const authUrl = wso2Client.getAuthorizationUrl("secure_state", challenge);
```

### 2. Process the Callback

```typescript
try {
  const { user, tokens } = await wso2Client.handleCallback(
    req.query.code,
    session.codeVerifier, // Pass the verifier here
  );

  // In v2, if jwksUrl is configured, the id_token signature has already been validated.
  console.log("Access granted to:", user.name);
} catch (error) {
  if (error instanceof Wso2SignatureError) {
    console.error("SECURITY ALERT: Token with invalid signature.");
  }
}
```

## Architectural Benefits

1.  **Typed Generics (`TUser`, `TPermissions`)**: Adaptable to any domain model.
2.  **Network Abstraction**: Separates the "dirty work" of HTTPS requests and Base64 decoding from your business logic.
3.  **Strategy Providers**: Inject your own `UserMapperProvider` to decide how to map WSO2 claims to your local user.

---

Developed with ❤️ by the **NovaShield** team.
