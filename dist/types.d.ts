export interface Wso2ClientConfig {
    baseUrl: string;
    clientId: string;
    // clientSecret: string;
    callbackUrl?: string;
    apiManagerUrl?: string;
    scope?: string;
    rejectUnauthorized?: boolean;
}
export interface AccessTokenResponse {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
    token_type?: string;
}
export interface AuthenticationResult<TUser, TPermissions> {
    tokens: AccessTokenResponse;
    user: TUser;
    permissions?: TPermissions;
}
