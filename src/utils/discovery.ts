import axios from "axios";
import { Logger } from "./logger";
import { Wso2NetworkError } from "../errors";

export interface OidcDiscoveryConfig {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    jwks_uri: string;
    registration_endpoint?: string;
    end_session_endpoint?: string;
}

export class DiscoveryService {
    constructor(private readonly logger: Logger) { }

    public async discover(baseUrl: string, options?: { discoveryUrl?: string; rejectUnauthorized?: boolean }): Promise<OidcDiscoveryConfig> {
        let url = options?.discoveryUrl;
        if (!url) {
            const sanitizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
            url = `${sanitizedBaseUrl}/oauth2/token/.well-known/openid-configuration`;
        }

        this.logger.debug(`Fetching OIDC configuration from: ${url}`);

        const axiosConfig: any = {};
        if (options?.rejectUnauthorized === false) {
            const https = require("https");
            axiosConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
        }

        try {
            const response = await axios.get<OidcDiscoveryConfig>(url, axiosConfig);
            this.logger.debug("OIDC Configuration discovered successfully");
            return response.data;
        } catch (error: any) {
            this.logger.error(`Discovery failed: ${error.message}`);
            throw new Wso2NetworkError(`Failed to discover OIDC configuration: ${error.message}`);
        }
    }
}
