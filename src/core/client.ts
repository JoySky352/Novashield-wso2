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
    Wso2TokenError,
    Wso2BaseError
} from "../errors";
import { Logger } from "../utils/logger";
import { ConfigValidator } from "../utils/config-validator";
import { DiscoveryService, OidcDiscoveryConfig } from "../utils/discovery";

/**
 * NovashieldAuthClient v2
 * Standard OIDC Client with PKCE and JWT Signature Validation
 */
export class NovashieldAuthClient<TUser = any, TPermissions = any> {
    private httpClient: AxiosInstance;
    private jwksRemote: any | null = null;
    private logger: Logger;
    private discoveryService: DiscoveryService;
    private discoveryConfig: OidcDiscoveryConfig | null = null;

    private appAccessToken: string | null = null;
    private appExpiresAt: dayjs.Dayjs | null = null;

    constructor(
        private config: Wso2ClientConfig,
        private readonly userMapper: UserMapperProvider<TUser>,
        private readonly permissionProvider?: PermissionProvider<TUser, TPermissions>
    ) {
        this.logger = new Logger(this.config.debug);
        ConfigValidator.validate(this.config);

        this.httpClient = axios.create({
            baseURL: this.config.baseUrl,
            httpsAgent: new https.Agent({
                rejectUnauthorized: this.config.rejectUnauthorized ?? true,
            }),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        this.discoveryService = new DiscoveryService(this.logger);

        if (this.config.jwksUrl) {
            this.jwksRemote = jose.createRemoteJWKSet(new URL(this.config.jwksUrl));
        }
    }

    /**
     * Initializes the client.
     * Performs OIDC Auto-Discovery if enabled.
     */
    public async initialize(): Promise<void> {
        if (this.config.autoDiscovery) {
            this.logger.info("Initializing with Auto-Discovery...");
            this.discoveryConfig = await this.discoveryService.discover(this.config.baseUrl, {
                discoveryUrl: this.config.discoveryUrl,
                rejectUnauthorized: this.config.rejectUnauthorized
            });

            if (!this.config.issuer) this.config.issuer = this.discoveryConfig.issuer;
            if (!this.config.jwksUrl) {
                this.config.jwksUrl = this.discoveryConfig.jwks_uri;
                this.jwksRemote = jose.createRemoteJWKSet(new URL(this.config.jwksUrl));
            }

            this.logger.info("Auto-Discovery completed.");
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

        const authEndpoint = this.discoveryConfig?.authorization_endpoint || `${this.config.baseUrl}/oauth2/authorize`;

        return `${authEndpoint}?${params.toString()}`;
    }

    /**
     * Generates the URL for WSO2 Self-Registration.
     */
    public getRegistrationUrl(state: string, codeChallenge?: string): string {
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

        const registrationEndpoint = this.discoveryConfig?.registration_endpoint || `${this.config.baseUrl}/accountrecoveryendpoint/register.do`;

        return `${registrationEndpoint}?${params.toString()}`;
    }

    /**
     * Constructs the OIDC logout URL.
     */
    public getLogoutUrl(idTokenHint: string, postLogoutRedirectUri: string): string {
        const params = new URLSearchParams({
            id_token_hint: idTokenHint,
            post_logout_redirect_uri: postLogoutRedirectUri
        });
        this.logger.debug("Generating logout URL", { idTokenHint, postLogoutRedirectUri });

        const logoutEndpoint = this.discoveryConfig?.end_session_endpoint || `${this.config.baseUrl}/oidc/logout`;

        return `${logoutEndpoint}?${params.toString()}`;
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

            const tokenEndpoint = this.discoveryConfig?.token_endpoint || "/oauth2/token";
            this.logger.debug(`Exchanging code at ${tokenEndpoint}`);

            const response = await this.httpClient.post<AccessTokenResponse>(tokenEndpoint, tokenBody, requestConfig);
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
                        clockTolerance: this.config.clockTolerance || 30,
                    });
                    idTokenPayload = payload;
                } catch (e: any) {
                    throw new Wso2SignatureError(`JWT Signature verification failed: ${e.message}`);
                }
            } else {
                this.logger.warn("Decoding ID Token without signature verification (jwksUrl not configured)");
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

            this.logger.debug(`App access token obtained. Expires in ${expires_in}s`);
            return access_token;
        } catch (error: any) {
            this.logger.error("Failed to obtain app access token");
            throw new Wso2NetworkError("Failed to obtain app access token", error.response?.data);
        }
    }

    /**
     * Extended User Info (SCIM)
     */
    public async getUserInfo(accessToken: string): Promise<any> {
        this.logger.debug("Fetching extended user info from /scim2/Me");
        try {
            const response = await this.httpClient.get("/scim2/Me", {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            this.logger.debug("User info fetched successfully");
            return response.data;
        } catch (error: any) {
            this.logger.error("Failed to fetch user info");
            throw new Wso2NetworkError("Failed to fetch extended user info", error.response?.data);
        }
    }
}
