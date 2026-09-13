import React from "react";
import ReactDOM from "react-dom/client";
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";
import "./index.css";
import App from "./App";

/**
 * Initialize official MSAL PublicClientApplication instance
 */
const msalInstance = new PublicClientApplication(msalConfig);

async function startApp() {
  try {
    // In MSAL Browser v3/v4/v5, initialize() MUST be called and awaited
    await msalInstance.initialize();

    // Handle any redirect promise if returning from login.microsoftonline.com
    const redirectResponse = await msalInstance.handleRedirectPromise().catch((err) => {
      console.warn("handleRedirectPromise warning:", err);
      return null;
    });

    if (redirectResponse && redirectResponse.account) {
      msalInstance.setActiveAccount(redirectResponse.account);
    } else if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
      msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
    }

    // Listen for sign-in events to update the active account
    msalInstance.addEventCallback((event) => {
      if (
        (event.eventType === EventType.LOGIN_SUCCESS ||
          event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
          event.eventType === EventType.SSO_SILENT_SUCCESS) &&
        event.payload?.account
      ) {
        msalInstance.setActiveAccount(event.payload.account);
      }
    });

    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Failed to initialize MSAL application:", err);
    // Render fallback UI so screen is never blank
    ReactDOM.createRoot(document.getElementById("root")).render(
      <div style={{ color: "#fff", padding: "40px", fontFamily: "sans-serif" }}>
        <h2>Authentication Initialization Error</h2>
        <p>{err.message || String(err)}</p>
        <button onClick={() => window.location.reload()} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Reload Application
        </button>
      </div>
    );
  }
}

startApp();
