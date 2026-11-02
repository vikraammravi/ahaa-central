/** Deployment-owned configuration. Never derived from a cookie or request header. */
export function platformDeployment() { return process.env.APP_SURFACE === "platform"; }
export function platformConsoleEnabled() { return platformDeployment() && process.env.PLATFORM_CONSOLE_ENABLED === "true"; }
