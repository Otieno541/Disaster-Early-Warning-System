let adminUser = null;
let allDisasters = [];
let allUsers = [];
let charts = {};
let simResults = [];
let resolvedDisasterIds = new Set();

document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
});

async function checkAdminAuth() {
    const loading = document.getElementById('admin-loading');
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();

        if (data.authenticated && data.user?.is_admin) {
            adminUser = data.user;
            if (loading) loading.style.display = 'none';
            document.getElementById('admin-app').classList.remove('hidden');
            document.getElementById('admin-auth-overlay').style.display = 'none';

            updateAdminUI();
            setupAdminEventListeners();
            setupNavigation();
            loadDashboardData();
            loadAuthorities();
            startClock();

            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('welcome') === 'back') {
                showAdminWelcome(`Welcome back, ${adminUser.full_name || adminUser.username}!`);
                window.history.replaceState({}, document.title, '/admin');
            }

            setInterval(loadDashboardData, 30000);
            
            loadAdminNotifications();
            setInterval(loadAdminNotifications, 15000);
        } else {
            if (loading) loading.style.display = 'none';
            document.getElementById('admin-auth-overlay').style.display = 'flex';
        }
    } catch (error) {
        if (loading) loading.style.display = 'none';
        document.getElementById('admin-auth-overlay').style.display = 'flex';
    }
}

function updateAdminUI() {
    if (!adminUser) return;
    const miniAvatar = document.getElementById('mini-avatar');
    const miniIcon = document.getElementById('mini-avatar-icon');
    const miniName = document.getElementById('mini-username');

    if (miniName) miniName.textContent = adminUser.full_name || adminUser.username;
    if (adminUser.avatar_url && miniAvatar) {
        miniAvatar.src = adminUser.avatar_url;
        miniAvatar.style.display = 'block';
        if (miniIcon) miniIcon.style.display = 'none';
    }

    document.getElementById('admin-fullname').value = adminUser.full_name || '';
    document.getElementById('admin-username').value = adminUser.username || '';
    document.getElementById('admin-email').value = adminUser.email || '';
    document.getElementById('admin-phone').value = adminUser.phone || '';

    const profileImg = document.getElementById('profile-avatar-img');
    const profileIcon = document.getElementById('profile-avatar-icon');
    const displayName = document.getElementById('profile-display-name');
    if (adminUser.avatar_url && profileImg) {
        profileImg.src = adminUser.avatar_url;
        profileImg.style.display = 'block';
        if (profileIcon) profileIcon.style.display = 'none';
    }
    if (displayName) displayName.textContent = adminUser.full_name || adminUser.username;
}

function showAdminWelcome(message) {
    const toast = document.getElementById('admin-welcome-toast');
    const msg = document.getElementById('admin-welcome-message');
    if (msg) msg.textContent = message;
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 5000);
    }
}

function setupAdminEventListeners() {
    
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        document.getElementById('admin-sidebar').classList.toggle('open');
    });

    document.getElementById('admin-logout-btn')?.addEventListener('click', doAdminLogout);

    document.getElementById('avatar-change-btn')?.addEventListener('click', () => {
        document.getElementById('profile-avatar-input')?.click();
    });
    document.getElementById('profile-avatar-input')?.addEventListener('change', async (e) => {
        if (!e.target.files[0]) return;
        const formData = new FormData();
        formData.append('avatar', e.target.files[0]);
        try {
            const response = await fetch('/api/update-profile', { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) {
                showAdminToast('Profile picture updated!', 'success');
                adminUser.avatar_url = data.user.avatar_url;
                updateAdminUI();
            }
        } catch (err) { showAdminToast('Upload failed', 'error'); }
    });

    document.getElementById('admin-profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('admin-new-password').value;
        const confirmPassword = document.getElementById('admin-confirm-password').value;

        if (newPassword && newPassword !== confirmPassword) {
            showAdminToast('Passwords do not match!', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('full_name', document.getElementById('admin-fullname').value);
        formData.append('email', document.getElementById('admin-email').value);
        formData.append('phone', document.getElementById('admin-phone').value);
        if (newPassword) {
            formData.append('new_password', newPassword);
            formData.append('confirm_password', confirmPassword);
        }

        try {
            const response = await fetch('/api/update-profile', { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) {
                showAdminToast('Profile updated successfully!', 'success');
                adminUser = { ...adminUser, ...data.user };
                updateAdminUI();
                document.getElementById('admin-new-password').value = '';
                document.getElementById('admin-confirm-password').value = '';
            } else {
                showAdminToast(data.message || 'Update failed', 'error');
            }
        } catch (err) { showAdminToast('Network error', 'error'); }
    });

    document.getElementById('run-sim-btn')?.addEventListener('click', runSimulation);
    document.getElementById('download-csv-btn')?.addEventListener('click', downloadSimCSV);
    document.getElementById('download-html-btn')?.addEventListener('click', downloadSimHTML);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('mouseenter', () => showKPITooltip(card, card.dataset.kpi));
        card.addEventListener('mouseleave', hideKPITooltip);
        card.addEventListener('click', () => showKPIDetail(card.dataset.kpi));
    });
}

function setupNavigation() {
    document.querySelectorAll('.admin-sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            showSection(section);

            document.querySelectorAll('.admin-sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function showSection(section) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${section}`);
    if (target) {
        target.classList.add('active');
        const titles = {
            dashboard: 'Admin Dashboard',
            disasters: 'Disaster Management',
            users: 'User Management',
            simulation: 'Disaster Simulation',
            authorities: 'Kenyan Disaster Authorities',
            profile: 'My Profile'
        };
        const titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.textContent = titles[section] || 'Admin Dashboard';
    }

    if (section === 'dashboard' || section === 'disasters') loadDisasterData();
    if (section === 'users') loadUsersData();
    if (section === 'disasters') populateDisasterFilters();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabId}`));
    if (tabId === 'online-users') loadOnlineUsers();
}

async function loadDashboardData() {
    await Promise.all([loadDisasterData(), loadUsersData(), loadOnlineUsers()]);
    
    loadAdminNotifications();
}

async function refreshAllData(fullRefresh) {
    if (fullRefresh) {
        showAdminToast('Refreshing all data...', 'info');
        
        document.getElementById('kpi-critical').classList.add('animate-pulse');
    }

    try {
        await Promise.all([
            loadDisasterData(),
            loadUsersData(),
            loadOnlineUsers(),
            loadAdminNotifications()
        ]);

        const realDisasters = window.allRealDisasters || [];
        const reported = await fetch('/api/disasters').then(r => r.json()).then(d => d.disasters || []).catch(() => []);
        allDisasters = [...realDisasters, ...reported];
        const active = allDisasters.filter(d => !resolvedDisasterIds.has(d.id));
        updateCharts(active);

        if (fullRefresh) {
            showAdminToast('All data refreshed successfully!', 'success');
        }
    } catch (error) {
        console.error('Refresh error:', error);
        if (fullRefresh) showAdminToast('Refresh partially failed', 'warning');
    } finally {
        document.getElementById('kpi-critical')?.classList.remove('animate-pulse');
    }
}

async function loadDisasterData() {
    try {
        const response = await fetch('/api/disasters');
        const data = await response.json();

        const realDisasters = window.allRealDisasters || [];
        const reported = data.disasters || [];

        allDisasters = [...realDisasters, ...reported];

        const active = allDisasters.filter(d => !resolvedDisasterIds.has(d.id));

        updateKPICards(active);
        updateCharts(active);
        updateRecentDisastersTable(active);
        updateFullDisastersTable(active);
    } catch (error) {
        console.error('Failed to load disaster data:', error);
    }
}

function updateKPICards(disasters) {
    const critical = disasters.filter(d => d.severity === 'Critical' && d.status !== 'Resolved' && d.status !== 'Contained').length;
    const high = disasters.filter(d => d.severity === 'High' && d.status !== 'Resolved' && d.status !== 'Contained').length;
    const predicted = disasters.filter(d => d.status === 'Predicted').length;
    const total = disasters.filter(d => d.status !== 'Resolved' && d.status !== 'Contained').length;

    document.getElementById('kpi-critical').textContent = critical;
    document.getElementById('kpi-high').textContent = high;
    document.getElementById('kpi-predicted').textContent = predicted;
    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-critical-trend').textContent = critical > 0 ? `${critical} requiring immediate attention` : 'No critical alerts';
}

function showKPITooltip(element, type) {
    const tooltip = document.getElementById('kpi-tooltip');
    if (!tooltip) return;

    const titles = {
        critical: 'Critical Alerts',
        high: 'High Risk Disasters',
        predicted: 'Predicted Disasters',
        total: 'Total Active Disasters',
        users: 'Total Registered Users',
        online: 'Users Online Now'
    };

    const rect = element.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.bottom + 8) + 'px';
    tooltip.style.transform = 'translateX(-50%)';

    let desc = '';
    const active = allDisasters.filter(d => d.status !== 'Resolved' && d.status !== 'Contained');

    switch (type) {
        case 'critical':
            desc = `Disasters requiring immediate response. Currently ${active.filter(d => d.severity === 'Critical').length} active critical alert(s). Source: USGS, GDACS, DEWS sensors.`;
            break;
        case 'high':
            desc = `High severity disasters monitored. Currently ${active.filter(d => d.severity === 'High').length} high-risk event(s) being tracked in real-time.`;
            break;
        case 'predicted':
            desc = `AI-predicted disasters based on weather patterns and sensor data. ${active.filter(d => d.status === 'Predicted').length} prediction(s) active.`;
            break;
        case 'total':
            desc = `Total active disasters being monitored across all 47 Kenyan counties. Updated every 5 minutes from multiple sources.`;
            break;
        case 'users':
            desc = `Total registered users in the DEWS Kenya system. Includes both regular users and administrators.`;
            break;
        case 'online':
            desc = `Users currently active on the platform. Real-time tracking of user sessions.`;
            break;
    }

    tooltip.innerHTML = `<div class="kpi-tooltip-title"><i class="fas fa-info-circle"></i> ${titles[type]}</div><div class="kpi-tooltip-desc">${desc}</div>`;
    tooltip.classList.remove('hidden');
}

function hideKPITooltip() {
    document.getElementById('kpi-tooltip')?.classList.add('hidden');
}

function showKPIDetail(type) {
    const modal = document.getElementById('kpi-detail-modal');
    const title = document.getElementById('kpi-detail-title');
    const body = document.getElementById('kpi-detail-body');
    if (!modal || !body) return;

    const titles = {
        critical: 'Critical Alert Details',
        high: 'High Risk Disaster Details',
        predicted: 'Predicted Disaster Details',
        total: 'All Active Disasters',
        users: 'User Statistics',
        online: 'Online Users'
    };

    title.innerHTML = `<i class="fas fa-chart-bar"></i> ${titles[type] || 'Details'}`;

    const active = allDisasters.filter(d => d.status !== 'Resolved' && d.status !== 'Contained');

    let filtered = active;
    if (type === 'critical') filtered = active.filter(d => d.severity === 'Critical');
    else if (type === 'high') filtered = active.filter(d => d.severity === 'High');
    else if (type === 'predicted') filtered = active.filter(d => d.status === 'Predicted');

    if (type === 'users' || type === 'online') {
        body.innerHTML = '<p>Loading user data...</p>';
        loadUsersData().then(() => {
            const targetUsers = type === 'online' ? allUsers.filter(u => u.is_online) : allUsers;
            body.innerHTML = `
                <div class="stats-chart-container">
                    <p style="font-size:1.5rem;color:white;font-weight:700;margin-bottom:16px;">${targetUsers.length}</p>
                    <table class="stats-table">
                        <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th></tr></thead>
                        <tbody>${targetUsers.map(u => `
                            <tr><td>${u.username}</td><td>${u.full_name || '-'}</td><td>${u.is_admin ? 'Admin' : 'User'}</td>
                            <td>${u.is_online ? '<span style="color:#5cdb7d;"><i class="fas fa-circle"></i> Online</span>' : '<span style="color:rgba(255,255,255,0.3);">Offline</span>'}</td></tr>
                        `).join('')}</tbody>
                    </table>
                </div>
            `;
        });
    } else {
        body.innerHTML = `
            <div class="stats-chart-container">
                <p style="font-size:1.5rem;color:white;font-weight:700;margin-bottom:16px;">${filtered.length} Active</p>
                <table class="stats-table">
                    <thead><tr><th>Type</th><th>County</th><th>Severity</th><th>Status</th><th>Detected</th></tr></thead>
                    <tbody>${filtered.map(d => {
                        const timeStr = d.timestamp instanceof Date ? d.timestamp.toLocaleString('en-KE') : new Date(d.timestamp).toLocaleString('en-KE');
                        return `<tr><td>${d.type}</td><td>${d.county}</td><td>${d.severity}</td><td>${d.status}</td><td>${timeStr}</td></tr>`;
                    }).join('')}</tbody>
                </table>
            </div>
        `;
    }

    modal.classList.remove('hidden');
}

function closeKPIDetail() {
    document.getElementById('kpi-detail-modal')?.classList.add('hidden');
}

function updateCharts(disasters) {
    const ctx1 = document.getElementById('chart-by-type');
    const ctx2 = document.getElementById('chart-by-severity');
    const ctx3 = document.getElementById('chart-by-county');

    if (!ctx1 || !ctx2 || !ctx3) return;

    const typeCounts = {};
    disasters.forEach(d => { typeCounts[d.type] = (typeCounts[d.type] || 0) + 1; });

    const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    disasters.forEach(d => { sevCounts[d.severity] = (sevCounts[d.severity] || 0) + 1; });

    const countyCounts = {};
    disasters.forEach(d => { countyCounts[d.county] = (countyCounts[d.county] || 0) + 1; });
    const topCounties = Object.entries(countyCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const chartColors = ['#0066CC', '#00CED1', '#FFD700', '#FF4500', '#28A745', '#DC3545', '#800080', '#FF1493', '#8B4513', '#228B22'];

    if (charts.type) charts.type.destroy();
    if (charts.severity) charts.severity.destroy();
    if (charts.county) charts.county.destroy();

    charts.type = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{ data: Object.values(typeCounts), backgroundColor: chartColors, borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right', labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } } } }
    });

    charts.severity = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: Object.keys(sevCounts),
            datasets: [{ data: Object.values(sevCounts), backgroundColor: ['#DC3545', '#FFC107', '#0066CC', '#28A745'], borderRadius: 6 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { display: false } } } }
    });

    charts.county = new Chart(ctx3, {
        type: 'bar',
        data: {
            labels: topCounties.map(c => c[0]),
            datasets: [{ data: topCounties.map(c => c[1]), backgroundColor: '#0066CC', borderRadius: 6 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: 'rgba(255,255,255,0.5)', maxRotation: 45 }, grid: { display: false } } } }
    });
}

function updateRecentDisastersTable(disasters) {
    const tbody = document.querySelector('#disasters-table tbody');
    if (!tbody) return;

    const active = disasters
        .filter(d => d.status !== 'Resolved' && d.status !== 'Contained')
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 20);

    if (active.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:rgba(255,255,255,0.3);padding:24px;"><i class="fas fa-check-circle" style="font-size:2rem;display:block;margin-bottom:8px;"></i>No active disasters</td></tr>';
        return;
    }

    tbody.innerHTML = active.map(d => {
        const timeStr = d.timestamp instanceof Date ? d.timestamp.toLocaleString('en-KE') : new Date(d.timestamp).toLocaleString('en-KE');
        const sevBadge = d.severity === 'Critical' ? 'badge-critical' : d.severity === 'High' ? 'badge-warning' : 'badge-info';
        return `
            <tr>
                <td><i class="fas ${window.DISASTER_ICONS?.[d.type]?.icon || 'fa-exclamation-triangle'}" style="color:${window.DISASTER_ICONS?.[d.type]?.color || '#FF4500'};margin-right:6px;"></i>${d.type}</td>
                <td>${d.county}</td>
                <td><span class="badge ${sevBadge}">${d.severity}</span></td>
                <td>${d.status}</td>
                <td>${d.confidence}%</td>
                <td>${d.location || d.county}</td>
                <td>${d.coords ? `${d.coords[0].toFixed(4)}, ${d.coords[1].toFixed(4)}` : '-'}</td>
                <td>${timeStr}</td>
                <td>
                    <button class="action-btn view" data-tooltip="View disaster details" onclick="viewDisasterDetails('${d.id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn resolve" data-tooltip="Mark as resolved" onclick="resolveDisaster('${d.id}')"><i class="fas fa-check"></i></button>
                    <button class="action-btn delete" data-tooltip="Send radius alert" onclick="openRadiusModal('${d.id}')"><i class="fas fa-broadcast-tower"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateFullDisastersTable(disasters) {
    const tbody = document.querySelector('#disasters-full-table tbody');
    if (!tbody) return;

    const countyFilter = document.getElementById('admin-disaster-filter')?.value || 'all';
    const statusFilter = document.getElementById('admin-status-filter')?.value || 'all';

    let filtered = disasters;
    if (countyFilter !== 'all') filtered = filtered.filter(d => d.county === countyFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(d => d.status === statusFilter);

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:rgba(255,255,255,0.3);padding:24px;">No disasters match filters</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(d => {
        const timeStr = d.timestamp instanceof Date ? d.timestamp.toLocaleString('en-KE') : new Date(d.timestamp).toLocaleString('en-KE');
        const sevBadge = d.severity === 'Critical' ? 'badge-critical' : d.severity === 'High' ? 'badge-warning' : 'badge-info';
        return `
            <tr>
                <td>${d.id.substring(0, 12)}...</td>
                <td>${d.type}</td>
                <td>${d.county}</td>
                <td><span class="badge ${sevBadge}">${d.severity}</span></td>
                <td>${d.status}</td>
                <td>${d.confidence}%</td>
                <td>${d.location || d.county}</td>
                <td>${d.coords ? `${d.coords[0].toFixed(4)}, ${d.coords[1].toFixed(4)}` : '-'}</td>
                <td>${timeStr}</td>
                <td>
                    <button class="action-btn view" data-tooltip="View disaster details" onclick="viewDisasterDetails('${d.id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn resolve" data-tooltip="Mark as resolved" onclick="resolveDisaster('${d.id}')"><i class="fas fa-check"></i></button>
                    <button class="action-btn delete" data-tooltip="Send radius alert" onclick="openRadiusModal('${d.id}')"><i class="fas fa-broadcast-tower"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function populateDisasterFilters() {
    const select = document.getElementById('admin-disaster-filter');
    if (!select || select.options.length > 1) return;

    const counties = [...new Set(allDisasters.map(d => d.county))].sort();
    counties.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => updateFullDisastersTable(allDisasters));
    document.getElementById('admin-status-filter')?.addEventListener('change', () => updateFullDisastersTable(allDisasters));
}

function viewDisasterDetails(id) {
    const d = allDisasters.find(x => x.id === id);
    if (!d) return;
    const timeStr = d.timestamp instanceof Date ? d.timestamp.toLocaleString('en-KE') : new Date(d.timestamp).toLocaleString('en-KE');

    const content = `
        <div style="font-family:'Segoe UI',sans-serif;">
            <h3 style="color:white;margin-bottom:16px;">${d.type} - ${d.county}</h3>
            <table class="printable-table" style="width:100%;">
                <tr><th>Field</th><th>Value</th></tr>
                <tr><td>ID</td><td>${d.id}</td></tr>
                <tr><td>Type</td><td>${d.type}</td></tr>
                <tr><td>County</td><td>${d.county}</td></tr>
                <tr><td>Location</td><td>${d.location || d.county}</td></tr>
                <tr><td>Coordinates</td><td>${d.coords ? `${d.coords[0].toFixed(6)}, ${d.coords[1].toFixed(6)}` : '-'}</td></tr>
                <tr><td>Severity</td><td><span class="badge badge-${d.severity === 'Critical' ? 'critical' : d.severity === 'High' ? 'warning' : 'info'}">${d.severity}</span></td></tr>
                <tr><td>Status</td><td>${d.status}</td></tr>
                <tr><td>Confidence</td><td>${d.confidence}%</td></tr>
                <tr><td>Source</td><td>${d.source || 'DEWS Kenya'}</td></tr>
                <tr><td>Detected</td><td>${timeStr}</td></tr>
                <tr><td>Description</td><td>${d.description || '-'}</td></tr>
            </table>
        </div>
    `;

    showKPIDetailModal(content);
}

function resolveDisaster(id) {
    if (!confirm('Mark this disaster as resolved? It will be removed from the active list.')) return;
    resolvedDisasterIds.add(id);
    showAdminToast('Disaster marked as resolved', 'success');
    loadDisasterData();
}

function showKPIDetailModal(content) {
    const modal = document.getElementById('kpi-detail-modal');
    const body = document.getElementById('kpi-detail-body');
    if (body) body.innerHTML = content;
    if (modal) modal.classList.remove('hidden');
}

function printDisasterTable() {
    const printWindow = window.open('', '_blank');
    const table = document.getElementById('disasters-table');
    const now = new Date().toLocaleString('en-KE');

    printWindow.document.write(`
        <html><head><title>DEWS Kenya - Disaster Report</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
            h1 { color: #0066CC; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #0B1121; color: #4da3ff; padding: 12px; text-align: left; border: 1px solid #333; }
            td { padding: 10px; border: 1px solid #ddd; color: #333; font-size: 0.85rem; }
            tr:nth-child(odd) { background: #f8f9fa; }
            .badge { padding: 3px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
            .badge-critical { background: #f8d7da; color: #721c24; }
            .badge-warning { background: #fff3cd; color: #856404; }
            .badge-info { background: #cce5ff; color: #004085; }
            .meta { color: #666; font-size: 0.8rem; margin-top: 8px; }
        </style></head><body>
        <h1><i class="fas fa-exclamation-triangle"></i> DEWS Kenya - Active Disasters Report</h1>
        <div class="meta">Generated: ${now} | Propelled by RIAT</div>
        <div class="meta">Source: USGS, GDACS, OpenWeather, DEWS Kenya Sensors</div>
        ${table.outerHTML}
        </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
}

function printFullDisasterTable() {
    const printWindow = window.open('', '_blank');
    const table = document.getElementById('disasters-full-table');
    const now = new Date().toLocaleString('en-KE');

    printWindow.document.write(`
        <html><head><title>DEWS Kenya - Full Disaster Report</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
            h1 { color: #0066CC; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #0B1121; color: #4da3ff; padding: 12px; text-align: left; border: 1px solid #333; }
            td { padding: 10px; border: 1px solid #ddd; color: #333; font-size: 0.85rem; }
            tr:nth-child(odd) { background: #f8f9fa; }
            .badge { padding: 3px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
            .badge-critical { background: #f8d7da; color: #721c24; }
            .badge-warning { background: #fff3cd; color: #856404; }
            .badge-info { background: #cce5ff; color: #004085; }
            .meta { color: #666; font-size: 0.8rem; margin-top: 8px; }
        </style></head><body>
        <h1><i class="fas fa-exclamation-triangle"></i> DEWS Kenya - Full Disaster Management Report</h1>
        <div class="meta">Generated: ${now} | Propelled by RIAT</div>
        ${table.outerHTML}
        </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
}

async function loadUsersData() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        allUsers = data.users || [];

        document.getElementById('kpi-users').textContent = allUsers.length;
        document.getElementById('kpi-online').textContent = allUsers.filter(u => u.is_online).length;

        updateUsersTable(allUsers);
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function updateUsersTable(users) {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:rgba(255,255,255,0.3);padding:24px;">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => {
        const lastSeen = u.last_seen ? new Date(u.last_seen).toLocaleString('en-KE') : 'Never';
        const statusClass = u.is_online ? 'status-online' : 'status-offline';
        const statusText = u.is_online ? '<i class="fas fa-circle"></i> Online' : 'Offline';

        return `
            <tr>
                <td><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#0066CC,#00CED1);display:flex;align-items:center;justify-content:center;color:white;font-size:0.75rem;">${(u.full_name || u.username).charAt(0).toUpperCase()}</div></td>
                <td>${u.username}</td>
                <td>${u.full_name || '-'}</td>
                <td>${u.email || '-'}</td>
                <td>${u.phone || '-'}</td>
                <td><span class="badge ${u.is_admin ? 'badge-warning' : 'badge-info'}">${u.is_admin ? 'Admin' : 'User'}</span></td>
                <td class="${statusClass}">${statusText}</td>
                <td>${lastSeen}</td>
                <td>
                    <button class="action-btn view" data-tooltip="View user details" onclick="viewUserDetails(${u.id})"><i class="fas fa-eye"></i></button>
                    <button class="action-btn deactivate" data-tooltip="${u.is_active === false ? 'Activate user account' : 'Deactivate user account'}" onclick="toggleUserStatus(${u.id}, ${u.is_active !== false})"><i class="fas ${u.is_active === false ? 'fa-user-check' : 'fa-user-slash'}"></i></button>
                    <button class="action-btn delete" data-tooltip="Permanently delete user" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadOnlineUsers() {
    const tbody = document.querySelector('#online-users-table tbody');
    if (!tbody) return;

    const online = allUsers.filter(u => u.is_online);
    if (online.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.3);padding:24px;">No users currently online</td></tr>';
        return;
    }

    tbody.innerHTML = online.map(u => {
        const lastSeen = u.last_seen ? new Date(u.last_seen).toLocaleString('en-KE') : 'Now';
        return `
            <tr>
                <td>${u.username}</td>
                <td>${u.full_name || '-'}</td>
                <td>${u.email || '-'}</td>
                <td><span class="badge ${u.is_admin ? 'badge-warning' : 'badge-info'}">${u.is_admin ? 'Admin' : 'User'}</span></td>
                <td>${lastSeen}</td>
            </tr>
        `;
    }).join('');
}

function viewUserDetails(id) {
    const u = allUsers.find(x => x.id === id);
    if (!u) return;
    const content = `
        <div style="font-family:'Segoe UI',sans-serif;">
            <h3 style="color:white;margin-bottom:16px;">User: ${u.username}</h3>
            <table class="printable-table" style="width:100%;">
                <tr><th>Field</th><th>Value</th></tr>
                <tr><td>Full Name</td><td>${u.full_name || '-'}</td></tr>
                <tr><td>Email</td><td>${u.email || '-'}</td></tr>
                <tr><td>Phone</td><td>${u.phone || '-'}</td></tr>
                <tr><td>Role</td><td>${u.is_admin ? 'Admin' : 'User'}</td></tr>
                <tr><td>Status</td><td>${u.is_online ? 'Online' : 'Offline'}</td></tr>
                <tr><td>Last Seen</td><td>${u.last_seen ? new Date(u.last_seen).toLocaleString('en-KE') : 'Never'}</td></tr>
            </table>
        </div>
    `;
    showKPIDetailModal(content);
}

async function toggleUserStatus(id, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`${currentlyActive ? 'Deactivate' : 'Activate'} this user? They will ${currentlyActive ? 'no longer' : ''} be able to access the system.`)) return;

    try {
        const response = await fetch(`/api/admin/users/${id}/${action}`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showAdminToast(`User ${action}d successfully!`, 'success');
            loadUsersData();
        } else {
            showAdminToast(data.message || 'Action failed', 'error');
        }
    } catch (err) { showAdminToast('Network error', 'error'); }
}

async function deleteUser(id) {
    if (!confirm('Permanently delete this user? This action cannot be undone!')) return;
    if (!confirm('Are you absolutely sure? All their data will be lost.')) return;

    try {
        const response = await fetch(`/api/admin/users/${id}/delete`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showAdminToast('User deleted permanently!', 'success');
            loadUsersData();
        } else {
            showAdminToast(data.message || 'Delete failed', 'error');
        }
    } catch (err) { showAdminToast('Network error', 'error'); }
}

async function runSimulation() {
    const btn = document.getElementById('run-sim-btn');
    const resultsDiv = document.getElementById('sim-results');
    if (!btn || !resultsDiv) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running simulation...';

    try {
        const response = await fetch('/api/simulate', { method: 'POST' });
        const data = await response.json();

        if (data.disasters) {
            simResults = data.disasters;
            const timestamp = new Date().toLocaleString('en-KE');

            document.getElementById('sim-timestamp').textContent = `Generated: ${timestamp}`;

            const list = document.getElementById('sim-disasters-list');
            list.innerHTML = simResults.map((d, i) => {
                const timeStr = d.timestamp ? new Date(d.timestamp).toLocaleString('en-KE') : timestamp;
                return `
                    <div class="sim-result-card">
                        <h4><i class="fas fa-exclamation-triangle"></i> ${i + 1}. ${d.type} - ${d.county}</h4>
                        <div class="sim-result-detail">
                            <p><strong>Severity:</strong> <span style="color:${d.severity === 'Critical' ? '#ff6b7a' : d.severity === 'High' ? '#ffe082' : '#4da3ff'}">${d.severity}</span></p>
                            <p><strong>Confidence:</strong> ${d.confidence}%</p>
                            <p><strong>Coordinates:</strong> ${d.coords[0].toFixed(6)}, ${d.coords[1].toFixed(6)}</p>
                            <p><strong>Location:</strong> ${d.location || d.county}</p>
                            <p><strong>Status:</strong> ${d.status}</p>
                            <p><strong>Detected:</strong> ${timeStr}</p>
                            <p><strong>Description:</strong> ${d.description || 'No description available'}</p>
                            <p><strong>Source:</strong> ${d.source || 'DEWS Kenya Simulation Engine'}</p>
                        </div>
                    </div>
                `;
            }).join('');

            resultsDiv.classList.remove('hidden');
            showAdminToast(`Simulation complete! ${simResults.length} disaster(s) predicted`, 'success');
        }
    } catch (error) {
        showAdminToast('Simulation failed. Please try again.', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play"></i> Run Simulation';
}

function downloadSimCSV() {
    if (simResults.length === 0) { showAdminToast('Run simulation first', 'warning'); return; }
    const now = new Date().toLocaleString('en-KE').replace(/[/,:]/g, '-');
    let csv = 'ID,Type,County,Severity,Confidence,Latitude,Longitude,Location,Status,Description,Detected,Source\\n';
    simResults.forEach((d, i) => {
        const timeStr = d.timestamp ? new Date(d.timestamp).toLocaleString('en-KE') : now;
        csv += `${i + 1},"${d.type}","${d.county}","${d.severity}",${d.confidence},${d.coords[0]},${d.coords[1]},"${d.location || d.county}","${d.status}","${(d.description || '').replace(/"/g, '""')}","${timeStr}","${d.source || 'DEWS Kenya'}"\\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DEWS-Simulation-${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showAdminToast('CSV downloaded!', 'success');
}

function downloadSimHTML() {
    if (simResults.length === 0) { showAdminToast('Run simulation first', 'warning'); return; }
    const now = new Date().toLocaleString('en-KE');

    let html = `<!DOCTYPE html><html><head><title>DEWS Kenya Simulation Report</title>
    <style>body{font-family:'Segoe UI',sans-serif;padding:40px;max-width:1000px;margin:0 auto;}h1{color:#0066CC;}table{width:100%;border-collapse:collapse;margin-top:20px;}th{background:#0B1121;color:#4da3ff;padding:12px;text-align:left;border:1px solid #333;}td{padding:10px;border:1px solid #ddd;color:#333;font-size:0.85rem;}tr:nth-child(odd){background:#f8f9fa;}.meta{color:#666;font-size:0.85rem;margin:8px 0;}</style></head><body>
    <h1><i class="fas fa-chart-bar"></i> DEWS Kenya - Disaster Simulation Report</h1>
    <div class="meta"><strong>Generated:</strong> ${now}</div>
    <div class="meta"><strong>Total Predicted:</strong> ${simResults.length} disaster(s)</div>
    <div class="meta">Propelled by Ramogi Institute of Advanced Technology (RIAT)</div>
    <table><thead><tr><th>#</th><th>Type</th><th>County</th><th>Severity</th><th>Confidence</th><th>Coordinates</th><th>Location</th><th>Status</th><th>Description</th></tr></thead><tbody>`;

    simResults.forEach((d, i) => {
        html += `<tr><td>${i + 1}</td><td>${d.type}</td><td>${d.county}</td><td>${d.severity}</td><td>${d.confidence}%</td><td>${d.coords[0].toFixed(6)}, ${d.coords[1].toFixed(6)}</td><td>${d.location || d.county}</td><td>${d.status}</td><td>${d.description || '-'}</td></tr>`;
    });

    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeNow = now.replace(/[/,:]/g, '-');
    a.download = `DEWS-Simulation-Report-${safeNow}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showAdminToast('HTML report downloaded!', 'success');
}

function loadAuthorities() {
    const grid = document.getElementById('admin-authorities-grid');
    if (!grid) return;

    const authorities = [
        { category: 'National Emergency', icon: 'fa-building', items: [
            { name: 'NDMU', role: 'National disaster coordination', phone: '020-2222181', email: 'ndmu@interior.go.ke' },
            { name: 'Kenya Red Cross', role: 'Emergency response', phone: '0709-598000', email: 'info@redcross.or.ke' },
            { name: 'National Police', role: 'Security & evacuation', phone: '999 / 112', email: 'ops@nationalpolice.go.ke' },
            { name: 'Kenya Forest Service', role: 'Forest fire management', phone: '020-2020285', email: 'info@kenyaforestservice.org' }
        ]},
        { category: 'Health Emergency', icon: 'fa-hospital', items: [
            { name: 'Ministry of Health', role: 'Health emergency', phone: '0729-471414', email: 'emergency@health.go.ke' },
            { name: 'KNH', role: 'National referral', phone: '020-2726300', email: 'knh@knh.or.ke' }
        ]},
        { category: 'Security', icon: 'fa-shield-alt', items: [
            { name: 'Admin Police', role: 'Security operations', phone: '020-2224101', email: 'ap@nationalpolice.go.ke' },
            { name: 'NIS', role: 'Threat assessment', phone: '020-2319011', email: 'info@nis.go.ke' }
        ]},
        { category: 'Infrastructure', icon: 'fa-hard-hat', items: [
            { name: 'Kenya Power', role: 'Power emergency', phone: '97771', email: 'customercare@kplc.co.ke' },
            { name: 'Water Authority', role: 'Water management', phone: '020-2734891', email: 'info@wra.go.ke' }
        ]},
        { category: 'Weather', icon: 'fa-cloud-sun', items: [
            { name: 'Met Department', role: 'Weather forecasting', phone: '020-3867880', email: 'info@meteo.go.ke' },
            { name: 'RCMRD', role: 'Satellite mapping', phone: '020-2683209', email: 'info@rcmrd.org' }
        ]},
        { category: 'DEWS Admin', icon: 'fa-headset', items: [
            { name: 'System Admin', role: 'Emergency contact', phone: '0746034952', email: 'dotieno558@gmail.com' },
            { name: 'RIAT ICT Team', role: 'Technical support', phone: '0746034952', email: 'support@dews-kenya.go.ke' }
        ]}
    ];

    grid.innerHTML = authorities.map(cat => `
        <div class="authorities-category">
            <h3><i class="fas ${cat.icon}"></i> ${cat.category}</h3>
            ${cat.items.map(auth => `
                <div class="authority-card">
                    <h4>${auth.name}</h4>
                    <p>${auth.role}</p>
                    <div class="authority-contacts">
                        <a href="tel:${auth.phone}" class="phone"><i class="fas fa-phone"></i> ${auth.phone}</a>
                        <a href="mailto:${auth.email}" class="email"><i class="fas fa-envelope"></i> Email</a>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

function startClock() {
    function update() {
        
    }
    setInterval(update, 30000);
}

async function doAdminLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        showAdminToast('Logout successful! See you soon &#128075;&#127999;', 'success');
        setTimeout(() => { window.location.href = '/login?logout=success'; }, 1000);
    } catch (error) {
        window.location.href = '/login?logout=success';
    }
}

function navigateToLiveMap(e) {
    if (e) e.preventDefault();
    
    window.location.replace('/');
}

function toggleAdminPassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function showAdminToast(message, type = 'info') {
    const container = document.getElementById('admin-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

let adminNotifications = [];
let notifDropdownOpen = false;

async function loadAdminNotifications() {
    try {
        const response = await fetch('/api/admin/notifications');
        const data = await response.json();
        if (data.success) {
            adminNotifications = data.notifications || [];
            updateNotificationBell(data.unread_count || 0);
            if (notifDropdownOpen) renderNotificationDropdown();
        }
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

function updateNotificationBell(unreadCount) {
    const bell = document.getElementById('notification-bell');
    const count = document.getElementById('notification-count');
    if (!bell || !count) return;

    if (unreadCount > 0) {
        count.textContent = unreadCount > 99 ? '99+' : unreadCount;
        count.classList.remove('hidden');
        bell.classList.add('has-unread');
    } else {
        count.classList.add('hidden');
        bell.classList.remove('has-unread');
    }
}

function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;
    notifDropdownOpen = !notifDropdownOpen;
    if (notifDropdownOpen) {
        dropdown.classList.remove('hidden');
        renderNotificationDropdown();
        
        setTimeout(() => {
            adminNotifications.filter(n => !n.read).slice(0, 5).forEach(n => {
                markNotificationRead(n.id);
            });
        }, 2000);
    } else {
        dropdown.classList.add('hidden');
    }
}

function renderNotificationDropdown() {
    const body = document.getElementById('notification-dropdown-body');
    if (!body) return;

    if (adminNotifications.length === 0) {
        body.innerHTML = `
            <div class="notif-empty">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications yet</p>
            </div>`;
        return;
    }

    body.innerHTML = adminNotifications.slice(0, 20).map(n => {
        const iconMap = {
            'new_message': 'fa-comment-alt',
            'new_report': 'fa-exclamation-triangle'
        };
        const iconClass = iconMap[n.type] || 'fa-bell';
        const typeClass = n.type === 'new_message' ? 'message' : n.type === 'new_report' ? 'report' : 'alert';
        const timeStr = n.timestamp ? new Date(n.timestamp).toLocaleString('en-KE', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '';

        return `
            <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick('${n.type}', '${n.report_id || ''}', '${n.user_id || ''}')">
                <div class="notif-icon ${typeClass}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-message">${n.message}</div>
                </div>
                <div class="notif-time">${timeStr}</div>
            </div>
        `;
    }).join('');
}

function handleNotificationClick(type, reportId, userId) {
    if (type === 'new_report' && reportId) {
        showSection('disasters');
        document.querySelectorAll('.admin-sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector('[data-section="disasters"]')?.classList.add('active');
    } else if (type === 'new_message' && userId) {
        showAdminToast(`New message from user. Check chat for details.`, 'info');
    }
    notifDropdownOpen = false;
    document.getElementById('notification-dropdown')?.classList.add('hidden');
}

async function markNotificationRead(notifId) {
    try {
        await fetch(`/api/admin/notifications/${notifId}/read`, { method: 'POST' });
        const n = adminNotifications.find(x => x.id === notifId);
        if (n) n.read = true;
        const unreadCount = adminNotifications.filter(n => !n.read).length;
        updateNotificationBell(unreadCount);
    } catch (e) {}
}

async function markAllNotificationsRead() {
    try {
        await fetch('/api/admin/notifications/read-all', { method: 'POST' });
        adminNotifications.forEach(n => n.read = true);
        updateNotificationBell(0);
        renderNotificationDropdown();
        showAdminToast('All notifications marked as read', 'success');
    } catch (e) {
        showAdminToast('Failed to mark notifications as read', 'error');
    }
}

document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.notification-bell-wrapper');
    if (wrapper && !wrapper.contains(e.target) && notifDropdownOpen) {
        notifDropdownOpen = false;
        document.getElementById('notification-dropdown')?.classList.add('hidden');
    }
});

function openRadiusModal(disasterId) {
    const overlay = document.getElementById('radius-modal-overlay');
    if (!overlay) return;

    const select = document.getElementById('radius-disaster-select');
    if (select) {
        select.innerHTML = '<option value="">Select a disaster...</option>' +
            allDisasters.filter(d => d.status !== 'Resolved' && d.status !== 'Contained')
                .map(d => `<option value="${d.id}" data-lat="${d.coords?.[0] || ''}" data-lon="${d.coords?.[1] || ''}" data-county="${d.county}">${d.type} - ${d.county}</option>`)
                .join('');
        if (disasterId) select.value = disasterId;
    }

    document.getElementById('radius-km').value = 50;
    document.getElementById('radius-km-display').textContent = '50 km';
    document.getElementById('radius-alert-message').value = '';
    document.getElementById('recipient-count-text').textContent = 'Select a disaster to see estimated recipients';

    overlay.classList.remove('hidden');
}

function closeRadiusModal() {
    document.getElementById('radius-modal-overlay')?.classList.add('hidden');
}

function toggleChannel(el) {
    el.classList.toggle('selected');
}

async function sendRadiusAlert() {
    const select = document.getElementById('radius-disaster-select');
    const selectedOption = select?.options[select.selectedIndex];
    const disasterId = select?.value;
    const radiusKm = parseInt(document.getElementById('radius-km')?.value || 50);
    const message = document.getElementById('radius-alert-message')?.value?.trim();
    const channels = [];
    document.querySelectorAll('.channel-option.selected').forEach(el => {
        channels.push(el.dataset.channel);
    });

    if (!disasterId) {
        showAdminToast('Please select a disaster', 'error');
        return;
    }
    if (!message) {
        showAdminToast('Please enter an alert message', 'error');
        return;
    }
    if (channels.length === 0) {
        showAdminToast('Please select at least one notification channel', 'error');
        return;
    }

    const lat = selectedOption?.dataset?.lat;
    const lon = selectedOption?.dataset?.lon;

    if (!lat || !lon) {
        showAdminToast('Selected disaster has no coordinates', 'error');
        return;
    }

    const sendBtn = document.querySelector('#radius-modal-overlay .btn-danger');
    const originalText = sendBtn?.innerHTML;
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    }

    try {
        const response = await fetch('/api/admin/send-radius-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                disaster_id: disasterId,
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                radius_km: radiusKm,
                message: message,
                channels: channels
            })
        });

        const data = await response.json();
        if (data.success) {
            showAdminToast(`Alert sent to ${data.recipients?.length || 0} users within ${radiusKm}km!`, 'success');
            document.getElementById('recipient-count-text').textContent =
                `Successfully sent to ${data.recipients?.length || 0} users via ${channels.join(' + ').toUpperCase()}`;
            setTimeout(closeRadiusModal, 1500);
        } else {
            showAdminToast(data.message || 'Failed to send alert', 'error');
        }
    } catch (error) {
        showAdminToast('Network error. Please try again.', 'error');
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
        }
    }
}

async function sendAdminChatReply(userId, message) {
    try {
        const response = await fetch('/api/admin/chat-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, content: message })
        });
        const data = await response.json();
        if (data.success) {
            showAdminToast('Reply sent to user', 'success');
            return true;
        } else {
            showAdminToast(data.message || 'Failed to send reply', 'error');
            return false;
        }
    } catch (error) {
        showAdminToast('Network error sending reply', 'error');
        return false;
    }
}

function refreshDashboard() {
    showAdminToast('Refreshing dashboard data...', 'info');
    refreshAllData(true);
}

function refreshDisasters() {
    showAdminToast('Refreshing disaster data...', 'info');
    loadDisasterData().then(() => {
        showAdminToast('Disaster data refreshed!', 'success');
    }).catch(() => {
        showAdminToast('Refresh failed', 'error');
    });
}
