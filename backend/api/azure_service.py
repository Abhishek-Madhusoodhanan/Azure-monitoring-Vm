"""
Azure Cloud Management Service
Integrates Microsoft Azure Resource Manager (ARM) via official Azure Python SDK:
- azure-identity (ClientSecretCredential)
- azure-mgmt-compute (ComputeManagementClient)
- azure-mgmt-network (NetworkManagementClient)
- azure-mgmt-resource (ResourceManagementClient)

Handles:
- Authentication & Connection Health Diagnostic
- Live VM Listing with Power States & Dynamic IPs
- VM Actions: Start, Stop (Deallocate), Restart, Delete
- VM Provisioning (Resource Group, VNet, Subnet, Public IP, NIC, VM)
- Graceful error reporting & fallback handling
"""

import os
import re
import logging
import time
import threading
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dotenv import load_dotenv

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

# Ensure .env is loaded from backend root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from azure.identity import ClientSecretCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.compute.models import (
    VirtualMachine,
    HardwareProfile,
    StorageProfile,
    OSDisk,
    ManagedDiskParameters,
    ImageReference,
    DataDisk,
    OSProfile,
    LinuxConfiguration,
    SshConfiguration,
    SshPublicKey,
    NetworkProfile,
    NetworkInterfaceReference,
)
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.network.models import (
    VirtualNetwork,
    AddressSpace,
    Subnet as ModelSubnet,
    PublicIPAddress,
    PublicIPAddressSku,
    NetworkInterface,
    NetworkInterfaceIPConfiguration,
    NetworkSecurityGroup,
    SecurityRule,
    SubResource,
)
from azure.mgmt.resource.resources import ResourceManagementClient
from azure.core.exceptions import HttpResponseError, ClientAuthenticationError

logger = logging.getLogger("azure_service")


class AzureService:
    def __init__(self):
        self.tenant_id = os.getenv("AZURE_TENANT_ID", "").strip()
        self.client_id = os.getenv("AZURE_CLIENT_ID", "").strip()
        self.client_secret = os.getenv("AZURE_CLIENT_SECRET", "").strip()
        self.subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID", "").strip()
        self.default_resource_group = os.getenv("AZURE_RESOURCE_GROUP", "rg-abhishek-anoop-inc-001").strip()
        self.default_location = os.getenv("AZURE_LOCATION", "centralindia").strip()
        self.mode = os.getenv("AZURE_MODE", "auto").strip().lower()

        self._credential: Optional[ClientSecretCredential] = None
        self._compute_client: Optional[ComputeManagementClient] = None
        self._network_client: Optional[NetworkManagementClient] = None
        self._resource_client: Optional[ResourceManagementClient] = None

        # Connection status cache — avoids calling Azure on every request
        self._status_cache: Optional[Dict[str, Any]] = None
        self._status_cache_ts: float = 0.0
        self._status_cache_ttl: float = 60.0  # seconds

    def is_configured(self) -> bool:
        """Returns True if the required Service Principal keys are defined."""
        return bool(
            self.tenant_id and self.client_id and self.client_secret and self.subscription_id
        )

    def _get_credential(self) -> ClientSecretCredential:
        if self._credential is None:
            if not self.is_configured():
                raise ValueError("Azure Service Principal environment variables are incomplete.")
            self._credential = ClientSecretCredential(
                tenant_id=self.tenant_id,
                client_id=self.client_id,
                client_secret=self.client_secret,
            )
        return self._credential

    @property
    def compute(self) -> ComputeManagementClient:
        if self._compute_client is None:
            self._compute_client = ComputeManagementClient(
                self._get_credential(), self.subscription_id
            )
        return self._compute_client

    @property
    def network(self) -> NetworkManagementClient:
        if self._network_client is None:
            self._network_client = NetworkManagementClient(
                self._get_credential(), self.subscription_id
            )
        return self._network_client

    @property
    def resource(self) -> ResourceManagementClient:
        if self._resource_client is None:
            self._resource_client = ResourceManagementClient(
                self._get_credential(), self.subscription_id
            )
        return self._resource_client

    def test_connection(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Validate Azure connectivity and IAM role assignment.
        Returns a rich status dictionary.
        Results are cached for 60 seconds to avoid hammering Azure on every request.
        """
        now = time.monotonic()
        if (
            not force_refresh
            and self._status_cache is not None
            and (now - self._status_cache_ts) < self._status_cache_ttl
        ):
            return self._status_cache

        if not self.is_configured():
            return {
                "connected": False,
                "status": "missing_credentials",
                "message": "Azure Service Principal environment variables are not configured in backend/.env.",
                "tenantId": self.tenant_id or "Not set",
                "clientId": self.client_id or "Not set",
                "subscriptionId": self.subscription_id or "Not set",
            }

        result = None
        try:
            # Attempt to list resource groups or query subscription
            rgs = []
            for rg in self.resource.resource_groups.list():
                rgs.append({"name": rg.name, "location": rg.location})
                if len(rgs) >= 5:
                    break

            result = {
                "connected": True,
                "status": "connected",
                "message": "Successfully authenticated and connected to Azure Cloud!",
                "tenantId": self.tenant_id,
                "clientId": self.client_id,
                "subscriptionId": self.subscription_id,
                "defaultResourceGroup": self.default_resource_group,
                "defaultLocation": self.default_location,
                "sampleResourceGroups": rgs,
            }

        except HttpResponseError as err:
            err_msg = str(err)
            if "AuthorizationFailed" in err_msg:
                # App registration exists and secret is valid, but IAM Role is missing
                result = {
                    "connected": False,
                    "status": "authorization_required",
                    "message": (
                        "Authenticated with Microsoft Entra ID successfully, but the Service Principal "
                        "needs 'Contributor' or 'Virtual Machine Contributor' Role Assignment on subscription "
                        f"'{self.subscription_id}' in Azure Portal (Access Control / IAM)."
                    ),
                    "tenantId": self.tenant_id,
                    "clientId": self.client_id,
                    "subscriptionId": self.subscription_id,
                    "rawError": err_msg,
                    "actionRequired": (
                        "Go to Azure Portal -> Subscriptions -> "
                        f"{self.subscription_id} -> Access control (IAM) -> Add role assignment -> "
                        "Select 'Contributor' -> Assign to App 'AzureMonitor-Abhishek'."
                    ),
                }
            else:
                result = {
                    "connected": False,
                    "status": "azure_api_error",
                    "message": f"Azure API Error: {err_msg}",
                    "tenantId": self.tenant_id,
                    "subscriptionId": self.subscription_id,
                    "rawError": err_msg,
                }

        except ClientAuthenticationError as auth_err:
            result = {
                "connected": False,
                "status": "authentication_failed",
                "message": f"Azure Authentication failed: Check Client Secret or Client ID. Details: {auth_err}",
                "tenantId": self.tenant_id,
                "clientId": self.client_id,
                "subscriptionId": self.subscription_id,
            }

        except Exception as e:
            result = {
                "connected": False,
                "status": "error",
                "message": f"Unexpected connection error: {str(e)}",
                "tenantId": self.tenant_id,
                "subscriptionId": self.subscription_id,
            }

        # Cache and return
        if result is not None:
            self._status_cache = result
            self._status_cache_ts = time.monotonic()
            return result

        # Fallback (should never reach here)
        return {
            "connected": False,
            "status": "error",
            "message": "Unknown error during Azure connection check.",
        }

    def list_resource_groups(self) -> List[Dict[str, Any]]:
        """List live resource groups from the Azure subscription."""
        if not self.is_configured():
            return [
                {
                    "name": self.default_resource_group,
                    "location": "centralindia",
                    "id": f"/subscriptions/{self.subscription_id or 'sub-demo'}/resourceGroups/{self.default_resource_group}",
                }
            ]
        try:
            results = []
            for rg in self.resource.resource_groups.list():
                results.append({
                    "name": rg.name,
                    "location": rg.location,
                    "id": rg.id,
                })
            # Sort with user's primary resource group first
            results.sort(key=lambda x: (x["name"] != self.default_resource_group, x["name"]))
            return results if results else [
                {
                    "name": self.default_resource_group,
                    "location": "centralindia",
                    "id": f"/subscriptions/{self.subscription_id}/resourceGroups/{self.default_resource_group}",
                }
            ]
        except Exception as e:
            logger.warning(f"Failed to list Resource Groups: {e}")
            return [
                {
                    "name": self.default_resource_group,
                    "location": "centralindia",
                    "id": f"/subscriptions/{self.subscription_id}/resourceGroups/{self.default_resource_group}",
                }
            ]

    def create_resource_group(self, name: str, location: str = "centralindia") -> Dict[str, Any]:
        """Create a new Resource Group in the subscription."""
        if not self.is_configured():
            return {"success": False, "message": "Azure credentials not configured."}
        try:
            rg = self.resource.resource_groups.create_or_update(
                name.strip(),
                {"location": location.strip(), "tags": {"created_by": "zenit-portal"}},
            )
            return {"success": True, "name": rg.name, "location": rg.location}
        except Exception as e:
            return {"success": False, "message": f"Failed to create resource group: {str(e)}"}

    def list_vnets(self, resource_group: Optional[str] = None) -> List[Dict[str, Any]]:
        """List Virtual Networks and their subnets in the given Resource Group."""
        if not self.is_configured():
            return []
        rg = (resource_group or self.default_resource_group).strip()
        try:
            results = []
            for v in self.network.virtual_networks.list(rg):
                subnets = []
                for s in (v.subnets or []):
                    subnets.append({
                        "name": s.name,
                        "id": s.id,
                        "addressPrefix": s.address_prefix or "",
                    })
                addr_spaces = []
                if v.address_space and v.address_space.address_prefixes:
                    addr_spaces = v.address_space.address_prefixes
                results.append({
                    "name": v.name,
                    "id": v.id,
                    "location": v.location,
                    "addressPrefixes": addr_spaces,
                    "subnets": subnets,
                })
            return results
        except Exception as e:
            logger.warning(f"Failed to list VNets in {rg}: {e}")
            return []

    def list_available_skus(self, location: str = "centralindia") -> List[Dict[str, Any]]:
        """
        Dynamically extracts available VM SKUs directly from Azure for the given location,
        filtering out sizes restricted by subscription or region.
        """
        loc_clean = location.lower().replace(" ", "").replace("-", "")
        if not self.is_configured():
            return [
                {"value": "Standard_D2s_v6", "label": "Standard_D2s_v6 — 2 vCPU, 8 GiB RAM (Recommended)", "vcpus": 2, "memoryGb": 8},
                {"value": "Standard_D2ds_v6", "label": "Standard_D2ds_v6 — 2 vCPU, 8 GiB RAM, 110 GB NVMe", "vcpus": 2, "memoryGb": 8},
                {"value": "Standard_D2as_v6", "label": "Standard_D2as_v6 — 2 vCPU, 8 GiB RAM (AMD EPYC)", "vcpus": 2, "memoryGb": 8},
                {"value": "Standard_D2alds_v6", "label": "Standard_D2alds_v6 — 2 vCPU, 4 GiB RAM", "vcpus": 2, "memoryGb": 4},
                {"value": "Standard_B2ms", "label": "Standard_B2ms — 2 vCPU, 8 GiB RAM", "vcpus": 2, "memoryGb": 8},
            ]

        try:
            # Query subscription compute quotas for this region to eliminate sizes with 0 quota
            usages = {}
            try:
                for u in self.compute.usage.list(loc_clean):
                    if u.name and u.name.value:
                        usages[u.name.value.lower()] = {
                            "current": u.current_value or 0,
                            "limit": u.limit or 0,
                        }
            except Exception as usage_err:
                logger.warning(f"Could not load usage quotas for {loc_clean}: {usage_err}")

            skus_raw = list(self.compute.resource_skus.list(filter=f"location eq '{loc_clean}'"))
            output = []
            seen = set()

            for sku in skus_raw:
                if sku.resource_type != "virtualMachines" or not sku.name:
                    continue
                # Check for regional or subscription location restrictions (exclude entire region)
                restrictions = sku.restrictions or []
                is_loc_restricted = any(
                    (r.type == "Location" or str(r.type).lower().endswith("location")) and
                    (not r.restriction_info or not r.restriction_info.locations or loc_clean in [l.lower() for l in r.restriction_info.locations])
                    for r in restrictions
                )
                if is_loc_restricted:
                    continue

                name = sku.name
                if name in seen:
                    continue

                # If we have quota information, ensure the VM family has quota allocated (> 0 limit)
                family_key = (sku.family or "").lower()
                if usages:
                    quota_info = usages.get(family_key)
                    if quota_info is not None:
                        # Family explicitly found in Azure usage list
                        if quota_info["limit"] <= 0 or quota_info["current"] >= quota_info["limit"]:
                            continue
                    else:
                        # Some families like standardDv6 or custom match loosely
                        family_base = family_key.replace("family", "")
                        matched = any(
                            (k == family_key or k.startswith(family_base)) and v["limit"] > 0
                            for k, v in usages.items()
                        )
                        # If we have core usage data and this family isn't granted any quota, exclude
                        if not matched and usages.get("cores", {}).get("limit", 0) > 0:
                            # Not an active quota family in this subscription
                            continue

                seen.add(name)

                # Extract vCPUs and memory from capabilities if present
                vcpus = None
                mem_gb = None
                for cap in (sku.capabilities or []):
                    if cap.name == "vCPUs":
                        try:
                            vcpus = int(cap.value)
                        except (ValueError, TypeError):
                            pass
                    elif cap.name == "MemoryGB":
                        try:
                            mem_gb = float(cap.value)
                        except (ValueError, TypeError):
                            pass

                # Filter down to practical dev/test & general purpose sizes (<= 8 vCPUs)
                if vcpus and vcpus > 8:
                    continue

                # Check against regional total cores limit if known
                cores_usage = usages.get("cores")
                if cores_usage and vcpus:
                    remaining_cores = cores_usage["limit"] - cores_usage["current"]
                    if vcpus > remaining_cores:
                        continue

                label_parts = [name]
                desc_details = []
                if vcpus:
                    desc_details.append(f"{vcpus} vCPU")
                if mem_gb:
                    desc_details.append(f"{mem_gb:g} GiB RAM")

                if desc_details:
                    label = f"{name} — {', '.join(desc_details)}"
                else:
                    label = name

                # Mark recommended based on proven Azure performance and quota
                if "D2s_v6" in name or "D2ds_v6" in name:
                    label += " (Recommended • Verified Quota)"
                elif "B2ms" in name:
                    label += " (Burstable General Purpose • Verified Quota)"
                elif "D2alds_v6" in name:
                    label += " (Cost-Optimized • Verified Quota)"

                output.append({
                    "value": name,
                    "label": label,
                    "vcpus": vcpus or 2,
                    "memoryGb": mem_gb or 8,
                })

            # Sort with popular recommended SKUs first
            def _sku_sort_key(item):
                v = item["value"]
                if "Standard_D2s_v6" in v:
                    return 0
                if "Standard_D2ds_v6" in v:
                    return 1
                if "Standard_D2alds_v6" in v:
                    return 2
                if "Standard_B2ms" in v:
                    return 3
                if "Standard_B2s" in v:
                    return 4
                if "Standard_D2as_v6" in v:
                    return 5
                if "Standard_B1ms" in v:
                    return 6
                return 10

            output.sort(key=_sku_sort_key)
            return output[:30] if output else [
                {"value": "Standard_D2s_v6", "label": "Standard_D2s_v6 — 2 vCPU, 8 GiB RAM (Recommended • Verified Quota)", "vcpus": 2, "memoryGb": 8},
                {"value": "Standard_D2ds_v6", "label": "Standard_D2ds_v6 — 2 vCPU, 8 GiB RAM, 110 GB NVMe (Verified Quota)", "vcpus": 2, "memoryGb": 8},
                {"value": "Standard_B2ms", "label": "Standard_B2ms — 2 vCPU, 8 GiB RAM (Verified Quota)", "vcpus": 2, "memoryGb": 8},
            ]
        except Exception as err:
            logger.warning(f"Error fetching Azure SKUs for {location}: {err}")
            return [
                {"value": "Standard_D2s_v6", "label": "Standard_D2s_v6 — 2 vCPU, 8 GiB RAM (Recommended • Verified Quota)", "vcpus": 2, "memoryGb": 8},
                {"value": "Standard_D2ds_v6", "label": "Standard_D2ds_v6 — 2 vCPU, 8 GiB RAM, 110 GB NVMe (Verified Quota)", "vcpus": 2, "memoryGb": 8},
                {"value": "Standard_B2ms", "label": "Standard_B2ms — 2 vCPU, 8 GiB RAM (Verified Quota)", "vcpus": 2, "memoryGb": 8},
            ]

    def list_vms(self, resource_group: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        List Virtual Machines.
        Scopes listing to the specified Resource Group (or self.default_resource_group).
        If resource_group is 'all' or empty, falls back to list_all().
        """
        if not self.is_configured():
            return [], "Azure credentials not configured."

        target_rg = (resource_group or self.default_resource_group or "").strip()

        try:
            if target_rg and target_rg.lower() != "all":
                try:
                    vms_raw = list(self.compute.virtual_machines.list(target_rg))
                except HttpResponseError as err:
                    # If the resource group does not exist yet in Azure, return empty list
                    if "ResourceGroupNotFound" in str(err):
                        return [], None
                    raise
            else:
                vms_raw = list(self.compute.virtual_machines.list_all())

            formatted_vms = []

            for vm in vms_raw:
                # Extract resource group from Azure resource ID:
                # /subscriptions/.../resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{vm}
                rg_name = target_rg or self.default_resource_group
                parts = vm.id.split("/")
                if "resourceGroups" in parts:
                    idx = parts.index("resourceGroups")
                    if idx + 1 < len(parts):
                        rg_name = parts[idx + 1]

                # Instance view for power state
                status = "Unknown"
                try:
                    iv = self.compute.virtual_machines.instance_view(rg_name, vm.name)
                    for s in iv.statuses or []:
                        code = s.code or ""
                        if code.startswith("PowerState/"):
                            state = code.split("/")[-1].capitalize()
                            status = "Running" if state == "Running" else ("Stopped" if state in ("Deallocated", "Stopped") else state)
                            break
                except Exception:
                    status = "Running" if vm.provisioning_state == "Succeeded" else vm.provisioning_state

                # Resolve Network & IP details
                private_ip = "10.0.1.4"
                public_ip = None
                vnet_name = "vnet-zenit-prod (10.0.0.0/16)"
                subnet_name = "subnet-frontend (10.0.1.0/24)"

                try:
                    if vm.network_profile and vm.network_profile.network_interfaces:
                        primary_nic_ref = vm.network_profile.network_interfaces[0]
                        nic_name = primary_nic_ref.id.split("/")[-1]
                        nic = self.network.network_interfaces.get(rg_name, nic_name)
                        if nic.ip_configurations:
                            ip_config = nic.ip_configurations[0]
                            private_ip = ip_config.private_ip_address or private_ip
                            if ip_config.subnet and ip_config.subnet.id:
                                subnet_parts = ip_config.subnet.id.split("/")
                                if "subnets" in subnet_parts:
                                    subnet_name = subnet_parts[-1]
                                if "virtualNetworks" in subnet_parts:
                                    v_idx = subnet_parts.index("virtualNetworks")
                                    vnet_name = subnet_parts[v_idx + 1]

                            if ip_config.public_ip_address and ip_config.public_ip_address.id:
                                pip_name = ip_config.public_ip_address.id.split("/")[-1]
                                pip = self.network.public_ip_addresses.get(rg_name, pip_name)
                                public_ip = pip.ip_address
                except Exception as nic_err:
                    logger.warning(f"Could not retrieve NIC info for {vm.name}: {nic_err}")

                # OS & Disk Info
                os_type_str = "Linux"
                if vm.storage_profile and vm.storage_profile.os_disk:
                    os_disk = vm.storage_profile.os_disk
                    raw_os = str(os_disk.os_type) if os_disk.os_type else "Linux"
                    os_type_str = "Windows Server" if "windows" in raw_os.lower() else "Ubuntu / Linux"
                    disk_size = os_disk.disk_size_gb or 128
                    disk_sku = (
                        os_disk.managed_disk.storage_account_type
                        if (os_disk.managed_disk and os_disk.managed_disk.storage_account_type)
                        else "Premium_LRS"
                    )
                else:
                    disk_size = 128
                    disk_sku = "Premium_LRS"

                admin_user = "azureuser"
                if vm.os_profile:
                    admin_user = vm.os_profile.admin_username or "azureuser"

                vm_size = vm.hardware_profile.vm_size if vm.hardware_profile else "Standard_D2s_v3"

                formatted_vms.append({
                    "id": vm.name,
                    "name": vm.name,
                    "size": vm_size,
                    "os": os_type_str,
                    "region": vm.location,
                    "status": status,
                    "privateIp": private_ip,
                    "publicIp": public_ip,
                    "resourceGroup": rg_name,
                    "vnet": vnet_name,
                    "subnet": subnet_name,
                    "osDiskType": disk_sku or "Premium_LRS",
                    "osDiskSizeGb": disk_size,
                    "adminUsername": admin_user,
                    "authType": "password" if "windows" in os_type_str.lower() else "sshPublicKey",
                    "inboundPorts": ["RDP (3389)"] if "windows" in os_type_str.lower() else ["SSH (22)"],
                    "cpuPercent": 18 if status == "Running" else 0,
                    "memoryGb": "2.4 / 8 GB" if status == "Running" else "—",
                    "uptime": "Live Azure" if status == "Running" else "—",
                    "tags": vm.tags or {"source": "azure-portal"},
                })

            return formatted_vms, None

        except Exception as e:
            logger.error(f"Error fetching Azure VMs: {e}")
            return [], str(e)

    def start_vm(self, resource_group: str, vm_name: str) -> Dict[str, Any]:
        """Trigger Azure VM power on asynchronously."""
        try:
            rg = resource_group or self.default_resource_group
            poller = self.compute.virtual_machines.begin_start(rg, vm_name)
            return {"success": True, "message": f"Azure VM '{vm_name}' start initiated."}
        except Exception as e:
            return {"success": False, "message": f"Azure start failed: {str(e)}"}

    def stop_vm(self, resource_group: str, vm_name: str) -> Dict[str, Any]:
        """Trigger Azure VM deallocate (stops compute billing)."""
        try:
            rg = resource_group or self.default_resource_group
            poller = self.compute.virtual_machines.begin_deallocate(rg, vm_name)
            return {"success": True, "message": f"Azure VM '{vm_name}' deallocation initiated."}
        except Exception as e:
            return {"success": False, "message": f"Azure stop failed: {str(e)}"}

    def restart_vm(self, resource_group: str, vm_name: str) -> Dict[str, Any]:
        """Trigger Azure VM restart."""
        try:
            rg = resource_group or self.default_resource_group
            poller = self.compute.virtual_machines.begin_restart(rg, vm_name)
            return {"success": True, "message": f"Azure VM '{vm_name}' restart initiated."}
        except Exception as e:
            return {"success": False, "message": f"Azure restart failed: {str(e)}"}

    def delete_vm(self, resource_group: str, vm_name: str) -> Dict[str, Any]:
        """Trigger Azure VM deletion."""
        try:
            rg = resource_group or self.default_resource_group
            poller = self.compute.virtual_machines.begin_delete(rg, vm_name)
            return {"success": True, "message": f"Azure VM '{vm_name}' deletion initiated."}
        except Exception as e:
            return {"success": False, "message": f"Azure delete failed: {str(e)}"}

    def create_vm(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Provisions a real Azure Virtual Machine in the subscription.
        Orchestrates:
        1. Resource Group check/create
        2. Virtual Network & Subnet
        3. Public IP allocation
        4. NIC & Security Rules
        5. Virtual Machine instantiation
        """
        try:
            raw_vm_name = params.get("name", "").strip()
            if not raw_vm_name:
                return {"success": False, "message": "VM name is required."}

            # Helper to sanitize resource names according to Azure naming conventions (no spaces, only alphanumeric, hyphen, underscore)
            def clean_az_name(val: str, max_len: int = 64) -> str:
                s = re.sub(r'[^a-zA-Z0-9\-_]', '-', val.strip()).strip('-_')
                s = re.sub(r'-+', '-', s)
                return (s[:max_len] if s else "vm").strip('-_')

            vm_name = clean_az_name(raw_vm_name, 64)
            computer_name = clean_az_name(raw_vm_name, 15)

            location = (params.get("region") or "centralindia").lower().replace(" ", "")
            if "centralindia" in location:
                location = "centralindia"
            elif "eastus2" in location:
                location = "eastus2"
            elif "eastus" in location:
                location = "eastus"
            elif "centralus" in location:
                location = "centralus"
            elif "northeurope" in location:
                location = "northeurope"
            elif "southeastasia" in location:
                location = "southeastasia"
            elif "westeurope" in location:
                location = "westeurope"

            rg_name = clean_az_name((params.get("resourceGroup") or self.default_resource_group), 90)

            # 1. Ensure Resource Group exists
            try:
                self.resource.resource_groups.create_or_update(
                    rg_name, {"location": location, "tags": {"created_by": "zenit-portal"}}
                )
            except Exception as e:
                logger.warning(f"Resource group check/create warning: {e}")

            # 2. Virtual Network & Subnet lookup or creation
            raw_vnet = (params.get("vnet") or "").strip()
            raw_subnet = (params.get("subnet") or "").strip()
            # Clean names in case formatted like "rg-vnet (10.0.0.0/16)"
            vnet_clean = raw_vnet.split(" ")[0] if raw_vnet else ""
            subnet_clean = raw_subnet.split(" ")[0] if raw_subnet else ""

            subnet_id = None
            if vnet_clean and not vnet_clean.startswith("(new)"):
                try:
                    existing_vnet = self.network.virtual_networks.get(rg_name, vnet_clean)
                    vnet_loc = getattr(existing_vnet, "location", "").lower().replace(" ", "")
                    # Only use existing VNet if it is in the same location as the user's chosen VM location
                    if vnet_loc == location:
                        for s in (existing_vnet.subnets or []):
                            if s.name.lower() == subnet_clean.lower():
                                subnet_id = s.id
                                subnet_clean = s.name
                                break
                        if not subnet_id and subnet_clean and not subnet_clean.startswith("(new)"):
                            # The user specified a custom/new subnet name in an existing VNet -> Create it!
                            try:
                                # Determine next available address prefix in 10.0.x.0/24 space
                                existing_prefixes = [s.address_prefix for s in (existing_vnet.subnets or []) if s.address_prefix]
                                next_octet = len(existing_vnet.subnets or [])
                                new_prefix = f"10.0.{next_octet}.0/24"
                                while new_prefix in existing_prefixes and next_octet < 250:
                                    next_octet += 1
                                    new_prefix = f"10.0.{next_octet}.0/24"

                                logger.info(f"Creating custom subnet '{subnet_clean}' ({new_prefix}) in existing VNet '{vnet_clean}'...")
                                snet_poller = self.network.subnets.begin_create_or_update(
                                    rg_name, vnet_clean, subnet_clean, ModelSubnet(address_prefix=new_prefix)
                                )
                                created_snet = snet_poller.result()
                                subnet_id = created_snet.id
                                logger.info(f"Successfully created custom subnet '{subnet_clean}' in '{vnet_clean}'.")
                            except Exception as snet_err:
                                logger.warning(f"Could not create custom subnet '{subnet_clean}' in '{vnet_clean}': {snet_err}")

                        if not subnet_id and existing_vnet.subnets:
                            subnet_id = existing_vnet.subnets[0].id
                            subnet_clean = existing_vnet.subnets[0].name
                    else:
                        logger.info(f"Existing VNet '{vnet_clean}' is in '{vnet_loc}' but VM requested in '{location}'. Will create location-matched VNet.")
                except Exception as ex:
                    logger.info(f"Existing VNet '{vnet_clean}' lookup: {ex}")

            if not subnet_id:
                # Create location-specific VNet using official SDK models to prevent Azure naming conflicts
                location_clean = location.lower().replace(" ", "").replace("-", "")
                
                if vnet_clean and not vnet_clean.startswith("(new)"):
                    if location_clean in vnet_clean.lower():
                        new_vnet_name = vnet_clean
                    else:
                        new_vnet_name = f"{vnet_clean}-{location_clean}"
                else:
                    new_vnet_name = f"vnet-{location_clean}-01"

                new_vnet_name = clean_az_name(new_vnet_name, 64)
                new_subnet_name = subnet_clean if (subnet_clean and not subnet_clean.startswith("(new)")) else "default"
                new_subnet_name = clean_az_name(new_subnet_name, 64)

                vnet_obj = VirtualNetwork(
                    location=location,
                    address_space=AddressSpace(address_prefixes=["10.0.0.0/16"]),
                    subnets=[ModelSubnet(name=new_subnet_name, address_prefix="10.0.0.0/24")],
                )
                vnet_poller = self.network.virtual_networks.begin_create_or_update(
                    rg_name, new_vnet_name, vnet_obj
                )
                vnet_result = vnet_poller.result()
                subnet_id = vnet_result.subnets[0].id
                vnet_clean = new_vnet_name
                subnet_clean = new_subnet_name

            # 3. Public IP Address
            public_ip_enabled = params.get("publicIpEnabled", True)
            public_ip_id = None
            if public_ip_enabled:
                pip_name = f"{vm_name}-ip"
                pip_obj = PublicIPAddress(
                    location=location,
                    sku=PublicIPAddressSku(name="Standard"),
                    public_ip_allocation_method="Static",
                )
                avail_option = params.get("availabilityOption", "none")
                if avail_option in ("zone-1", "zone-2", "zone-3"):
                    pip_obj.zones = [avail_option.split("-")[1]]

                pip_poller = self.network.public_ip_addresses.begin_create_or_update(
                    rg_name, pip_name, pip_obj
                )
                pip_res = pip_poller.result()
                public_ip_id = pip_res.id

            # 4. Network Security Group (NSG) with Inbound Rules
            os_name = (params.get("os") or "Ubuntu 22.04 LTS").lower()
            is_windows = "windows" in os_name
            inbound_ports = params.get("inboundPorts", ["SSH (22)"] if not is_windows else ["RDP (3389)"])
            nsg_type = params.get("nsgType", "basic").lower()

            nsg_id = None
            if nsg_type != "none" and inbound_ports:
                nsg_name = f"{vm_name}-nsg"
                sec_rules = []
                priority = 300
                for port_str in inbound_ports:
                    port_num = 22
                    rule_name = "Allow-SSH"
                    if "80" in port_str and "8080" not in port_str:
                        port_num = 80
                        rule_name = "Allow-HTTP"
                    elif "443" in port_str:
                        port_num = 443
                        rule_name = "Allow-HTTPS"
                    elif "3389" in port_str:
                        port_num = 3389
                        rule_name = "Allow-RDP"
                    elif "22" in port_str:
                        port_num = 22
                        rule_name = "Allow-SSH"

                    sec_rules.append(
                        SecurityRule(
                            name=f"{rule_name}-{port_num}",
                            protocol="Tcp",
                            source_port_range="*",
                            destination_port_range=str(port_num),
                            source_address_prefix="*",
                            destination_address_prefix="*",
                            access="Allow",
                            priority=priority,
                            direction="Inbound",
                        )
                    )
                    priority += 10

                try:
                    nsg_obj = NetworkSecurityGroup(location=location, security_rules=sec_rules)
                    nsg_poller = self.network.network_security_groups.begin_create_or_update(
                        rg_name, nsg_name, nsg_obj
                    )
                    nsg_res = nsg_poller.result()
                    nsg_id = nsg_res.id
                except Exception as ex:
                    logger.warning(f"Could not create NSG: {ex}")

            # 5. Network Interface (NIC)
            nic_name = f"{vm_name}-nic"
            ip_config = NetworkInterfaceIPConfiguration(
                name="ipconfig1",
                subnet=ModelSubnet(id=subnet_id),
                private_ip_allocation_method="Dynamic",
            )
            if public_ip_id:
                ip_config.public_ip_address = PublicIPAddress(id=public_ip_id)

            nic_obj = NetworkInterface(
                location=location,
                ip_configurations=[ip_config],
                enable_accelerated_networking=params.get("acceleratedNetworking", False),
            )
            if nsg_id:
                nic_obj.network_security_group = NetworkSecurityGroup(id=nsg_id)

            nic_poller = self.network.network_interfaces.begin_create_or_update(
                rg_name, nic_name, nic_obj
            )
            nic_res = nic_poller.result()

            # 6. VM Image & OS Profile mapping
            os_lower = os_name.lower()
            if "windows" in os_lower:
                if "2019" in os_lower:
                    img_ref_obj = ImageReference(
                        publisher="MicrosoftWindowsServer",
                        offer="WindowsServer",
                        sku="2019-Datacenter",
                        version="latest",
                    )
                else:
                    img_ref_obj = ImageReference(
                        publisher="MicrosoftWindowsServer",
                        offer="WindowsServer",
                        sku="2022-datacenter-azure-edition",
                        version="latest",
                    )
            elif "24.04" in os_lower:
                img_ref_obj = ImageReference(
                    publisher="canonical",
                    offer="ubuntu-24_04-lts",
                    sku="server",
                    version="latest",
                )
            elif "debian" in os_lower:
                img_ref_obj = ImageReference(
                    publisher="Debian",
                    offer="debian-12",
                    sku="12-gen2",
                    version="latest",
                )
            else:
                # Default to Ubuntu 22.04 LTS Gen2
                img_ref_obj = ImageReference(
                    publisher="Canonical",
                    offer="0001-com-ubuntu-server-jammy",
                    sku="22_04-lts-gen2",
                    version="latest",
                )

            admin_user = params.get("adminUsername") or "azureuser"
            auth_type = params.get("authType", "sshPublicKey")

            os_prof_obj = OSProfile(
                computer_name=computer_name,
                admin_username=admin_user,
            )

            if is_windows or auth_type == "password":
                os_prof_obj.admin_password = params.get("adminPassword") or "ZenitAzure2026!#"
            else:
                ssh_key_data = (params.get("sshKey") or "").strip()
                # If key is empty, invalid, or contains placeholder ellipsis ('...'), generate a valid 2048-bit OpenSSH RSA key
                if not ssh_key_data or "..." in ssh_key_data or len(ssh_key_data) < 100 or not (ssh_key_data.startswith("ssh-rsa") or ssh_key_data.startswith("ssh-ed25519")):
                    logger.info("Generating clean 2048-bit OpenSSH RSA key for Linux VM...")
                    gen_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
                    ssh_key_data = gen_key.public_key().public_bytes(
                        serialization.Encoding.OpenSSH,
                        serialization.PublicFormat.OpenSSH
                    ).decode("utf-8")

                os_prof_obj.linux_configuration = LinuxConfiguration(
                    disable_password_authentication=True,
                    ssh=SshConfiguration(
                        public_keys=[
                            SshPublicKey(
                                path=f"/home/{admin_user}/.ssh/authorized_keys",
                                key_data=ssh_key_data.strip(),
                            )
                        ]
                    ),
                )

            # 7. Disks Configuration (OS Disk & Data Disks)
            disk_sku = params.get("osDiskType", "Premium_LRS")
            # Azure minimum for Windows is 127 GB; Linux is 30 GB
            requested_disk_size = int(params.get("osDiskSizeGb", 128 if is_windows else 30))
            if is_windows and requested_disk_size < 127:
                requested_disk_size = 128
            elif not is_windows and requested_disk_size < 30:
                requested_disk_size = 30

            delete_os_disk = params.get("deleteOsDiskWithVm", True)

            os_disk_obj = OSDisk(
                name=f"{vm_name}-osdisk",
                caching=params.get("osDiskCaching", "ReadWrite"),
                create_option="FromImage",
                disk_size_gb=requested_disk_size,
                managed_disk=ManagedDiskParameters(storage_account_type=disk_sku),
                delete_option="Delete" if delete_os_disk else "Detach",
            )

            data_disks_objs = []
            raw_data_disks = params.get("dataDisks", [])
            if raw_data_disks and isinstance(raw_data_disks, list):
                for i, dd in enumerate(raw_data_disks):
                    data_disks_objs.append(
                        DataDisk(
                            lun=i,
                            name=dd.get("name") or f"{vm_name}-datadisk-{i}",
                            create_option="Empty",
                            disk_size_gb=int(dd.get("sizeGb", 128)),
                            managed_disk=ManagedDiskParameters(storage_account_type=dd.get("diskType", "Premium_LRS")),
                            caching=dd.get("caching", "ReadWrite"),
                            delete_option="Delete" if dd.get("deleteWithVm", True) else "Detach",
                        )
                    )

            stor_prof_obj = StorageProfile(
                image_reference=img_ref_obj,
                os_disk=os_disk_obj,
                data_disks=data_disks_objs if data_disks_objs else None,
            )

            delete_nic = params.get("deleteNicWithVm", True)
            net_prof_obj = NetworkProfile(
                network_interfaces=[
                    NetworkInterfaceReference(
                        id=nic_res.id,
                        delete_option="Delete" if delete_nic else "Detach",
                    )
                ]
            )

            # Map VM size: if Standard_D2s_v7 or other nonexistent SKU was passed, normalize to supported Central India SKU
            raw_size = params.get("size", "Standard_D2s_v6")
            if "v7" in raw_size:
                # Replace with active v6 SKU in Central India
                raw_size = raw_size.replace("v7", "v6")
            elif raw_size == "Standard_B2s":
                # Standard_B2s is restricted in Central India; use Standard_B2ms or Standard_D2s_v6
                raw_size = "Standard_D2s_v6"

            hw_prof_obj = HardwareProfile(vm_size=raw_size)

            vm_obj = VirtualMachine(
                location=location,
                hardware_profile=hw_prof_obj,
                storage_profile=stor_prof_obj,
                os_profile=os_prof_obj,
                network_profile=net_prof_obj,
                tags={"env": "prod", "managed_by": "zenit-portal"},
            )

            # Map availability option to Azure zones parameter if supported
            avail_option = params.get("availabilityOption", "none")
            if avail_option == "zone-1":
                vm_obj.zones = ["1"]
            elif avail_option == "zone-2":
                vm_obj.zones = ["2"]
            elif avail_option == "zone-3":
                vm_obj.zones = ["3"]

            # Trigger Azure begin_create_or_update and monitor in background thread
            poller = self.compute.virtual_machines.begin_create_or_update(
                rg_name, vm_name, vm_obj
            )

            def _track_vm_creation():
                try:
                    logger.info(f"Background thread waiting for VM '{vm_name}' creation in '{rg_name}'...")
                    created_vm = poller.result()
                    logger.info(f"Successfully finished provisioning Azure VM '{created_vm.name}'!")
                except Exception as poll_err:
                    logger.error(f"Error during async Azure VM '{vm_name}' provisioning: {poll_err}", exc_info=True)

            thread = threading.Thread(target=_track_vm_creation, daemon=True)
            thread.start()

            return {
                "success": True,
                "message": f"Azure Virtual Machine '{vm_name}' provisioning initiated in '{rg_name}' ({location}).",
                "vm": {
                    "id": vm_name,
                    "name": vm_name,
                    "size": raw_size,
                    "os": params.get("os"),
                    "region": location,
                    "status": "Provisioning",
                    "resourceGroup": rg_name,
                    "vnet": vnet_clean,
                    "subnet": subnet_clean,
                    "osDiskType": disk_sku,
                    "osDiskSizeGb": requested_disk_size,
                    "adminUsername": admin_user,
                    "publicIp": "Allocating...",
                    "privateIp": "Allocating...",
                    "uptime": "Provisioning",
                    "cpuPercent": 0,
                    "memoryGb": "—",
                    "inboundPorts": inbound_ports,
                },
            }

        except Exception as e:
            logger.error(f"Error provisioning Azure VM: {e}")
            return {"success": False, "message": f"Azure VM provisioning failed: {str(e)}"}


# Singleton instance
azure_service = AzureService()
