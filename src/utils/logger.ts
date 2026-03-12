export class Logger {
    constructor(private readonly enabled: boolean = false) { }

    public debug(message: string, ...args: any[]): void {
        if (this.enabled) {
            console.log(`[Novashield SDK] [DEBUG] ${message}`, ...args);
        }
    }

    public info(message: string, ...args: any[]): void {
        console.log(`[Novashield SDK] [INFO] ${message}`, ...args);
    }

    public warn(message: string, ...args: any[]): void {
        console.warn(`[Novashield SDK] [WARN] ${message}`, ...args);
    }

    public error(message: string, ...args: any[]): void {
        console.error(`[Novashield SDK] [ERROR] ${message}`, ...args);
    }
}
