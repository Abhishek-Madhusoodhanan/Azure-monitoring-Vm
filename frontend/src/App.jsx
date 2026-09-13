import { useState, useEffect, useCallback } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import axios from "axios";
import LoginPage from "./components/LoginPage";
import UserDashboard from "./components/UserDashboard";
import { loginRequest } from "./authConfig";

function App() {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    const savedTheme = localStorage.getItem("azure_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("azure_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [verifyingSession, setVerifyingSession] = useState(false);

  // Synchronize authenticated MSAL account with backend verification
  const syncMsalAccount = useCallback(async (account) => {
    if (!account) return;
    setVerifyingSession(true);
    try {
      // Silently acquire token for backend validation
      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account,
      });

      const token = tokenResponse.idToken || tokenResponse.accessToken;

      // Verify token with backend
      const res = await axios.post("/api/auth/entra-verify", {
        token,
        idToken: tokenResponse.idToken,
        accessToken: tokenResponse.accessToken,
      });

      if (res.data.success && res.data.user) {
        const verifiedUser = {
          ...res.data.user,
          accountHomeId: account.homeAccountId,
          idTokenClaims: tokenResponse.idTokenClaims,
        };
        setCurrentUser(verifiedUser);
        localStorage.setItem("azure_user", JSON.stringify(verifiedUser));
      }
    } catch (err) {
      console.warn("Silent token acquisition or verification failed:", err);
      // If token silent failed due to interaction required, fall back to claims in account
      const fallbackUser = {
        email: account.username || account.idTokenClaims?.email || "",
        displayName: account.name || account.username || "Microsoft User",
        role: "user",
        tenant: "Gruppo Zenit S.r.l (Entra ID)",
        authMethod: "Microsoft_Entra_ID_OAuth2",
        avatarInitial: (account.name?.[0] || account.username?.[0] || "M").toUpperCase(),
      };
      setCurrentUser(fallbackUser);
    } finally {
      setVerifyingSession(false);
    }
  }, [instance]);

  useEffect(() => {
    if (isAuthenticated && accounts.length > 0 && !currentUser) {
      syncMsalAccount(accounts[0]);
    }
  }, [isAuthenticated, accounts, currentUser, syncMsalAccount]);

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    try {
      localStorage.setItem("azure_user", JSON.stringify(userData));
    } catch (e) {
      console.error("Failed to persist auth state:", e);
    }
  };

  const handleLogout = async () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem("azure_user");
      localStorage.removeItem("azure_demo_user");
    } catch (e) {
      console.error("Failed to clear auth state:", e);
    }

    // Official Microsoft logout: signs out of Microsoft identity platform
    try {
      const activeAccount = instance.getActiveAccount() || accounts[0];
      if (activeAccount) {
        await instance.logoutRedirect({
          account: activeAccount,
          postLogoutRedirectUri: window.location.origin,
        });
      }
    } catch (err) {
      console.warn("MSAL logoutRedirect error, falling back to local logout:", err);
    }
  };

  if (verifyingSession && !currentUser) {
    return (
      <div className="login-wrapper" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(0, 120, 212, 0.2)", borderTopColor: "#0078D4", borderRadius: "50%", animation: "spin 0.7s linear infinite" }}></div>
        <p style={{ marginTop: 16, color: "var(--text-secondary, #94a3b8)", fontSize: "0.95rem" }}>
          Authenticating with Microsoft identity platform…
        </p>
      </div>
    );
  }

  if (currentUser) {
    return <UserDashboard user={currentUser} onLogout={handleLogout} />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}

export default App;
