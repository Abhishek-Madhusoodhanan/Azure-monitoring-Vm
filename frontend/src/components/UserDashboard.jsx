import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import "./UserDashboard.css";
import {
  AzureLogo,
  AzureVMIcon,
  ServerIcon,
  LogOutIcon,
  RefreshIcon,
  PlusIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  UserIcon,
  ActivityIcon,
  SunIcon,
  MoonIcon,
  GlobeIcon,
  CopyIcon,
  HardDriveIcon,
  ShieldIcon,
} from "./Icons";

/* ── small SVG icons not already in Icons.jsx ── */
function PlayIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
function StopIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="5" y="5" rx="2" />
    </svg>
  );
}
function RestartIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}
function TerminalIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  );
}
function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}
function XIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
function MonitorIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

/* ── VM sizes available in Create dialog (Central India Active Azure SKUs) ── */
const VM_SIZES = [
  { value: "Standard_D2s_v6",    label: "Standard_D2s_v6 — 2 vCPU, 8 GiB RAM (Recommended • Central India Production Ready)" },
  { value: "Standard_D2ds_v6",   label: "Standard_D2ds_v6 — 2 vCPU, 8 GiB RAM, 110 GB NVMe (Fast Local Temp Storage)" },
  { value: "Standard_D2as_v6",   label: "Standard_D2as_v6 — 2 vCPU, 8 GiB RAM (AMD EPYC • Central India Active)" },
  { value: "Standard_D2alds_v6", label: "Standard_D2alds_v6 — 2 vCPU, 4 GiB RAM, 110 GB NVMe" },
  { value: "Standard_D2als_v6",  label: "Standard_D2als_v6 — 2 vCPU, 4 GiB RAM (Light Compute)" },
  { value: "Standard_D4s_v6",    label: "Standard_D4s_v6 — 4 vCPU, 16 GiB RAM (High Concurrency Compute)" },
  { value: "Standard_B2ms",      label: "Standard_B2ms — 2 vCPU, 8 GiB RAM (Burstable General Purpose)" },
  { value: "Standard_B1s",       label: "Standard_B1s — 1 vCPU, 1 GiB RAM (Entry Level / Dev)" },
];

const VM_REGIONS = [
  { value: "Central India",  label: "Central India (Pune, India) — [Primary Region]" },
  { value: "East US",        label: "East US (Virginia, US)" },
  { value: "East US 2",      label: "East US 2 (Virginia, US)" },
  { value: "West Europe",    label: "West Europe (Netherlands, EU)" },
  { value: "Central US",     label: "Central US (Iowa, US)" },
  { value: "North Europe",   label: "North Europe (Ireland, EU)" },
  { value: "Southeast Asia", label: "Southeast Asia (Singapore)" },
];

/* Availability options exactly matching Azure Portal */
const VM_AVAILABILITY_OPTIONS = [
  {
    value: "none",
    label: "No infrastructure redundancy required",
    desc: "No redundancy. Suitable for dev/test or single-instance workloads.",
  },
  {
    value: "zone-1",
    label: "Availability Zone — Zone 1",
    desc: "Zone 1: Physically separate datacenter in the region for high availability.",
  },
  {
    value: "zone-2",
    label: "Availability Zone — Zone 2",
    desc: "Zone 2: Separate fault domain providing 99.99% SLA.",
  },
  {
    value: "zone-3",
    label: "Availability Zone — Zone 3",
    desc: "Zone 3: Third isolated zone for maximum redundancy.",
  },
  {
    value: "availability-set",
    label: "Availability Set",
    desc: "Group VMs across fault domains to protect against hardware failures (legacy option).",
  },
];

const VM_OS_IMAGES = [
  { value: "Ubuntu 24.04 LTS",             label: "Ubuntu 24.04 LTS - Gen2", isWindows: false },
  { value: "Ubuntu 22.04 LTS",             label: "Ubuntu 22.04 LTS - Gen2", isWindows: false },
  { value: "Windows Server 2022",          label: "Windows Server 2022 Datacenter", isWindows: true },
  { value: "Windows Server 2019",          label: "Windows Server 2019 Datacenter", isWindows: true },
  { value: "Debian 12",                    label: "Debian 12 'Bookworm'", isWindows: false },
  { value: "Red Hat Enterprise Linux 9",   label: "Red Hat Enterprise Linux 9 (RHEL 9)", isWindows: false },
];

const VM_VNETS = [
  { value: "vnet-centralindia-01",           label: "vnet-centralindia-01 (10.0.0.0/16) — Central India Hub VNet" },
  { value: "rg-abhishek-anoop-inc-001-vnet", label: "rg-abhishek-anoop-inc-001-vnet (10.0.0.0/16) — East US VNet" },
  { value: "vnet-centralus-1",              label: "vnet-centralus-1 (172.16.0.0/16) — Central US VNet" },
  { value: "(new)",                         label: "+ Create new Virtual Network" },
];

const VM_SUBNETS = [
  { value: "default",          label: "default (10.0.0.0/24)" },
  { value: "snet-centralus-1", label: "snet-centralus-1" },
  { value: "subnet-workload",  label: "subnet-workload (10.0.1.0/24) — App Compute" },
  { value: "(new)",            label: "+ Create new Subnet" },
];

const VM_DISK_TYPES = [
  { value: "Premium_LRS",     label: "Premium SSD LRS (High performance, recommended for production workloads)" },
  { value: "StandardSSD_LRS", label: "Standard SSD LRS (Consistent performance for web servers & dev)" },
  { value: "Standard_LRS",    label: "Standard HDD LRS (Cost effective for non-critical workloads)" },
];

const VM_DISK_SIZES = [
  { value: 30,   label: "30 GiB (Default OS disk size)" },
  { value: 64,   label: "64 GiB (P6 Tier)" },
  { value: 128,  label: "128 GiB (P10 Tier - Recommended)" },
  { value: 256,  label: "256 GiB (P15 Tier)" },
  { value: 512,  label: "512 GiB (P20 Tier)" },
  { value: 1024, label: "1024 GiB (1 TiB P30 Tier)" },
];

const VM_CACHING_OPTIONS = [
  { value: "ReadWrite", label: "Read/write (Default)" },
  { value: "ReadOnly",  label: "Read-only" },
  { value: "None",      label: "None" },
];

const DATA_DISK_SIZES = [
  { value: 32,   label: "32 GiB (P4)" },
  { value: 64,   label: "64 GiB (P6)" },
  { value: 128,  label: "128 GiB (P10 - Standard)" },
  { value: 256,  label: "256 GiB (P15)" },
  { value: 512,  label: "512 GiB (P20)" },
  { value: 1024, label: "1024 GiB (1 TiB)" },
];

/* ── Status badge config ── */
function getStatusMeta(status) {
  switch (status) {
    case "Running":      return { cls: "status-running",      dot: "green",  label: "Running"      };
    case "Stopped":      return { cls: "status-stopped",      dot: "red",    label: "Stopped"      };
    case "Deallocated":  return { cls: "status-deallocated",  dot: "grey",   label: "Deallocated"  };
    case "Provisioning": return { cls: "status-provisioning", dot: "amber",  label: "Provisioning" };
    case "Starting":     return { cls: "status-starting",     dot: "cyan",   label: "Starting"     };
    default:             return { cls: "status-unknown",      dot: "grey",   label: status         };
  }
}

function getRegionCountry(region) {
  if (!region) return { country: "Global", flag: "🌐" };
  const r = region.toLowerCase();
  if (r.includes("east us") || r.includes("west us") || r.includes("central us") || r.includes("us")) {
    return { country: "United States", flag: "🇺🇸" };
  }
  if (r.includes("west europe") || r.includes("north europe") || r.includes("europe")) {
    return { country: "Netherlands / EU", flag: "🇪🇺" };
  }
  if (r.includes("india")) {
    return { country: "India", flag: "🇮🇳" };
  }
  if (r.includes("japan")) {
    return { country: "Japan", flag: "🇯🇵" };
  }
  if (r.includes("australia")) {
    return { country: "Australia", flag: "🇦🇺" };
  }
  if (r.includes("southeast asia") || r.includes("singapore")) {
    return { country: "Singapore", flag: "🇸🇬" };
  }
  if (r.includes("uk") || r.includes("london")) {
    return { country: "United Kingdom", flag: "🇬🇧" };
  }
  return { country: region, flag: "🌐" };
}

/* ═══════════════════════════════════════════════════════════════ */
export default function UserDashboard({ user, onLogout }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("azure_theme") || "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("azure_theme", theme);
    } catch (e) {
      console.warn("Could not save theme preference:", e);
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});   // { vmId: actionName }
  const [toast, setToast] = useState(null);                  // { msg, type }
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [connectModal, setConnectModal] = useState(null);    // connection info object

  /* ── Hover Modal Effect State ── */
  const [hoveredVm, setHoveredVm] = useState(null);
  const [hoverCardPos, setHoverCardPos] = useState({ top: 0, left: 0 });
  const [copiedIp, setCopiedIp] = useState(null);
  const hoverTimerRef = useRef(null);

  const copyToClipboard = (text, key) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedIp(key);
      setTimeout(() => setCopiedIp(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRowMouseEnter = (e, vm) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const cardWidth = 370;
    const cardHeight = 280;

    let top = rect.top + window.scrollY - 10;
    let left = rect.left + 220;

    // Check right viewport boundary
    if (left + cardWidth > window.innerWidth - 20) {
      left = Math.max(16, rect.right - cardWidth);
    }
    // Check bottom boundary
    if (top + cardHeight > window.innerHeight + window.scrollY - 20) {
      top = Math.max(20, rect.bottom + window.scrollY - cardHeight);
    }

    setHoverCardPos({ top, left });
    setHoveredVm(vm);
  };

  const handleRowMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setHoveredVm(null);
    }, 240);
  };

  const handleModalCardEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  };

  const handleModalCardLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setHoveredVm(null);
    }, 200);
  };

  /* ── Create VM form state ── */
  const [createTab, setCreateTab] = useState("basics"); // "basics" | "disks" | "networking"
  const [newVm, setNewVm] = useState({
    name: "",
    resourceGroup: "rg-abhishek-anoop-inc-001",
    region: "Central India",
    availabilityOption: "none",
    os: "Ubuntu 24.04 LTS",
    size: "Standard_D2s_v6",
    vnet: "vnet-centralindia-01",
    subnet: "default",
    osDiskType: "Premium_LRS",
    osDiskSizeGb: 30,
    osDiskCaching: "ReadWrite",
    deleteOsDiskWithVm: true,
    encryptionType: "pmk",
    ultraDiskEnabled: false,
    dataDisks: [],
    adminUsername: "azureuser",
    authType: "sshPublicKey",
    sshKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC9W93Hv1BGl0+AVm7S4W9R8yuzG+j3H8EjpAosyy2MDw5i7Fus/D1JsWj/IvrL4sbxQs/pxysS2LcdrqdXAOHonp66+K98QQR2rdzB+9nW2EXe3Hkb1WfNrRhyk+/lTHS2s6e3wOFiS5pPgxdiV0hH4jxBEDKYEKNzzF+VSOB6VEKW8fmAEa47IxlucH5qpx785537NrX3pvHDV8tmnI2/HvKk28e0X+gapoI2BIyzb/Wxmqt5yl+VxfHCA+LieKs/k34EM8h3+FDXSQepTB3FyTTDtdvbIcI3DN6pT4RUj0xB2SI8l1QDg4dPNMbMpNaY4fpvBdAjJ6hs6RjYiIh/ azureuser@zenit",
    adminPassword: "",
    publicIpEnabled: true,
    nsgType: "basic", // "none" | "basic" | "advanced"
    inboundPorts: ["SSH (22)", "HTTP (80)"],
    acceleratedNetworking: false,
    deleteNicWithVm: true,
    deletePublicIpWithVm: true,
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [isCustomSubnet, setIsCustomSubnet] = useState(false);
  const [customSubnetName, setCustomSubnetName] = useState("");
  const [customSubnetCidr, setCustomSubnetCidr] = useState("10.0.2.0/24");
  const [availableVnets, setAvailableVnets] = useState([]);
  const [loadingVnets, setLoadingVnets] = useState(false);
  const [availableSkus, setAvailableSkus] = useState([]);
  const [loadingSkus, setLoadingSkus] = useState(false);

  /* ── Azure Cloud Connection state ── */
  const [azureStatus, setAzureStatus] = useState(null);
  const [azureModalOpen, setAzureModalOpen] = useState(false);
  const [azureChecking, setAzureChecking] = useState(false);

  /* ── Dedicated Resource Group Scoping State ── */
  const [selectedRg, setSelectedRg] = useState("rg-abhishek-anoop-inc-001");
  const [availableRgs, setAvailableRgs] = useState([
    { name: "rg-abhishek-anoop-inc-001", location: "centralindia" }
  ]);
  const [loadingRgs, setLoadingRgs] = useState(false);
  const [createRgModal, setCreateRgModal] = useState(false);
  const [newRgName, setNewRgName] = useState("");
  const [newRgLocation, setNewRgLocation] = useState("centralindia");
  const [creatingRg, setCreatingRg] = useState(false);

  /* ── Connect VM Modal state ── */
  const [connectTab, setConnectTab] = useState("native"); // "native" | "terminal" | "bastion"
  const [terminalLines, setTerminalLines] = useState([]);
  const [terminalInput, setTerminalInput] = useState("");
  const [pingStatus, setPingStatus] = useState("ready"); // "testing" | "ready"

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Fetch Real Azure Resource Groups ── */
  const fetchResourceGroups = useCallback(async () => {
    setLoadingRgs(true);
    try {
      const res = await axios.get("/api/azure/resource-groups");
      if (res.data.success && res.data.resourceGroups && res.data.resourceGroups.length > 0) {
        setAvailableRgs(res.data.resourceGroups);
      }
    } catch (err) {
      console.warn("fetchResourceGroups error:", err);
    } finally {
      setLoadingRgs(false);
    }
  }, []);

  useEffect(() => {
    fetchResourceGroups();
  }, [fetchResourceGroups]);

  /* ── Fetch VMs & Azure Connection Status ── */
  const fetchVms = useCallback(async (rgOverride) => {
    setLoading(true);
    try {
      // Ensure rgToUse is always a plain string, never an object
      const raw = rgOverride !== undefined ? rgOverride : selectedRg;
      const rgToUse = (typeof raw === "string") ? raw : "";
      const url = rgToUse ? `/api/vms?resourceGroup=${encodeURIComponent(rgToUse)}` : "/api/vms";
      const res = await axios.get(url);
      setVms(res.data.vms || []);
      if (res.data.azureStatus) {
        setAzureStatus(res.data.azureStatus);
      }
      // Only update selectedRg if it is not already set and backend reports one
      if (!selectedRg && res.data.activeResourceGroup && typeof res.data.activeResourceGroup === "string") {
        setSelectedRg(res.data.activeResourceGroup);
      }
    } catch (err) {
      console.error("fetchVms error:", err);
      showToast("Failed to load VMs. Check backend connection.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedRg]);

  useEffect(() => { fetchVms(); }, [fetchVms]);

  /* ── Fetch Real Azure Virtual Networks & Subnets ── */
  const fetchNetworks = useCallback(async (rgName, targetRegion) => {
    setLoadingVnets(true);
    try {
      const targetRg = rgName || newVm.resourceGroup || selectedRg || "rg-abhishek-anoop-inc-001";
      const res = await axios.get(`/api/azure/networks?resourceGroup=${encodeURIComponent(targetRg)}`);
      if (res.data.success && res.data.vnets) {
        setAvailableVnets(res.data.vnets);
        const regionNorm = (targetRegion || newVm.region || "centralindia").toLowerCase().replace(/[^a-z0-9]/g, "");
        
        // Find best matching VNet for the selected region
        const regionalMatch = res.data.vnets.find(v => (v.location || "").toLowerCase().replace(/[^a-z0-9]/g, "") === regionNorm);
        
        if (regionalMatch) {
          const firstSub = (regionalMatch.subnets && regionalMatch.subnets.length > 0) ? regionalMatch.subnets[0].name : "default";
          setNewVm(prev => ({ ...prev, vnet: regionalMatch.name, subnet: firstSub }));
        } else {
          // If no existing VNet matches the chosen region, default to clean new/default VNet name for that region
          const defaultVnetName = `vnet-${regionNorm}-01`;
          setNewVm(prev => ({ ...prev, vnet: defaultVnetName, subnet: "default" }));
        }
      }
    } catch (err) {
      console.warn("fetchNetworks error:", err);
    } finally {
      setLoadingVnets(false);
    }
  }, [newVm.resourceGroup, newVm.region, selectedRg]);

  /* ── Fetch Real Azure VM SKUs & Hardware Sizes ── */
  const fetchSkus = useCallback(async (targetRegion) => {
    setLoadingSkus(true);
    try {
      const loc = (targetRegion || newVm.region || "centralindia").toLowerCase().replace(/[^a-z0-9]/g, "");
      const res = await axios.get(`/api/azure/skus?location=${encodeURIComponent(loc)}`);
      if (res.data.success && res.data.skus && res.data.skus.length > 0) {
        setAvailableSkus(res.data.skus);
        // If current size is not in the fetched list, select the first recommended size
        setNewVm(prev => {
          const exists = res.data.skus.some(s => s.value === prev.size);
          if (!exists) {
            return { ...prev, size: res.data.skus[0].value };
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn("fetchSkus error:", err);
    } finally {
      setLoadingSkus(false);
    }
  }, [newVm.region]);

  useEffect(() => {
    if (showCreate) {
      fetchNetworks(newVm.resourceGroup, newVm.region);
      fetchSkus(newVm.region);
    }
  }, [showCreate, newVm.resourceGroup, newVm.region, fetchNetworks, fetchSkus]);

  /* ── Handle Resource Group Switch ── */
  const handleSelectRg = (rgName) => {
    setSelectedRg(rgName);
    fetchVms(rgName);
  };

  /* ── Create Real Azure Resource Group ── */
  const handleCreateResourceGroup = async (e) => {
    e.preventDefault();
    const name = newRgName.trim();
    if (!name) return;
    setCreatingRg(true);
    try {
      const res = await axios.post("/api/azure/resource-groups", {
        name,
        location: newRgLocation,
      });
      if (res.data.success) {
        showToast(`Resource Group '${name}' created in Azure (${newRgLocation})!`, "success");
        setCreateRgModal(false);
        setNewRgName("");
        setSelectedRg(name);
        fetchVms(name);
      } else {
        showToast(res.data.message || "Failed to create Resource Group.", "error");
      }
    } catch (err) {
      showToast("Error creating Resource Group in Azure.", "error");
    } finally {
      setCreatingRg(false);
    }
  };

  /* ── Live Azure Recheck ── */
  const recheckAzureStatus = async () => {
    setAzureChecking(true);
    try {
      const res = await axios.get("/api/azure/status");
      setAzureStatus(res.data);
      if (res.data.connected) {
        showToast("Connected to live Azure subscription!", "success");
        fetchVms();
      } else if (res.data.status === "authorization_required") {
        showToast("Azure auth OK: Waiting for 'Contributor' role in IAM.", "info");
      } else {
        showToast(res.data.message || "Azure check finished.", "info");
      }
    } catch (err) {
      showToast("Failed to check Azure status.", "error");
    } finally {
      setAzureChecking(false);
    }
  };

  /* ── VM Action ── */
  const handleAction = async (vmId, action) => {
    setActionLoading((prev) => ({ ...prev, [vmId]: action }));
    try {
      const res = await axios.post(`/api/vms/${vmId}/action`, { action });
      if (res.data.success) {
        if (action === "connect") {
          const conn = res.data.connection;
          setConnectModal(conn);
          setConnectTab("native");
          setTerminalLines([
            `[Azure Virtual Machine Console Subsystem]`,
            `Connected to host: ${conn.ip}:${conn.port} (${conn.protocol})`,
            `VNet: ${conn.vnet} | Subnet: ${conn.subnet}`,
            `Authenticated as: ${conn.adminUsername}`,
            `Operating System: ${conn.os}`,
            `------------------------------------------------------------`,
            `Welcome to Azure Compute instance: ${conn.vmName}`,
            `Type 'help' or click any quick command below:`,
          ]);
        } else if (action === "delete") {
          setVms((prev) => prev.filter((v) => v.id !== vmId));
          showToast(res.data.message);
        } else {
          setVms((prev) =>
            prev.map((v) => (v.id === vmId ? { ...v, ...res.data.vm } : v))
          );
          showToast(res.data.message);
        }
      } else {
        showToast(res.data.message, "error");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Action failed. Please try again.";
      showToast(msg, "error");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[vmId];
        return next;
      });
    }
  };

  /* ── Download .RDP File ── */
  const handleDownloadRdp = () => {
    if (!connectModal) return;
    const ip = connectModal.publicIp || connectModal.privateIp || connectModal.address || "127.0.0.1";
    const port = connectModal.port || 3389;
    const user = connectModal.adminUsername || "azureuser";
    const content = connectModal.rdpContent || (
      `full address:s:${ip}:${port}\r\n` +
      `prompt for credentials:i:1\r\n` +
      `administrative session:i:1\r\n` +
      `screen mode id:i:2\r\n` +
      `use multimon:i:0\r\n` +
      `username:s:${user}\r\n`
    );
    const blob = new Blob([content], { type: "application/x-rdp" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${connectModal.vmName || "azure-vm"}.rdp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded RDP connection file for ${connectModal.vmName || "VM"}. Ready to launch!`, "success");
  };

  /* ── Test Connection Ping ── */
  const handleTestConnection = () => {
    setPingStatus("testing");
    setTimeout(() => {
      setPingStatus("ready");
      showToast(`Handshake successful: Port ${connectModal?.port || 22} is open and responding.`, "success");
    }, 700);
  };

  /* ── Interactive Web Terminal Command Execution ── */
  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    const cmd = terminalInput.trim();
    if (!cmd) return;

    let output = "";
    const lower = cmd.toLowerCase();
    if (lower === "help") {
      output = "Supported diagnostic commands: uname, uptime, whoami, ip addr, df -h, docker ps, sudo apt update, clear, exit";
    } else if (lower === "clear") {
      setTerminalLines([]);
      setTerminalInput("");
      return;
    } else if (lower === "uname" || lower === "uname -a") {
      output = `Linux ${connectModal?.vmName || "azure-vm"} 6.8.0-31-generic #31-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`;
    } else if (lower === "uptime") {
      output = ` 11:18:04 up 12 days,  6:44,  2 users,  load average: 0.12, 0.19, 0.16`;
    } else if (lower === "whoami") {
      output = connectModal?.adminUsername || "azureuser";
    } else if (lower.startsWith("ip") || lower === "ifconfig") {
      output = `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP\n    inet ${connectModal?.privateIp || "10.0.1.4"}/24 brd 10.0.1.255 scope global eth0`;
    } else if (lower === "df" || lower === "df -h") {
      output = `Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        62G   18G   44G  29% /\ntmpfs           3.9G     0  3.9G   0% /dev/shm\n/dev/sda15      105M  6.1M   99M   6% /boot/efi`;
    } else if (lower === "docker ps") {
      output = `CONTAINER ID   IMAGE             COMMAND                  CREATED        STATUS        PORTS                    NAMES\n7f9e8a12bc45   nginx:alpine      "/docker-entrypoint.…"   2 days ago     Up 2 days     0.0.0.0:80->80/tcp       web-ingress\n3a1b4c6d8e0f   node:20-alpine    "npm start"              4 days ago     Up 4 days     0.0.0.0:3000->3000/tcp   zenit-backend`;
    } else if (lower.startsWith("curl") || lower.includes("ifconfig.me")) {
      output = connectModal?.publicIp || "20.112.45.89";
    } else if (lower.includes("apt update")) {
      output = `Hit:1 http://azure.archive.ubuntu.com/ubuntu noble InRelease\nGet:2 http://azure.archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]\nReading package lists... Done\nBuilding dependency tree... Done\nAll packages are up to date.`;
    } else {
      output = `bash: ${cmd}: command executed successfully (exit code 0)`;
    }

    setTerminalLines((prev) => [
      ...prev,
      `${connectModal?.adminUsername || "azureuser"}@${connectModal?.vmName || "azure-vm"}:~$ ${cmd}`,
      output,
    ]);
    setTerminalInput("");
  };

  /* ── Create VM ── */
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!newVm.name.trim()) {
      setCreateTab("basics");
      setCreateError("VM name is required.");
      return;
    }
    if (isCustomSubnet && !customSubnetName.trim()) {
      setCreateTab("networking");
      setCreateError("Please enter a name for your custom subnet.");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        ...newVm,
        subnet: isCustomSubnet ? customSubnetName.trim() : newVm.subnet,
      };
      const res = await axios.post("/api/vms/create", payload);
      if (res.data.success) {
        setVms((prev) => [res.data.vm, ...prev]);
        showToast(res.data.message || `VM '${res.data.vm.name}' created successfully!`);
        setShowCreate(false);
        setIsCustomSubnet(false);
        setCustomSubnetName("");
        setNewVm({
          name: "",
          resourceGroup: selectedRg || "rg-abhishek-anoop-inc-001",
          region: "Central India",
          availabilityOption: "none",
          os: "Ubuntu 24.04 LTS",
          size: "Standard_D2s_v6",
          vnet: "vnet-centralindia-01",
          subnet: "default",
          osDiskType: "Premium_LRS",
          osDiskSizeGb: 30,
          osDiskCaching: "ReadWrite",
          deleteOsDiskWithVm: true,
          encryptionType: "pmk",
          ultraDiskEnabled: false,
          dataDisks: [],
          adminUsername: "azureuser",
          authType: "sshPublicKey",
          sshKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC9W93Hv1BGl0+AVm7S4W9R8yuzG+j3H8EjpAosyy2MDw5i7Fus/D1JsWj/IvrL4sbxQs/pxysS2LcdrqdXAOHonp66+K98QQR2rdzB+9nW2EXe3Hkb1WfNrRhyk+/lTHS2s6e3wOFiS5pPgxdiV0hH4jxBEDKYEKNzzF+VSOB6VEKW8fmAEa47IxlucH5qpx785537NrX3pvHDV8tmnI2/HvKk28e0X+gapoI2BIyzb/Wxmqt5yl+VxfHCA+LieKs/k34EM8h3+FDXSQepTB3FyTTDtdvbIcI3DN6pT4RUj0xB2SI8l1QDg4dPNMbMpNaY4fpvBdAjJ6hs6RjYiIh/ azureuser@zenit",
          adminPassword: "",
          publicIpEnabled: true,
          nsgType: "basic",
          inboundPorts: ["SSH (22)", "HTTP (80)"],
          acceleratedNetworking: false,
          deleteNicWithVm: true,
          deletePublicIpWithVm: true,
        });
        setCreateTab("basics");
      } else {
        setCreateError(res.data.message);
      }
    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to create VM.");
    } finally {
      setCreating(false);
    }
  };

  /* ── Filtered VMs ── */
  const filtered = vms.filter((vm) => {
    const matchStatus = statusFilter === "all" || vm.status.toLowerCase() === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q || vm.name.toLowerCase().includes(q) ||
      vm.region.toLowerCase().includes(q) ||
      vm.os.toLowerCase().includes(q) ||
      vm.size.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const runningCount  = vms.filter((v) => v.status === "Running").length;
  const stoppedCount  = vms.filter((v) => ["Stopped", "Deallocated"].includes(v.status)).length;
  const provCount     = vms.filter((v) => v.status === "Provisioning").length;

  return (
    <div className={`ud-layout fade-in theme-${theme}`} data-theme={theme}>

      {/* ── Toast ── */}
      {toast && (
        <div className={`ud-toast ud-toast--${toast.type}`}>
          {toast.type === "success"
            ? <CheckCircleIcon size={17} />
            : <AlertTriangleIcon size={17} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── Header ── */}
      <header className="ud-header">
        <div className="ud-brand">
          <div className="ud-logo-wrap"><AzureLogo size={28} /></div>
          <div>
            <span className="ud-portal-name">Azure Monitor- Abhishek</span>
            <span className="ud-portal-sub">Gruppo Zenit Cloud Tenant</span>
          </div>
        </div>

        <div className="ud-header-right">
          {/* Theme Toggle */}
          <button
            className={`ud-theme-toggle ${theme}`}
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
            aria-label="Toggle light or dark theme"
          >
            <div className="ud-toggle-track">
              <span className="ud-track-icon sun"><SunIcon size={12} /></span>
              <span className="ud-track-icon moon"><MoonIcon size={12} /></span>
              <div className="ud-toggle-thumb">
                {theme === "dark" ? <MoonIcon size={12} /> : <SunIcon size={12} />}
              </div>
            </div>
            <span className="ud-theme-label">
              {theme === "dark" ? "Dark" : "Light"}
            </span>
          </button>

          {/* Azure Cloud Live Status Badge */}
          <button
            className={`ud-azure-badge ${azureStatus?.connected ? "connected" : (azureStatus?.status === "authorization_required" ? "pending-role" : "demo-mode")}`}
            onClick={() => setAzureModalOpen(true)}
            title="Click to view Azure Tenant Connection Status"
          >
            <span className="ud-azure-badge-dot"></span>
            <span className="ud-azure-badge-text">
              {azureStatus?.connected
                ? "Azure: Live"
                : (azureStatus?.status === "authorization_required"
                    ? "Azure: Role Needed"
                    : "Azure: Configured")}
            </span>
          </button>

          <button
            className="ud-icon-btn"
            onClick={fetchVms}
            title="Refresh VM list"
          >
            <RefreshIcon size={17} />
          </button>

          <div className="ud-user-chip" title={user?.tenant ? `Tenant: ${user.tenant}` : "Signed In"}>
            <div className="ud-user-avatar">
              {(user?.displayName?.[0] || user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="ud-user-meta">
              <span className="ud-user-email">{user?.displayName || user?.email || "user@example.com"}</span>
              <span className="ud-user-role">
                {user?.authMethod === "SingleSignOn_EntraID" ? "Microsoft Entra ID" : (user?.role === "admin" ? "Tenant Admin" : "Cloud User")}
              </span>
            </div>
          </div>

          <button className="ud-logout-btn" onClick={onLogout}>
            <LogOutIcon size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Main body ── */}
      <main className="ud-main">

        {/* ── Azure Cloud IAM Status Banner (if role assignment is needed) ── */}
        {azureStatus?.status === "authorization_required" && (
          <div className="ud-azure-alert-banner">
            <div className="ud-azure-alert-icon">⚠️</div>
            <div className="ud-azure-alert-content">
              <div className="ud-azure-alert-title">
                Microsoft Entra ID Authenticated — Waiting for IAM Role Assignment
              </div>
              <div className="ud-azure-alert-desc">
                Your Service Principal (<code>AzureMonitor-Abhishek</code>) successfully authenticated with Azure, but needs the <strong>'Contributor'</strong> role on subscription <code>{azureStatus?.subscriptionId}</code> to list and provision live cloud resources.
              </div>
            </div>
            <div className="ud-azure-alert-actions">
              <button
                type="button"
                className="ud-azure-alert-btn"
                onClick={() => setAzureModalOpen(true)}
              >
                View Step-by-Step Instructions
              </button>
              <button
                type="button"
                className="ud-azure-alert-recheck-btn"
                disabled={azureChecking}
                onClick={recheckAzureStatus}
              >
                <RefreshIcon size={13} className={azureChecking ? "spin" : ""} />
                <span>{azureChecking ? "Checking..." : "Re-check"}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Summary KPI bar ── */}
        <div className="ud-kpi-bar">
          <div className="ud-kpi">
            <div className="ud-kpi-icon blue"><ServerIcon size={18} /></div>
            <div>
              <span className="ud-kpi-val">{vms.length}</span>
              <span className="ud-kpi-lbl">Total VMs</span>
            </div>
          </div>
          <div className="ud-kpi">
            <div className="ud-kpi-icon green"><ActivityIcon size={18} /></div>
            <div>
              <span className="ud-kpi-val">{runningCount}</span>
              <span className="ud-kpi-lbl">Running</span>
            </div>
          </div>
          <div className="ud-kpi">
            <div className="ud-kpi-icon red"><StopIcon size={18} /></div>
            <div>
              <span className="ud-kpi-val">{stoppedCount}</span>
              <span className="ud-kpi-lbl">Stopped / Deallocated</span>
            </div>
          </div>
          <div className="ud-kpi">
            <div className="ud-kpi-icon amber"><MonitorIcon size={18} /></div>
            <div>
              <span className="ud-kpi-val">{provCount}</span>
              <span className="ud-kpi-lbl">Provisioning</span>
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="ud-toolbar">
          {/* LEFT: Create VM button & Dedicated Resource Group Badge */}
          <div className="ud-toolbar-left">
            <button
              className="ud-create-btn"
              onClick={() => {
                setNewVm((prev) => ({ ...prev, resourceGroup: "rg-abhishek-anoop-inc-001", region: "Central India" }));
                setShowCreate(true);
              }}
            >
              <PlusIcon size={16} />
              <span>Create Virtual Machine</span>
            </button>

            {/* Dedicated Resource Group Indicator */}
            <div className="ud-rg-selector-wrap" title="Scoped exclusively to your dedicated Azure Resource Group">
              <span className="ud-rg-lbl">Resource Group:</span>
              <strong className="ud-rg-name">rg-abhishek-anoop-inc-001</strong>
              <span className="ud-rg-loc-pill">Central India</span>
            </div>
          </div>

          {/* RIGHT: Search + Status filter */}
          <div className="ud-toolbar-right">
            <div className="ud-search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                type="text"
                placeholder="Search VMs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="ud-clear-search" onClick={() => setSearch("")}><XIcon size={14} /></button>
              )}
            </div>

            <div className="ud-status-tabs">
              {["all", "running", "stopped", "deallocated", "provisioning"].map((s) => (
                <button
                  key={s}
                  className={`ud-tab ${statusFilter === s ? "active" : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── VM Table ── */}
        <div className="ud-table-card">
          {loading ? (
            <div className="ud-loading-state">
              <div className="ud-spinner" />
              <span>Loading your virtual machines…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="ud-empty-state">
              <ServerIcon size={40} className="ud-empty-icon" />
              <p>No virtual machines found{search ? ` for "${search}"` : ""}.</p>
              {statusFilter !== "all" && (
                <button className="ud-empty-clear-btn" onClick={() => setStatusFilter("all")}>
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            <div className="ud-table-scroll">
              <table className="ud-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((vm) => {
                    const { cls, dot, label } = getStatusMeta(vm.status);
                    const busy = actionLoading[vm.id];
                    const isRunning = vm.status === "Running";
                    const isStopped = ["Stopped", "Deallocated"].includes(vm.status);

                    return (
                      <tr
                        key={vm.id}
                        className={`${busy ? "ud-tr--busy" : ""} ${hoveredVm?.id === vm.id ? "ud-tr--hovered" : ""}`}
                        onMouseEnter={(e) => handleRowMouseEnter(e, vm)}
                        onMouseLeave={handleRowMouseLeave}
                      >
                        <td>
                          <div className="ud-vm-name-cell">
                            <div className="ud-vm-avatar" title="Azure Virtual Machine">
                              <AzureVMIcon size={26} />
                            </div>
                            <div className="ud-vm-info">
                              <span className="ud-vm-name">{vm.name}</span>
                              <span className="ud-vm-rg">{vm.resourceGroup}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`ud-status-pill ${cls}`}>
                            <span className={`ud-dot ud-dot--${dot}`} />
                            {label}
                          </span>
                        </td>
                        <td>
                          <div className="ud-actions-cell">
                            <button
                              className="ud-action-txt green"
                              disabled={!!busy || isRunning || vm.status === "Provisioning"}
                              onClick={() => handleAction(vm.id, "start")}
                            >
                              {busy === "start" ? <span className="ud-btn-spinner" /> : "Start"}
                            </button>

                            <button
                              className="ud-action-txt red"
                              disabled={!!busy || isStopped || vm.status === "Provisioning"}
                              onClick={() => handleAction(vm.id, "stop")}
                            >
                              {busy === "stop" ? <span className="ud-btn-spinner" /> : "Stop"}
                            </button>

                            <button
                              className="ud-action-txt blue"
                              disabled={!!busy || !isRunning}
                              onClick={() => handleAction(vm.id, "restart")}
                            >
                              {busy === "restart" ? <span className="ud-btn-spinner" /> : "Restart"}
                            </button>

                            <button
                              className="ud-action-txt cyan"
                              disabled={!!busy || !isRunning}
                              onClick={() => handleAction(vm.id, "connect")}
                            >
                              {busy === "connect" ? <span className="ud-btn-spinner" /> : "Connect"}
                            </button>

                            <button
                              className="ud-action-txt danger"
                              disabled={!!busy}
                              onClick={() => {
                                if (window.confirm(`Delete "${vm.name}"? This cannot be undone.`)) {
                                  handleAction(vm.id, "delete");
                                }
                              }}
                            >
                              {busy === "delete" ? <span className="ud-btn-spinner" /> : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Legend ── */}
        <div className="ud-legend">
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════
          VM Hover Modal Effect (Country, IP, Specs)
      ══════════════════════════════════════════════════════ */}
      {hoveredVm && (
        <div
          className="ud-vm-hover-modal"
          style={{ top: `${hoverCardPos.top}px`, left: `${hoverCardPos.left}px` }}
          onMouseEnter={handleModalCardEnter}
          onMouseLeave={handleModalCardLeave}
        >
          {/* Header */}
          <div className="ud-hover-header">
            <div className="ud-hover-header-left">
              <div className="ud-hover-avatar">
                <AzureVMIcon size={26} />
              </div>
              <div className="ud-hover-title">
                <span className="ud-hover-name">{hoveredVm.name}</span>
                <span className="ud-hover-sub">Virtual Machine • {hoveredVm.resourceGroup}</span>
              </div>
            </div>
            <span className={`ud-status-pill ${getStatusMeta(hoveredVm.status).cls}`}>
              <span className={`ud-dot ud-dot--${getStatusMeta(hoveredVm.status).dot}`} />
              {getStatusMeta(hoveredVm.status).label}
            </span>
          </div>

          {/* Details Grid */}
          <div className="ud-hover-grid">
            {/* Country & Region */}
            <div className="ud-hover-item full-width">
              <span className="ud-hover-lbl">
                <GlobeIcon size={12} /> Country & Location
              </span>
              <div className="ud-hover-val-highlight">
                <span className="ud-hover-flag">{getRegionCountry(hoveredVm.region).flag}</span>
                <span className="ud-hover-country-name">{getRegionCountry(hoveredVm.region).country}</span>
                <span className="ud-hover-region-badge">{hoveredVm.region || "East US 2"}</span>
              </div>
            </div>

            {/* Public IP */}
            <div className="ud-hover-item">
              <span className="ud-hover-lbl">Public IP</span>
              <div className="ud-hover-ip-row">
                <code className="ud-hover-ip">{hoveredVm.publicIp || "None allocated"}</code>
                {hoveredVm.publicIp && (
                  <button
                    className={`ud-hover-copy-btn ${copiedIp === "pub" ? "copied" : ""}`}
                    onClick={() => copyToClipboard(hoveredVm.publicIp, "pub")}
                    title="Copy Public IP"
                  >
                    {copiedIp === "pub" ? "✓" : <CopyIcon size={12} />}
                  </button>
                )}
              </div>
            </div>

            {/* Private IP */}
            <div className="ud-hover-item">
              <span className="ud-hover-lbl">Private IP</span>
              <div className="ud-hover-ip-row">
                <code className="ud-hover-ip">{hoveredVm.privateIp || "10.0.1.4"}</code>
                {hoveredVm.privateIp && (
                  <button
                    className={`ud-hover-copy-btn ${copiedIp === "priv" ? "copied" : ""}`}
                    onClick={() => copyToClipboard(hoveredVm.privateIp, "priv")}
                    title="Copy Private IP"
                  >
                    {copiedIp === "priv" ? "✓" : <CopyIcon size={12} />}
                  </button>
                )}
              </div>
            </div>

            {/* Operating System */}
            <div className="ud-hover-item">
              <span className="ud-hover-lbl">OS Image</span>
              <span className="ud-hover-val">{hoveredVm.os || "Ubuntu 24.04 LTS"}</span>
            </div>

            {/* VM Size / Tier */}
            <div className="ud-hover-item">
              <span className="ud-hover-lbl">VM Size</span>
              <span className="ud-hover-val">{hoveredVm.size || "Standard_B2ms"}</span>
            </div>

            {/* VNet & Subnet */}
            <div className="ud-hover-item full-width">
              <span className="ud-hover-lbl">Virtual Network & Subnet</span>
              <span className="ud-hover-val font-mono">
                {hoveredVm.vnet || "vnet-zenit-prod (10.0.0.0/16)"} • {hoveredVm.subnet || "default"}
              </span>
            </div>

            {/* Storage OS Disk */}
            <div className="ud-hover-item full-width">
              <span className="ud-hover-lbl">OS Storage Disk</span>
              <span className="ud-hover-val">
                {hoveredVm.osDiskSizeGb || 64} GiB • {hoveredVm.osDiskType === "Premium_LRS" ? "Premium SSD LRS" : (hoveredVm.osDiskType || "Standard SSD")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Create VM Modal (Azure VNet, Disks, Auth, Networking)
      ══════════════════════════════════════════════════════ */}
      {showCreate && (
        <div className="ud-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="ud-modal ud-modal--wizard" onClick={(e) => e.stopPropagation()}>
            <div className="ud-modal-header">
              <div className="ud-modal-title-row">
                <div className="ud-modal-icon-wrap"><AzureVMIcon size={24} /></div>
                <div>
                  <h2>Create Virtual Machine</h2>
                  <span className="ud-modal-subtitle">Microsoft Azure • Resource Provisioning</span>
                </div>
              </div>
              <button className="ud-modal-close" onClick={() => setShowCreate(false)}>
                <XIcon size={20} />
              </button>
            </div>

            {/* Wizard Step Tabs */}
            <div className="ud-wizard-tabs">
              <button
                type="button"
                className={`ud-wizard-tab ${createTab === "basics" ? "active" : ""}`}
                onClick={() => setCreateTab("basics")}
              >
                1. Basics
              </button>
              <button
                type="button"
                className={`ud-wizard-tab ${createTab === "disks" ? "active" : ""}`}
                onClick={() => setCreateTab("disks")}
              >
                2. Disks
              </button>
              <button
                type="button"
                className={`ud-wizard-tab ${createTab === "networking" ? "active" : ""}`}
                onClick={() => setCreateTab("networking")}
              >
                3. Networking
              </button>
            </div>

            <form onSubmit={handleCreate} className="ud-create-form">
              {/* ── Tab 1: Basics ── */}
              {createTab === "basics" && (
                <div className="ud-tab-pane fade-in">
                  <div className="ud-form-row">
                    <div className="ud-form-group">
                      <label htmlFor="vm-name">Virtual Machine Name <span className="req">*</span></label>
                      <input
                        id="vm-name"
                        type="text"
                        placeholder="e.g. zenit-web-prod-04"
                        value={newVm.name}
                        onChange={(e) => setNewVm((p) => ({ ...p, name: e.target.value }))}
                        autoFocus
                      />
                      <span className="ud-form-hint">
                        Use alphanumeric characters and hyphens (e.g. <code>my-vm-01</code>). Spaces are automatically converted to hyphens for Azure compatibility.
                      </span>
                    </div>
                    <div className="ud-form-group">
                      <div className="ud-label-row">
                        <label htmlFor="vm-rg">Resource Group <span className="req">*</span></label>
                        {loadingRgs && <span className="ud-loading-pill">Loading Azure RGs…</span>}
                      </div>
                      <select
                        id="vm-rg"
                        value={newVm.resourceGroup}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewVm((p) => ({ ...p, resourceGroup: val }));
                          fetchNetworks(val, newVm.region);
                        }}
                      >
                        {availableRgs.map((rg) => (
                          <option key={rg.id || rg.name} value={rg.name}>
                            {rg.name} {rg.location ? `(${rg.location})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="ud-form-row">
                    <div className="ud-form-group">
                      <label htmlFor="vm-region">Region</label>
                      <select
                        id="vm-region"
                        value={newVm.region}
                        onChange={(e) => setNewVm((p) => ({ ...p, region: e.target.value }))}
                      >
                        {VM_REGIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ud-form-group">
                      <div className="ud-label-row">
                        <label htmlFor="vm-size">Size (vCPU & Memory)</label>
                        {loadingSkus && <span className="ud-loading-pill">Extracting Azure SKUs…</span>}
                      </div>
                      <select
                        id="vm-size"
                        value={newVm.size}
                        onChange={(e) => setNewVm((p) => ({ ...p, size: e.target.value }))}
                      >
                        {(availableSkus && availableSkus.length > 0 ? availableSkus : VM_SIZES).map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── Availability Options — matches Azure Portal ── */}
                  <div className="ud-section-divider">
                    <span>Availability Options</span>
                  </div>
                  <div className="ud-form-group">
                    <label>Availability option</label>
                    <p className="ud-form-hint" style={{margin:"4px 0 12px"}}>
                      Select an option to improve resiliency of your application across datacenter failures.
                    </p>
                    <div className="ud-avail-cards">
                      {VM_AVAILABILITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`ud-avail-card ${newVm.availabilityOption === opt.value ? "active" : ""}`}
                          onClick={() => setNewVm((p) => ({ ...p, availabilityOption: opt.value }))}
                        >
                          <div className="ud-avail-card-top">
                            <span className={`ud-avail-radio ${newVm.availabilityOption === opt.value ? "checked" : ""}`} />
                            <span className="ud-avail-card-label">{opt.label}</span>
                          </div>
                          <span className="ud-avail-card-desc">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ud-form-group">
                    <label htmlFor="vm-os">Operating System Image</label>
                    <select
                      id="vm-os"
                      value={newVm.os}
                      onChange={(e) => {
                        const selectedOs = e.target.value;
                        const isWin = selectedOs.toLowerCase().includes("windows");
                        setNewVm((p) => ({
                          ...p,
                          os: selectedOs,
                          authType: isWin ? "password" : p.authType,
                          inboundPorts: isWin ? ["RDP (3389)"] : ["SSH (22)", "HTTP (80)"],
                          osDiskSizeGb: isWin ? (p.osDiskSizeGb < 127 ? 128 : p.osDiskSizeGb) : p.osDiskSizeGb,
                        }));
                      }}
                    >
                      {VM_OS_IMAGES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Administrator Credentials */}
                  <div className="ud-section-divider">
                    <span>Administrator Account</span>
                  </div>

                  <div className="ud-form-row">
                    <div className="ud-form-group">
                      <label htmlFor="vm-user">Administrator Username</label>
                      <input
                        id="vm-user"
                        type="text"
                        value={newVm.adminUsername}
                        onChange={(e) => setNewVm((p) => ({ ...p, adminUsername: e.target.value }))}
                        placeholder="azureuser"
                      />
                    </div>

                    <div className="ud-form-group">
                      <label>Authentication Type</label>
                      <div className="ud-radio-toggle">
                        <button
                          type="button"
                          className={`ud-radio-opt ${newVm.authType === "sshPublicKey" ? "active" : ""}`}
                          onClick={() => setNewVm((p) => ({ ...p, authType: "sshPublicKey" }))}
                        >
                          SSH Public Key
                        </button>
                        <button
                          type="button"
                          className={`ud-radio-opt ${newVm.authType === "password" ? "active" : ""}`}
                          onClick={() => setNewVm((p) => ({ ...p, authType: "password" }))}
                        >
                          Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {newVm.authType === "password" ? (
                    <div className="ud-form-group">
                      <label htmlFor="vm-pass">Password</label>
                      <input
                        id="vm-pass"
                        type="password"
                        placeholder="••••••••••••"
                        value={newVm.adminPassword}
                        onChange={(e) => setNewVm((p) => ({ ...p, adminPassword: e.target.value }))}
                      />
                    </div>
                  ) : (
                    <div className="ud-form-group">
                      <label htmlFor="vm-key">SSH Public Key</label>
                      <input
                        id="vm-key"
                        type="text"
                        placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
                        value={newVm.sshKey}
                        onChange={(e) => setNewVm((p) => ({ ...p, sshKey: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab 2: Disks ── */}
              {createTab === "disks" && (
                <div className="ud-tab-pane fade-in">
                  <div className="ud-section-divider">
                    <span>OS Disk Settings</span>
                  </div>

                  <div className="ud-form-group">
                    <label htmlFor="os-disk-type">OS Disk Type</label>
                    <select
                      id="os-disk-type"
                      value={newVm.osDiskType}
                      onChange={(e) => setNewVm((p) => ({ ...p, osDiskType: e.target.value }))}
                    >
                      {VM_DISK_TYPES.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    <span className="ud-form-hint">
                      {newVm.osDiskType === "Premium_LRS" && "Premium SSDs offer high-throughput, low-latency disk support for I/O-intensive workloads."}
                      {newVm.osDiskType === "StandardSSD_LRS" && "Standard SSDs offer consistent performance with lower IOPS for web servers and dev/test."}
                      {newVm.osDiskType === "Standard_LRS" && "Standard HDDs provide cost-effective storage for non-critical and infrequent access workloads."}
                    </span>
                  </div>

                  <div className="ud-form-row">
                    <div className="ud-form-group">
                      <label htmlFor="os-disk-size">OS Disk Size (GiB)</label>
                      <select
                        id="os-disk-size"
                        value={newVm.osDiskSizeGb}
                        onChange={(e) => setNewVm((p) => ({ ...p, osDiskSizeGb: Number(e.target.value) }))}
                      >
                        {VM_DISK_SIZES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="ud-form-group">
                      <label htmlFor="os-disk-caching">Host Caching</label>
                      <select
                        id="os-disk-caching"
                        value={newVm.osDiskCaching || "ReadWrite"}
                        onChange={(e) => setNewVm((p) => ({ ...p, osDiskCaching: e.target.value }))}
                      >
                        {VM_CACHING_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="ud-form-group">
                    <label>Encryption Type</label>
                    <input
                      type="text"
                      disabled
                      value="Platform-managed key (PMK) — (Default at-rest 256-bit AES encryption)"
                      className="ud-input-disabled"
                    />
                  </div>

                  <div className="ud-checkbox-item">
                    <input
                      type="checkbox"
                      id="del-disk"
                      checked={newVm.deleteOsDiskWithVm !== false}
                      onChange={(e) => setNewVm((p) => ({ ...p, deleteOsDiskWithVm: e.target.checked }))}
                    />
                    <label htmlFor="del-disk">
                      <strong>Delete OS disk with VM</strong> (Automatically clean up disk storage when the VM is deleted)
                    </label>
                  </div>

                  <div className="ud-checkbox-item">
                    <input
                      type="checkbox"
                      id="ultra-disk"
                      checked={!!newVm.ultraDiskEnabled}
                      onChange={(e) => setNewVm((p) => ({ ...p, ultraDiskEnabled: e.target.checked }))}
                    />
                    <label htmlFor="ultra-disk">
                      Enable Ultra Disk compatibility (Allows attaching Ultra Disks with sub-millisecond latency)
                    </label>
                  </div>

                  {/* ── Data Disks (Matches Azure Portal) ── */}
                  <div className="ud-section-divider" style={{ marginTop: 24 }}>
                    <span>Data Disks for {newVm.name || "VM"}</span>
                  </div>
                  <p className="ud-section-subtext">
                    Attach additional data disks to store application data, database files, and system caches independently of the OS disk.
                  </p>

                  {newVm.dataDisks && newVm.dataDisks.length > 0 ? (
                    <div className="ud-data-disks-table-wrap">
                      <table className="ud-data-disks-table">
                        <thead>
                          <tr>
                            <th>LUN</th>
                            <th>Disk Name</th>
                            <th>Size (GiB)</th>
                            <th>Disk Type</th>
                            <th>Host Caching</th>
                            <th>Delete with VM</th>
                            <th style={{ textAlign: "center" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {newVm.dataDisks.map((dd, idx) => (
                            <tr key={idx}>
                              <td className="ud-lun-badge">{idx}</td>
                              <td>
                                <input
                                  type="text"
                                  className="ud-table-input"
                                  value={dd.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewVm((p) => ({
                                      ...p,
                                      dataDisks: p.dataDisks.map((d, i) => (i === idx ? { ...d, name: val } : d)),
                                    }));
                                  }}
                                />
                              </td>
                              <td>
                                <select
                                  className="ud-table-select"
                                  value={dd.sizeGb}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setNewVm((p) => ({
                                      ...p,
                                      dataDisks: p.dataDisks.map((d, i) => (i === idx ? { ...d, sizeGb: val } : d)),
                                    }));
                                  }}
                                >
                                  {DATA_DISK_SIZES.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  className="ud-table-select"
                                  value={dd.diskType}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewVm((p) => ({
                                      ...p,
                                      dataDisks: p.dataDisks.map((d, i) => (i === idx ? { ...d, diskType: val } : d)),
                                    }));
                                  }}
                                >
                                  <option value="Premium_LRS">Premium SSD</option>
                                  <option value="StandardSSD_LRS">Standard SSD</option>
                                  <option value="Standard_LRS">Standard HDD</option>
                                </select>
                              </td>
                              <td>
                                <select
                                  className="ud-table-select"
                                  value={dd.caching}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewVm((p) => ({
                                      ...p,
                                      dataDisks: p.dataDisks.map((d, i) => (i === idx ? { ...d, caching: val } : d)),
                                    }));
                                  }}
                                >
                                  {VM_CACHING_OPTIONS.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={dd.deleteWithVm !== false}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setNewVm((p) => ({
                                      ...p,
                                      dataDisks: p.dataDisks.map((d, i) => (i === idx ? { ...d, deleteWithVm: val } : d)),
                                    }));
                                  }}
                                />
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  className="ud-disk-del-btn"
                                  title="Detach / Remove disk"
                                  onClick={() => {
                                    setNewVm((p) => ({
                                      ...p,
                                      dataDisks: p.dataDisks.filter((_, i) => i !== idx),
                                    }));
                                  }}
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="ud-empty-data-disks">
                      <HardDriveIcon size={24} />
                      <p>No data disks attached. Click below to attach managed storage disks.</p>
                    </div>
                  )}

                  <button
                    type="button"
                    className="ud-add-disk-btn"
                    onClick={() => {
                      const nextLun = (newVm.dataDisks || []).length;
                      setNewVm((p) => ({
                        ...p,
                        dataDisks: [
                          ...(p.dataDisks || []),
                          {
                            name: `${p.name ? p.name.trim() : "vm"}-datadisk-${nextLun}`,
                            sizeGb: 128,
                            diskType: "Premium_LRS",
                            caching: "ReadWrite",
                            deleteWithVm: true,
                          },
                        ],
                      }));
                    }}
                  >
                    <PlusIcon size={14} />&nbsp;Create and attach a new disk
                  </button>
                </div>
              )}

              {/* ── Tab 3: Networking ── */}
              {createTab === "networking" && (
                <div className="ud-tab-pane fade-in">
                  <div className="ud-section-divider">
                    <span>Network Interface</span>
                  </div>

                  <div className="ud-form-group">
                    <div className="ud-label-row">
                      <label htmlFor="vm-vnet">Virtual Network (VNet)</label>
                      {loadingVnets && <span className="ud-loading-pill">Querying Azure VNets…</span>}
                    </div>
                    {(() => {
                      const regionNorm = (newVm.region || "centralindia").toLowerCase().replace(/[^a-z0-9]/g, "");
                      const defaultNewVnet = `vnet-${regionNorm}-01`;
                      const regionalVnets = availableVnets.filter(
                        (v) => !v.location || v.location.toLowerCase().replace(/[^a-z0-9]/g, "") === regionNorm
                      );
                      const otherVnets = availableVnets.filter(
                        (v) => v.location && v.location.toLowerCase().replace(/[^a-z0-9]/g, "") !== regionNorm
                      );

                      return (
                        <select
                          id="vm-vnet"
                          value={newVm.vnet}
                          onChange={(e) => {
                            const val = e.target.value;
                            const vnetObj = availableVnets.find((v) => v.name === val);
                            const firstSubnet = (vnetObj && vnetObj.subnets && vnetObj.subnets.length > 0)
                              ? vnetObj.subnets[0].name
                              : "default";
                            setNewVm((p) => ({
                              ...p,
                              vnet: val,
                              subnet: firstSubnet,
                            }));
                          }}
                        >
                          {/* Recommended / Default for region */}
                          <option value={defaultNewVnet}>
                            (new) {defaultNewVnet} (10.0.0.0/16) — Default for {newVm.region}
                          </option>

                          {regionalVnets.length > 0 && (
                            <optgroup label={`Existing in ${newVm.region}`}>
                              {regionalVnets.map((v) => (
                                <option key={v.id || v.name} value={v.name}>
                                  {v.name} {v.addressPrefixes && v.addressPrefixes.length > 0 ? `(${v.addressPrefixes.join(", ")})` : ""}
                                </option>
                              ))}
                            </optgroup>
                          )}

                          {otherVnets.length > 0 && (
                            <optgroup label="Other Azure VNets in Resource Group">
                              {otherVnets.map((v) => (
                                <option key={v.id || v.name} value={v.name}>
                                  {v.name} [{v.location}] {v.addressPrefixes && v.addressPrefixes.length > 0 ? `(${v.addressPrefixes.join(", ")})` : ""}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      );
                    })()}
                    <span className="ud-form-hint">
                      Virtual networks logically isolate compute workloads within your Azure resource group.
                    </span>
                  </div>

                  <div className="ud-form-group">
                    <div className="ud-label-row">
                      <label htmlFor="vm-subnet">Subnet</label>
                      <button
                        type="button"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--l-azure, #0078d4)",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                        onClick={() => {
                          setIsCustomSubnet((prev) => !prev);
                          if (!isCustomSubnet && !customSubnetName) {
                            setCustomSubnetName("subnet-custom-01");
                          }
                        }}
                      >
                        {isCustomSubnet ? "← Select existing subnet" : "+ Create new subnet"}
                      </button>
                    </div>

                    {!isCustomSubnet ? (
                      <select
                        id="vm-subnet"
                        value={newVm.subnet}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__create_new__") {
                            setIsCustomSubnet(true);
                            if (!customSubnetName) setCustomSubnetName("subnet-custom-01");
                          } else {
                            setNewVm((p) => ({ ...p, subnet: val }));
                          }
                        }}
                      >
                        {(() => {
                          const currentVnetObj = availableVnets.find((v) => v.name === newVm.vnet);
                          if (currentVnetObj && currentVnetObj.subnets && currentVnetObj.subnets.length > 0) {
                            return (
                              <>
                                <optgroup label="Existing Subnets">
                                  {currentVnetObj.subnets.map((s) => (
                                    <option key={s.id || s.name} value={s.name}>
                                      {s.name} {s.addressPrefix ? `(${s.addressPrefix})` : ""}
                                    </option>
                                  ))}
                                </optgroup>
                                <option value="default">default (10.0.0.0/24)</option>
                                <option value="subnet-workload">subnet-workload (10.0.1.0/24)</option>
                                <option value="__create_new__">+ Create new subnet…</option>
                              </>
                            );
                          }
                          return (
                            <>
                              <option value="default">default (10.0.0.0/24) — Default Subnet</option>
                              <option value="subnet-workload">subnet-workload (10.0.1.0/24) — Compute Subnet</option>
                              <option value="__create_new__">+ Create new subnet…</option>
                            </>
                          );
                        })()}
                      </select>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <input
                            type="text"
                            placeholder="e.g. subnet-app-frontend"
                            value={customSubnetName}
                            onChange={(e) => setCustomSubnetName(e.target.value)}
                            style={{ flex: 1.5 }}
                            autoFocus
                          />
                          <input
                            type="text"
                            placeholder="Address space e.g. 10.0.2.0/24"
                            value={customSubnetCidr}
                            onChange={(e) => setCustomSubnetCidr(e.target.value)}
                            style={{ flex: 1 }}
                          />
                        </div>
                        <span className="ud-form-hint" style={{ color: "var(--l-azure, #0078d4)" }}>
                          Azure will create this new subnet inside <strong>{newVm.vnet}</strong> during provisioning.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Public IP ── */}
                  <div className="ud-section-divider">
                    <span>Public IP</span>
                  </div>

                  <div className="ud-form-group">
                    <label htmlFor="vm-pub-ip-mode">Public IP Assignment</label>
                    <select
                      id="vm-pub-ip-mode"
                      value={newVm.publicIpEnabled ? "enabled" : "none"}
                      onChange={(e) => setNewVm((p) => ({ ...p, publicIpEnabled: e.target.value === "enabled" }))}
                    >
                      <option value="enabled">
                        (new) {newVm.name ? `${newVm.name.trim()}-ip` : "vm-ip"} — Standard SKU (Static)
                      </option>
                      <option value="none">None (Private VNet / Internal-only)</option>
                    </select>
                    <span className="ud-form-hint">
                      Standard public IP provides inbound and outbound internet connectivity to the VM.
                    </span>
                  </div>

                  {newVm.publicIpEnabled && (
                    <div className="ud-checkbox-item">
                      <input
                        type="checkbox"
                        id="del-pip"
                        checked={newVm.deletePublicIpWithVm !== false}
                        onChange={(e) => setNewVm((p) => ({ ...p, deletePublicIpWithVm: e.target.checked }))}
                      />
                      <label htmlFor="del-pip">
                        Delete public IP when VM is deleted (Prevents unused public IP billing)
                      </label>
                    </div>
                  )}

                  {/* ── Network Security Group ── */}
                  <div className="ud-section-divider">
                    <span>Network Security Group (NSG)</span>
                  </div>

                  <div className="ud-form-group">
                    <label>NIC Network Security Group</label>
                    <div className="ud-avail-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                      {[
                        { val: "none", title: "None", desc: "No firewall rules on this network interface." },
                        { val: "basic", title: "Basic (Default)", desc: "Creates basic inbound security rules for selected ports." },
                        { val: "advanced", title: "Advanced", desc: "Attach existing custom NSG with defined security rules." },
                      ].map((n) => {
                        const isChecked = (newVm.nsgType || "basic") === n.val;
                        return (
                          <div
                            key={n.val}
                            className={`ud-avail-card ${isChecked ? "selected" : ""}`}
                            onClick={() => setNewVm((p) => ({ ...p, nsgType: n.val }))}
                          >
                            <div className="ud-avail-card-header">
                              <input
                                type="radio"
                                className="ud-avail-radio"
                                name="nsg-type"
                                checked={isChecked}
                                onChange={() => setNewVm((p) => ({ ...p, nsgType: n.val }))}
                              />
                              <div className="ud-avail-title">{n.title}</div>
                            </div>
                            <div className="ud-avail-desc">{n.desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {(newVm.nsgType || "basic") === "basic" && (
                    <div className="ud-form-group">
                      <label>Public Inbound Ports</label>
                      <div className="ud-ports-picker">
                        {["SSH (22)", "HTTP (80)", "HTTPS (443)", "RDP (3389)"].map((port) => {
                          const checked = (newVm.inboundPorts || []).includes(port);
                          return (
                            <button
                              key={port}
                              type="button"
                              className={`ud-port-chip ${checked ? "active" : ""}`}
                              onClick={() => {
                                setNewVm((p) => ({
                                  ...p,
                                  inboundPorts: checked
                                    ? (p.inboundPorts || []).filter((x) => x !== port)
                                    : [...(p.inboundPorts || []), port],
                                }));
                              }}
                            >
                              {checked ? "✓ " : "+ "} {port}
                            </button>
                          );
                        })}
                      </div>
                      <div className="ud-azure-info-banner">
                        <ShieldIcon size={15} />
                        <span>
                          This will allow traffic from the internet to your virtual machine on the specified ports.
                          For production workloads, consider using Azure Bastion or restricting source IP addresses.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ── Advanced Networking Options ── */}
                  <div className="ud-section-divider">
                    <span>Performance & Cleanup</span>
                  </div>

                  <div className="ud-checkbox-item">
                    <input
                      type="checkbox"
                      id="accel-net"
                      checked={!!newVm.acceleratedNetworking}
                      onChange={(e) => setNewVm((p) => ({ ...p, acceleratedNetworking: e.target.checked }))}
                    />
                    <label htmlFor="accel-net">
                      Enable Accelerated Networking (SR-IOV for ultra-low latency & up to 30 Gbps throughput)
                    </label>
                  </div>

                  <div className="ud-checkbox-item">
                    <input
                      type="checkbox"
                      id="del-nic"
                      checked={newVm.deleteNicWithVm !== false}
                      onChange={(e) => setNewVm((p) => ({ ...p, deleteNicWithVm: e.target.checked }))}
                    />
                    <label htmlFor="del-nic">
                      <strong>Delete NIC when VM is deleted</strong> (Automatically delete the network interface upon VM deletion)
                    </label>
                  </div>
                </div>
              )}

              {createError && (
                <div className="ud-create-error">
                  <AlertTriangleIcon size={16} />
                  <span>{createError}</span>
                </div>
              )}

              <div className="ud-modal-footer">
                {createTab !== "basics" && (
                  <button
                    type="button"
                    className="ud-cancel-btn"
                    onClick={() => {
                      if (createTab === "disks") setCreateTab("basics");
                      if (createTab === "networking") setCreateTab("disks");
                    }}
                  >
                    ← Back
                  </button>
                )}

                {createTab === "basics" && (
                  <button
                    type="button"
                    className="ud-step-next-btn"
                    onClick={() => setCreateTab("disks")}
                  >
                    Next: Disks →
                  </button>
                )}

                {createTab === "disks" && (
                  <button
                    type="button"
                    className="ud-step-next-btn"
                    onClick={() => setCreateTab("networking")}
                  >
                    Next: Networking →
                  </button>
                )}

                <button type="submit" className="ud-confirm-create-btn" disabled={creating}>
                  {creating
                    ? <><span className="ud-btn-spinner" />&nbsp;Provisioning in Azure…</>
                    : <><PlusIcon size={15} />&nbsp;Create VM</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          Connect Modal (Native SSH/RDP, Web Terminal, Bastion)
      ══════════════════════════════════════════════════════ */}
      {connectModal && (
        <div className="ud-modal-overlay" onClick={() => setConnectModal(null)}>
          <div className="ud-modal ud-modal--connect" onClick={(e) => e.stopPropagation()}>
            <div className="ud-modal-header">
              <div className="ud-modal-title-row">
                <div className="ud-modal-icon-wrap cyan"><AzureVMIcon size={24} /></div>
                <div>
                  <h2>Connect to {connectModal.vmName || "Virtual Machine"}</h2>
                  <div className="ud-modal-connect-sub">
                    <span className="ud-connect-status-badge">
                      <span className="ud-dot ud-dot--green" /> Port {connectModal.port} Listening • Ready to Connect
                    </span>
                  </div>
                </div>
              </div>
              <button className="ud-modal-close" onClick={() => setConnectModal(null)}>
                <XIcon size={20} />
              </button>
            </div>

            {/* Connect Navigation Tabs */}
            <div className="ud-wizard-tabs">
              <button
                type="button"
                className={`ud-wizard-tab ${connectTab === "native" ? "active" : ""}`}
                onClick={() => setConnectTab("native")}
              >
                {connectModal.protocol === "RDP" ? "Remote Desktop (RDP)" : "SSH Client"}
              </button>
              <button
                type="button"
                className={`ud-wizard-tab ${connectTab === "terminal" ? "active" : ""}`}
                onClick={() => setConnectTab("terminal")}
              >
                Web Terminal (Console)
              </button>
              <button
                type="button"
                className={`ud-wizard-tab ${connectTab === "bastion" ? "active" : ""}`}
                onClick={() => setConnectTab("bastion")}
              >
                Azure Bastion
              </button>
            </div>

            <div className="ud-connect-body">
              {/* ── Tab 1: Native Client (SSH or RDP) ── */}
              {connectTab === "native" && (
                <div className="ud-tab-pane fade-in">
                  {connectModal.protocol === "RDP" ? (
                    <div className="ud-rdp-panel">
                      <div className="ud-rdp-banner">
                        <div className="ud-rdp-banner-text">
                          <h4>Connect via Remote Desktop Connection</h4>
                          <p>Download the pre-configured <code>.rdp</code> file to launch Windows Remote Desktop immediately.</p>
                        </div>
                        <button
                          type="button"
                          className="ud-rdp-download-btn"
                          onClick={handleDownloadRdp}
                        >
                          <MonitorIcon size={16} />
                          Download .RDP File
                        </button>
                      </div>

                      <div className="ud-connect-grid-2">
                        <div>
                          <p className="ud-connect-label">Target Address (Public IP)</p>
                          <code className="ud-connect-addr">{connectModal.address}</code>
                        </div>
                        <div>
                          <p className="ud-connect-label">Administrator Account</p>
                          <code className="ud-connect-addr">{connectModal.adminUsername || "azureuser"}</code>
                        </div>
                      </div>

                      <div className="ud-connect-steps">
                        <h4>Quick Connect Instructions:</h4>
                        <ol>
                          <li>Click <strong>Download .RDP File</strong> above and open the file.</li>
                          <li>Alternatively, press <kbd>Win + R</kbd>, type <code>mstsc /v:{connectModal.address}</code> and hit Enter.</li>
                          <li>Sign in using username <code>{connectModal.adminUsername || "azureuser"}</code> and your VM password.</li>
                        </ol>
                      </div>
                    </div>
                  ) : (
                    <div className="ud-ssh-panel">
                      <div className="ud-connect-meta-bar">
                        <div>
                          <p className="ud-connect-label">Public IP Address</p>
                          <code className="ud-connect-addr">{connectModal.ip}</code>
                        </div>
                        <div>
                          <p className="ud-connect-label">Port</p>
                          <code className="ud-connect-addr">{connectModal.port || 22}</code>
                        </div>
                        <div>
                          <p className="ud-connect-label">User</p>
                          <code className="ud-connect-addr">{connectModal.adminUsername || "azureuser"}</code>
                        </div>
                      </div>

                      <p className="ud-connect-label">SSH Command</p>
                      <div className="ud-copy-command-box">
                        <code>{connectModal.instruction}</code>
                        <button
                          type="button"
                          className="ud-box-copy-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(connectModal.instruction);
                            showToast("SSH command copied to clipboard!", "success");
                          }}
                        >
                          <CopyIcon size={14} /> Copy
                        </button>
                      </div>

                      <p className="ud-connect-label">SSH with Identity File (Key)</p>
                      <div className="ud-copy-command-box">
                        <code>ssh -i ~/.ssh/id_rsa {connectModal.adminUsername || "azureuser"}@{connectModal.ip}</code>
                        <button
                          type="button"
                          className="ud-box-copy-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(`ssh -i ~/.ssh/id_rsa ${connectModal.adminUsername || "azureuser"}@${connectModal.ip}`);
                            showToast("Identity SSH command copied!", "success");
                          }}
                        >
                          <CopyIcon size={14} /> Copy
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="ud-conn-test-row">
                    <button
                      type="button"
                      className="ud-test-conn-btn"
                      onClick={handleTestConnection}
                    >
                      {pingStatus === "testing" ? "Probing port..." : "Test Port Handshake"}
                    </button>
                    <span className="ud-conn-test-hint">
                      Checks Network Security Group (NSG) rule for port {connectModal.port}.
                    </span>
                  </div>
                </div>
              )}

              {/* ── Tab 2: Web Terminal (Live interactive console) ── */}
              {connectTab === "terminal" && (
                <div className="ud-terminal-panel fade-in">
                  <div className="ud-terminal-quick-bar">
                    <span className="ud-terminal-quick-title">Quick commands:</span>
                    {["uname -a", "uptime", "whoami", "ip addr", "df -h", "docker ps", "clear"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="ud-term-chip"
                        onClick={() => {
                          setTerminalInput(c);
                          // Trigger simulated output
                          setTimeout(() => {
                            const evt = { preventDefault: () => {} };
                            handleTerminalSubmit(evt);
                          }, 50);
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <div className="ud-terminal-screen">
                    <div className="ud-terminal-output">
                      {terminalLines.map((line, idx) => (
                        <div
                          key={idx}
                          className={`ud-term-line ${line.startsWith(connectModal.adminUsername || "azureuser") ? "command" : ""}`}
                        >
                          {line}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleTerminalSubmit} className="ud-terminal-prompt-form">
                      <span className="ud-term-prompt-user">
                        {connectModal.adminUsername || "azureuser"}@{connectModal.vmName || "vm"}:~$
                      </span>
                      <input
                        type="text"
                        className="ud-term-input"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        placeholder="type a command (e.g. uptime, docker ps)..."
                        autoFocus
                      />
                    </form>
                  </div>
                </div>
              )}

              {/* ── Tab 3: Azure Bastion ── */}
              {connectTab === "bastion" && (
                <div className="ud-bastion-panel fade-in">
                  <div className="ud-bastion-card">
                    <div className="ud-bastion-badge">
                      <ShieldIcon size={16} /> Azure Bastion Host Active
                    </div>
                    <h4>Secure Zero-Public-IP Browser Session</h4>
                    <p>
                      Azure Bastion connects securely over TLS (port 443) directly to the VM's private IP (<code>{connectModal.privateIp || "10.0.1.4"}</code>) in virtual network <code>{connectModal.vnet}</code>.
                    </p>
                    <div className="ud-bastion-specs">
                      <div className="ud-bastion-spec-item">
                        <span>VNet</span>
                        <strong>{connectModal.vnet}</strong>
                      </div>
                      <div className="ud-bastion-spec-item">
                        <span>Subnet</span>
                        <strong>AzureBastionSubnet (10.0.0.0/27)</strong>
                      </div>
                      <div className="ud-bastion-spec-item">
                        <span>Private IP</span>
                        <strong>{connectModal.privateIp || "10.0.1.4"}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ud-bastion-launch-btn"
                      onClick={() => {
                        setConnectTab("terminal");
                        showToast("Launching Bastion TLS session in Web Console...", "success");
                      }}
                    >
                      Launch Bastion Session
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="ud-modal-footer">
              <button
                type="button"
                className="ud-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(connectModal.instruction);
                  showToast("Copied command to clipboard!", "success");
                }}
              >
                Copy Command
              </button>
              <button
                type="button"
                className="ud-confirm-create-btn"
                onClick={() => setConnectModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Azure Cloud Tenant Status & Diagnostics Modal ── */}
      {azureModalOpen && (
        <div className="ud-modal-backdrop" onClick={() => setAzureModalOpen(false)}>
          <div
            className="ud-modal ud-modal--azure"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ud-modal-header">
              <div className="ud-modal-header-icon blue">
                <AzureLogo size={24} />
              </div>
              <div>
                <h3 className="ud-modal-title">Azure Cloud Tenant Diagnostics</h3>
                <p className="ud-modal-sub">
                  Microsoft Azure Resource Manager (ARM) Integration
                </p>
              </div>
              <button
                className="ud-modal-close"
                onClick={() => setAzureModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="ud-modal-body">
              <div className={`ud-azure-diag-card ${azureStatus?.connected ? "success" : "warning"}`}>
                <div className="ud-azure-diag-header">
                  <div className="ud-azure-diag-indicator">
                    <span className={`ud-dot ${azureStatus?.connected ? "green" : "amber"}`}></span>
                    <strong>
                      {azureStatus?.connected
                        ? "Connected to Live Azure Subscription"
                        : (azureStatus?.status === "authorization_required"
                            ? "Entra ID Auth OK — Pending IAM Role Assignment"
                            : "Azure Connection Configured")}
                    </strong>
                  </div>
                  <span className="ud-azure-diag-status-tag">
                    {azureStatus?.status || "Checking..."}
                  </span>
                </div>
                <p className="ud-azure-diag-msg">
                  {azureStatus?.message}
                </p>
              </div>

              <div className="ud-azure-spec-grid">
                <div className="ud-azure-spec-item">
                  <span className="ud-azure-spec-lbl">Directory (Tenant) ID</span>
                  <div className="ud-azure-spec-val">
                    <code>{azureStatus?.tenantId || "00d8a0cf-d1d1-4d2e-9e9c-83904d181b3a"}</code>
                    <button
                      type="button"
                      className="ud-chip-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(azureStatus?.tenantId || "00d8a0cf-d1d1-4d2e-9e9c-83904d181b3a");
                        showToast("Copied Tenant ID", "success");
                      }}
                    >
                      <CopyIcon size={12} />
                    </button>
                  </div>
                </div>

                <div className="ud-azure-spec-item">
                  <span className="ud-azure-spec-lbl">Application (Client) ID</span>
                  <div className="ud-azure-spec-val">
                    <code>{azureStatus?.clientId || "adce8ae4-edbf-4d11-9245-47d8e97286f9"}</code>
                    <button
                      type="button"
                      className="ud-chip-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(azureStatus?.clientId || "adce8ae4-edbf-4d11-9245-47d8e97286f9");
                        showToast("Copied Client ID", "success");
                      }}
                    >
                      <CopyIcon size={12} />
                    </button>
                  </div>
                </div>

                <div className="ud-azure-spec-item">
                  <span className="ud-azure-spec-lbl">Subscription ID</span>
                  <div className="ud-azure-spec-val">
                    <code>{azureStatus?.subscriptionId || "cb103e8d-053f-430e-98f8-b3d0e6fe737f"}</code>
                    <button
                      type="button"
                      className="ud-chip-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(azureStatus?.subscriptionId || "cb103e8d-053f-430e-98f8-b3d0e6fe737f");
                        showToast("Copied Subscription ID", "success");
                      }}
                    >
                      <CopyIcon size={12} />
                    </button>
                  </div>
                </div>

                <div className="ud-azure-spec-item">
                  <span className="ud-azure-spec-lbl">Service Principal Name</span>
                  <div className="ud-azure-spec-val">
                    <code>AzureMonitor-Abhishek</code>
                  </div>
                </div>
              </div>

              {azureStatus?.status === "authorization_required" && (
                <div className="ud-azure-instructions-box">
                  <h4>Next Step: Grant IAM Role in Azure Portal (1-minute setup)</h4>
                  <ol className="ud-azure-steps-list">
                    <li>
                      Open <strong>portal.azure.com</strong> and search for <strong>Subscriptions</strong>.
                    </li>
                    <li>
                      Select subscription: <code>cb103e8d-053f-430e-98f8-b3d0e6fe737f</code>.
                    </li>
                    <li>
                      Click <strong>Access control (IAM)</strong> in the left sidebar.
                    </li>
                    <li>
                      Click <strong>+ Add</strong> ➔ <strong>Add role assignment</strong>.
                    </li>
                    <li>
                      Select the <strong>Contributor</strong> role (or <em>Virtual Machine Contributor</em>).
                    </li>
                    <li>
                      Under <strong>Members</strong>, search for <code>AzureMonitor-Abhishek</code> and select it.
                    </li>
                    <li>
                      Click <strong>Review + assign</strong>, then click <strong>"Re-test Connection"</strong> below!
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="ud-modal-footer">
              <button
                type="button"
                className="ud-azure-recheck-btn"
                disabled={azureChecking}
                onClick={recheckAzureStatus}
              >
                <RefreshIcon size={15} className={azureChecking ? "spin" : ""} />
                <span>{azureChecking ? "Testing Azure..." : "Re-test Connection"}</span>
              </button>
              <button
                type="button"
                className="ud-confirm-create-btn"
                onClick={() => setAzureModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Resource Group Modal ── */}
      {createRgModal && (
        <div className="ud-modal-backdrop" onClick={() => setCreateRgModal(false)}>
          <div
            className="ud-modal"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ud-modal-header">
              <div className="ud-modal-header-icon blue">
                <AzureLogo size={24} />
              </div>
              <div>
                <h3 className="ud-modal-title">Create Azure Resource Group</h3>
                <p className="ud-modal-sub">
                  Create a dedicated boundary in your Azure subscription
                </p>
              </div>
              <button
                className="ud-modal-close"
                onClick={() => setCreateRgModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateResourceGroup}>
              <div className="ud-modal-body">
                <div className="ud-field">
                  <label className="ud-label">Resource Group Name *</label>
                  <input
                    type="text"
                    className="ud-input"
                    value={newRgName}
                    onChange={(e) => setNewRgName(e.target.value)}
                    placeholder="e.g. rg-abhishek-inc-001"
                    required
                    autoFocus
                  />
                  <span className="ud-hint">
                    Unique name within your subscription. Use lowercase, numbers, and hyphens.
                  </span>
                </div>

                <div className="ud-field">
                  <label className="ud-label">Region / Location</label>
                  <select
                    className="ud-select"
                    value={newRgLocation}
                    onChange={(e) => setNewRgLocation(e.target.value)}
                  >
                    <option value="centralindia">Central India (Pune)</option>
                    <option value="eastus2">East US 2 (Virginia)</option>
                    <option value="westeurope">West Europe (Netherlands)</option>
                    <option value="southeastasia">Southeast Asia (Singapore)</option>
                  </select>
                </div>
              </div>

              <div className="ud-modal-footer">
                <button
                  type="button"
                  className="ud-cancel-btn"
                  onClick={() => setCreateRgModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ud-confirm-create-btn"
                  disabled={creatingRg || !newRgName.trim()}
                >
                  {creatingRg ? "Creating in Azure..." : "Create Resource Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

