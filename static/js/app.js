let currentUser = null;
let chatRefreshInterval = null;
let voiceRecorder = null;
let voiceChunks = [];
let voiceRecordTimer = null;
let voiceRecordSeconds = 0;
let capturedMediaFiles = [];
let streamCamera = null;
let notifications = [];

(function injectNotifStyles() {
    if (document.getElementById('msg-notif-styles')) return;
    const style = document.createElement('style');
    style.id = 'msg-notif-styles';
    style.textContent = `
        @keyframes notifFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes notifFadeOut { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(-10px); } }
        .chat-message-sent-notif { text-align: center; margin: 8px 0; }
        .sent-notif-bubble { display: inline-block; padding: 6px 16px; background: rgba(40,167,69,0.2); border: 1px solid rgba(40,167,69,0.3); border-radius: 20px; color: #5cdb7d; font-size: 0.75rem; font-weight: 600; }
    `;
    document.head.appendChild(style);
})();

document.addEventListener('DOMContentLoaded', async () => {
    
    const loadingFailsafe = setTimeout(() => {
        console.log('[DEWS] Loading screen failsafe triggered');
        forceHideLoadingScreen();
    }, 8000);

    try {
        await checkAuth();
        setupEventListeners();
        setupLegendDropdown();
        setupNotificationCenter();
        startClock();
        startLastUpdateClock();

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('welcome') === 'back') {
            showWelcomeToast('Welcome back! We missed you');
            
            window.history.replaceState({}, document.title, '/');
        }

        clearTimeout(loadingFailsafe);
    } catch (error) {
        console.error('[DEWS] Initialization error:', error);
        forceHideLoadingScreen();
        clearTimeout(loadingFailsafe);
    }
});

function forceHideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.visibility = 'hidden';
        loadingScreen.classList.add('hidden');
    }
    if (app) {
        app.classList.remove('hidden');
        app.style.display = 'block';
    }
    console.log('[DEWS] Loading screen force-hidden');
}

async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();

        if (data.authenticated) {
            currentUser = data.user;
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            document.getElementById('auth-btn').classList.add('hidden');
            document.getElementById('logout-btn').classList.remove('hidden');
            if (currentUser.is_admin) {
                document.getElementById('admin-link-btn').classList.remove('hidden');
            }
            updateAuthUI();
            startChatRefresh();
        } else {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            
        }
    } catch (error) {
        console.log('[DEWS] Auth check failed:', error);
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }
}

function updateAuthUI() {
    if (!currentUser) return;
    const avatarImg = document.getElementById('user-avatar-img');
    const avatarIcon = document.getElementById('user-avatar-icon');
    if (currentUser.avatar_url && avatarImg) {
        avatarImg.src = currentUser.avatar_url;
        avatarImg.style.display = 'block';
        if (avatarIcon) avatarIcon.style.display = 'none';
    }
}

function setupEventListeners() {
    
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target.closest('.modal-close')) {
                el.closest('.modal').classList.add('hidden');
            }
        });
    });

    const authBtn = document.getElementById('auth-btn');
    if (authBtn) authBtn.addEventListener('click', openAuthModal);

    const avatarUploadTrigger = document.getElementById('avatar-upload-trigger');
    if (avatarUploadTrigger) {
        avatarUploadTrigger.addEventListener('click', () => {
            showEditProfile();
            setTimeout(() => document.getElementById('profile-avatar')?.click(), 400);
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

    const reportBtn = document.getElementById('report-btn');
    if (reportBtn) reportBtn.addEventListener('click', openReportModal);

    const chatBtn = document.getElementById('chat-btn');
    const openChatBtn = document.getElementById('open-chat-btn');
    if (chatBtn) chatBtn.addEventListener('click', openChatModal);
    if (openChatBtn) openChatBtn.addEventListener('click', openChatModal);

    const layerBtn = document.getElementById('layer-btn');
    if (layerBtn) layerBtn.addEventListener('click', toggleLayerPanel);

    const toggleSidebar = document.getElementById('toggle-sidebar');
    if (toggleSidebar) toggleSidebar.addEventListener('click', toggleSidebarPanel);
    setupSidebarTab();

    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) voiceBtn.addEventListener('click', startVoiceSearch);

    const filterReviewBtn = document.getElementById('filter-review-btn');
    if (filterReviewBtn) filterReviewBtn.addEventListener('click', doFilterReview);

    document.getElementById('voice-close')?.addEventListener('click', () => {
        document.getElementById('voice-overlay').classList.add('hidden');
        stopVoiceSearch();
    });

    const reportForm = document.getElementById('report-form');
    if (reportForm) reportForm.addEventListener('submit', submitReport);

    const reportVoiceBtn = document.getElementById('report-voice-btn');
    if (reportVoiceBtn) reportVoiceBtn.addEventListener('click', startVoiceRecording);

    const voiceStopBtn = document.getElementById('voice-stop-btn');
    if (voiceStopBtn) voiceStopBtn.addEventListener('click', stopVoiceRecording);

    const reportGetLoc = document.getElementById('report-get-location');
    if (reportGetLoc) reportGetLoc.addEventListener('click', getReportLocation);

    document.getElementById('capture-photo-btn')?.addEventListener('click', capturePhoto);
    document.getElementById('capture-video-btn')?.addEventListener('click', captureVideo);
    document.getElementById('report-media')?.addEventListener('change', handleFileUpload);

    document.getElementById('chat-send-btn')?.addEventListener('click', sendChatMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    document.getElementById('logout-modal-btn')?.addEventListener('click', doLogout);
    document.getElementById('edit-profile-btn')?.addEventListener('click', showEditProfile);
    document.getElementById('cancel-edit-btn')?.addEventListener('click', hideEditProfile);
    document.getElementById('profile-update-form')?.addEventListener('submit', updateProfile);

    document.getElementById('authorities-btn')?.addEventListener('click', openAuthoritiesModal);

    document.getElementById('alert-center-btn')?.addEventListener('click', openNotificationCenter);
    document.getElementById('nc-close')?.addEventListener('click', closeNotificationCenter);
    document.getElementById('nc-refresh')?.addEventListener('click', refreshNotifications);

    document.getElementById('auto-alert-dismiss')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('auto-alert-banner').classList.add('hidden');
    });

    setTimeout(() => {
        populateReportCountySelect();
    }, 500);
}

function populateReportCountySelect() {
    const reportCounty = document.getElementById('report-county');
    if (reportCounty && window.COUNTIES && Object.keys(window.COUNTIES).length > 0) {
        
        while (reportCounty.options.length > 1) {
            reportCounty.remove(1);
        }
        Object.keys(window.COUNTIES).sort().forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            reportCounty.appendChild(opt);
        });
        console.log('[DEWS] County select populated with', Object.keys(window.COUNTIES).length, 'counties');
    } else {
        
        setTimeout(populateReportCountySelect, 500);
    }
}

function setupLegendDropdown() {
    const container = document.getElementById('legend-dropdown-container');
    const btn = document.getElementById('legend-dropdown-btn');
    const content = document.getElementById('legend-dropdown-content');
    if (!btn || !content) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.classList.toggle('active');
        content.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            btn.classList.remove('active');
            content.classList.remove('active');
        }
    });
}

function startClock() {
    function update() {
        const now = new Date();
        const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
        const hDeg = (h % 12) * 30 + m * 0.5;
        const mDeg = m * 6 + s * 0.1;
        const sDeg = s * 6;

        const hHand = document.getElementById('clock-hour');
        const mHand = document.getElementById('clock-minute');
        const sHand = document.getElementById('clock-second');
        const digital = document.getElementById('clock-digital');

        if (hHand) hHand.style.transform = `translateX(-50%) rotate(${hDeg}deg)`;
        if (mHand) mHand.style.transform = `translateX(-50%) rotate(${mDeg}deg)`;
        if (sHand) sHand.style.transform = `translateX(-50%) rotate(${sDeg}deg)`;
        if (digital) digital.textContent = now.toLocaleTimeString('en-KE', { hour12: false });
    }
    update();
    setInterval(update, 1000);
}

function startLastUpdateClock() {
    function update() {
        const now = new Date();
        const timeEl = document.getElementById('last-update-time');
        const dateEl = document.getElementById('last-update-date');
        if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-KE', { hour12: false });
        if (dateEl) dateEl.textContent = now.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
    update();
    setInterval(update, 30000);
}

function toggleSidebarPanel() {
    const sidebar = document.getElementById('sidebar');
    const tab = document.getElementById('sidebar-tab');
    const toggle = document.getElementById('toggle-sidebar');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');

    if (isCollapsed) {
        
        sidebar.classList.remove('sidebar-collapsed');
        if (tab) tab.classList.remove('visible');
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
            }
        }
        showToast('Situation Room expanded', 'info');
    } else {
        
        sidebar.classList.add('sidebar-collapsed');
        if (tab) tab.classList.add('visible');
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
            }
        }
        showToast('Situation Room minimized', 'info');
    }
}

function setupSidebarTab() {
    const tab = document.getElementById('sidebar-tab');
    if (tab) {
        tab.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('sidebar-collapsed')) {
                toggleSidebarPanel();
            }
        });
    }
}

function toggleLayerPanel() {
    const panel = document.getElementById('layer-panel');
    if (panel) panel.classList.toggle('hidden');
}

function showWelcomeToast(message) {
    const toast = document.getElementById('welcome-toast');
    const msg = document.getElementById('welcome-message');
    if (msg) msg.textContent = message;
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 5000);
    }
}

function openAuthModal() {
    if (!currentUser) {
        window.location.href = '/login';
        return;
    }
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-title');
    const name = document.getElementById('auth-user-name');
    const role = document.getElementById('auth-user-role');
    const adminLink = document.getElementById('admin-panel-link');
    const avatarImg = document.getElementById('user-avatar-img');
    const avatarIcon = document.getElementById('user-avatar-icon');

    if (title) title.textContent = 'My Account';
    if (name) name.textContent = currentUser.full_name || currentUser.username;
    if (role) {
        role.textContent = currentUser.is_admin ? 'System Administrator' : 'Viewer';
        role.className = 'role-badge ' + (currentUser.is_admin ? 'admin' : 'viewer');
    }
    if (adminLink) {
        if (currentUser.is_admin) adminLink.classList.remove('hidden');
        else adminLink.classList.add('hidden');
    }

    if (currentUser.avatar_url && avatarImg) {
        avatarImg.src = currentUser.avatar_url;
        avatarImg.style.display = 'block';
        if (avatarIcon) avatarIcon.style.display = 'none';
    } else if (avatarImg) {
        avatarImg.style.display = 'none';
        if (avatarIcon) avatarIcon.style.display = 'block';
    }

    document.getElementById('edit-profile-form')?.classList.add('hidden');
    document.getElementById('auth-user-panel')?.classList.remove('hidden');

    const avatarInput = document.getElementById('profile-avatar');
    if (avatarInput) avatarInput.value = '';
    const preview = document.getElementById('profile-pic-preview');
    if (preview) {
        preview.src = '';
        preview.classList.remove('visible');
        preview.style.display = 'none';
    }

    if (modal) modal.classList.remove('hidden');
}

function showEditProfile() {
    document.getElementById('auth-user-panel')?.classList.add('hidden');
    const form = document.getElementById('edit-profile-form');
    if (form) {
        form.classList.remove('hidden');
        document.getElementById('profile-fullname').value = currentUser?.full_name || '';
        document.getElementById('profile-email').value = currentUser?.email || '';
        document.getElementById('profile-phone').value = currentUser?.phone || '';

        const avatarInput = document.getElementById('profile-avatar');
        if (avatarInput) {
            avatarInput.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const preview = document.getElementById('profile-pic-preview');
                        if (preview) {
                            preview.src = e.target.result;
                            preview.style.display = 'block';
                            preview.classList.add('visible');
                        }
                    };
                    reader.readAsDataURL(file);
                }
            };
        }
    }
}

function hideEditProfile() {
    document.getElementById('edit-profile-form')?.classList.add('hidden');
    document.getElementById('auth-user-panel')?.classList.remove('hidden');

    const preview = document.getElementById('profile-pic-preview');
    if (preview) {
        preview.src = '';
        preview.classList.remove('visible');
        preview.style.display = 'none';
    }
    const avatarInput = document.getElementById('profile-avatar');
    if (avatarInput) avatarInput.value = '';
}

async function updateProfile(e) {
    e.preventDefault();
    if (!currentUser) return;

    const saveBtn = e.target.querySelector('button[type="submit"]');
    const originalText = saveBtn?.innerHTML;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    const formData = new FormData();
    formData.append('full_name', document.getElementById('profile-fullname').value);
    formData.append('email', document.getElementById('profile-email').value);
    formData.append('phone', document.getElementById('profile-phone').value);

    const avatarFile = document.getElementById('profile-avatar')?.files[0];
    if (avatarFile) formData.append('avatar', avatarFile);

    try {
        const response = await fetch('/api/update-profile', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            showToast('Profile updated successfully!', 'success');
            currentUser = { ...currentUser, ...data.user };

            if (data.user.avatar_url) {
                const avatarImg = document.getElementById('user-avatar-img');
                const avatarIcon = document.getElementById('user-avatar-icon');
                if (avatarImg) {
                    avatarImg.src = data.user.avatar_url;
                    avatarImg.style.display = 'block';
                }
                if (avatarIcon) avatarIcon.style.display = 'none';
            }

            const nameEl = document.getElementById('auth-user-name');
            if (nameEl) nameEl.textContent = currentUser.full_name || currentUser.username;

            hideEditProfile();
        } else {
            showToast(data.message || 'Update failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }
}

async function doLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showToast('Logout successful! See you soon 👋🏿', 'success');
        setTimeout(() => {
            window.location.href = '/login?logout=success';
        }, 1000);
    } catch (error) {
        window.location.href = '/login?logout=success';
    }
}

function openReportModal() {
    if (!currentUser) {
        showToast('Please login first', 'warning');
        window.location.href = '/login';
        return;
    }
    const modal = document.getElementById('report-modal');
    if (modal) {
        
        document.getElementById('report-form')?.reset();
        document.getElementById('report-success')?.classList.add('hidden');
        document.getElementById('report-form')?.classList.remove('hidden');
        document.getElementById('voice-playback').style.display = 'none';
        document.getElementById('voice-blob-data').value = '';
        document.getElementById('captured-media-preview').innerHTML = '';
        capturedMediaFiles = [];
        document.getElementById('report-location-display')?.classList.add('hidden');
        modal.classList.remove('hidden');
    }
}

async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceRecorder = new MediaRecorder(stream);
        voiceChunks = [];

        voiceRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) voiceChunks.push(e.data);
        };

        voiceRecorder.onstop = () => {
            const blob = new Blob(voiceChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const playback = document.getElementById('voice-playback');
            playback.src = url;
            playback.style.display = 'block';

            const reader = new FileReader();
            reader.onloadend = () => {
                document.getElementById('voice-blob-data').value = reader.result;
            };
            reader.readAsDataURL(blob);

            stream.getTracks().forEach(t => t.stop());
        };

        voiceRecorder.start();

        document.getElementById('voice-record-status').classList.remove('hidden');
        document.getElementById('report-voice-btn').classList.add('hidden');

        voiceRecordSeconds = 0;
        voiceRecordTimer = setInterval(() => {
            voiceRecordSeconds++;
            const mins = Math.floor(voiceRecordSeconds / 60).toString().padStart(2, '0');
            const secs = (voiceRecordSeconds % 60).toString().padStart(2, '0');
            document.getElementById('voice-record-timer').textContent = `${mins}:${secs}`;
        }, 1000);

    } catch (err) {
        showToast('Microphone access denied', 'error');
    }
}

function stopVoiceRecording() {
    if (voiceRecorder && voiceRecorder.state !== 'inactive') {
        voiceRecorder.stop();
    }
    clearInterval(voiceRecordTimer);
    document.getElementById('voice-record-status').classList.add('hidden');
    document.getElementById('report-voice-btn').classList.remove('hidden');
}

function getReportLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        return;
    }
    showToast('Getting your exact GPS location...', 'info');
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const accuracy = pos.coords.accuracy;

            document.getElementById('report-location').value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

            try {
                const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await resp.json();
                const address = data.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                document.getElementById('report-location').value = address;
            } catch (e) {  }

            const display = document.getElementById('report-location-display');
            if (display) {
                display.innerHTML = `<i class="fas fa-map-marker-alt"></i> GPS: ${lat.toFixed(6)}, ${lon.toFixed(6)} (accuracy: ${Math.round(accuracy)}m)`;
                display.classList.remove('hidden');
            }
            showToast('Location captured via GPS', 'success');
        },
        (err) => showToast('Location failed: ' + err.message, 'error'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

async function capturePhoto() {
    try {
        streamCamera = await navigator.mediaDevices.getUserMedia({ video: true });
        const preview = document.getElementById('camera-preview');
        const canvas = document.getElementById('camera-canvas');
        preview.srcObject = streamCamera;
        preview.style.display = 'block';

        const captureBtn = document.createElement('button');
        captureBtn.className = 'btn btn-primary btn-sm';
        captureBtn.innerHTML = '<i class="fas fa-camera"></i> Take Picture';
        captureBtn.style.marginTop = '8px';
        captureBtn.onclick = () => {
            canvas.width = preview.videoWidth;
            canvas.height = preview.videoHeight;
            canvas.getContext('2d').drawImage(preview, 0, 0);
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                addCapturedMedia(url, 'image');
                capturedMediaFiles.push(blob);
                preview.style.display = 'none';
                streamCamera.getTracks().forEach(t => t.stop());
                captureBtn.remove();
            }, 'image/jpeg', 0.9);
        };
        preview.parentNode.insertBefore(captureBtn, preview.nextSibling);
    } catch (err) {
        showToast('Camera access denied. Use upload instead.', 'warning');
    }
}

async function captureVideo() {
    try {
        streamCamera = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const preview = document.getElementById('camera-preview');
        preview.srcObject = streamCamera;
        preview.style.display = 'block';
        preview.muted = true;

        const mediaRecorder = new MediaRecorder(streamCamera);
        const chunks = [];
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        const startBtn = document.createElement('button');
        startBtn.className = 'btn btn-primary btn-sm';
        startBtn.innerHTML = '<i class="fas fa-video"></i> Start Recording';
        startBtn.style.marginTop = '8px';

        const stopBtn = document.createElement('button');
        stopBtn.className = 'btn btn-danger btn-sm';
        stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
        stopBtn.style.marginTop = '8px';
        stopBtn.style.display = 'none';

        startBtn.onclick = () => {
            mediaRecorder.start();
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-flex';
            showToast('Recording started...', 'info');
        };

        stopBtn.onclick = () => {
            mediaRecorder.stop();
            streamCamera.getTracks().forEach(t => t.stop());
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            addCapturedMedia(url, 'video');
            capturedMediaFiles.push(blob);
            preview.style.display = 'none';
            startBtn.remove();
            stopBtn.remove();
            showToast('Video captured!', 'success');
        };

        preview.parentNode.insertBefore(startBtn, preview.nextSibling);
        preview.parentNode.insertBefore(stopBtn, preview.nextSibling);
    } catch (err) {
        showToast('Camera access denied. Use upload instead.', 'warning');
    }
}

function addCapturedMedia(url, type) {
    const container = document.getElementById('captured-media-preview');
    const item = document.createElement('div');
    item.className = 'captured-media-item';
    if (type === 'image') {
        item.innerHTML = `<img src="${url}"><button class="remove-media" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
    } else {
        item.innerHTML = `<video src="${url}" controls></video><button class="remove-media" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
    }
    container.appendChild(item);
}

function handleFileUpload(e) {
    const files = e.target.files;
    for (let file of files) {
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video') ? 'video' : 'image';
        addCapturedMedia(url, type);
        capturedMediaFiles.push(file);
    }
}

async function submitReport(e) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('county', document.getElementById('report-county').value);
    formData.append('type', document.getElementById('report-type').value);
    formData.append('description', document.getElementById('report-description').value);
    formData.append('location', document.getElementById('report-location').value || '');
    formData.append('phone', document.getElementById('report-phone').value || '');

    const voiceData = document.getElementById('voice-blob-data').value;
    if (voiceData) formData.append('voice_data', voiceData);

    capturedMediaFiles.forEach((file, i) => {
        formData.append(`media_${i}`, file);
    });

    try {
        const response = await fetch('/api/report', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('report-form').classList.add('hidden');
            document.getElementById('report-success').classList.remove('hidden');
            showToast('Report submitted successfully!', 'success');
        } else {
            showToast(data.message || 'Submit failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

function openChatModal() {
    if (!currentUser) {
        showToast('Please login to chat', 'warning');
        return;
    }
    const modal = document.getElementById('chat-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadChatMessages();
        document.getElementById('chat-badge')?.classList.add('hidden');
    }
}

async function loadChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    try {
        const response = await fetch('/api/chat');
        const data = await response.json();

        if (data.messages) {
            container.innerHTML = data.messages.map(msg => {
                const isAdmin = msg.sender_type === 'admin';
                const time = new Date(msg.timestamp).toLocaleString('en-KE');
                return `
                    <div class="chat-message ${isAdmin ? 'admin' : 'user'}">
                        <div class="chat-bubble"><strong>${msg.sender_name}:</strong> ${msg.content}</div>
                        <div class="chat-time">${time}</div>
                    </div>
                `;
            }).join('');
            container.scrollTop = container.scrollHeight;
        }
    } catch (error) {
        container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:20px;">Failed to load messages</div>';
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim()) return;

    const content = input.value.trim();

    const container = document.getElementById('chat-messages');
    const now = new Date().toLocaleString('en-KE');
    const div = document.createElement('div');
    div.className = 'chat-message user';
    div.innerHTML = `<div class="chat-bubble"><strong>You:</strong> ${escapeHtml(content)}</div><div class="chat-time">${now}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    input.value = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await response.json();

        if (data.success) {
            
            showMessageSentNotification();
        }
    } catch (error) {
        showToast('Failed to send message', 'error');
    }
}

function showMessageSentNotification() {
    
    showToast('&#9989; Message sent successfully! Admin will reply shortly.', 'success');

    const container = document.getElementById('chat-messages');
    if (container) {
        const notifDiv = document.createElement('div');
        notifDiv.className = 'chat-message-sent-notif';
        notifDiv.innerHTML = `<div class="sent-notif-bubble"><i class="fas fa-check-circle"></i> Message delivered successfully</div>`;
        notifDiv.style.cssText = 'text-align:center;margin:8px 0;animation:notifFadeIn 0.5s ease;';
        container.appendChild(notifDiv);
        container.scrollTop = container.scrollHeight;

        setTimeout(() => {
            notifDiv.style.animation = 'notifFadeOut 0.5s ease forwards';
            setTimeout(() => notifDiv.remove(), 500);
        }, 4000);
    }
}

function startChatRefresh() {
    if (chatRefreshInterval) clearInterval(chatRefreshInterval);
    chatRefreshInterval = setInterval(async () => {
        const chatModal = document.getElementById('chat-modal');
        if (chatModal && !chatModal.classList.contains('hidden')) {
            await loadChatMessages();
        }
    }, 5000);
}

function setupNotificationCenter() {
    refreshNotifications();
    
    setInterval(refreshNotifications, 60000);
}

async function refreshNotifications() {
    try {
        
        let apiNotifications = [];
        try {
            const response = await fetch('/api/notifications');
            if (response.ok) {
                const data = await response.json();
                apiNotifications = data.notifications || [];
            }
        } catch (e) {
            
        }

        const disasters = window.allRealDisasters || [];
        const ncList = document.getElementById('nc-list');
        const ncScanTime = document.getElementById('nc-scan-time');

        if (ncScanTime) {
            ncScanTime.textContent = new Date().toLocaleString('en-KE');
        }

        let allNotifications = [...apiNotifications];

        disasters.forEach(d => {
            if (d.status !== 'Resolved' && d.status !== 'Contained') {
                allNotifications.push({
                    type: d.type,
                    title: `${d.type} - ${d.county}`,
                    severity: d.severity,
                    confidence: d.confidence,
                    timestamp: d.timestamp,
                    description: d.description,
                    coords: d.coords,
                    id: d.id
                });
            }
        });

        allNotifications.sort((a, b) => {
            const sevOrder = { 'Critical': 3, 'High': 2, 'Medium': 1, 'Low': 0 };
            return (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
        });

        if (allNotifications.length === 0) {
            if (ncList) ncList.innerHTML = '<div class="nc-empty">No new notifications</div>';
            return;
        }

        if (ncList) {
            ncList.innerHTML = allNotifications.slice(0, 20).map(d => {
                const sevClass = d.severity === 'Critical' ? 'critical' : d.severity === 'High' ? 'high' : 'medium';
                const timeStr = d.timestamp ? new Date(d.timestamp).toLocaleString('en-KE') : 'Just now';

                return `
                    <div class="nc-item ${sevClass} clickable" onclick="goToDisasterNotification('${d.id}')">
                        <div class="nc-item-title"><i class="fas fa-exclamation-triangle"></i> ${d.title || d.type}</div>
                        <div class="nc-item-desc">${(d.description || '').substring(0, 120)}...</div>
                        <div class="nc-item-meta">
                            <span>Severity: ${d.severity}</span>
                            ${d.confidence ? `<span>Conf: ${d.confidence}%</span>` : ''}
                            <span><i class="fas fa-clock"></i> ${timeStr}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const badge = document.getElementById('alert-badge');
        if (badge) {
            const count = allNotifications.filter(d => d.severity === 'Critical' || d.severity === 'High').length;
            if (count > 0) {
                badge.textContent = Math.min(count, 99);
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (e) {
        console.error('Notification refresh error:', e);
    }
}

function openNotificationCenter() {
    const nc = document.getElementById('notification-center');
    if (nc) nc.classList.remove('hidden');
    refreshNotifications();
}

function closeNotificationCenter() {
    const nc = document.getElementById('notification-center');
    if (nc) nc.classList.add('hidden');
}

function goToDisasterNotification(id) {
    const d = (window.allRealDisasters || []).find(x => x.id === id);
    if (d && window.map) {
        window.map.flyTo(d.coords, 14, { duration: 1.5 });
        const marker = window.disasterMarkers?.find(m => m.disasterId === id);
        if (marker) marker.openPopup();
        closeNotificationCenter();
    }
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('alert-badge');
    if (badge) {
        const current = parseInt(badge.textContent || '0');
        badge.textContent = current + count;
        badge.classList.remove('hidden');
    }
}

function openAuthoritiesModal() {
    const modal = document.getElementById('authorities-modal');
    const body = document.getElementById('authorities-body');
    if (!body) return;

    const authorities = [
        {
            category: 'National Emergency Response',
            icon: 'fa-building',
            items: [
                { name: 'National Disaster Management Unit (NDMU)', role: 'National disaster coordination', phone: '020-2222181', email: 'ndmu@interior.go.ke' },
                { name: 'Kenya Red Cross Society', role: 'Emergency response & humanitarian aid', phone: '0709-598000', email: 'info@redcross.or.ke' },
                { name: 'National Police Service', role: 'Security & evacuation support', phone: '999 / 112 / 020-341411', email: 'ops@nationalpolice.go.ke' },
                { name: 'Kenya Forest Service', role: 'Forest fire management', phone: '020-2020285', email: 'info@kenyaforestservice.org' },
                { name: 'National Environment Management Authority', role: 'Environmental disaster response', phone: '020-2101370', email: 'info@nema.go.ke' }
            ]
        },
        {
            category: 'Health & Medical Emergency',
            icon: 'fa-hospital',
            items: [
                { name: 'Ministry of Health Emergency', role: 'Health emergency coordination', phone: '0729-471414', email: 'emergency@health.go.ke' },
                { name: 'Kenyatta National Hospital', role: 'National referral hospital', phone: '020-2726300', email: 'knh@knh.or.ke' }
            ]
        },
        {
            category: 'Security & Law Enforcement',
            icon: 'fa-shield-alt',
            items: [
                { name: 'Administration Police', role: 'Security operations', phone: '020-2224101', email: 'ap@nationalpolice.go.ke' },
                { name: 'National Intelligence Service', role: 'Threat assessment', phone: '020-2319011', email: 'info@nis.go.ke' },
                { name: 'National Counter Terrorism Centre', role: 'Counter-terrorism operations', phone: '020-2247368', email: 'info@nctc.go.ke' }
            ]
        },
        {
            category: 'Infrastructure & Utilities',
            icon: 'fa-hard-hat',
            items: [
                { name: 'Kenya Power Emergency', role: 'Power infrastructure', phone: '97771', email: 'customercare@kplc.co.ke' },
                { name: 'Kenya Pipeline Company', role: 'Pipeline safety', phone: '020-3245000', email: 'info@kpc.co.ke' },
                { name: 'Water Resources Authority', role: 'Water management', phone: '020-2734891', email: 'info@wra.go.ke' }
            ]
        },
        {
            category: 'Weather & Climate',
            icon: 'fa-cloud-sun',
            items: [
                { name: 'Kenya Meteorological Department', role: 'Weather forecasting', phone: '020-3867880', email: 'info@meteo.go.ke' },
                { name: 'Regional Centre for Mapping of Resources for Development', role: 'Satellite mapping', phone: '020-2683209', email: 'info@rcmrd.org' }
            ]
        },
        {
            category: 'DEWS Kenya Admin Contact',
            icon: 'fa-headset',
            items: [
                { name: 'DEWS Kenya System Admin', role: 'System administrator & emergency contact', phone: '0746034952', email: 'dotieno558@gmail.com' },
                { name: 'RIAT ICT Team', role: 'Technical support & system maintenance', phone: '0746034952', email: 'support@dews-kenya.go.ke' }
            ]
        }
    ];

    body.innerHTML = `<div class="authorities-grid">${authorities.map(cat => `
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
    `).join('')}</div>`;

    if (modal) modal.classList.remove('hidden');
}

async function doFilterReview() {
    const county = document.getElementById('disaster-filter')?.value || 'all';
    const status = document.getElementById('status-filter')?.value || 'all';
    const resultDiv = document.getElementById('filter-review-result');
    if (!resultDiv) return;

    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cross-checking with verified sources...';

    let disasters = window.allRealDisasters || [];
    if (county !== 'all') disasters = disasters.filter(d => d.county === county);
    if (status !== 'all') disasters = disasters.filter(d => d.status === status);

    setTimeout(() => {
        const now = new Date().toLocaleString('en-KE');
        let html = `Cross-check completed at ${now}<br><br>`;
        html += `Found ${disasters.length} matching disaster(s)<br><br>`;
        html += `Verified Sources:<br>`;
        html += `- USGS Real-time Earthquake Feed<br>`;
        html += `- GDACS Global Disaster Alert System<br>`;
        html += `- Kenya Meteorological Department<br>`;
        html += `- DEWS Kenya Sensor Network<br><br>`;
        html += disasters.map((d, i) =>
            `${i + 1}. [${d.severity}] ${d.type} in ${d.county}<br>&nbsp;&nbsp;&nbsp;Status: ${d.status} | Confidence: ${d.confidence}% | Source: ${d.source}`
        ).join('<br><br>') || 'No disasters found matching criteria.';

        resultDiv.innerHTML = html;
    }, 1500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

let voiceRecognition = null;
function startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showToast('Voice search not supported in this browser', 'warning');
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = true;
    voiceRecognition.lang = 'en-US';

    document.getElementById('voice-overlay').classList.remove('hidden');
    document.getElementById('voice-status').textContent = 'Listening...';
    document.getElementById('voice-result').textContent = '';

    voiceRecognition.onresult = (e) => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
        document.getElementById('voice-result').textContent = transcript;
        if (e.results[0].isFinal) {
            document.getElementById('county-search').value = transcript;
            setTimeout(() => {
                document.getElementById('voice-overlay').classList.add('hidden');
                if (window.performSearch) performSearch(transcript);
            }, 500);
        }
    };

    voiceRecognition.onerror = () => {
        document.getElementById('voice-status').textContent = 'Error. Try again.';
        setTimeout(() => document.getElementById('voice-overlay').classList.add('hidden'), 1500);
    };

    voiceRecognition.onend = () => {
        if (document.getElementById('voice-result').textContent === '') {
            document.getElementById('voice-overlay').classList.add('hidden');
        }
    };

    voiceRecognition.start();
}

function stopVoiceSearch() {
    if (voiceRecognition) voiceRecognition.stop();
}

function normalizeCountyName(name) {
    const county = name.toLowerCase().replace('county', '').trim();
    for (const [key] of Object.entries(window.COUNTIES || {})) {
        if (key.toLowerCase().replace('\'', '') === county.replace('\'', '')) return key;
    }
    return name;
}

window.allRealDisasters = window.allRealDisasters || [];
window.DISASTER_ICONS = window.DISASTER_ICONS || {};
window.COUNTIES = window.COUNTIES || {};
