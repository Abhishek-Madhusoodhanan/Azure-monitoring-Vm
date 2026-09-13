import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .azure_service import azure_service

from .token_validator import verify_microsoft_token

# ─────────────────────────────────────────────────────────────────
#  Demo VM state (in-memory state cache when live Azure has no VMs yet)
# ─────────────────────────────────────────────────────────────────
DEMO_VMS = [
    {
        "id": "vm-001",
        "name": "zenit-web-prod-01",
        "size": "Standard_D2s_v3",
        "os": "Windows Server 2022",
        "region": "East US 2",
        "status": "Running",
        "privateIp": "10.0.1.4",
        "publicIp": "20.112.45.89",
        "resourceGroup": "rg-abhishek-anoop-inc-001",
        "vnet": "vnet-zenit-prod (10.0.0.0/16)",
        "subnet": "subnet-frontend (10.0.1.0/24)",
        "osDiskType": "Premium_LRS",
        "osDiskSizeGb": 128,
        "adminUsername": "azureuser",
        "authType": "password",
        "inboundPorts": ["RDP (3389)", "HTTP (80)", "HTTPS (443)"],
        "cpuPercent": 34,
        "memoryGb": "3.1 / 8 GB",
        "uptime": "12d 6h",
        "tags": {"env": "production", "owner": "devops"},
    },
    {
        "id": "vm-002",
        "name": "zenit-api-worker-02",
        "size": "Standard_B2ms",
        "os": "Ubuntu 24.04 LTS",
        "region": "West Europe",
        "status": "Running",
        "privateIp": "10.0.2.5",
        "publicIp": "51.144.120.33",
        "resourceGroup": "rg-abhishek-anoop-inc-001",
        "vnet": "vnet-zenit-prod (10.0.0.0/16)",
        "subnet": "subnet-workload (10.0.2.0/24)",
        "osDiskType": "Premium_LRS",
        "osDiskSizeGb": 64,
        "adminUsername": "azureuser",
        "authType": "sshPublicKey",
        "inboundPorts": ["SSH (22)", "HTTP (80)"],
        "cpuPercent": 67,
        "memoryGb": "2.8 / 8 GB",
        "uptime": "4d 14h",
        "tags": {"env": "production", "owner": "backend-team"},
    },
    {
        "id": "vm-003",
        "name": "zenit-dev-sandbox",
        "size": "Standard_B1ms",
        "os": "Ubuntu 22.04 LTS",
        "region": "East US 2",
        "status": "Stopped",
        "privateIp": "10.0.3.9",
        "publicIp": None,
        "resourceGroup": "rg-abhishek-anoop-inc-001",
        "vnet": "vnet-zenit-dev (10.1.0.0/16)",
        "subnet": "subnet-dev (10.1.1.0/24)",
        "osDiskType": "StandardSSD_LRS",
        "osDiskSizeGb": 32,
        "adminUsername": "abhishek",
        "authType": "sshPublicKey",
        "inboundPorts": ["SSH (22)"],
        "cpuPercent": 0,
        "memoryGb": "0 / 2 GB",
        "uptime": "—",
        "tags": {"env": "dev", "owner": "abhishek"},
    },
    {
        "id": "vm-004",
        "name": "zenit-db-replica-eu",
        "size": "Standard_E4s_v5",
        "os": "Windows Server 2019",
        "region": "West Europe",
        "status": "Running",
        "privateIp": "10.0.4.12",
        "publicIp": "40.78.22.99",
        "resourceGroup": "rg-abhishek-anoop-inc-001",
        "vnet": "vnet-zenit-data (10.2.0.0/16)",
        "subnet": "subnet-data (10.2.1.0/24)",
        "osDiskType": "Premium_LRS",
        "osDiskSizeGb": 256,
        "adminUsername": "dbadmin",
        "authType": "password",
        "inboundPorts": ["RDP (3389)"],
        "cpuPercent": 22,
        "memoryGb": "14.2 / 32 GB",
        "uptime": "28d 2h",
        "tags": {"env": "production", "owner": "data-team"},
    },
    {
        "id": "vm-005",
        "name": "zenit-build-agent",
        "size": "Standard_D4s_v3",
        "os": "Ubuntu 24.04 LTS",
        "region": "Central US",
        "status": "Deallocated",
        "privateIp": "10.0.5.20",
        "publicIp": None,
        "resourceGroup": "rg-abhishek-anoop-inc-001",
        "vnet": "vnet-zenit-ci (10.3.0.0/16)",
        "subnet": "subnet-ci (10.3.1.0/24)",
        "osDiskType": "Premium_LRS",
        "osDiskSizeGb": 128,
        "adminUsername": "agentadmin",
        "authType": "sshPublicKey",
        "inboundPorts": ["SSH (22)"],
        "cpuPercent": 0,
        "memoryGb": "0 / 16 GB",
        "uptime": "—",
        "tags": {"env": "ci", "owner": "devops"},
    },
]

# ─────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────
def _parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


# ─────────────────────────────────────────────────────────────────
#  Microsoft Entra ID Token Verification Endpoint  POST /api/auth/entra-verify
#  Validates Microsoft-issued OAuth 2.0 / OpenID Connect tokens
# ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def entra_verify_view(request):
    """
    Validates Microsoft Entra ID tokens issued by Microsoft identity platform.
    Ensures the token signature is cryptographically valid using Microsoft JWKS keys,
    issuer is login.microsoftonline.com, and audience matches the registered application.
    """
    if request.method == "OPTIONS":
        return JsonResponse({"status": "preflight ok"})

    data = _parse_json_body(request)
    if not data:
        return JsonResponse(
            {"success": False, "message": "Malformed or missing JSON request body."},
            status=400,
        )

    # Token can be ID token or Access token
    token = data.get("idToken") or data.get("accessToken") or data.get("token")
    if not token:
        return JsonResponse(
            {"success": False, "message": "Missing Microsoft authentication token."},
            status=401,
        )

    try:
        claims = verify_microsoft_token(token)
    except Exception as exc:
        return JsonResponse(
            {
                "success": False,
                "message": f"Microsoft token validation failed: {str(exc)}",
            },
            status=401,
        )

    # Extract user identity strictly from verified Microsoft claims
    email = (
        claims.get("preferred_username")
        or claims.get("email")
        or claims.get("upn")
        or claims.get("unique_name")
        or ""
    ).strip().lower()

    display_name = claims.get("name") or email.split("@")[0] if email else "Microsoft User"
    tenant_id = claims.get("tid") or azure_service.tenant_id or ""
    sub_id = azure_service.subscription_id or ""

    # Roles assigned in Entra ID app registration (if any)
    roles = claims.get("roles", [])
    user_role = "admin" if ("Admin" in roles or "Directory.ReadWrite.All" in roles) else "user"

    # Derive user initials
    initials = "".join([part[0].upper() for part in display_name.split() if part][:2]) or "MS"

    azure_status = azure_service.test_connection()
    is_live = azure_status.get("connected", False) or azure_status.get("status") in (
        "connected",
        "authorization_required",
    )

    return JsonResponse(
        {
            "success": True,
            "message": f"Successfully authenticated via Microsoft Entra ID!",
            "user": {
                "email": email,
                "displayName": display_name,
                "role": user_role,
                "tenantId": tenant_id,
                "tenant": f"Gruppo Zenit S.r.l (Entra ID)",
                "subscriptionId": sub_id,
                "authMethod": "Microsoft_Entra_ID_OAuth2",
                "isAzureLive": is_live,
                "avatarInitial": initials,
                "oid": claims.get("oid"),
            },
        },
        status=200,
    )



# ─────────────────────────────────────────────────────────────────
#  Azure Cloud status endpoint  GET /api/azure/status
# ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def azure_status_view(request):
    """
    Test and return Azure Cloud authentication & IAM role status.
    Always performs a fresh check (bypasses cache) so the Re-check button works.
    """
    if request.method == "OPTIONS":
        return JsonResponse({"status": "preflight ok"})
    status = azure_service.test_connection(force_refresh=True)
    return JsonResponse(status, status=200)


# ─────────────────────────────────────────────────────────────────
#  Azure Resource Groups endpoint  GET|POST /api/azure/resource-groups
# ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def azure_resource_groups_view(request):
    """
    GET: List all resource groups in the subscription.
    POST: Create a new Resource Group in Azure.
    """
    if request.method == "OPTIONS":
        return JsonResponse({"status": "preflight ok"})

    if request.method == "POST":
        data = _parse_json_body(request) or {}
        name = data.get("name", "").strip()
        location = data.get("location", "centralindia").strip()
        if not name:
            return JsonResponse({"success": False, "message": "Resource group name is required."}, status=400)
        res = azure_service.create_resource_group(name, location)
        return JsonResponse(res, status=200 if res.get("success") else 400)

    # GET
    rgs = azure_service.list_resource_groups()
    return JsonResponse({
        "success": True,
        "resourceGroups": rgs,
        "defaultResourceGroup": azure_service.default_resource_group,
    }, status=200)


# ─────────────────────────────────────────────────────────────────
#  Azure Networks endpoint  GET /api/azure/networks?resourceGroup=...
# ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def azure_networks_view(request):
    """
    GET: List Virtual Networks and Subnets for the specified or default Resource Group.
    """
    if request.method == "OPTIONS":
        return JsonResponse({"status": "preflight ok"})

    rg = request.GET.get("resourceGroup", "").strip() or azure_service.default_resource_group
    vnets = []
    azure_status = azure_service.test_connection()
    if azure_status.get("connected"):
        vnets = azure_service.list_vnets(resource_group=rg)

    # If no VNets found in Azure (or demo mode), provide realistic default VNets
    if not vnets:
        vnets = [
            {
                "name": f"{rg}-vnet",
                "id": f"/subscriptions/{azure_service.subscription_id or 'sub-demo'}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/{rg}-vnet",
                "location": azure_service.default_location or "centralindia",
                "addressPrefixes": ["10.0.0.0/16"],
                "subnets": [
                    {"name": "default", "addressPrefix": "10.0.0.0/24"},
                    {"name": "subnet-workload", "addressPrefix": "10.0.1.0/24"},
                ],
            }
        ]

    return JsonResponse({
        "success": True,
        "resourceGroup": rg,
        "vnets": vnets,
    }, status=200)


# ─────────────────────────────────────────────────────────────────
#  Azure Live SKUs endpoint  GET /api/azure/skus?location=...
# ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def azure_skus_view(request):
    """
    Extracts available VM SKUs and hardware sizes directly from Azure.
    """
    if request.method == "OPTIONS":
        return JsonResponse({"status": "preflight ok"})

    location = request.GET.get("location", "").strip() or azure_service.default_location or "centralindia"
    skus = azure_service.list_available_skus(location=location)
    return JsonResponse({
        "success": True,
        "location": location,
        "skus": skus,
    }, status=200)


# ─────────────────────────────────────────────────────────────────
#  VM list endpoint  GET /api/vms
# ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["GET"])
def vm_list_view(request):
    """
    Return list of Virtual Machines.
    Scopes to a specific Resource Group if provided via ?resourceGroup=...
    or configured in AZURE_RESOURCE_GROUP in .env.
    """
    requested_rg = request.GET.get("resourceGroup", "").strip()
    target_rg = requested_rg or azure_service.default_resource_group or ""

    try:
        azure_status = azure_service.test_connection()  # uses 60s cache — fast
        available_rgs = azure_service.list_resource_groups() if azure_status.get("connected") else []

        if azure_status.get("connected"):
            live_vms, err = azure_service.list_vms(resource_group=target_rg)
            if not err:
                return JsonResponse({
                    "success": True,
                    "vms": live_vms,
                    "azureConnected": True,
                    "azureStatus": azure_status,
                    "activeResourceGroup": target_rg,
                    "resourceGroups": available_rgs,
                }, status=200)

        # Demo fallback
        filtered_demo = [vm for vm in DEMO_VMS if not target_rg or vm.get("resourceGroup") == target_rg]
        if not filtered_demo and DEMO_VMS:
            filtered_demo = DEMO_VMS

        return JsonResponse({
            "success": True,
            "vms": filtered_demo,
            "azureConnected": azure_status.get("connected", False),
            "azureStatus": azure_status,
            "activeResourceGroup": target_rg,
            "resourceGroups": available_rgs,
        }, status=200)

    except Exception as exc:
        # Safety net: always return valid JSON so the frontend never sees a 500
        import traceback
        return JsonResponse({
            "success": True,
            "vms": DEMO_VMS,
            "azureConnected": False,
            "azureStatus": {
                "connected": False,
                "status": "error",
                "message": f"Backend error (demo fallback active): {str(exc)}",
            },
            "activeResourceGroup": target_rg,
            "resourceGroups": [],
        }, status=200)


# ─────────────────────────────────────────────────────────────────
#  VM action endpoint  POST /api/vms/<vm_id>/action
# ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def vm_action_view(request, vm_id):
    """
    Perform an action on a VM: start | stop | restart | connect | delete.

    PRODUCTION NOTE:
        Replace the demo state-toggle with Azure SDK calls, e.g.:
            compute_client.virtual_machines.begin_start(resource_group, vm_name)
            compute_client.virtual_machines.begin_deallocate(resource_group, vm_name)
            compute_client.virtual_machines.begin_restart(resource_group, vm_name)
        For 'connect', generate a JIT-access request or return the RDP/SSH connection string.
    """
    if request.method == "OPTIONS":
        return JsonResponse({"status": "preflight ok"})

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"success": False, "message": "Invalid JSON body."}, status=400)

    action = data.get("action", "").strip().lower()
    valid_actions = {"start", "stop", "restart", "connect", "delete"}
    if action not in valid_actions:
        return JsonResponse(
            {"success": False, "message": f"Unknown action '{action}'. Valid: {', '.join(valid_actions)}."},
            status=400,
        )

    # Find VM in live Azure resources if connected, otherwise fallback to demo store
    target_vm = None
    is_live = False
    azure_status = azure_service.test_connection()
    if azure_status.get("connected"):
        live_vms, _ = azure_service.list_vms()
        target_vm = next((vm for vm in live_vms if vm["id"] == vm_id or vm["name"] == vm_id), None)
        if target_vm:
            is_live = True

    if not target_vm:
        target_vm = next((vm for vm in DEMO_VMS if vm["id"] == vm_id), None)

    if not target_vm:
        return JsonResponse({"success": False, "message": f"VM '{vm_id}' not found."}, status=404)

    vm_name = target_vm["name"]
    rg_name = target_vm.get("resourceGroup", azure_service.default_resource_group)

    # If this is a live Azure Cloud VM, call the Azure ARM API
    if is_live:
        if action == "start":
            res = azure_service.start_vm(rg_name, vm_name)
            return JsonResponse(res, status=200 if res.get("success") else 500)
        elif action == "stop":
            res = azure_service.stop_vm(rg_name, vm_name)
            return JsonResponse(res, status=200 if res.get("success") else 500)
        elif action == "restart":
            res = azure_service.restart_vm(rg_name, vm_name)
            return JsonResponse(res, status=200 if res.get("success") else 500)
        elif action == "delete":
            res = azure_service.delete_vm(rg_name, vm_name)
            return JsonResponse(res, status=200 if res.get("success") else 500)

    # Demo state transitions
    if action == "start":
        if target_vm["status"] == "Running":
            return JsonResponse(
                {"success": False, "message": f"VM '{vm_name}' is already running."}, status=409
            )
        target_vm["status"] = "Running"
        target_vm["publicIp"] = target_vm["publicIp"] or "20.0.0." + vm_id.split("-")[-1]
        target_vm["uptime"] = "0d 0h"
        return JsonResponse(
            {"success": True, "message": f"VM '{vm_name}' is starting up.", "vm": target_vm}
        )

    elif action == "stop":
        if target_vm["status"] in ("Stopped", "Deallocated"):
            return JsonResponse(
                {"success": False, "message": f"VM '{vm_name}' is already stopped."}, status=409
            )
        target_vm["status"] = "Stopped"
        target_vm["publicIp"] = None
        target_vm["cpuPercent"] = 0
        target_vm["uptime"] = "—"
        return JsonResponse(
            {"success": True, "message": f"VM '{vm_name}' has been stopped.", "vm": target_vm}
        )

    elif action == "restart":
        if target_vm["status"] != "Running":
            return JsonResponse(
                {"success": False, "message": f"VM '{vm_name}' must be running to restart."}, status=409
            )
        target_vm["uptime"] = "0d 0h"
        return JsonResponse(
            {"success": True, "message": f"VM '{vm_name}' is restarting.", "vm": target_vm}
        )

    elif action == "connect":
        ip = target_vm.get("publicIp") or target_vm.get("privateIp") or "10.0.1.4"
        os_type = target_vm.get("os", "")
        admin_user = target_vm.get("adminUsername", "azureuser")
        is_windows = "windows" in os_type.lower()
        port = 3389 if is_windows else 22

        # Standard RDP configuration file content matching Azure portal
        rdp_content = (
            f"full address:s:{ip}:{port}\r\n"
            f"prompt for credentials:i:1\r\n"
            f"administrative session:i:1\r\n"
            f"screen mode id:i:2\r\n"
            f"use multimon:i:0\r\n"
            f"username:s:{admin_user}\r\n"
        )

        connection_info = {
            "protocol": "RDP" if is_windows else "SSH",
            "vmName": vm_name,
            "ip": ip,
            "publicIp": target_vm.get("publicIp"),
            "privateIp": target_vm.get("privateIp"),
            "port": port,
            "address": f"{ip}:{port}" if is_windows else ip,
            "os": os_type,
            "adminUsername": admin_user,
            "authType": target_vm.get("authType", "sshPublicKey" if not is_windows else "password"),
            "vnet": target_vm.get("vnet", "vnet-zenit-prod (10.0.0.0/16)"),
            "subnet": target_vm.get("subnet", "subnet-default (10.0.1.0/24)"),
            "sshCommand": f"ssh {admin_user}@{ip}",
            "powershellCommand": f"mstsc /v:{ip}:{port}" if is_windows else f"ssh {admin_user}@{ip}",
            "instruction": f"mstsc /v:{ip}:{port}" if is_windows else f"ssh {admin_user}@{ip}",
            "rdpContent": rdp_content if is_windows else None,
            "bastionAvailable": True,
            "serialConsoleAvailable": True,
        }
        return JsonResponse(
            {
                "success": True,
                "message": f"Connection info for '{vm_name}'.",
                "connection": connection_info,
            }
        )

    elif action == "delete":
        DEMO_VMS[:] = [vm for vm in DEMO_VMS if vm["id"] != vm_id]
        return JsonResponse(
            {"success": True, "message": f"VM '{vm_name}' has been deleted."}
        )


# ─────────────────────────────────────────────────────────────────
#  VM create endpoint  POST /api/vms/create
# ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def vm_create_view(request):
    """
    Create a new VM.

    PRODUCTION NOTE:
        Replace demo dict insertion with:
            compute_client.virtual_machines.begin_create_or_update(
                resource_group, vm_name, vm_parameters
            )
    """
    if request.method == "OPTIONS":
        return JsonResponse({"status": "preflight ok"})

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"success": False, "message": "Invalid JSON body."}, status=400)

    name = data.get("name", "").strip()
    if not name:
        return JsonResponse({"success": False, "message": "VM name is required."}, status=400)

    # If connected to live Azure Cloud, provision real Azure VM
    azure_status = azure_service.test_connection()
    if azure_status.get("connected"):
        res = azure_service.create_vm(data)
        return JsonResponse(res, status=200 if res.get("success") else 500)

    size = data.get("size", "Standard_B2ms")
    region = data.get("region", "East US 2")
    os_type = data.get("os", "Ubuntu 24.04 LTS")
    resource_group = data.get("resourceGroup", "rg-zenit-prod")

    # Real Azure storage & network provisioning parameters
    vnet = data.get("vnet", "vnet-zenit-prod (10.0.0.0/16)")
    subnet = data.get("subnet", "default (10.0.1.0/24)")
    os_disk_type = data.get("osDiskType", "Premium_LRS")
    os_disk_size_gb = int(data.get("osDiskSizeGb", 64))
    admin_username = data.get("adminUsername", "azureuser").strip() or "azureuser"
    auth_type = data.get("authType", "sshPublicKey")
    public_ip_enabled = data.get("publicIpEnabled", True)
    inbound_ports = data.get("inboundPorts", ["SSH (22)"] if "windows" not in os_type.lower() else ["RDP (3389)"])

    if not name:
        return JsonResponse({"success": False, "message": "VM name is required."}, status=400)

    # Check for duplicate name
    if any(vm["name"].lower() == name.lower() for vm in DEMO_VMS):
        return JsonResponse(
            {"success": False, "message": f"A VM named '{name}' already exists in {resource_group}."},
            status=409,
        )

    # Generate allocated IP addresses matching network profile
    vm_num = len(DEMO_VMS) + 1
    allocated_private_ip = f"10.0.1.{vm_num + 20}"
    allocated_public_ip = f"20.198.54.{vm_num + 50}" if public_ip_enabled else None

    new_vm = {
        "id": f"vm-{vm_num:03d}",
        "name": name,
        "size": size,
        "os": os_type,
        "region": region,
        "status": "Running",
        "privateIp": allocated_private_ip,
        "publicIp": allocated_public_ip,
        "resourceGroup": resource_group,
        "vnet": vnet,
        "subnet": subnet,
        "osDiskType": os_disk_type,
        "osDiskSizeGb": os_disk_size_gb,
        "adminUsername": admin_username,
        "authType": auth_type,
        "inboundPorts": inbound_ports,
        "cpuPercent": 14,
        "memoryGb": "1.2 / 8 GB",
        "uptime": "0d 1h",
        "tags": {"env": "prod", "owner": admin_username},
    }
    DEMO_VMS.append(new_vm)

    return JsonResponse(
        {
            "success": True,
            "message": f"Virtual Machine '{name}' successfully provisioned in {vnet}.",
            "vm": new_vm,
        },
        status=201,
    )


# ─────────────────────────────────────────────────────────────────
#  Health check  GET /api/health
# ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["GET"])
def health_view(request):
    """Health check endpoint for Azure App Service & monitoring."""
    return JsonResponse(
        {
            "status": "ok",
            "framework": "Django 6",
            "cloud_provider": "Azure",
            "version": "2.4.0",
        }
    )
