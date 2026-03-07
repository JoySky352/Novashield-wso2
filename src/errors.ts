/**
 * Base error class for NovaShield WSO2 SDK
 */
export class Wso2BaseError extends Error {
    constructor(message: string, public readonly details?: any) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Thrown when authentication fails (invalid credentials, invalid code, etc.)
 */
export class Wso2AuthenticationError extends Wso2BaseError {
    constructor(message: string, details?: any) {
        super(message, details);
    }
}

/**
 * Thrown when there's a networking issue communicating with WSO2
 */
export class Wso2NetworkError extends Wso2BaseError {
    constructor(message: string, details?: any) {
        super(message, details);
    }
}

/**
 * Thrown when a token is invalid or expired
 */
export class Wso2TokenError extends Wso2BaseError {
    constructor(message: string, details?: any) {
        super(message, details);
    }
}

/**
 * Thrown when token signature verification fails
 */
export class Wso2SignatureError extends Wso2TokenError {
    constructor(message: string, details?: any) {
        super(message, details);
    }
}
