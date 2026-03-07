export interface UserMapperProvider<TUser> {
    /**
     * Translates the claims obtained from the ID Token into the generic User shape
     */
    fromIdToken(idTokenPayload: any): TUser;

    /**
     * Optionally translate user details directly from the UserInfo/scim2 API
     */
    fromUserInfo(userInfoPayload: any): TUser;
}
