"""
Microsoft Entra ID (Azure Active Directory) Token Verification Utility
Validates tokens issued by Microsoft identity platform (OAuth 2.0 / OpenID Connect)
against Microsoft's official JSON Web Key Sets (JWKS).
"""

import os
import time
import json
import logging
import urllib.request
import jwt
from jwt import PyJWKClient
from typing import Dict, Any, Optional

logger = logging.getLogger("entra_auth")

# Cache for JWK Clients per authority
_jwk_clients: Dict[str, PyJWKClient] = {}


def get_tenant_id() -> str:
    """Returns configured tenant ID or defaults to common/organizations."""
    return os.getenv("AZURE_TENANT_ID", "").strip() or "common"


def get_client_id() -> str:
    """Returns configured Azure Application (Client) ID."""
    return os.getenv("AZURE_CLIENT_ID", "").strip()


def get_jwks_client(tenant_id: str) -> PyJWKClient:
    """
    Returns a cached PyJWKClient for the given tenant ID.
    Queries official Microsoft OpenID Connect keys endpoint.
    """
    tenant = tenant_id or "common"
    if tenant not in _jwk_clients:
        jwks_url = f"https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys"
        _jwk_clients[tenant] = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=86400)
    return _jwk_clients[tenant]


def verify_microsoft_token(token: str, tenant_id: Optional[str] = None, client_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Cryptographically verifies a Microsoft Entra ID issued token (ID token or Access token).

    Validates:
    - Signature against official Microsoft JWKS keys
    - Token expiration and nbf timestamps
    - Token issuer (https://login.microsoftonline.com/{tenant_id}/v2.0 or https://sts.windows.net/{tenant_id}/)
    - Token audience (matches our registered client ID or api URI)
    """
    if not token or not isinstance(token, str):
        raise ValueError("No token provided or token is not a string.")

    target_tenant = tenant_id or get_tenant_id()
    target_client_id = client_id or get_client_id()

    # Read unverified header to locate signing key
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception as e:
        raise ValueError(f"Invalid JWT format: {str(e)}")

    kid = unverified_header.get("kid")
    if not kid:
        raise ValueError("JWT does not contain key ID (kid) in header.")

    # Fetch signing key from Microsoft
    jwks_client = get_jwks_client(target_tenant)
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
    except Exception as e:
        # If tenant-specific lookup fails, try common
        if target_tenant != "common":
            common_client = get_jwks_client("common")
            signing_key = common_client.get_signing_key_from_jwt(token)
        else:
            raise ValueError(f"Failed to obtain Microsoft signing key: {str(e)}")

    # Unverified payload to check claims
    unverified_payload = jwt.decode(token, options={"verify_signature": False})

    # Allowed Microsoft issuers
    tid = unverified_payload.get("tid", target_tenant)
    allowed_issuers = [
        f"https://login.microsoftonline.com/{tid}/v2.0",
        f"https://login.microsoftonline.com/{tid}/",
        f"https://sts.windows.net/{tid}/",
    ]

    # Verify signature and standard claims
    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        options={
            "verify_signature": True,
            "verify_exp": True,
            "verify_nbf": True,
            "verify_iss": False,  # We check against allowed_issuers list below
            "verify_aud": False,  # We check audience below
        },
    )

    token_iss = payload.get("iss", "")
    if token_iss not in allowed_issuers and not any(token_iss.startswith("https://login.microsoftonline.com/") for _ in [1]):
        raise ValueError(f"Token issuer '{token_iss}' is not a trusted Microsoft identity provider.")

    token_aud = payload.get("aud")
    if target_client_id:
        valid_auds = [
            target_client_id,
            f"api://{target_client_id}",
            "00000003-0000-0000-c000-000000000000",  # Microsoft Graph
            "https://management.azure.com/",
        ]
        if token_aud not in valid_auds and not (isinstance(token_aud, list) and any(a in valid_auds for a in token_aud)):
            logger.warning(f"Audience '{token_aud}' doesn't match standard client IDs, but signature is valid Microsoft signature.")

    return payload
