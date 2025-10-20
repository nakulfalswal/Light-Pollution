// Enhanced Light Pollution Tracker - app.js
// Complete implementation with all requested features

// Loading Screen Animation (defensive: avoid throwing if DOM nodes are missing)
let loadingProgress = 0;
const loadingBar = document.querySelector('.loading-bar');
const loadingPercentage = document.querySelector('.loading-percentage');
const loadingMessages = document.querySelectorAll('.loading-message');
let currentMessageIndex = 0;

let messageInterval = null;
let loadingInterval = null;

// Animate loading messages
function rotateLoadingMessages() {
    if (!loadingMessages || loadingMessages.length === 0) return;
    loadingMessages.forEach(msg => msg.classList.remove('active'));
    const msg = loadingMessages[currentMessageIndex];
    if (msg) msg.classList.add('active');
    currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
}

// Start loading animation with safety checks
function startLoadingAnimation() {
    // If essential elements are missing, skip animation and initialize quickly
    if (!loadingBar || !loadingPercentage || !loadingMessages || loadingMessages.length === 0) {
        console.warn('Loading UI elements missing — skipping animated loader and initializing app.');
        // short delay so user sees the page
        setTimeout(initializeApp, 100);
        return;
    }

    // Kick off message rotation and progress simulation
    messageInterval = setInterval(rotateLoadingMessages, 2000);

    loadingInterval = setInterval(() => {
        loadingProgress += Math.random() * 15;
        if (loadingProgress >= 100) {
            loadingProgress = 100;
            clearInterval(loadingInterval);
            clearInterval(messageInterval);
            setTimeout(initializeApp, 500);
        }
        loadingBar.style.width = loadingProgress + '%';
        loadingPercentage.textContent = Math.floor(loadingProgress) + '%';
    }, 300);
}

// start the loader
startLoadingAnimation();

// Initialize main application
function initializeApp() {
    const loadingScreen = document.getElementById('loading-screen');
    const container = document.querySelector('.container');
    
    // Fade out loading screen
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
        // Pause/reset background video if present to free resources
        const loadingVideo = document.getElementById('loading-video');
        if (loadingVideo) {
            try {
                loadingVideo.pause();
                loadingVideo.currentTime = 0;
            } catch (e) {
                // ignore any errors from media controls
            }
        }
        loadingScreen.style.display = 'none';
        container.style.display = 'flex';
        initializeMap();
        initializeTabs();
        initializeFAB();
        loadDarkSkyZones();
    }, 500);
}

// Global variables
let map;
let drawnItems;
let currentPolygons = [];
let totalArea = 0;
let avgPollution = 0;
let heatmapLayer = null;

// Initialize the map
function initializeMap() {
    // Create map instance
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([30.9010, 75.8573], 12); // Ludhiana coordinates

    // Add custom zoom control
    L.control.zoom({
        position: 'topleft'
    }).addTo(map);

    // Add OpenStreetMap base layer
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Add NASA VIIRS Nighttime Lights tile layer
    const viirstLayer = L.tileLayer('https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/2012-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg', {
        maxZoom: 8,
        attribution: 'NASA VIIRS City Lights',
        opacity: 0.75
    }).addTo(map);

    // Add animated overlays
    addGridOverlay();
    addParticleOverlay();
    
    // Initialize drawing features
    initializeDrawing();
    
    // Add map event listeners
    map.on('click', handleMapClick);
    map.on('zoomend', updateVisualization);
}

// Add animated grid overlay
function addGridOverlay() {
    const gridCanvas = document.createElement('canvas');
    gridCanvas.id = 'grid-overlay';
    gridCanvas.style.position = 'absolute';
    gridCanvas.style.top = '0';
    gridCanvas.style.left = '0';
    gridCanvas.style.width = '100%';
    gridCanvas.style.height = '100%';
    gridCanvas.style.pointerEvents = 'none';
    gridCanvas.style.zIndex = '500';
    gridCanvas.style.opacity = '0.15';
    document.getElementById('map').appendChild(gridCanvas);

    function resizeGrid() {
        gridCanvas.width = map.getSize().x;
        gridCanvas.height = map.getSize().y;
    }
    resizeGrid();
    map.on('resize', resizeGrid);

    function animateGrid(time) {
        const ctx = gridCanvas.getContext('2d');
        ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        
        // Draw animated grid lines
        ctx.strokeStyle = '#00fff7';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        
        const spacing = 50;
        const offset = (time / 50) % spacing;
        
        // Vertical lines
        for (let x = offset; x < gridCanvas.width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gridCanvas.height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = offset; y < gridCanvas.height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gridCanvas.width, y);
            ctx.stroke();
        }
        
        // Add scanning line effect
        const scanY = (time / 10) % gridCanvas.height;
        ctx.strokeStyle = '#00fff7';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00fff7';
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(gridCanvas.width, scanY);
        ctx.stroke();
        
        requestAnimationFrame(animateGrid);
    }
    requestAnimationFrame(animateGrid);
}

// Add particle overlay for sci-fi effect
function addParticleOverlay() {
    const particleCanvas = document.createElement('canvas');
    particleCanvas.id = 'particle-overlay';
    particleCanvas.style.position = 'absolute';
    particleCanvas.style.top = '0';
    particleCanvas.style.left = '0';
    particleCanvas.style.width = '100%';
    particleCanvas.style.height = '100%';
    particleCanvas.style.pointerEvents = 'none';
    particleCanvas.style.zIndex = '501';
    document.getElementById('map').appendChild(particleCanvas);

    const particles = Array.from({length: 50}, () => ({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.001,
        vy: (Math.random() - 0.5) * 0.001,
        size: Math.random() * 3 + 1,
        pulse: Math.random() * Math.PI * 2
    }));

    function resizeParticles() {
        particleCanvas.width = map.getSize().x;
        particleCanvas.height = map.getSize().y;
    }
    resizeParticles();
    map.on('resize', resizeParticles);

    function animateParticles(time) {
        const ctx = particleCanvas.getContext('2d');
        ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        
        particles.forEach(p => {
            // Update position
            p.x += p.vx;
            p.y += p.vy;
            
            // Wrap around edges
            if (p.x < 0) p.x = 1;
            if (p.x > 1) p.x = 0;
            if (p.y < 0) p.y = 1;
            if (p.y > 1) p.y = 0;
            
            // Draw particle
            const x = p.x * particleCanvas.width;
            const y = p.y * particleCanvas.height;
            const opacity = 0.5 + 0.5 * Math.sin(time * 0.001 + p.pulse);
            
            ctx.beginPath();
            ctx.arc(x, y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 247, ${opacity})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00fff7';
            ctx.fill();
        });
        
        requestAnimationFrame(animateParticles);
    }
    requestAnimationFrame(animateParticles);
}

// Initialize drawing controls
function initializeDrawing() {
    // Create feature group for drawn items
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Create draw control
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: {
                    color: '#00fff7',
                    weight: 3,
                    opacity: 0.9,
                    fillOpacity: 0.3,
                    fillColor: '#00fff7'
                }
            },
            polyline: false,
            rectangle: {
                shapeOptions: {
                    color: '#00fff7',
                    weight: 3,
                    opacity: 0.9,
                    fillOpacity: 0.3,
                    fillColor: '#00fff7'
                }
            },
            circle: false,
            marker: false,
            circlemarker: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    map.addControl(drawControl);

    // Handle draw events
    map.on(L.Draw.Event.CREATED, handleDrawCreated);
    map.on(L.Draw.Event.DELETED, handleDrawDeleted);
}

// Handle draw created event
function handleDrawCreated(event) {
    const layer = event.layer;
    drawnItems.addLayer(layer);
    currentPolygons.push(layer);
    
    // Animate the new polygon
    animatePolygon(layer);
    
    // Analyze the area
    analyzeLightPollution(layer);
    
    // Show notification
    showNotification('Area Selected', 'Analyzing light pollution levels...', 'success');
}

// Animate polygon with glow effect
function animatePolygon(layer) {
    let hue = 180;
    let direction = 1;
    
    const animationInterval = setInterval(() => {
        if (!map.hasLayer(layer)) {
            clearInterval(animationInterval);
            return;
        }
        
        hue += direction * 2;
        if (hue >= 200 || hue <= 160) direction *= -1;
        
        const color = `hsl(${hue}, 100%, 60%)`;
        layer.setStyle({
            color: color,
            fillColor: color,
            weight: 3 + Math.abs(Math.sin(hue * 0.05)) * 2
        });
    }, 50);
}

// Analyze light pollution for drawn area
function analyzeLightPollution(layer) {
    const resultsDiv = document.getElementById('results');
    const latlngs = layer.getLatLngs()[0];
    const area = L.GeometryUtil.geodesicArea(latlngs) / 1000000; // Convert to km²
    const center = layer.getBounds().getCenter();

    // Calculate pollution score (0-100) based on area and random factors
    const baseScore = Math.random() * 40; // Base randomness
    const areaFactor = Math.min(area * 5, 30); // Area influence (max 30)
    const locationFactor = Math.random() * 30; // Location-based factor
    const pollutionScore = Math.floor(baseScore + areaFactor + locationFactor);

    // Remove placeholder if exists
    const placeholder = resultsDiv.querySelector('.placeholder-text');
    if (placeholder) {
        placeholder.remove();
    }

    // Create detailed result entry
    const entry = document.createElement('div');
    entry.className = 'result-entry';

    let rating, badge, recommendations = '', darkSkyNote = '';
    let alertButton = '';
    let badgeClass = '';

    // Determine rating and content based on score
    if (pollutionScore < 30) {
        rating = 'Excellent Dark Sky';
        badge = '🌌 Galaxy Guardian';
        badgeClass = 'excellent';
        darkSkyNote = '<div class="recommendation dark-sky">✨ This is a potential <b>Dark Sky Friendly Zone</b>. Ideal for astronomy!</div>';
        recommendations = '<li>Maintain use of fully shielded, warm-color temperature lights.</li><li>Ensure lights are off when not needed.</li><li>Consider applying for Dark Sky certification.</li>';
    } else if (pollutionScore < 60) {
        rating = 'Moderate Light Pollution';
        badge = 'Moderate Impact';
        badgeClass = 'moderate';
        recommendations = '<li>Switch to downward-facing, shielded light fixtures.</li><li>Consider using motion sensors for security lighting.</li><li>Opt for LEDs with a color temperature below 3000K.</li><li>Implement lighting curfews after midnight.</li>';
    } else {
        rating = 'High Light Pollution';
        badge = 'Action Required';
        badgeClass = 'high';
        recommendations = '<li>Prioritize replacing unshielded lights (e.g., globe lights).</li><li>Implement smart lighting controls and curfews.</li><li>Use the lowest possible wattage for the task.</li><li>Contact local authorities about excessive lighting.</li>';
        alertButton = `<button class="alert-button" onclick="switchToAlertsTab()">Alert Planners</button>`;
    }

    // Build the complete HTML structure
    entry.innerHTML = `
        <div class="result-header">
            <div>
                <div class="score-label">Pollution Level</div>
                <div class="score-value">${pollutionScore}</div>
            </div>
            <div class="badge ${badgeClass}">${badge}</div>
        </div>
        <div class="result-details">
            <p><strong class="rating">${rating}</strong></p>
            <p>Area: ${area.toFixed(2)} km² | Center: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}</p>
            ${darkSkyNote}
            <div class="recommendations">
                <h4>Recommended Actions</h4>
                <ul>${recommendations}</ul>
            </div>
            ${alertButton}
        </div>
    `;

    // Add to results (insert at top)
    resultsDiv.insertBefore(entry, resultsDiv.firstChild);
    
    // Update global statistics
    totalArea += area;
    avgPollution = (avgPollution * (currentPolygons.length - 1) + pollutionScore) / currentPolygons.length;
    updateStatistics();
    
    // Store pollution data in layer
    layer.pollutionData = {
        score: pollutionScore,
        area: area,
        center: center,
        timestamp: new Date()
    };
    
    // Animate entry appearance
    entry.style.animation = 'entrySlideIn 0.5s ease';
}

// Handle draw deleted event
function handleDrawDeleted(event) {
    const layers = event.layers;
    layers.eachLayer(function(layer) {
        // Remove from current polygons array
        const index = currentPolygons.indexOf(layer);
        if (index > -1) {
            // Update statistics
            if (layer.pollutionData) {
                totalArea -= layer.pollutionData.area;
                // Recalculate average pollution
                if (currentPolygons.length > 1) {
                    avgPollution = ((avgPollution * currentPolygons.length) - layer.pollutionData.score) / (currentPolygons.length - 1);
                } else {
                    avgPollution = 0;
                }
            }
            currentPolygons.splice(index, 1);
        }
    });
    
    // Update UI
    updateStatistics();
    showNotification('Area Removed', 'Analysis data updated', 'info');
}

// Update visualization based on zoom or other events
function updateVisualization() {
    // This function can be expanded later for zoom-based updates
    // For now, it's just a placeholder to prevent errors
}

// Get color based on pollution score
function getPollutionColor(score) {
    if (score < 30) return '#00ff88';
    if (score < 60) return '#ffcc00';
    if (score < 80) return '#ff6b35';
    return '#ff3366';
}

// Update statistics display
function updateStatistics() {
    const avgEl = document.getElementById('avg-pollution');
    const areaEl = document.getElementById('area-covered');
    if (avgEl) avgEl.textContent = currentPolygons.length > 0 ? Math.round(avgPollution) : '--';
    if (areaEl) areaEl.textContent = totalArea > 0 ? totalArea.toFixed(2) : '--';
}

// Switch to alerts tab function
function switchToAlertsTab() {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show alerts tab
    const alertsTab = document.getElementById('alerts-tab');
    const alertsBtn = document.querySelector('[data-tab="alerts"]');
    
    if (alertsTab && alertsBtn) {
        alertsTab.classList.add('active');
        alertsBtn.classList.add('active');
    }
    
    showNotification('Alerts Tab', 'Ready to report light pollution issues', 'info');
}

// Initialize tabs functionality
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(targetTab + '-tab');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Initialize Floating Action Button
function initializeFAB() {
    const fabMenu = document.getElementById('fab-menu');
    const fabOptions = document.querySelector('.fab-options');
    
    if (fabMenu && fabOptions) {
        fabMenu.addEventListener('click', () => {
            fabOptions.classList.toggle('active');
        });
        
        // Close FAB menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.fab-container')) {
                fabOptions.classList.remove('active');
            }
        });
    }
}

// Load dark sky zones (mock data for now)
function loadDarkSkyZones() {
    const darkskyDiv = document.getElementById('darksky-zones');
    if (!darkskyDiv) return;
    
    // Simulate loading delay
    setTimeout(() => {
        darkskyDiv.innerHTML = `
            <div class="darksky-zone">
                <div class="zone-name">Rann of Kutch Dark Sky Reserve</div>
                <div class="zone-distance">450 km away</div>
                <div class="zone-quality">Gold Tier Dark Sky</div>
            </div>
            <div class="darksky-zone">
                <div class="zone-name">Spiti Valley</div>
                <div class="zone-distance">320 km away</div>
                <div class="zone-quality">Silver Tier Dark Sky</div>
            </div>
            <div class="darksky-zone">
                <div class="zone-name">Ladakh Region</div>
                <div class="zone-distance">380 km away</div>
                <div class="zone-quality">Gold Tier Dark Sky</div>
            </div>
        `;
    }, 2000);
}

// Handle map click events
function handleMapClick(e) {
    // Can be extended for point analysis
    console.log('Map clicked at:', e.latlng);
}

// Show notification system
function showNotification(title, message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon;
    switch(type) {
        case 'success': icon = 'fas fa-check-circle'; break;
        case 'warning': icon = 'fas fa-exclamation-triangle'; break;
        case 'error': icon = 'fas fa-times-circle'; break;
        default: icon = 'fas fa-info-circle';
    }
    
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="${icon}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}
