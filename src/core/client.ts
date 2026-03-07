import axios, { AxiosInstance } from "axios";
import https from "https";
import dayjs from "dayjs";
import { AccessTokenResponse, AuthenticationResult, Wso2ClientConfig } from "../types";
import { UserMapperProvider } from "../providers/user-mapper.provider";
import { PermissionProvider } from "../providers/permission.provider";

/**
 * Generic Framework-Agnostic Client for WSO2 Identity Server
 *
 * It decouples the WSO2 specifics into an injectable class, standardizing the OAuth2/OIDC flows
 * while allowing generic typings for internal domain users (TUser) and permissions (TPermissions).
 */
export class NovashieldAuthClient<TUser = any, TPermissions = any> {
    private httpClient: AxiosInstance;

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
    }

    /**
     * Generates the OAuth2 Authorization string URL for the frontend redirection.
     */
    public getAuthorizationUrl(state: string, prompt?: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.callbackUrl || "",
            response_type: "code",
            scope: this.config.scope || "openid profile email",
            state,
        });
        if (prompt) {
            params.append("prompt", prompt);
        }
        return `${this.config.baseUrl}/oauth2/authorize?${params.toString()}`;
    }

    /**
     * Constructs the OIDC standard logout URL
     */
    public getLogoutUrl(idTokenHint: string, postLogoutRedirectUri: string): string {
        const params = new URLSearchParams({
            id_token_hint: idTokenHint,
            post_logout_redirect_uri: postLogoutRedirectUri
        });
        return `${this.config.baseUrl}/oidc/logout?${params.toString()}`;
    }

    /**
     * Exchanges an authorization code for tokens, maps the ID Token to the generic user model `TUser`,
     * and optionally fetches/maps the permissions.
     */
    public async handleCallback(code: string): Promise<AuthenticationResult<TUser, TPermissions>> {
        try {
            const tokenBody: Record<string, string> = {
                grant_type: "authorization_code",
                redirect_uri: this.config.callbackUrl || "",
                code,
            };

            const requestConfig: Record<string, any> = {};
            if (this.config.clientSecret) {
                console.log("[Novashield WSO2] Using Basic Auth for token exchange (confidential client)");
                requestConfig.auth = {
                    username: this.config.clientId,
                    password: this.config.clientSecret,
                };
            } else {
                console.log("[Novashield WSO2] Using public client (client_id in body)");
                tokenBody.client_id = this.config.clientId;
            }

            const tokenResponse = await this.httpClient.post<AccessTokenResponse>("/oauth2/token", tokenBody, requestConfig);

            const tokens = tokenResponse.data;
            if (!tokens.id_token) {
                throw new Error("WSO2 did not return an ID token");
            }

            const idTokenPayload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64").toString());

            const user = this.userMapper.fromIdToken(idTokenPayload);

            let permissions: TPermissions | undefined = undefined;
            if (this.permissionProvider) {
                permissions = await this.permissionProvider.getPermissions(user, tokens.access_token);
            }

            return {
                tokens,
                user,
                permissions
            };
        } catch (error: any) {
            console.error("[Novashield WSO2] Error exchanging code:", error.response?.data || error.message);
            throw new Error(`Failed to exchange code: ${error.message}`);
        }
    }

    /**
     * Uses Client Credentials grant to obtain an App Access Token. 
     * It handles caching automatically based on expiration time.
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
            console.error("[Novashield WSO2] Client Credentials error:", error.response?.data || error.message);
            throw new Error("Failed to get client credentials token");
        }
    }

    /**
     * Fetches the /scim2/Me endpoint to update or grab extended user information in a pure JSON shape.
     */
    public async getUserInfo(accessToken: string): Promise<any> {
        try {
            const response = await axios.get(`${this.config.baseUrl}/scim2/Me`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                httpsAgent: new https.Agent({ rejectUnauthorized: this.config.rejectUnauthorized ?? true })
            });
            return response.data;
        } catch (error: any) {
            console.error("[Novashield WSO2] getUserInfo error:", error.response?.data || error.message);
            throw error;
        }
    }
}
