export interface PermissionProvider<TUser, TPermissions> {
    /**
     * Fetches, transforms or resolves the permissions specific to the authenticated user.
     * Can use the user's roles, or make external API calls (e.g. to WSO2 AM) using the accessToken.
     */
    getPermissions(user: TUser, accessToken: string): Promise<TPermissions>;
}
