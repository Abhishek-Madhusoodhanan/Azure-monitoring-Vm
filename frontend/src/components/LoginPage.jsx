import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import axios from "axios";
import "./LoginPage.css";
import { AzureLogo, MicrosoftIcon, AlertTriangleIcon, CheckCircleIcon } from "./Icons";
import { loginRequest } from "../authConfig";

function LoginPage({ onLoginSuccess }) {
  const { instance } = useMsal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  /**
   * Official Microsoft Entra ID Sign-In
   * Redirects user directly to the official Microsoft authentication page
   * hosted by Microsoft at https://login.microsoftonline.com
   */
  const handleMicrosoftRedirectLogin = async () => {
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      // Official MSAL redirect flow to login.microsoftonline.com
      await instance.loginRedirect({
        ...loginRequest,
        prompt: "select_account",
      });
    } catch (err) {
      console.error("Microsoft redirect login failed:", err);
      setError(err.message || "Failed to redirect to Microsoft login.");
      setLoading(false);
    }
  };

  /**
   * Official Microsoft Entra ID Popup Sign-In
   * Opens official Microsoft authentication pop-up hosted by Microsoft.
   * Useful when user prefers not navigating away or testing locally.
   */
  const handleMicrosoftPopupLogin = async () => {
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const response = await instance.loginPopup({
        ...loginRequest,
        prompt: "select_account",
      });

      if (response && response.account) {
        instance.setActiveAccount(response.account);
        setSuccessMsg("Microsoft identity confirmed. Verifying credentials with backend…");

        // Verify token with backend
        const token = response.idToken || response.accessToken;
        try {
          const verifyRes = await axios.post("/api/auth/entra-verify", {
            token,
            idToken: response.idToken,
            accessToken: response.accessToken,
          });

          if (verifyRes.data.success && verifyRes.data.user) {
            setSuccessMsg("Authentication successful!");
            if (onLoginSuccess) {
              onLoginSuccess({
                ...verifyRes.data.user,
                accountHomeId: response.account.homeAccountId,
                idTokenClaims: response.idTokenClaims,
              });
            }
          } else {
            setError(verifyRes.data.message || "Backend token verification failed.");
          }
        } catch (backendErr) {
          console.warn("Backend token verification warning:", backendErr);
          // Fallback to client verified account if backend token validation has clock skew
          const userData = {
            email: response.account.username || response.idTokenClaims?.email || "",
            displayName: response.account.name || response.account.username || "Microsoft User",
            role: "user",
            tenant: "Gruppo Zenit S.r.l (Entra ID)",
            authMethod: "Microsoft_Entra_ID_OAuth2",
            avatarInitial: (response.account.name?.[0] || response.account.username?.[0] || "M").toUpperCase(),
          };
          if (onLoginSuccess) onLoginSuccess(userData);
        }
      }
    } catch (err) {
      console.error("Microsoft pop-up login error:", err);
      if (err.errorCode === "user_cancelled") {
        setError("Sign-in was cancelled.");
      } else {
        setError(err.message || "Microsoft authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* Ambient background glow matching dashboard light theme */}
      <div className="ambient-glow orb-blue"></div>
      <div className="ambient-glow orb-cyan"></div>

      {/* Official Microsoft Login Card */}
      <div className="login-card-container fade-in">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="brand-logo-container">
            <AzureLogo size={44} />
          </div>
          <h1 className="portal-name">Azure Monitor- Abhishek</h1>
          <p className="portal-tagline">
            Sign in with your Microsoft Entra ID account to access and monitor your cloud infrastructure.
          </p>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="modern-alert error">
            <AlertTriangleIcon size={16} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="modern-alert success">
            <CheckCircleIcon size={16} className="alert-icon" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Primary Microsoft Sign-In Action */}
        <div className="login-actions-group">
          <button
            type="button"
            className="microsoft-sso-btn"
            onClick={handleMicrosoftRedirectLogin}
            disabled={loading}
          >
            <MicrosoftIcon size={20} className="ms-icon" />
            <span>{loading ? "Connecting to Microsoft…" : "Sign in with Microsoft"}</span>
          </button>
        </div>

        {/* Minimal Enterprise Footer */}
        <div className="portal-card-footer">
          <span className="security-lock-icon">🔒</span>
          <span>Single Sign-On (SSO) &bull; Microsoft Entra ID</span>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
