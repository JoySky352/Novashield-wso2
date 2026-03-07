# @novashield352/novashield-wso2

**NovaShield** is a powerful, agnostic SDK designed to integrate **WSO2 Identity Server** into Node.js/TypeScript applications following clean architecture principles.

This version (v2.0.0+) introduces significant security improvements, including cryptographic token validation and **optional** PKCE support.

---

## 🚀 Installation

```bash
npm install @novashield352/novashield-wso2
# or
yarn add @novashield352/novashield-wso2
```

---

## ⚙️ Basic Configuration

To get started, you need to configure the client with your WSO2 Service Provider credentials.

```typescript
import { NovashieldAuthClient } from "@novashield352/novashield-wso2";

const config = {
  baseUrl: "https://is.your-domain.com",
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET", // Optional if using public flows
  callbackUrl: "https://your-app.com/callback",
  jwksUrl: "https://is.your-domain.com/oauth2/jwks", // Recommended for token validation
  issuer: "https://is.your-domain.com/oauth2/token",
  rejectUnauthorized: true, // Set to false only in local development
};

// You'll need a Mapper to transform WSO2 data into your user model
const userMapper = {
  fromIdToken: (payload: any) => ({
    id: payload.sub,
    email: payload.email,
    name: payload.preferred_username,
  }),
};

const authClient = new NovashieldAuthClient(config, userMapper);
```

---

## 🔐 Authentication Flows

### 1. Standard Usage (Without PKCE)

Ideal for server-to-server applications or where basic security is sufficient.

**Step A: Redirect to Login**

```typescript
const state = "random-value-to-prevent-csrf";
const loginUrl = authClient.getAuthorizationUrl(state);
// Redirect the user to loginUrl
```

**Step B: Handle the Callback**

```typescript
const { tokens, user } = await authClient.handleCallback(req.query.code);
console.log("Welcome:", user.name);
```

### 2. PKCE Usage (Optional - Recommended)

Recommended for Single Page Applications (SPA) and mobile apps to prevent authorization code interception.

**Step A: Generate Challenge and Verifier**

```typescript
import {
  generateCodeVerifier,
  generateCodeChallenge,
} from "@novashield352/novashield-wso2";

const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);

// IMPORTANT: Save the 'verifier' in the session or a secure cookie before redirecting
session.codeVerifier = verifier;

const authUrl = authClient.getAuthorizationUrl("my-state", challenge);
```

**Step B: Process the Callback with Verifier**

```typescript
const verifier = session.codeVerifier;
const { tokens, user } = await authClient.handleCallback(
  req.query.code,
  verifier,
);
```

---

## 🛠️ Advanced Customization

### Implementing a UserMapperProvider

You can create a class to handle user transformation more robustly.

```typescript
import { UserMapperProvider } from "@novashield352/novashield-wso2";

class MyUserMapper implements UserMapperProvider<MyUserType> {
  fromIdToken(payload: any): MyUserType {
    return {
      uuid: payload.sub,
      email: payload.email,
      roles: payload.groups || [],
    };
  }
}
```

### Permission Management

If your application needs to load additional permissions after login:

```typescript
const permissionProvider = {
  getPermissions: async (user, accessToken) => {
    // Logic to fetch permissions from a DB or API
    return ["READ_DOCS", "WRITE_DOCS"];
  },
};

const authClient = new NovashieldAuthClient(
  config,
  userMapper,
  permissionProvider,
);
```

---

## ⚠️ Error Handling

The library uses an error hierarchy to facilitate exception handling:

- `Wso2AuthenticationError`: General errors in the code exchange process.
- `Wso2TokenError`: The received token is invalid or malformed.
- `Wso2SignatureError`: **Critical.** The JWT cryptographic signature could not be validated.
- `Wso2NetworkError`: Connection issues with the WSO2 server.

```typescript
try {
  await authClient.handleCallback(code);
} catch (error) {
  if (error instanceof Wso2SignatureError) {
    // Possible attack or expired WSO2 certificate
  }
}
```

---

## 📋 Method Summary

| Method                                     | Description                                        |
| ------------------------------------------ | -------------------------------------------------- |
| `getAuthorizationUrl(state, challenge?)`   | Generates the URL to initiate the OIDC flow.       |
| `handleCallback(code, verifier?)`          | Exchanges the code for tokens and user profile.    |
| `getLogoutUrl(idTokenHint, postLogoutUri)` | Generates the logout URL.                          |
| `getAppAccessToken()`                      | Obtains an application token (Client Credentials). |
| `getUserInfo(accessToken)`                 | Queries the WSO2 `/scim2/Me` endpoint.             |

---

Developed with ❤️ by the **NovaShield** team.
