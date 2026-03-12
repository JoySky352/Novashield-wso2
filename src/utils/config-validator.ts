import { Wso2ClientConfig } from "../types";
import { Wso2ConfigurationError } from "../errors";

export class ConfigValidator {
    public static validate(config: Wso2ClientConfig): void {
        const required: (keyof Wso2ClientConfig)[] = ["baseUrl", "clientId"];

        for (const field of required) {
            if (!config[field]) {
                throw new Wso2ConfigurationError(`Configuration error: ${field} is required.`);
            }
        }

        if (config.jwksUrl) {
            try {
                new URL(config.jwksUrl);
            } catch (e) {
                throw new Wso2ConfigurationError("Configuration error: jwksUrl must be a valid URL.");
            }
        }

        if (config.baseUrl) {
            try {
                new URL(config.baseUrl);
            } catch (e) {
                throw new Wso2ConfigurationError("Configuration error: baseUrl must be a valid URL.");
            }
        }
    }
}
