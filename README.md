# @novashield352/novashield-wso2

Este es el SDK oficial de **NovaShield** diseñado para manejar la integración con **WSO2 Identity Server** utilizando metodologías de arquitectura limpia. Es completamente agnóstico al framework subyacente (Express, NestJS, FastAPI backend, etc.).

## Instalación

```bash
npm install @novashield352/novashield-wso2
```

## Beneficios

1. **Genéricos Tipados (`TUser`, `TPermissions`)**: Ya no estás atado a una interfaz estricta. El módulo se adapta a tu modelo de dominio pasándole tus propias interfaces TypeScript.
2. **Inyección de Dependencias**: Sigue los principios SOLID separando la responsabilidad de Mapeo de Usuario (`UserMapperProvider`) y Resolución de Permisos (`PermissionProvider`).
3. **Manejo Centralizado de Tokens**: Abstrae completamente los Access Tokens de WSO2, el token de Client Credentials (`AppAccessToken`) y el manejo de sesiones en JWT firmados.

## Uso Avanzado en tu Framework (Ej. NestJS o Express)

### Paso 1: Crea tus modelos e Inyectores de Dependencia

El SDK delega a tu aplicación definir qué es un usuario. Implementa las interfaces provistas:

```typescript
import {
  UserMapperProvider,
  PermissionProvider,
} from "@novashield352/novashield-wso2";

// Tus interfaces locales
export interface MyUserShape {
  id: string;
  email: string;
  groups: string[];
}
export interface MyPermissionsShape {
  posIds: string[];
  orgIds: string[];
}

export class Wso2UserMapper implements UserMapperProvider<MyUserShape> {
  fromIdToken(idTokenPayload: any): MyUserShape {
    return {
      id: idTokenPayload.sub,
      email: idTokenPayload.email,
      groups: idTokenPayload.groups || [],
    };
  }

  fromUserInfo(userInfo: any): MyUserShape {
    /*...*/
  }
}

export class Wso2PermissionProvider implements PermissionProvider<
  MyUserShape,
  MyPermissionsShape
> {
  // Aquí puedes inyectar tus repositorios locales, llamadas de BD o APIs
  async getPermissions(
    user: MyUserShape,
    accessToken: string,
  ): Promise<MyPermissionsShape> {
    // Ejemplo: buscar roles en AM
    return { posIds: [], orgIds: [] };
  }
}
```

### Paso 2: Inicializa el Cliente

```typescript
import { NovashieldAuthClient } from "@novashield352/novashield-wso2";

const config = {
  baseUrl: process.env.IS_URL,
  clientId: process.env.IS_CLIENT_KEY,
  clientSecret: process.env.IS_CLIENT_SECRET,
  callbackUrl: process.env.IS_SPA_CALLBACK_URL,
  rejectUnauthorized: false,
};

const wso2Client = new NovashieldAuthClient<MyUserShape, MyPermissionsShape>(
  config,
  new Wso2UserMapper(),
  new Wso2PermissionProvider(), // Opcional
);
```

### Paso 3: Úsalo en tus controladores

```typescript
// En vez de tener lógica acoplada de axios en tus controladores:

// Generar URL de Redirección (SSO Login)
const authUrl = wso2Client.getAuthorizationUrl("some_secure_state");

// Procesar el Callback (OIDC Exchange)
const { user, tokens, permissions } = await wso2Client.handleCallback(
  req.query.code,
);

// Llamada server-to-server (App Token)
const ccToken = await wso2Client.getAppAccessToken();
```

Esto separa la suciedad de la red HTTPS, validación de schemas de WSO2 y decodificación base64, dejándote con una Lógica de Aplicación pura y profesional.
