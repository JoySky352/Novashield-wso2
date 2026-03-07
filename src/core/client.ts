import axios, { AxiosInstance } from "axios";
import https from "https";
import dayjs from "dayjs";
import * as jose from "jose";
import { AccessTokenResponse, AuthenticationResult, Wso2ClientConfig } from "../types";
import { UserMapperProvider } from "../providers/user-mapper.provider";
import { PermissionProvider } from "../providers/permission.provider";
import {
    Wso2AuthenticationError,
    Wso2NetworkError,
    Wso2SignatureError,
    Wso2TokenError
} from "../errors";

/**
 * NovashieldAuthClient v2
 * Standard OIDC Client with PKCE and JWT Signature Validation
 */
export class NovashieldAuthClient<TUser = any, TPermissions = any> {
    private httpClient: AxiosInstance;
    private jwksRemote: any | null = null;

    private appAccessToken: string | null = null;
    private appExpiresAt: dayjs.Dayjs | null = null;

    constructor(
        private readonly config: Wso2ClientConfig,
        private readonly userMapper: UserMapperProvider<TUser>,
        private readonly permissionProvider?: PermissionProvider<TUser, TPermissions>
    ) {
        this.httpClient = axios.create({
            baseURL: this.config.baseUrl,
            httpsAgent: new https.Agent({
                rejectUnauthorized: this.config.rejectUnauthorized ?? true,
            }),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        if (this.config.jwksUrl) {
            this.jwksRemote = jose.createRemoteJWKSet(new URL(this.config.jwksUrl));
        }
    }

    /**
     * Generates the OAuth2 Authorization URL.
     * v2: Supports PKCE (code_challenge).
     */
    public getAuthorizationUrl(state: string, codeChallenge?: string, prompt?: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.callbackUrl || "",
            response_type: "code",
            scope: this.config.scope || "openid profile email",
            state,
        });

        if (codeChallenge) {
            params.append("code_challenge", codeChallenge);
            params.append("code_challenge_method", "S256");
        }

        if (prompt) {
            params.append("prompt", prompt);
        }

        return `${this.config.baseUrl}/oauth2/authorize?${params.toString()}`;
    }

    /**
     * Constructs the OIDC logout URL.
     */
    public getLogoutUrl(idTokenHint: string, postLogoutRedirectUri: string): string {
        const params = new URLSearchParams({
            id_token_hint: idTokenHint,
            post_logout_redirect_uri: postLogoutRedirectUri
        });
        return `${this.config.baseUrl}/oidc/logout?${params.toString()}`;
    }

    /**
     * Exchanges code for tokens.
     * v2: Supports PKCE (code_verifier) and JWT validation.
     */
    public async handleCallback(code: string, codeVerifier?: string): Promise<AuthenticationResult<TUser, TPermissions>> {
        try {
            const tokenBody: Record<string, string> = {
                grant_type: "authorization_code",
                redirect_uri: this.config.callbackUrl || "",
                code,
            };

            if (codeVerifier) {
                tokenBody.code_verifier = codeVerifier;
            }

            const requestConfig: Record<string, any> = {};
            if (this.config.clientSecret) {
                requestConfig.auth = {
                    username: this.config.clientId,
                    password: this.config.clientSecret,
                };
            } else {
                tokenBody.client_id = this.config.clientId;
            }

            const response = await this.httpClient.post<AccessTokenResponse>("/oauth2/token", tokenBody, requestConfig);
            const tokens = response.data;

            if (!tokens.id_token) {
                throw new Wso2TokenError("Missing id_token in WSO2 response");
            }

            // v2: Crypto Verification of JWT
            let idTokenPayload: any;
            if (this.jwksRemote) {
                try {
                    const { payload } = await jose.jwtVerify(tokens.id_token, this.jwksRemote, {
                        issuer: this.config.issuer,
                        audience: this.config.clientId,
                    });
                    idTokenPayload = payload;
                } catch (e: any) {
                    throw new Wso2SignatureError(`JWT Signature verification failed: ${e.message}`);
                }
            } else {
                console.warn("[Novashield WSO2] Warning: Decoding ID Token without signature verification (jwksUrl not configured)");
                idTokenPayload = jose.decodeJwt(tokens.id_token);
            }

            const user = this.userMapper.fromIdToken(idTokenPayload);

            let permissions: TPermissions | undefined;
            if (this.permissionProvider) {
                permissions = await this.permissionProvider.getPermissions(user, tokens.access_token);
            }

            return { tokens, user, permissions };

        } catch (error: any) {
            if (error instanceof Wso2BaseError) throw error;

            if (axios.isAxiosError(error)) {
                const wso2Error = error.response?.data?.error || error.message;
                throw new Wso2AuthenticationError(`Failed to exchange code: ${wso2Error}`, error.response?.data);
            }

            throw new Wso2NetworkError(`Unexpected error during callback: ${error.message}`);
        }
    }

    /**
     * Client Credentials Grant
     */
    public async getAppAccessToken(): Promise<string> {
        const now = dayjs();
        if (this.appAccessToken && this.appExpiresAt && now.isBefore(this.appExpiresAt)) {
            return this.appAccessToken;
        }

        try {
            const response = await this.httpClient.post<AccessTokenResponse>("/oauth2/token", {
                grant_type: "client_credentials",
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                scope: this.config.scope || "openid",
            });

            const { access_token, expires_in } = response.data;
            this.appAccessToken = access_token;
            this.appExpiresAt = dayjs().add(expires_in - 10, "second");

            return access_token;
        } catch (error: any) {
            throw new Wso2NetworkError("Failed to obtain app access token", error.response?.data);
        }
    }

    /**
     * Extended User Info (SCIM)
     */
    public async getUserInfo(accessToken: string): Promise<any> {
        try {
            const response = await this.httpClient.get("/scim2/Me", {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            return response.data;
        } catch (error: any) {
            throw new Wso2NetworkError("Failed to fetch extended user info", error.response?.data);
        }
    }
}
import { Wso2BaseError } from "../errors";

