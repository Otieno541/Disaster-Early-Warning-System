let rtInterval = null;
let isRefreshing = false;

document.addEventListener('DOMContentLoaded', () => {
    
    startRealtimeUpdates();
});

function startRealtimeUpdates() {
    
    if (rtInterval) clearInterval(rtInterval);
    rtInterval = setInterval(async () => {
        if (isRefreshing) return;
        isRefreshing = true;

        try {
            
            if (typeof loadRealDisasterData === 'function') {
                await loadRealDisasterData();
            }

            if (typeof refreshNotifications === 'function') {
                refreshNotifications();
            }

            const weatherSelect = document.getElementById('weather-county-select');
            if (weatherSelect && weatherSelect.value && typeof loadCountyWeather === 'function') {
                await loadCountyWeather(weatherSelect.value);
            }

            const dot = document.querySelector('.pulse-dot');
            if (dot) {
                dot.style.background = '#00ff88';
                setTimeout(() => { dot.style.background = 'var(--success)'; }, 1000);
            }

        } catch (e) {
            console.error('Real-time update error:', e);
        } finally {
            isRefreshing = false;
        }
    }, 300000); 

    setInterval(() => {
        if (typeof checkForNewAlerts === 'function' && window.allRealDisasters) {
            checkForNewAlerts(window.allRealDisasters);
        }
    }, 30000);
}

function stopRealtimeUpdates() {
    if (rtInterval) {
        clearInterval(rtInterval);
        rtInterval = null;
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        
    } else {
        
        if (typeof loadRealDisasterData === 'function') {
            loadRealDisasterData();
        }
    }
});

window.startRealtimeUpdates = startRealtimeUpdates;
window.stopRealtimeUpdates = stopRealtimeUpdates;
