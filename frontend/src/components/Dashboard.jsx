import React, { useState, useEffect } from "react";
import "./Dashboard.css";
import {
  AzureLogo,
  DashboardIcon,
  ServerIcon,
  DatabaseIcon,
  CloudIcon,
  ShieldIcon,
  ActivityIcon,
  BellIcon,
  SearchIcon,
  RefreshIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  CpuIcon,
  TrendingUpIcon,
  PlusIcon,
} from "./Icons";

const INITIAL_RESOURCES = [
  {
    id: "vm-01",
    name: "zenit-api-gateway-prod",
    type: "Compute (App Service)",
    category: "compute",
    region: "East US 2",
    status: "Running",
    cpuUsage: 38,
    memoryUsage: "2.4 / 4.0 GB",
    ip: "20.112.45.89",
    uptime: "18d 4h",
  },
  {
    id: "vm-02",
    name: "auth-service-cluster",
    type: "Kubernetes (AKS)",
    category: "compute",
    region: "West Europe",
    status: "Running",
    cpuUsage: 54,
    memoryUsage: "6.8 / 8.0 GB",
    ip: "51.144.120.33",
    uptime: "34d 12h",
  },
  {
    id: "db-01",
    name: "zenit-telemetry-postgres",
    type: "Azure Cosmos DB / PG",
    category: "database",
    region: "East US 2",
    status: "Healthy",
    cpuUsage: 22,
    memoryUsage: "12.1 / 16.0 GB",
    ip: "10.0.4.12",
    uptime: "45d 9h",
  },
  {
    id: "db-02",
    name: "redis-cache-tier-1",
    type: "Azure Cache for Redis",
    category: "database",
    region: "West Europe",
    status: "Healthy",
    cpuUsage: 15,
    memoryUsage: "1.8 / 2.0 GB",
    ip: "10.0.5.88",
    uptime: "9d 2h",
  },
  {
    id: "st-01",
    name: "zenitblobstoreprimary",
    type: "Blob Storage Account",
    category: "storage",
    region: "East US 2",
    status: "Syncing",
    cpuUsage: 8,
    memoryUsage: "482 GB / 2 TB",
    ip: "10.0.1.5",
    uptime: "120d 0h",
  },
  {
    id: "vm-03",
    name: "worker-batch-indexer",
    type: "Container Instance",
    category: "compute",
    region: "Central US",
    status: "Running",
    cpuUsage: 67,
    memoryUsage: "3.9 / 4.0 GB",
    ip: "40.76.19.201",
    uptime: "4d 18h",
  },
];

const INITIAL_ACTIVITIES = [
  {
    id: 1,
    title: "User Authenticated",
    desc: "Super Admin signed into Azure portal from current IP session.",
    time: "Just now",
    type: "auth",
  },
  {
    id: 2,
    title: "Cluster Auto-Scale Event",
    desc: "Node pool scaled horizontally (+2 worker pods) to meet demand.",
    time: "14 mins ago",
    type: "scale",
  },
  {
    id: 3,
    title: "Automated DB Snapshot",
    desc: "zenit-telemetry-postgres geo-replicated backup stored in GRS vault.",
    time: "1 hour ago",
    type: "backup",
  },
  {
    id: 4,
    title: "Security Shield Scan",
    desc: "Zero high vulnerabilities found in vulnerability compliance scan.",
    time: "3 hours ago",
    type: "security",
  },
];

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [resources, setResources] = useState(INITIAL_RESOURCES);
  const [activities, setActivities] = useState(INITIAL_ACTIVITIES);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3500);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      showToast("Live telemetry & metrics synchronized with Azure cloud.");
    }, 700);
  };

  const handleResourceAction = (resId, actionName) => {
    const target = resources.find((r) => r.id === resId);
    showToast(`Action '${actionName}' executed for ${target ? target.name : resId}`);
  };

  const filteredResources = resources.filter((res) => {
    const matchesCategory =
      categoryFilter === "all" || res.category === categoryFilter;
    const matchesSearch =
      res.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.ip.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="dashboard-layout fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="dashboard-toast">
          <CheckCircleIcon size={18} className="toast-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="dash-header">
        <div className="dash-brand">
          <div className="dash-logo-wrap">
            <AzureLogo size={30} />
          </div>
          <div className="dash-brand-info">
            <span className="brand-title">Azure Cloud Portal</span>
            <span className="brand-sub">Gruppo Zenit Infrastructure</span>
          </div>
          <span className="dash-version-pill">v2.4 Enterprise</span>
        </div>

        {/* Global Live Status */}
        <div className="system-status-indicator" title="East US & West Europe regions healthy">
          <span className="pulsing-status-dot"></span>
          <span className="status-text">All Cloud Systems Operational</span>
        </div>

        {/* Header Right Actions */}
        <div className="dash-header-actions">
          <button
            className={`icon-button ${refreshing ? "spinning" : ""}`}
            onClick={handleRefresh}
            title="Refresh Azure Metrics"
          >
            <RefreshIcon size={18} />
          </button>

          <div className="notification-wrapper">
            <button
              className="icon-button notification-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
            >
              <BellIcon size={18} />
              <span className="notif-badge">3</span>
            </button>

            {showNotifications && (
              <div className="notifications-dropdown">
                <div className="notif-header">
                  <h4>System Alerts</h4>
                  <span className="notif-unread-count">3 new</span>
                </div>
                <div className="notif-list">
                  <div className="notif-item unread">
                    <span className="notif-dot blue"></span>
                    <div>
                      <p className="notif-text">East US 2 latency dropped to 14ms</p>
                      <span className="notif-time">10 min ago</span>
                    </div>
                  </div>
                  <div className="notif-item unread">
                    <span className="notif-dot green"></span>
                    <div>
                      <p className="notif-text">Daily security compliance passed 100%</p>
                      <span className="notif-time">1 hour ago</span>
                    </div>
                  </div>
                  <div className="notif-item">
                    <span className="notif-dot amber"></span>
                    <div>
                      <p className="notif-text">Monthly budget threshold at 79%</p>
                      <span className="notif-time">Yesterday</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="user-profile-chip">
            <div className="user-avatar">
              {(user?.email?.[0] || "A").toUpperCase()}
            </div>
            <div className="user-meta">
              <span className="user-email-text">{user?.email || "admin@example.com"}</span>
              <span className="user-role-badge">Cloud Admin</span>
            </div>
          </div>

          <button className="logout-btn" onClick={onLogout} title="Sign Out">
            <LogOutIcon size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Body: Sidebar + Main Content */}
      <div className="dash-body">
        {/* Sidebar */}
        <aside className="dash-sidebar">
          <div className="sidebar-section-title">PORTAL NAVIGATION</div>
          <nav className="dash-nav">
            <button
              className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <DashboardIcon size={18} />
              <span>Overview</span>
            </button>
            <button
              className={`nav-item ${activeTab === "compute" ? "active" : ""}`}
              onClick={() => setActiveTab("compute")}
            >
              <ServerIcon size={18} />
              <span>Virtual Machines</span>
              <span className="nav-badge">3</span>
            </button>
            <button
              className={`nav-item ${activeTab === "database" ? "active" : ""}`}
              onClick={() => setActiveTab("database")}
            >
              <DatabaseIcon size={18} />
              <span>Databases & Storage</span>
              <span className="nav-badge">3</span>
            </button>
            <button
              className={`nav-item ${activeTab === "cloud" ? "active" : ""}`}
              onClick={() => setActiveTab("cloud")}
            >
              <CloudIcon size={18} />
              <span>Virtual Networks</span>
            </button>
            <button
              className={`nav-item ${activeTab === "security" ? "active" : ""}`}
              onClick={() => setActiveTab("security")}
            >
              <ShieldIcon size={18} />
              <span>Security & Policies</span>
            </button>
            <button
              className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <SettingsIcon size={18} />
              <span>Subscription Settings</span>
            </button>
          </nav>

          {/* Quota Meter Card in Sidebar */}
          <div className="sidebar-quota-card">
            <div className="quota-header">
              <span className="quota-title">Monthly Quota</span>
              <span className="quota-percent">71%</span>
            </div>
            <div className="quota-progress-track">
              <div className="quota-progress-bar" style={{ width: "71%" }}></div>
            </div>
            <div className="quota-stats">
              <span>$1,428.50 / $2,000</span>
              <span className="quota-sub">Azure Demo Plan</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="dash-main">
          {/* Hero Welcome Banner */}
          <div className="hero-banner">
            <div className="hero-text-block">
              <div className="hero-greeting">
                <h2>Welcome to Azure Cloud Center, {user?.email?.split("@")[0] || "Administrator"}</h2>
                <span className="hero-badge">Production Ready</span>
              </div>
              <p className="hero-desc">
                Your Azure enterprise tenant is running smoothly. All services are currently distributed across East US 2 and West Europe data centers.
              </p>
            </div>
            <div className="hero-actions">
              <button
                className="hero-primary-btn"
                onClick={() => showToast("Provisioning modal opened: Choose Azure Template.")}
              >
                <PlusIcon size={16} />
                <span>Deploy Resource</span>
              </button>
              <button className="hero-secondary-btn" onClick={handleRefresh}>
                <RefreshIcon size={16} />
                <span>Sync Telemetry</span>
              </button>
            </div>
          </div>

          {/* KPI Metrics Grid */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Active Workloads</span>
                <div className="kpi-icon-wrap blue">
                  <ServerIcon size={18} />
                </div>
              </div>
              <div className="kpi-value">28 Instances</div>
              <div className="kpi-footer positive">
                <TrendingUpIcon size={14} />
                <span>+4 provisioned this week</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Avg CPU Utilization</span>
                <div className="kpi-icon-wrap cyan">
                  <CpuIcon size={18} />
                </div>
              </div>
              <div className="kpi-value">39.2%</div>
              <div className="kpi-footer neutral">
                <span>Healthy balance across clusters</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Uptime & Reliability</span>
                <div className="kpi-icon-wrap emerald">
                  <CheckCircleIcon size={18} />
                </div>
              </div>
              <div className="kpi-value">99.98%</div>
              <div className="kpi-footer positive">
                <span>Zero downtime in 30 days</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">Month-to-Date Spend</span>
                <div className="kpi-icon-wrap amber">
                  <TrendingUpIcon size={18} />
                </div>
              </div>
              <div className="kpi-value">$1,428.50</div>
              <div className="kpi-footer positive">
                <span>14% below monthly forecast</span>
              </div>
            </div>
          </div>

          {/* Resources & Activity Split Section */}
          <div className="dash-content-split">
            {/* Left/Main Column: Resources Table */}
            <section className="dash-panel resource-panel">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Cloud Resources & Services</h3>
                  <p className="panel-subtitle">Monitor health, compute metrics, and regions</p>
                </div>

                <div className="panel-controls">
                  <div className="search-box">
                    <SearchIcon size={16} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search resource, IP, region..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="filter-chips">
                    <button
                      className={`filter-chip ${categoryFilter === "all" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("all")}
                    >
                      All
                    </button>
                    <button
                      className={`filter-chip ${categoryFilter === "compute" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("compute")}
                    >
                      Compute
                    </button>
                    <button
                      className={`filter-chip ${categoryFilter === "database" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("database")}
                    >
                      Data
                    </button>
                    <button
                      className={`filter-chip ${categoryFilter === "storage" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("storage")}
                    >
                      Storage
                    </button>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="table-responsive">
                <table className="resource-table">
                  <thead>
                    <tr>
                      <th>Resource Name</th>
                      <th>Region</th>
                      <th>Status</th>
                      <th>CPU Load</th>
                      <th>Public / VNet IP</th>
                      <th>Uptime</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResources.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="empty-table-state">
                          No matching resources found for query "{searchQuery}".
                        </td>
                      </tr>
                    ) : (
                      filteredResources.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="resource-name-cell">
                              <span className="res-title">{item.name}</span>
                              <span className="res-type">{item.type}</span>
                            </div>
                          </td>
                          <td>
                            <span className="res-region-tag">{item.region}</span>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                item.status === "Running" || item.status === "Healthy"
                                  ? "green"
                                  : "amber"
                              }`}
                            >
                              <span className="pill-dot"></span>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <div className="cpu-metric-cell">
                              <div className="cpu-track">
                                <div
                                  className="cpu-fill"
                                  style={{
                                    width: `${item.cpuUsage}%`,
                                    backgroundColor:
                                      item.cpuUsage > 60
                                        ? "#f59e0b"
                                        : "var(--azure-400)",
                                  }}
                                ></div>
                              </div>
                              <span className="cpu-num">{item.cpuUsage}%</span>
                            </div>
                          </td>
                          <td>
                            <code className="ip-code">{item.ip}</code>
                          </td>
                          <td className="uptime-text">{item.uptime}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="action-btn"
                                onClick={() => handleResourceAction(item.id, "Restart")}
                                title="Restart instance"
                              >
                                Restart
                              </button>
                              <button
                                className="action-btn secondary"
                                onClick={() => handleResourceAction(item.id, "Telemetry")}
                                title="View logs"
                              >
                                Logs
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Right Column: Recent Activity Feed & Audit */}
            <section className="dash-panel activity-panel">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Audit Log & Events</h3>
                  <p className="panel-subtitle">Real-time tenant activity</p>
                </div>
                <ActivityIcon size={18} className="activity-header-icon" />
              </div>

              <div className="activity-feed">
                {activities.map((act) => (
                  <div className="activity-item" key={act.id}>
                    <div className="activity-line"></div>
                    <div className={`activity-bullet ${act.type}`}></div>
                    <div className="activity-details">
                      <div className="activity-top-row">
                        <span className="activity-name">{act.title}</span>
                        <span className="activity-timestamp">{act.time}</span>
                      </div>
                      <p className="activity-desc">{act.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Security Health Box */}
              <div className="security-summary-card">
                <div className="security-summary-header">
                  <ShieldIcon size={20} className="shield-green" />
                  <span className="sec-title">Microsoft Defender for Cloud</span>
                </div>
                <p className="sec-text">
                  Security posture score is <strong>96%</strong>. Multi-Factor Authentication and encryption at rest enabled.
                </p>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
