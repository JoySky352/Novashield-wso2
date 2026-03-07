"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovashieldAuthClient = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const dayjs_1 = __importDefault(require("dayjs"));
/**
 * Generic Framework-Agnostic Client for WSO2 Identity Server
 *
 * It decouples the WSO2 specifics into an injectable class, standardizing the OAuth2/OIDC flows
 * while allowing generic typings for internal domain users (TUser) and permissions (TPermissions).
 */
class NovashieldAuthClient {
  config;
  userMapper;
  permissionProvider;
  httpClient;
  appAccessToken = null;
  appExpiresAt = null;
  constructor(config, userMapper, permissionProvider) {
    this.config = config;
    this.userMapper = userMapper;
    this.permissionProvider = permissionProvider;
    this.httpClient = axios_1.default.create({
      baseURL: this.config.baseUrl,
      httpsAgent: new https_1.default.Agent({
        rejectUnauthorized: this.config.rejectUnauthorized ?? true,
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }
  /**
   * Generates the OAuth2 Authorization string URL for the frontend redirection.
   */
  getAuthorizationUrl(state, prompt) {
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
  getLogoutUrl(idTokenHint, postLogoutRedirectUri) {
    const params = new URLSearchParams({
      id_token_hint: idTokenHint,
      post_logout_redirect_uri: postLogoutRedirectUri,
    });
    return `${this.config.baseUrl}/oidc/logout?${params.toString()}`;
  }
  /**
   * Exchanges an authorization code for tokens, maps the ID Token to the generic user model `TUser`,
   * and optionally fetches/maps the permissions.
   */
  async handleCallback(code) {
    try {
      const tokenResponse = await this.httpClient.post("/oauth2/token", {
        grant_type: "authorization_code",
        client_id: this.config.clientId,
        // client_secret: this.config.clientSecret,
        redirect_uri: this.config.callbackUrl,
        code,
      });
      const tokens = tokenResponse.data;
      if (!tokens.id_token) {
        throw new Error("WSO2 did not return an ID token");
      }
      const idTokenPayload = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64").toString(),
      );
      const user = this.userMapper.fromIdToken(idTokenPayload);
      let permissions = undefined;
      if (this.permissionProvider) {
        permissions = await this.permissionProvider.getPermissions(
          user,
          tokens.access_token,
        );
      }
      return {
        tokens,
        user,
        permissions,
      };
    } catch (error) {
      console.error(
        "[Novashield WSO2] Error exchanging code:",
        error.response?.data || error.message,
      );
      throw new Error(`Failed to exchange code: ${error.message}`);
    }
  }
  /**
   * Uses Client Credentials grant to obtain an App Access Token.
   * It handles caching automatically based on expiration time.
   */
  async getAppAccessToken() {
    const now = (0, dayjs_1.default)();
    if (
      this.appAccessToken &&
      this.appExpiresAt &&
      now.isBefore(this.appExpiresAt)
    ) {
      return this.appAccessToken;
    }
    try {
      const response = await this.httpClient.post("/oauth2/token", {
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: this.config.scope || "openid",
      });
      const { access_token, expires_in } = response.data;
      this.appAccessToken = access_token;
      this.appExpiresAt = (0, dayjs_1.default)().add(expires_in - 10, "second");
      return access_token;
    } catch (error) {
      console.error(
        "[Novashield WSO2] Client Credentials error:",
        error.response?.data || error.message,
      );
      throw new Error("Failed to get client credentials token");
    }
  }
  /**
   * Fetches the /scim2/Me endpoint to update or grab extended user information in a pure JSON shape.
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios_1.default.get(
        `${this.config.baseUrl}/scim2/Me`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          httpsAgent: new https_1.default.Agent({
            rejectUnauthorized: this.config.rejectUnauthorized ?? true,
          }),
        },
      );
      return response.data;
    } catch (error) {
      console.error(
        "[Novashield WSO2] getUserInfo error:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
exports.NovashieldAuthClient = NovashieldAuthClient;
