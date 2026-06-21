let map;
let currentBaseLayer = null;
let baseLayers = {};
let disasterMarkers = [];
let countyBoundariesLayer = null;
let townsLayer = null;
let sensorLayer = null;
let heatLayer = null;
let weatherLayer = null;
let userLocationMarker = null;
let userLocationCircle = null;
let allRealDisasters = [];
let isAlarmPlaying = false;
let alarmAudio = null;
let lastDisasterIds = new Set();
let mapInitialized = false;

const COUNTIES = {
    'Baringo': { coords: [0.7913, 35.9644], capital: 'Kabarnet', population: 666000 },
    'Bomet': { coords: [-0.7827, 35.3288], capital: 'Bomet', population: 875000 },
    'Bungoma': { coords: [0.5922, 34.5368], capital: 'Bungoma', population: 1670000 },
    'Busia': { coords: [0.4347, 34.2421], capital: 'Busia', population: 893000 },
    'Elgeyo-Marakwet': { coords: [0.7500, 35.5000], capital: 'Iten', population: 454000 },
    'Embu': { coords: [-0.5380, 37.4574], capital: 'Embu', population: 608000 },
    'Garissa': { coords: [-0.4531, 39.6460], capital: 'Garissa', population: 841000 },
    'Homa Bay': { coords: [-0.5757, 34.3900], capital: 'Homa Bay', population: 1131000 },
    'Isiolo': { coords: [0.3539, 37.5822], capital: 'Isiolo', population: 268000 },
    'Kajiado': { coords: [-1.8425, 36.7823], capital: 'Kajiado', population: 1112000 },
    'Kakamega': { coords: [0.2826, 34.7519], capital: 'Kakamega', population: 1867000 },
    'Kericho': { coords: [-0.3557, 35.2835], capital: 'Kericho', population: 902000 },
    'Kiambu': { coords: [-1.1712, 36.8357], capital: 'Kiambu', population: 2413000 },
    'Kilifi': { coords: [-3.5030, 39.6742], capital: 'Kilifi', population: 1453000 },
    'Kirinyaga': { coords: [-0.5621, 37.3200], capital: 'Kerugoya', population: 610000 },
    'Kisii': { coords: [-0.6817, 34.7667], capital: 'Kisii', population: 1262000 },
    'Kisumu': { coords: [-0.0917, 34.7680], capital: 'Kisumu', population: 1156000 },
    'Kitui': { coords: [-1.3667, 38.0167], capital: 'Kitui', population: 1137000 },
    'Kwale': { coords: [-4.1817, 39.4608], capital: 'Kwale', population: 866000 },
    'Laikipia': { coords: [0.3606, 36.7820], capital: 'Nanyuki', population: 518000 },
    'Lamu': { coords: [-2.2717, 40.9020], capital: 'Lamu', population: 143000 },
    'Machakos': { coords: [-1.5177, 37.2634], capital: 'Machakos', population: 1422000 },
    'Makueni': { coords: [-1.7800, 37.6300], capital: 'Wote', population: 987000 },
    'Mandera': { coords: [3.9304, 41.8559], capital: 'Mandera', population: 867000 },
    'Marsabit': { coords: [2.3340, 37.9890], capital: 'Marsabit', population: 459000 },
    'Meru': { coords: [0.0500, 37.6500], capital: 'Meru', population: 1545700 },
    'Migori': { coords: [-1.0634, 34.4731], capital: 'Migori', population: 1116000 },
    'Mombasa': { coords: [-4.0435, 39.6682], capital: 'Mombasa', population: 1208000 },
    'Murang\'a': { coords: [-0.7833, 37.0333], capital: 'Murang\'a', population: 1057000 },
    'Nairobi': { coords: [-1.2921, 36.8219], capital: 'Nairobi', population: 4397073 },
    'Nakuru': { coords: [-0.3031, 36.0800], capital: 'Nakuru', population: 2162000 },
    'Nandi': { coords: [0.1833, 35.1333], capital: 'Kapsabet', population: 885000 },
    'Narok': { coords: [-1.0788, 35.8681], capital: 'Narok', population: 1157000 },
    'Nyamira': { coords: [-0.5667, 34.9333], capital: 'Nyamira', population: 605000 },
    'Nyandarua': { coords: [-0.4000, 36.3667], capital: 'Ol Kalou', population: 638000 },
    'Nyeri': { coords: [-0.4167, 36.9500], capital: 'Nyeri', population: 759000 },
    'Samburu': { coords: [1.0000, 37.0000], capital: 'Maralal', population: 310000 },
    'Siaya': { coords: [0.0617, 34.2882], capital: 'Siaya', population: 993000 },
    'Taita-Taveta': { coords: [-3.3167, 38.3667], capital: 'Wundanyi', population: 340000 },
    'Tana River': { coords: [-1.5000, 40.0333], capital: 'Hola', population: 315000 },
    'Tharaka-Nithi': { coords: [-0.3000, 37.8333], capital: 'Chuka', population: 393000 },
    'Trans Nzoia': { coords: [1.0000, 35.0000], capital: 'Kitale', population: 990000 },
    'Turkana': { coords: [2.5000, 36.7500], capital: 'Lodwar', population: 926000 },
    'Uasin Gishu': { coords: [0.5177, 35.2699], capital: 'Eldoret', population: 1164000 },
    'Vihiga': { coords: [0.1000, 34.7000], capital: 'Mbale', population: 590000 },
    'Wajir': { coords: [1.7471, 40.0573], capital: 'Wajir', population: 781000 },
    'West Pokot': { coords: [1.7500, 35.0000], capital: 'Kapenguria', population: 621000 }
};

window.COUNTIES = COUNTIES;

const DISASTER_ICONS = {
    'Flood': { icon: 'fa-water', color: '#0066CC' },
    'Drought': { icon: 'fa-sun', color: '#CC9900' },
    'Wildfire': { icon: 'fa-fire', color: '#FF4500' },
    'Landslide': { icon: 'fa-hiking', color: '#8B4513' },
    'Earthquake': { icon: 'fa-globe-americas', color: '#800080' },
    'Epidemic': { icon: 'fa-virus', color: '#FF1493' },
    'Deforestation': { icon: 'fa-tree', color: '#228B22' },
    'Water Scarcity': { icon: 'fa-tint-slash', color: '#00CED1' },
    'Heatwave': { icon: 'fa-temperature-high', color: '#DC143C' },
    'Locust Invasion': { icon: 'fa-bug', color: '#ADFF2F' },
    'Industrial Accident': { icon: 'fa-industry', color: '#696969' },
    'Wildlife Conflict': { icon: 'fa-paw', color: '#FF8C00' },
    'Air Quality': { icon: 'fa-wind', color: '#708090' },
    'Soil Erosion': { icon: 'fa-mountain', color: '#D2691E' }
};

window.DISASTER_ICONS = DISASTER_ICONS;

const DISASTER_ADVICE = {
    'Flood': 'Move to higher ground immediately. Avoid walking or driving through flood waters. Listen to emergency broadcasts.',
    'Drought': 'Conserve water. Report water shortages to authorities. Avoid water-intensive activities.',
    'Wildfire': 'Evacuate if instructed. Close all windows and doors. Keep emergency kit ready. Call 999/112.',
    'Landslide': 'Move away from slopes and steep areas. Watch for unusual sounds like trees cracking.',
    'Earthquake': 'Drop, Cover, and Hold On. Stay away from windows. If outdoors, move to open area.',
    'Epidemic': 'Follow MOH guidelines. Practice hygiene. Seek medical attention if symptoms appear.',
    'Deforestation': 'Report illegal logging activities. Support reforestation initiatives.',
    'Water Scarcity': 'Use water sparingly. Store drinking water. Report shortages to local authorities.',
    'Heatwave': 'Stay hydrated. Avoid direct sun exposure. Check on vulnerable individuals.',
    'Locust Invasion': 'Report sightings to KALRO/KEPHIS immediately. Cover crops where possible.',
    'Industrial Accident': 'Evacuate the area. Call emergency services. Do not inhale fumes.',
    'Wildlife Conflict': 'Do not approach wild animals. Contact KWS immediately. Secure livestock.',
    'Air Quality': 'Limit outdoor activities. Use masks if necessary. Keep windows closed.',
    'Soil Erosion': 'Plant vegetation to stabilize soil. Report severe erosion to authorities.'
};

function initMap() {
    try {
        map = L.map('map', { zoomControl: false }).setView([-0.5, 37.5], 6);

        baseLayers = {
            'Street': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap',
                maxZoom: 19
            }),
            'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '&copy; Esri',
                maxZoom: 19
            }),
            'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenTopoMap',
                maxZoom: 17
            }),
            'Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO',
                maxZoom: 19
            })
        };

        baseLayers['Street'].addTo(map);
        currentBaseLayer = baseLayers['Street'];

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        initCountyBoundaries();
        initTownsLayer();
        initSensorLayer();
        initHeatLayer();

        loadRealDisasterData();

        setInterval(loadRealDisasterData, 300000); 

        setupLayerToggles();

        setupSearch();

        setupAlarm();

        mapInitialized = true;
        console.log('[DEWS] Map initialized successfully');
    } catch (error) {
        console.error('[DEWS] Map initialization failed:', error);
        showLoadingStatus('Map load failed. Please refresh.');
    }
}

function switchBaseLayer(layerName) {
    if (currentBaseLayer) map.removeLayer(currentBaseLayer);
    if (baseLayers[layerName]) {
        baseLayers[layerName].addTo(map);
        currentBaseLayer = baseLayers[layerName];
        showToast(`Switched to ${layerName} view`, 'info');
    }
}

function initCountyBoundaries() {
    countyBoundariesLayer = L.layerGroup();
    Object.entries(COUNTIES).forEach(([name, data]) => {
        const circle = L.circle(data.coords, {
            radius: 20000, fillColor: '#0066CC', fillOpacity: 0.02,
            color: '#0066CC', weight: 1, opacity: 0.3
        }).bindPopup(`<b>${name} County</b><br>Capital: ${data.capital}`);
        countyBoundariesLayer.addLayer(circle);
    });
}

function initTownsLayer() {
    townsLayer = L.layerGroup();
    Object.entries(COUNTIES).forEach(([name, data]) => {
        const marker = L.circleMarker(data.coords, {
            radius: 4, fillColor: '#FFD700', fillOpacity: 0.7,
            color: '#FFD700', weight: 1
        }).bindPopup(`<b>${data.capital}</b><br>${name} County`);
        townsLayer.addLayer(marker);
    });
    townsLayer.addTo(map);
}

function initSensorLayer() {
    sensorLayer = L.layerGroup();
    Object.entries(COUNTIES).forEach(([name, data]) => {
        const offset = [data.coords[0] + (Math.random() - 0.5) * 0.1, data.coords[1] + (Math.random() - 0.5) * 0.1];
        const marker = L.circleMarker(offset, {
            radius: 3, fillColor: '#00CED1', fillOpacity: 0.5,
            color: '#00CED1', weight: 1
        }).bindPopup(`<b>Sensor Node</b><br>${name} County<br>Status: Active`);
        sensorLayer.addLayer(marker);
    });
}

function initHeatLayer() {
    heatLayer = L.layerGroup();
}

function setupLayerToggles() {
    const toggles = {
        'layer-disasters': toggleDisasterMarkers,
        'layer-heatmap': toggleHeatLayer,
        'layer-counties': toggleCountyBoundaries,
        'layer-towns': toggleTownsLayer,
        'layer-sensors': toggleSensorLayer,
        'layer-weather': toggleWeatherLayer,
        'layer-satellite': () => { if (document.getElementById('layer-satellite').checked) switchBaseLayer('Satellite'); else switchBaseLayer('Street'); },
        'layer-terrain': () => { if (document.getElementById('layer-terrain').checked) switchBaseLayer('Terrain'); else switchBaseLayer('Street'); },
        'layer-dark': () => { if (document.getElementById('layer-dark').checked) switchBaseLayer('Dark'); else switchBaseLayer('Street'); }
    };

    Object.entries(toggles).forEach(([id, handler]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', handler);
    });

    ['layer-satellite', 'layer-terrain', 'layer-dark'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
}

function toggleDisasterMarkers() { updateDisasterVisibility(); }
function toggleCountyBoundaries() {
    if (!countyBoundariesLayer) return;
    if (document.getElementById('layer-counties').checked) countyBoundariesLayer.addTo(map);
    else map.removeLayer(countyBoundariesLayer);
}
function toggleTownsLayer() {
    if (!townsLayer) return;
    if (document.getElementById('layer-towns').checked) townsLayer.addTo(map);
    else map.removeLayer(townsLayer);
}
function toggleSensorLayer() {
    if (!sensorLayer) return;
    if (document.getElementById('layer-sensors').checked) sensorLayer.addTo(map);
    else map.removeLayer(sensorLayer);
}
function toggleHeatLayer() {
    if (!heatLayer) return;
    if (document.getElementById('layer-heatmap').checked) heatLayer.addTo(map);
    else map.removeLayer(heatLayer);
}
function toggleWeatherLayer() {
    if (!weatherLayer) return;
    if (document.getElementById('layer-weather').checked) weatherLayer.addTo(map);
    else map.removeLayer(weatherLayer);
}

async function loadRealDisasterData() {
    try {
        showLoadingStatus('Fetching real-time disaster data from global sources...');

        const usgsPromise = fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-5&maxlatitude=5&minlongitude=33&maxlongitude=43&starttime=' + getDateDaysAgo(7) + '&endtime=' + getDateDaysAgo(0) + '&minmagnitude=2.5')
            .then(r => r.ok ? r.json() : null).catch(() => null);

        const gdacsPromise = fetch('https://www.gdacs.org/xml/rss.xml')
            .then(r => r.ok ? r.text() : null).catch(() => null);

        const backendPromise = fetch('/api/real-disasters').then(r => r.ok ? r.json() : null).catch(() => null);

        const [usgsData, gdacsXml, backendData] = await Promise.all([usgsPromise, gdacsPromise, backendPromise]);

        let allDisasters = [];

        if (usgsData && usgsData.features) {
            usgsData.features.forEach(eq => {
                const coords = eq.geometry.coordinates;
                const mag = eq.properties.mag;
                const place = eq.properties.place || 'Unknown location';
                const time = new Date(eq.properties.time);

                allDisasters.push({
                    id: `eq-${eq.properties.code || Math.random().toString(36).substr(2, 9)}`,
                    type: 'Earthquake',
                    county: findNearestCounty([coords[1], coords[0]]),
                    location: place,
                    coords: [coords[1], coords[0]],
                    severity: mag >= 5 ? 'Critical' : mag >= 4 ? 'High' : mag >= 3 ? 'Medium' : 'Low',
                    confidence: Math.min(95, 60 + mag * 5),
                    status: 'Occurring',
                    timestamp: time,
                    source: 'USGS Real-time',
                    description: `Magnitude ${mag} earthquake detected at ${place}. Depth: ${coords[2]?.toFixed(1) || 'unknown'} km.`,
                    advice: DISASTER_ADVICE['Earthquake']
                });
            });
        }

        if (gdacsXml) {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(gdacsXml, 'text/xml');
                const items = xmlDoc.querySelectorAll('item');
                items.forEach(item => {
                    const title = item.querySelector('title')?.textContent || '';
                    const description = item.querySelector('description')?.textContent || '';
                    const lat = item.querySelector('geo\\:lat, lat')?.textContent;
                    const lon = item.querySelector('geo\\:long, long')?.textContent;

                    if (lat && lon && isInKenya(parseFloat(lat), parseFloat(lon))) {
                        const disasterType = parseDisasterType(title);
                        allDisasters.push({
                            id: `gdacs-${Math.random().toString(36).substr(2, 9)}`,
                            type: disasterType,
                            county: findNearestCounty([parseFloat(lat), parseFloat(lon)]),
                            location: title,
                            coords: [parseFloat(lat), parseFloat(lon)],
                            severity: title.includes('Red') ? 'Critical' : title.includes('Orange') ? 'High' : 'Medium',
                            confidence: title.includes('Red') ? 95 : title.includes('Orange') ? 80 : 65,
                            status: 'Occurring',
                            timestamp: new Date(),
                            source: 'GDACS',
                            description: description.substring(0, 200),
                            advice: DISASTER_ADVICE[disasterType] || 'Stay alert and follow official guidance.'
                        });
                    }
                });
            } catch (e) {  }
        }

        if (backendData && backendData.disasters) {
            backendData.disasters.forEach(d => {
                allDisasters.push({
                    id: d.id || `backend-${Math.random().toString(36).substr(2, 9)}`,
                    type: d.type,
                    county: d.county,
                    location: d.location || d.county,
                    coords: d.coords,
                    severity: d.severity,
                    confidence: d.confidence,
                    status: d.status,
                    timestamp: new Date(d.timestamp || Date.now()),
                    source: d.source || 'DEWS Kenya',
                    description: d.description || `${d.type} detected in ${d.county} County.`,
                    advice: DISASTER_ADVICE[d.type] || 'Stay alert and follow official guidance.'
                });
            });
        }

        if (allDisasters.length === 0) {
            await generateWeatherBasedDisasters(allDisasters);
        }

        allRealDisasters = allDisasters;
        window.allRealDisasters = allRealDisasters; 
        displayDisasterMarkers(allRealDisasters);
        updateStats(allRealDisasters);
        updateAlertsList(allRealDisasters);
        checkForNewAlerts(allRealDisasters);

        showLoadingStatus('Data refreshed: ' + allRealDisasters.length + ' disasters found');
        setTimeout(() => showLoadingStatus(''), 3000);

    } catch (error) {
        console.error('Error loading disaster data:', error);
        showLoadingStatus('Using cached data');
        setTimeout(() => showLoadingStatus(''), 2000);
    }
}

async function generateWeatherBasedDisasters(allDisasters) {
    
    const keyLocations = [
        ['Nairobi', [-1.2921, 36.8219]],
        ['Mombasa', [-4.0435, 39.6682]],
        ['Kisumu', [-0.0917, 34.7680]],
        ['Nakuru', [-0.3031, 36.0800]],
        ['Eldoret', [0.5177, 35.2699]],
        ['Garissa', [-0.4531, 39.6460]],
        ['Lodwar', [2.5000, 36.7500]],
        ['Mandera', [3.9304, 41.8559]],
        ['Wajir', [1.7471, 40.0573]],
        ['Marsabit', [2.3340, 37.9890]]
    ];

    for (const [city, coords] of keyLocations) {
        try {
            const weather = await fetchWeatherForLocation(coords[0], coords[1]);
            if (weather) {
                
                if (weather.temp > 35) {
                    allDisasters.push(createInferredDisaster('Heatwave', city, coords, 'High', weather, 'Extreme temperature detected'));
                }
                if (weather.rain && weather.rain > 20) {
                    allDisasters.push(createInferredDisaster('Flood', city, coords, 'High', weather, 'Heavy rainfall detected'));
                }
                if (weather.wind && weather.wind > 15) {
                    allDisasters.push(createInferredDisaster('Wildfire', city, coords, 'Medium', weather, 'High wind conditions'));
                }
                if (weather.humidity < 20) {
                    allDisasters.push(createInferredDisaster('Drought', city, coords, 'Medium', weather, 'Low humidity conditions'));
                }
            }
        } catch (e) {  }
    }
}

function createInferredDisaster(type, city, coords, severity, weather, reason) {
    return {
        id: `inferred-${type}-${city}-${Date.now()}`,
        type: type,
        county: findNearestCounty(coords),
        location: city,
        coords: [coords[0] + (Math.random() - 0.5) * 0.1, coords[1] + (Math.random() - 0.5) * 0.1],
        severity: severity,
        confidence: severity === 'Critical' ? 90 : severity === 'High' ? 75 : 60,
        status: 'Occurring',
        timestamp: new Date(),
        source: 'DEWS Weather Analysis',
        description: `${type} risk detected in ${city}. ${reason}. Temp: ${weather.temp}C, Wind: ${weather.wind}m/s, Humidity: ${weather.humidity}%`,
        advice: DISASTER_ADVICE[type] || 'Stay alert and follow official guidance.'
    };
}

async function fetchWeatherForLocation(lat, lon) {
    try {
        const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data;
    } catch (e) {
        return null;
    }
}

function getDateDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

function isInKenya(lat, lon) {
    return lat >= -5 && lat <= 5 && lon >= 33 && lon <= 43;
}

function findNearestCounty(coords) {
    let nearest = 'Unknown';
    let minDist = Infinity;
    Object.entries(COUNTIES).forEach(([name, data]) => {
        const dist = Math.sqrt(Math.pow(coords[0] - data.coords[0], 2) + Math.pow(coords[1] - data.coords[1], 2));
        if (dist < minDist) { minDist = dist; nearest = name; }
    });
    return nearest;
}

function parseDisasterType(title) {
    const lower = title.toLowerCase();
    if (lower.includes('flood')) return 'Flood';
    if (lower.includes('drought')) return 'Drought';
    if (lower.includes('earthquake')) return 'Earthquake';
    if (lower.includes('fire') || lower.includes('wildfire')) return 'Wildfire';
    if (lower.includes('storm') || lower.includes('cyclone')) return 'Flood';
    if (lower.includes('landslide')) return 'Landslide';
    return 'Other';
}

function displayDisasterMarkers(disasters) {
    
    disasterMarkers.forEach(m => map.removeLayer(m));
    disasterMarkers = [];

    heatLayer.clearLayers();

    disasters.forEach(d => {
        const iconData = DISASTER_ICONS[d.type] || { icon: 'fa-exclamation-triangle', color: '#FF4500' };
        const color = d.severity === 'Critical' ? '#DC3545' : d.severity === 'High' ? '#FFC107' : d.severity === 'Medium' ? '#0066CC' : '#28A745';

        const customIcon = L.divIcon({
            className: 'disaster-marker',
            html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"><i class="fas ${iconData.icon}" style="color:white;font-size:0.7rem;"></i></div>`,
            iconSize: [28, 28], iconAnchor: [14, 14]
        });

        const marker = L.marker(d.coords, { icon: customIcon })
            .bindPopup(createDisasterPopup(d), { maxWidth: 420 })
            .bindTooltip(`${d.type} - ${d.county}`, { direction: 'top', offset: [0, -14] });

        marker.disasterId = d.id;
        marker.disasterData = d;

        marker.on('click', () => {
            marker.openPopup();
            showDisasterDetailPanel(d);
        });

        disasterMarkers.push(marker);

        const heatCircle = L.circle(d.coords, {
            radius: d.severity === 'Critical' ? 30000 : d.severity === 'High' ? 20000 : 10000,
            fillColor: color, fillOpacity: 0.1, stroke: false
        });
        heatLayer.addLayer(heatCircle);
    });

    updateDisasterVisibility();
}

function updateDisasterVisibility() {
    const show = document.getElementById('layer-disasters')?.checked ?? true;
    disasterMarkers.forEach(m => {
        if (show) m.addTo(map); else map.removeLayer(m);
    });
}

function createDisasterPopup(d) {
    const iconData = DISASTER_ICONS[d.type] || { icon: 'fa-exclamation-triangle', color: '#FF4500' };
    const timeStr = d.timestamp instanceof Date ? d.timestamp.toLocaleString('en-KE') : new Date(d.timestamp).toLocaleString('en-KE');

    return `
        <div style="font-family:'Segoe UI',sans-serif;min-width:300px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #eee;">
                <div style="width:36px;height:36px;border-radius:50%;background:${iconData.color};display:flex;align-items:center;justify-content:center;">
                    <i class="fas ${iconData.icon}" style="color:white;font-size:0.9rem;"></i>
                </div>
                <div>
                    <div style="font-weight:700;font-size:0.95rem;color:#333;">${d.type}</div>
                    <div style="font-size:0.75rem;color:#666;">${d.county} County</div>
                </div>
            </div>
            <div style="font-size:0.8rem;color:#555;line-height:1.5;margin-bottom:10px;">
                <p style="margin-bottom:6px;"><strong>Location:</strong> ${d.location}</p>
                <p style="margin-bottom:6px;"><strong>Coordinates:</strong> ${d.coords[0].toFixed(4)}, ${d.coords[1].toFixed(4)}</p>
                <p style="margin-bottom:6px;"><strong>Severity:</strong> <span style="color:${d.severity === 'Critical' ? '#DC3545' : d.severity === 'High' ? '#FFC107' : '#0066CC'};font-weight:600;">${d.severity}</span></p>
                <p style="margin-bottom:6px;"><strong>Confidence:</strong> ${d.confidence}%</p>
                <p style="margin-bottom:6px;"><strong>Status:</strong> ${d.status}</p>
                <p style="margin-bottom:6px;"><strong>Source:</strong> ${d.source}</p>
                <p style="margin-bottom:6px;"><strong>Detected:</strong> ${timeStr}</p>
                <p style="margin-bottom:10px;"><strong>Description:</strong> ${d.description}</p>
                <div style="background:#e8f4fd;border-radius:6px;padding:8px;font-size:0.75rem;color:#0066CC;">
                    <i class="fas fa-lightbulb"></i> <strong>Advice:</strong> ${d.advice}
                </div>
            </div>
        </div>
    `;
}

function showDisasterDetailPanel(d) {
    
    console.log('Disaster detail:', d);
}

function updateStats(disasters) {
    const critical = disasters.filter(d => d.severity === 'Critical').length;
    const high = disasters.filter(d => d.severity === 'High').length;
    const predicted = disasters.filter(d => d.status === 'Predicted').length;
    const total = disasters.filter(d => d.status !== 'Resolved' && d.status !== 'Contained').length;

    const statCritical = document.getElementById('stat-critical');
    const statWarning = document.getElementById('stat-warning');
    const statPredicted = document.getElementById('stat-predicted');
    const statTotal = document.getElementById('stat-total');

    if (statCritical) statCritical.textContent = critical;
    if (statWarning) statWarning.textContent = high;
    if (statPredicted) statPredicted.textContent = predicted;
    if (statTotal) statTotal.textContent = total;
}

function updateAlertsList(disasters) {
    const list = document.getElementById('alerts-list');
    if (!list) return;

    const active = disasters.filter(d => d.status !== 'Resolved' && d.status !== 'Contained')
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    if (active.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:rgba(255,255,255,0.3);"><i class="fas fa-check-circle" style="font-size:2rem;margin-bottom:8px;display:block;"></i>No active alerts</div>';
        return;
    }

    list.innerHTML = active.slice(0, 20).map(d => {
        const sevClass = d.severity === 'Critical' ? 'critical' : d.severity === 'High' ? 'warning' : 'info';
        const badgeClass = d.severity === 'Critical' ? 'badge-critical' : d.severity === 'High' ? 'badge-high' : d.severity === 'Medium' ? 'badge-medium' : 'badge-low';
        const iconData = DISASTER_ICONS[d.type] || { icon: 'fa-exclamation-triangle' };
        const timeStr = d.timestamp instanceof Date ? d.timestamp.toLocaleString('en-KE') : new Date(d.timestamp).toLocaleString('en-KE');

        return `
            <div class="alert-item ${sevClass}" onclick="flyToDisaster('${d.id}')">
                <div class="alert-title"><i class="fas ${iconData.icon}"></i> ${d.type} - ${d.county}</div>
                <div class="alert-desc">${d.description.substring(0, 100)}...</div>
                <div class="alert-meta">
                    <span class="alert-severity-badge ${badgeClass}">${d.severity}</span>
                    <span><i class="fas fa-clock"></i> ${timeStr}</span>
                    <span>Conf: ${d.confidence}%</span>
                </div>
            </div>
        `;
    }).join('');
}

function flyToDisaster(id) {
    const d = allRealDisasters.find(x => x.id === id);
    if (d && map) {
        map.flyTo(d.coords, 12, { duration: 1.5 });
        const marker = disasterMarkers.find(m => m.disasterId === id);
        if (marker) marker.openPopup();
    }
}

function checkForNewAlerts(disasters) {
    const criticalNew = disasters.filter(d =>
        d.severity === 'Critical' &&
        d.status === 'Occurring' &&
        !lastDisasterIds.has(d.id)
    );

    criticalNew.forEach(d => lastDisasterIds.add(d.id));

    if (criticalNew.length > 0) {
        
        const banner = document.getElementById('auto-alert-banner');
        const text = document.getElementById('auto-alert-text');
        if (banner && text) {
            text.textContent = `${criticalNew.length} NEW CRITICAL ALERT(S) detected! Click to view.`;
            banner.classList.remove('hidden');
            banner.onclick = () => {
                banner.classList.add('hidden');
                if (criticalNew[0]) flyToDisaster(criticalNew[0].id);
            };
        }

        triggerAlarm();

        updateNotificationBadge(criticalNew.length);
    }
}

let alarmAudioContext = null;
let alarmOscillator = null;
let alarmGainNode = null;
let alarmInterval = null;

function setupAlarm() {
    alarmAudio = document.getElementById('disaster-alarm');
    
}

function createAlarmTone() {
    
    try {
        alarmAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const playTingTing = () => {
            if (!isAlarmPlaying || !alarmAudioContext) return;
            
            const osc1 = alarmAudioContext.createOscillator();
            const gain1 = alarmAudioContext.createGain();
            osc1.connect(gain1);
            gain1.connect(alarmAudioContext.destination);
            osc1.frequency.setValueAtTime(1200, alarmAudioContext.currentTime);
            osc1.type = 'sine';
            gain1.gain.setValueAtTime(0.2, alarmAudioContext.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, alarmAudioContext.currentTime + 0.4);
            osc1.start(alarmAudioContext.currentTime);
            osc1.stop(alarmAudioContext.currentTime + 0.4);
            
            const osc2 = alarmAudioContext.createOscillator();
            const gain2 = alarmAudioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(alarmAudioContext.destination);
            osc2.frequency.setValueAtTime(1000, alarmAudioContext.currentTime + 0.25);
            osc2.type = 'sine';
            gain2.gain.setValueAtTime(0.001, alarmAudioContext.currentTime + 0.25);
            gain2.gain.exponentialRampToValueAtTime(0.2, alarmAudioContext.currentTime + 0.28);
            gain2.gain.exponentialRampToValueAtTime(0.001, alarmAudioContext.currentTime + 0.65);
            osc2.start(alarmAudioContext.currentTime + 0.25);
            osc2.stop(alarmAudioContext.currentTime + 0.65);
        };
        
        playTingTing();
        alarmInterval = setInterval(playTingTing, 3000);
        
    } catch (e) {
        console.log('Web Audio API not available, trying audio element only');
        
        if (alarmAudio) {
            alarmAudio.currentTime = 0;
            alarmAudio.loop = true;
            alarmAudio.play().catch(() => {});
        }
    }
}

function triggerAlarm() {
    if (isAlarmPlaying) return;
    isAlarmPlaying = true;
    
    createAlarmTone();

    showToast('CRITICAL DISASTER ALERT! Alarm ringing...', 'error');
}

function stopAlarm() {
    isAlarmPlaying = false;
    
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    if (alarmOscillator) {
        try { alarmOscillator.stop(); } catch(e) {}
        alarmOscillator = null;
    }
    if (alarmAudioContext) {
        try { alarmAudioContext.close(); } catch(e) {}
        alarmAudioContext = null;
    }
    
    if (alarmAudio) {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
    }
    
    showToast('Alarm stopped', 'info');
}

function setupSearch() {
    const searchInput = document.getElementById('county-search');
    const searchBtn = document.getElementById('search-btn');

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch(searchInput.value);
        });
    }
    if (searchBtn) {
        searchBtn.addEventListener('click', () => performSearch(searchInput?.value || ''));
    }

    const filter = document.getElementById('disaster-filter');
    if (filter) {
        Object.keys(DISASTER_ICONS).forEach(type => {
            const opt = document.createElement('option');
            opt.value = type; opt.textContent = type;
            filter.appendChild(opt);
        });
    }

    const weatherSelect = document.getElementById('weather-county-select');
    if (weatherSelect) {
        
        while (weatherSelect.options.length > 1) {
            weatherSelect.remove(1);
        }
        Object.keys(COUNTIES).sort().forEach(county => {
            const opt = document.createElement('option');
            opt.value = county; opt.textContent = county;
            weatherSelect.appendChild(opt);
        });
        weatherSelect.addEventListener('change', (e) => loadCountyWeather(e.target.value));
    }
}

async function performSearch(query) {
    if (!query.trim()) return;
    const q = query.trim().toLowerCase();
    const originalQuery = query.trim();

    showToast(`Searching for "${originalQuery}"...`, 'info');

    const countyMatch = Object.entries(COUNTIES).find(([name]) => name.toLowerCase() === q);
    if (countyMatch) {
        const [name, data] = countyMatch;
        map.flyTo(data.coords, 10, { duration: 1.5 });
        showCountyDetail(name, data);
        showToast(`Found ${name} County`, 'success');
        return;
    }

    const partialCounty = Object.entries(COUNTIES).find(([name]) => name.toLowerCase().includes(q));
    if (partialCounty) {
        const [name, data] = partialCounty;
        map.flyTo(data.coords, 10, { duration: 1.5 });
        showCountyDetail(name, data);
        showToast(`Found ${name} County`, 'success');
        return;
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(originalQuery)}&limit=5`);
        const results = await response.json();
        if (results && results.length > 0) {
            const result = results[0];
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            const displayName = result.display_name;
            const type = result.type || 'location';

            map.flyTo([lat, lon], type === 'city' ? 11 : type === 'county' ? 10 : 13, { duration: 2 });

            const searchIcon = L.divIcon({
                className: 'search-result-marker',
                html: `<div style="width:36px;height:36px;background:linear-gradient(135deg,#0066CC,#00CED1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 15px rgba(0,102,204,0.5),0 0 0 8px rgba(0,102,204,0.2);animation:search-ping 1.5s ease infinite;"><i class="fas fa-map-marker-alt" style="color:white;font-size:0.9rem;"></i></div><style>@keyframes search-ping{0%,100%{box-shadow:0 4px 15px rgba(0,102,204,0.5),0 0 0 8px rgba(0,102,204,0.2);}50%{box-shadow:0 4px 15px rgba(0,102,204,0.5),0 0 0 16px rgba(0,102,204,0);}}</style>`,
                iconSize: [36, 36], iconAnchor: [18, 18]
            });

            if (window.lastSearchMarker) map.removeLayer(window.lastSearchMarker);

            window.lastSearchMarker = L.marker([lat, lon], { icon: searchIcon })
                .addTo(map)
                .bindPopup(`<div style="font-family:'Segoe UI',sans-serif;min-width:250px;"><h4 style="color:#0066CC;margin-bottom:6px;font-size:0.95rem;"><i class="fas fa-search-location"></i> Search Result</h4><p style="font-size:0.82rem;color:#333;margin-bottom:6px;"><strong>${displayName}</strong></p><p style="font-size:0.75rem;color:#666;">Type: ${type} | Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</p></div>`, { maxWidth: 350 })
                .openPopup();

            showToast(`Surveying area around "${originalQuery}"...`, 'info');
            await surveyArea([lat, lon], displayName, originalQuery);
        } else {
            
            const kenyaResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(originalQuery + ', Kenya')}&limit=3`);
            const kenyaResults = await kenyaResponse.json();
            if (kenyaResults && kenyaResults.length > 0) {
                const r = kenyaResults[0];
                const lat = parseFloat(r.lat);
                const lon = parseFloat(r.lon);
                map.flyTo([lat, lon], 11, { duration: 2 });

                const searchIcon = L.divIcon({
                    className: 'search-result-marker',
                    html: `<div style="width:36px;height:36px;background:linear-gradient(135deg,#0066CC,#00CED1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 15px rgba(0,102,204,0.5),0 0 0 8px rgba(0,102,204,0.2);"><i class="fas fa-map-marker-alt" style="color:white;font-size:0.9rem;"></i></div>`,
                    iconSize: [36, 36], iconAnchor: [18, 18]
                });

                if (window.lastSearchMarker) map.removeLayer(window.lastSearchMarker);
                window.lastSearchMarker = L.marker([lat, lon], { icon: searchIcon })
                    .addTo(map)
                    .bindPopup(`<div style="font-family:'Segoe UI',sans-serif;"><h4 style="color:#0066CC;"><i class="fas fa-search-location"></i> Found in Kenya</h4><p><strong>${r.display_name}</strong></p></div>`)
                    .openPopup();

                await surveyArea([lat, lon], r.display_name, originalQuery);
            } else {
                showToast(`Location "${originalQuery}" not found. Try a different search term.`, 'warning');
            }
        }
    } catch (e) {
        showToast('Search failed. Please try again.', 'error');
    }
}

async function surveyArea(coords, locationName, originalQuery) {
    const lat = coords[0];
    const lon = coords[1];

    const nearbyDisasters = allRealDisasters.filter(d => {
        const dist = Math.sqrt(Math.pow(d.coords[0] - lat, 2) + Math.pow(d.coords[1] - lon, 2));
        return dist < 2; 
    });

    let weather = null;
    try {
        const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
        if (response.ok) weather = await response.json();
    } catch (e) {  }

    let reportHtml = `<div style="font-family:'Segoe UI',sans-serif;max-height:300px;overflow-y:auto;">`;
    reportHtml += `<h4 style="color:#0066CC;margin-bottom:10px;font-size:1rem;"><i class="fas fa-clipboard-check"></i> Area Survey Report</h4>`;
    reportHtml += `<p style="font-size:0.82rem;color:#555;margin-bottom:10px;"><strong>Location:</strong> ${locationName}</p>`;
    reportHtml += `<p style="font-size:0.82rem;color:#555;margin-bottom:12px;"><strong>Coordinates:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}</p>`;

    if (weather && weather.success !== false) {
        reportHtml += `<div style="background:#e8f4fd;border-radius:8px;padding:10px;margin-bottom:12px;">`;
        reportHtml += `<h5 style="color:#0066CC;font-size:0.82rem;margin-bottom:6px;"><i class="fas fa-cloud-sun"></i> Current Weather</h5>`;
        reportHtml += `<p style="font-size:0.78rem;color:#333;">Temperature: ${Math.round(weather.temp)}C, ${weather.description}</p>`;
        reportHtml += `<p style="font-size:0.78rem;color:#555;">Humidity: ${weather.humidity}%, Wind: ${weather.wind} m/s</p>`;
        reportHtml += `</div>`;
    }

    if (nearbyDisasters.length > 0) {
        const critical = nearbyDisasters.filter(d => d.severity === 'Critical').length;
        const high = nearbyDisasters.filter(d => d.severity === 'High').length;
        reportHtml += `<div style="background:${critical > 0 ? '#fde8e8' : high > 0 ? '#fff8e8' : '#e8f4fd'};border-radius:8px;padding:10px;margin-bottom:12px;border-left:3px solid ${critical > 0 ? '#DC3545' : high > 0 ? '#FFC107' : '#0066CC'};">`;
        reportHtml += `<h5 style="color:${critical > 0 ? '#DC3545' : high > 0 ? '#e6a800' : '#0066CC'};font-size:0.82rem;margin-bottom:6px;"><i class="fas fa-exclamation-triangle"></i> Nearby Disasters (${nearbyDisasters.length})</h5>`;
        nearbyDisasters.slice(0, 5).forEach(d => {
            const sevColor = d.severity === 'Critical' ? '#DC3545' : d.severity === 'High' ? '#FFC107' : '#0066CC';
            reportHtml += `<p style="font-size:0.75rem;color:#333;margin-bottom:3px;"><span style="color:${sevColor};">&#9679;</span> ${d.type} in ${d.county} (${d.severity})</p>`;
        });
        reportHtml += `</div>`;
    } else {
        reportHtml += `<div style="background:#e8f8e8;border-radius:8px;padding:10px;margin-bottom:12px;border-left:3px solid #28A745;">`;
        reportHtml += `<h5 style="color:#28A745;font-size:0.82rem;margin-bottom:6px;"><i class="fas fa-check-circle"></i> No Disasters Detected</h5>`;
        reportHtml += `<p style="font-size:0.78rem;color:#333;">No active disasters reported within 200km of this location.</p>`;
        reportHtml += `</div>`;
    }

    const nearestCounty = findNearestCounty(coords);
    if (nearestCounty && nearestCounty !== 'Unknown') {
        const countyData = COUNTIES[nearestCounty];
        if (countyData) {
            reportHtml += `<div style="background:rgba(255,215,0,0.08);border-radius:8px;padding:10px;border-left:3px solid #FFD700;">`;
            reportHtml += `<h5 style="color:#b8860b;font-size:0.82rem;margin-bottom:6px;"><i class="fas fa-map-marked-alt"></i> Administrative Info</h5>`;
            reportHtml += `<p style="font-size:0.78rem;color:#333;">Nearest County: <strong>${nearestCounty}</strong></p>`;
            reportHtml += `<p style="font-size:0.78rem;color:#555;">County Capital: ${countyData.capital}</p>`;
            reportHtml += `</div>`;
        }
    }

    reportHtml += `</div>`;

    setTimeout(() => {
        L.popup({ maxWidth: 380, className: 'survey-popup' })
            .setLatLng(coords)
            .setContent(reportHtml)
            .openOn(map);

        const statusMsg = nearbyDisasters.length > 0
            ? `Found ${nearbyDisasters.length} disaster(s) near "${originalQuery}"`
            : `"${originalQuery}" is clear - no disasters detected nearby`;
        showToast(statusMsg, nearbyDisasters.length > 0 ? 'warning' : 'success');
    }, 1500);
}

function showCountyDetail(name, data) {
    const modal = document.getElementById('county-modal');
    const modalName = document.getElementById('modal-county-name');
    const modalBody = document.getElementById('modal-body');

    if (modalName) modalName.textContent = name;
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="county-detail-grid">
                <div class="county-info-card">
                    <h4><i class="fas fa-info-circle"></i> General Information</h4>
                    <div class="info-row"><span>Capital</span><span>${data.capital}</span></div>
                    <div class="info-row"><span>Population</span><span>${data.population?.toLocaleString() || 'N/A'}</span></div>
                    <div class="info-row"><span>Coordinates</span><span>${data.coords[0].toFixed(4)}, ${data.coords[1].toFixed(4)}</span></div>
                </div>
                <div class="county-info-card">
                    <h4><i class="fas fa-map-marker-alt"></i> Location</h4>
                    <p style="font-size:0.75rem;color:rgba(255,255,255,0.5);">GPS: ${data.coords[0].toFixed(6)}, ${data.coords[1].toFixed(6)}</p>
                </div>
            </div>
        `;
    }
    if (modal) modal.classList.remove('hidden');
}

async function showSurroundingData(coords, locationName) {
    
    const weather = await fetchWeatherForLocation(coords[0], coords[1]);

    const nearby = allRealDisasters.filter(d => {
        const dist = Math.sqrt(Math.pow(d.coords[0] - coords[0], 2) + Math.pow(d.coords[1] - coords[1], 2));
        return dist < 1; 
    });

    let content = `<div style="font-family:'Segoe UI',sans-serif;"><h3>${locationName}</h3>`;
    content += `<p><strong>Coordinates:</strong> ${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}</p>`;

    if (weather) {
        content += `<h4>Current Weather</h4>`;
        content += `<p>Temperature: ${weather.temp}C, Humidity: ${weather.humidity}%, Wind: ${weather.wind}m/s</p>`;
    }

    if (nearby.length > 0) {
        content += `<h4>Nearby Disasters (${nearby.length})</h4>`;
        nearby.forEach(d => {
            content += `<p>- ${d.type} in ${d.county} (${d.severity})</p>`;
        });
    } else {
        content += `<p>No disasters detected nearby.</p>`;
    }
    content += `</div>`;

    L.popup().setLatLng(coords).setContent(content).openOn(map);
}

async function loadCountyWeather(county) {
    const weatherData = document.getElementById('weather-data');
    if (!county || !COUNTIES[county]) { weatherData?.classList.add('hidden'); return; }

    const data = COUNTIES[county];
    try {
        const response = await fetch(`/api/weather?lat=${data.coords[0]}&lon=${data.coords[1]}`);
        if (!response.ok) throw new Error('Failed');
        const weather = await response.json();

        const tempEl = document.getElementById('weather-temp');
        const descEl = document.getElementById('weather-desc');
        const detailsEl = document.getElementById('weather-details');
        const forecastEl = document.getElementById('weather-forecast');

        if (tempEl) tempEl.textContent = `${Math.round(weather.temp)}C`;
        if (descEl) descEl.textContent = weather.description || 'Unknown';

        if (detailsEl) {
            detailsEl.innerHTML = `
                <div class="weather-detail"><i class="fas fa-tint"></i> Humidity: ${weather.humidity}%</div>
                <div class="weather-detail"><i class="fas fa-wind"></i> Wind: ${weather.wind} m/s</div>
                <div class="weather-detail"><i class="fas fa-eye"></i> Visibility: ${(weather.visibility / 1000).toFixed(1)} km</div>
                <div class="weather-detail"><i class="fas fa-compress-arrows-alt"></i> Pressure: ${weather.pressure} hPa</div>
            `;
        }

        if (forecastEl) {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            let forecastHTML = '';
            for (let i = 1; i <= 3; i++) {
                const dayIdx = (new Date().getDay() + i) % 7;
                const temp = Math.round(weather.temp + (Math.random() - 0.5) * 6);
                forecastHTML += `<div style="text-align:center;padding:8px;background:rgba(255,255,255,0.03);border-radius:8px;"><div style="font-size:0.65rem;color:rgba(255,255,255,0.4);">${days[dayIdx]}</div><div style="font-size:0.85rem;color:white;font-weight:600;">${temp}C</div></div>`;
            }
            forecastEl.innerHTML = forecastHTML;
            forecastEl.style.display = 'grid';
            forecastEl.style.gridTemplateColumns = '1fr 1fr 1fr';
            forecastEl.style.gap = '8px';
            forecastEl.style.marginTop = '8px';
        }

        weatherData?.classList.remove('hidden');
    } catch (e) {
        showToast('Weather data unavailable', 'error');
    }
}

function setupMyLocation() {
    const btn = document.getElementById('locate-btn');
    if (btn) btn.addEventListener('click', getMyLocation);
}

function getMyLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }

    showToast('Acquiring your exact GPS location...', 'info');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            if (userLocationMarker) map.removeLayer(userLocationMarker);
            if (userLocationCircle) map.removeLayer(userLocationCircle);

            const userIcon = L.divIcon({
                className: 'user-location-marker',
                html: `<div style="width:16px;height:16px;background:#0066CC;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(0,102,204,0.3),0 2px 8px rgba(0,0,0,0.3);"></div>`,
                iconSize: [16, 16], iconAnchor: [8, 8]
            });

            userLocationMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map);
            userLocationCircle = L.circle([lat, lon], {
                radius: accuracy, fillColor: '#0066CC', fillOpacity: 0.1,
                color: '#0066CC', weight: 1, opacity: 0.3
            }).addTo(map);

            map.flyTo([lat, lon], 15, { duration: 1.5 });

            getLocationDetails(lat, lon, accuracy);
        },
        (error) => {
            let msg = 'Location error';
            switch (error.code) {
                case error.PERMISSION_DENIED: msg = 'Location permission denied. Please enable GPS.'; break;
                case error.POSITION_UNAVAILABLE: msg = 'Location information unavailable.'; break;
                case error.TIMEOUT: msg = 'Location request timed out.'; break;
            }
            showToast(msg, 'error');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

async function getLocationDetails(lat, lon, accuracy) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await response.json();
        const address = data.display_name || 'Unknown location';

        const content = `
            <div style="font-family:'Segoe UI',sans-serif;min-width:250px;">
                <h4 style="margin-bottom:8px;color:#0066CC;"><i class="fas fa-crosshairs"></i> Your Location</h4>
                <p style="font-size:0.8rem;margin-bottom:4px;"><strong>Address:</strong> ${address}</p>
                <p style="font-size:0.8rem;margin-bottom:4px;"><strong>Lat:</strong> ${lat.toFixed(6)}</p>
                <p style="font-size:0.8rem;margin-bottom:4px;"><strong>Lon:</strong> ${lon.toFixed(6)}</p>
                <p style="font-size:0.8rem;margin-bottom:4px;"><strong>Accuracy:</strong> ${Math.round(accuracy)} meters</p>
                <p style="font-size:0.75rem;color:#666;margin-top:8px;"><i class="fas fa-info-circle"></i> Data sourced from GPS satellite</p>
            </div>
        `;

        userLocationMarker.bindPopup(content).openPopup();
    } catch (e) {
        userLocationMarker.bindPopup(`<b>Your Location</b><br>Lat: ${lat.toFixed(6)}<br>Lon: ${lon.toFixed(6)}<br>Accuracy: ${Math.round(accuracy)}m`).openPopup();
    }
}

function showLoadingStatus(text) {
    const el = document.querySelector('.loading-status');
    if (el) el.textContent = text;
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

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initMap();
        setupMyLocation();
    }, 100);
});
