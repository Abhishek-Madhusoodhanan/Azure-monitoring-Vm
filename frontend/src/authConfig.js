import { LogLevel } from "@azure/msal-browser";

/**
 * Microsoft Entra ID (Azure Active Directory) configuration
 * Uses the official Microsoft identity platform (OAuth 2.0 / OpenID Connect).
 */
export const msalConfig = {
  auth: {
    // Azure App Registration Application (Client) ID
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "adce8ae4-edbf-4d11-9245-47d8e97286f9",
    // Authority points directly to the Microsoft Entra ID tenant login portal
    // Can also be set to 'https://login.microsoftonline.com/common' or 'https://login.microsoftonline.com/organizations'
    authority: import.meta.env.VITE_AZURE_AUTHORITY || "https://login.microsoftonline.com/00d8a0cf-d1d1-4d2e-9e9c-83904d181b3a",
    // Must match the redirect URI registered in the Azure Portal for this SPA
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "localStorage", // Uses localStorage for persistent Single Sign-On (SSO)
    storeAuthStateInCookie: false, // Set to true if having issues on IE11 or older browsers
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error("[MSAL Error]:", message);
            return;
          case LogLevel.Warning:
            console.warn("[MSAL Warning]:", message);
            return;
          default:
            return;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

/**
 * Scopes requested during login for OpenID Connect and Microsoft Graph basic profile
 */
export const loginRequest = {
  scopes: ["openid", "profile", "email", "User.Read"],
};
