# @novashield352/novashield-wso2 (v2.0.0)

El SDK de **NovaShield** es una herramienta potente y agnóstica para integrar **WSO2 Identity Server** con arquitecturas limpias. La versión **2.0.0 (Security Core)** eleva el estándar de seguridad implementando validación criptográfica y cumplimiento de estándares modernos (SPAs/Mobile).

## 🛡️ Novedades v2 (Seguridad Proactiva)

1.  **Validación de Firmas JWT (JWKS)**: Ya no se confía ciegamente en el payload del token. El SDK se conecta a WSO2 y verifica las firmas criptográficas de los tokens automáticamente.
2.  **Soporte Nativo PKCE**: Incluye generadores de `code_verifier` y `code_challenge` (S256) para proteger aplicaciones contra interceptación de códigos.
3.  **Jerarquía de Errores Custom**: Errores granulares como `Wso2AuthenticationError`, `Wso2TokenError` y `Wso2SignatureError` para un manejo de excepciones preciso.
4.  **OIDC Compliance**: Soporte extendido para emisores (`iss`) y audiencias (`aud`) verificables.

## Instalación

```bash
yarn add @novashield352/novashield-wso2
# O vía npm
npm install @novashield352/novashield-wso2
```

## Configuración Extendida (v2)

Para habilitar la validación de firmas, es vital configurar el `jwksUrl`.

```typescript
const config = {
  baseUrl: "https://is-dev.novabank.global",
  clientId: "YOUR_CLIENT_ID",
  clientSecret: "YOUR_CLIENT_SECRET", // Opcional si solo usas PKCE
  callbackUrl: "http://localhost:5173/callback",
  jwksUrl: "https://is-dev.novabank.global/oauth2/jwks", // Requerido para validación v2
  issuer: "https://is-dev.novabank.global/oauth2/token", // Requerido para verificación 'iss'
  rejectUnauthorized: false,
};
```

## Uso del Flujo v2 con PKCE

Si estás construyendo una aplicación moderna que requiere el máximo nivel de seguridad:

### 1. Generar URL de Redirección (con PKCE)

```typescript
import {
  NovashieldAuthClient,
  generateCodeVerifier,
  generateCodeChallenge,
} from "@novashield352/novashield-wso2";

const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);

// Importante: Guarda el verifier en la sesión del usuario para el siguiente paso
session.codeVerifier = verifier;

const authUrl = wso2Client.getAuthorizationUrl("secure_state", challenge);
```

### 2. Procesar el Callback

```typescript
try {
  const { user, tokens } = await wso2Client.handleCallback(
    req.query.code,
    session.codeVerifier, // Pasa el verifier aquí
  );

  // En v2, si jwksUrl está configurado, la firma del id_token ya fue validada.
  console.log("Acceso concedido a:", user.name);
} catch (error) {
  if (error instanceof Wso2SignatureError) {
    console.error("ALERTA DE SEGURIDAD: Token con firma inválida.");
  }
}
```

## Beneficios de Arquitectura

1.  **Genéricos Tipados (`TUser`, `TPermissions`)**: Adaptable a cualquier modelo de dominio.
2.  **Abstracción de Red**: Separa la "suciedad" de las peticiones HTTPS y decodificaciones Base64 de tu lógica de negocio.
3.  **Proveedores de Estrategia**: Inyecta tu propio `UserMapperProvider` para decidir cómo mapear los claims de WSO2 a tu usuario local.

---

Desarrollado con ❤️ por el equipo de **NovaShield**.
