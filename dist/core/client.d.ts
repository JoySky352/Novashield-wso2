import { AuthenticationResult, Wso2ClientConfig } from "../types";
import { UserMapperProvider } from "../providers/user-mapper.provider";
import { PermissionProvider } from "../providers/permission.provider";
/**
 * Generic Framework-Agnostic Client for WSO2 Identity Server
 *
 * It decouples the WSO2 specifics into an injectable class, standardizing the OAuth2/OIDC flows
 * while allowing generic typings for internal domain users (TUser) and permissions (TPermissions).
 */
export declare class NovashieldAuthClient<TUser = any, TPermissions = any> {
    private readonly config;
    private readonly userMapper;
    private readonly permissionProvider?;
    private httpClient;
    private appAccessToken;
    private appExpiresAt;
    constructor(config: Wso2ClientConfig, userMapper: UserMapperProvider<TUser>, permissionProvider?: PermissionProvider<TUser, TPermissions> | undefined);
    /**
     * Generates the OAuth2 Authorization string URL for the frontend redirection.
     */
    getAuthorizationUrl(state: string, prompt?: string): string;
    /**
     * Constructs the OIDC standard logout URL
     */
    getLogoutUrl(idTokenHint: string, postLogoutRedirectUri: string): string;
    /**
     * Exchanges an authorization code for tokens, maps the ID Token to the generic user model `TUser`,
     * and optionally fetches/maps the permissions.
     */
    handleCallback(code: string): Promise<AuthenticationResult<TUser, TPermissions>>;
    /**
     * Uses Client Credentials grant to obtain an App Access Token.
     * It handles caching automatically based on expiration time.
     */
    getAppAccessToken(): Promise<string>;
    /**
     * Fetches the /scim2/Me endpoint to update or grab extended user information in a pure JSON shape.
     */
    getUserInfo(accessToken: string): Promise<any>;
}
