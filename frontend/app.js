const API = '/api';
let token = localStorage.getItem('aerosense_token');
let me = null;
let map = null;
let watchId = null;
let familyMarkers = new Map();
let currentAqiChart = null;
let currentSearchedPlace = null;
let searchDebounceTimer = null;
let isSidebarOpen = false;
let lastTelemetryData = null;

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

// ============================================================================
// Theme & Toast System
// ============================================================================
function initTheme() {
  const saved = localStorage.getItem('aerosense_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('aerosense_theme', next);
  toast(`Theme switched to ${next} mode`, 'info');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerHTML = next === 'dark' ? '☀️' : '🌙';
}

function toast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';
  t.innerHTML = `<span>${icon}</span> <div>${esc(message)}</div>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(100%)';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ============================================================================
// API Helper
// ============================================================================
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(API + path, { ...opts, headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

// ============================================================================
// Mobile Drawer & Voice Assistant
// ============================================================================
function toggleMobileSidebar() {
  isSidebarOpen = !isSidebarOpen;
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.toggle('open', isSidebarOpen);
  if (backdrop) backdrop.classList.toggle('open', isSidebarOpen);
}

let isSpeakingVoice = false;

function toggleVoiceAdvisory() {
  if (!('speechSynthesis' in window)) {
    toast('Voice speech is not supported in this browser.', 'warn');
    return;
  }

  if (window.speechSynthesis.speaking || isSpeakingVoice) {
    window.speechSynthesis.cancel();
    isSpeakingVoice = false;
    updateVoiceButtons(false);
    toast('🔇 Voice safety briefing stopped.', 'info');
    return;
  }

  window.speechSynthesis.cancel();
  const place = currentSearchedPlace?.name || 'your location';
  const score = lastTelemetryData?.risk?.score ?? 35;
  const level = lastTelemetryData?.risk?.level ?? 'moderate';
  const pm25 = lastTelemetryData?.current?.pm2_5 ?? 15;
  const advisory = lastTelemetryData?.risk?.advisory || 'Air quality is normal.';

  const text = `AeroSense Atmospheric Safety Report for ${place}. Exposure score is ${score} out of 100, which is ${level} risk. Particulate matter PM 2.5 is currently ${pm25} micrograms per cubic meter. ${advisory}`;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.05;

  utterance.onend = () => {
    isSpeakingVoice = false;
    updateVoiceButtons(false);
  };
  utterance.onerror = () => {
    isSpeakingVoice = false;
    updateVoiceButtons(false);
  };

  isSpeakingVoice = true;
  window.speechSynthesis.speak(utterance);
  updateVoiceButtons(true);
  toast('🔊 Playing voice safety briefing (click again to stop)', 'info');
}

function updateVoiceButtons(playing) {
  const btns = document.querySelectorAll('.voice-advisory-btn');
  btns.forEach(b => {
    if (playing) {
      b.innerHTML = '⏹ Stop Voice';
      b.classList.add('playing');
    } else {
      b.innerHTML = '🔊 Voice Safety';
      b.classList.remove('playing');
    }
  });
  const sidebarBtn = document.getElementById('sidebarVoiceBtn');
  if (sidebarBtn) {
    sidebarBtn.innerHTML = playing ? '⏹' : '🔊';
    sidebarBtn.title = playing ? 'Stop Voice Briefing' : 'Listen to Voice Briefing';
  }
}

window.speakCurrentAdvisory = toggleVoiceAdvisory;
window.toggleVoiceAdvisory = toggleVoiceAdvisory;

// ============================================================================
// Professional Left-Sidebar Layout
// ============================================================================
function layout(content, activeRoute = 'home') {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const themeIcon = currentTheme === 'dark' ? '☀️' : '🌙';

  app.innerHTML = `
    <div class="app-shell">
      <!-- Backdrop for mobile drawer -->
      <div id="sidebarBackdrop" class="sidebar-backdrop" onclick="toggleMobileSidebar()"></div>

      <!-- Professional Left Sidebar -->
      <aside id="sidebar" class="sidebar">
        <div class="sidebar-main-scroll">
          <div class="sidebar-header">
            <div class="sidebar-brand-wrapper" onclick="go('home')">
              <img src="/icon.png" alt="AeroSense" class="brand-logo-img">
              <div>
                <div class="brand-title">AeroSense</div>
                <div class="brand-sub">● Live Intelligence</div>
              </div>
            </div>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-section-title">Atmospheric Monitoring</div>
            <button class="sidebar-btn ${activeRoute==='home'?'active':''}" onclick="go('home')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">🏠</span> <span>Overview & Map</span></span>
            </button>
            <button class="sidebar-btn ${activeRoute==='tracking'?'active':''}" onclick="go('tracking')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">📡</span> <span>Global AQI & Radar</span></span>
            </button>
            <button class="sidebar-btn ${activeRoute==='pollen'?'active':''}" onclick="go('pollen')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">🌿</span> <span>Pollen & Allergen Index</span></span>
              <span class="pill low" style="font-size:10px">Live</span>
            </button>
            <button class="sidebar-btn ${activeRoute==='planner'?'active':''}" onclick="go('planner')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">🏃‍♂️</span> <span>Clean Air Planner</span></span>
            </button>

            <div class="nav-section-title" style="margin-top:8px">Safety & Intelligence</div>
            <button class="sidebar-btn ${activeRoute==='disease'?'active':''}" onclick="go('disease')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">🦠</span> <span>WHO Disease Spread</span></span>
            </button>
            <button class="sidebar-btn ${activeRoute==='precautions'?'active':''}" onclick="go('precautions')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">🛡️</span> <span>Health Precautions</span></span>
            </button>
            <button class="sidebar-btn ${activeRoute==='family'?'active':''}" onclick="go('family')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">👨‍👩‍👧‍👦</span> <span>Family & SMS Radar</span></span>
            </button>

            <div class="nav-section-title" style="margin-top:8px">Mobile & Sharing</div>
            <button class="sidebar-btn" onclick="showQrCodeModal()">
              <span class="sidebar-btn-content"><span class="sidebar-icon">📱</span> <span>Mobile App & QR Code</span></span>
              <span class="pill low" style="font-size:10px">Scan</span>
            </button>

            <div class="nav-section-title" style="margin-top:8px">Account & Settings</div>
            <button class="sidebar-btn ${activeRoute==='profile'?'active':''}" onclick="go('profile')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">👤</span> <span>Health Profile</span></span>
            </button>
            <button class="sidebar-btn ${activeRoute==='settings'?'active':''}" onclick="go('settings')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">⚙️</span> <span>Settings & Privacy</span></span>
            </button>
            <button class="sidebar-btn ${activeRoute==='notifications'?'active':''}" onclick="go('notifications')">
              <span class="sidebar-btn-content"><span class="sidebar-icon">🔔</span> <span>Notifications</span></span>
              <span id="sidebarBellDot" class="dot" style="display:none"></span>
            </button>
            ${me?.role==='expert' ? `
              <button class="sidebar-btn ${activeRoute==='expert'?'active':''}" onclick="go('expert')">
                <span class="sidebar-btn-content"><span class="sidebar-icon">🩺</span> <span>Expert Portal</span></span>
              </button>
            ` : ''}
          </nav>
        </div>

        <!-- Sidebar Footer -->
        <div class="sidebar-footer">
          ${me ? `
            <div class="user-profile-mini" onclick="go('profile')" title="View & Edit Health Profile">
              <div class="user-avatar-circle">${esc(me.name ? me.name[0].toUpperCase() : 'U')}</div>
              <div style="overflow:hidden">
                <div style="font-weight:700;font-size:13.5px;color:var(--text-main);white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${esc(me.name || me.email)}</div>
                <div class="muted" style="font-size:11.5px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${esc(me.phone || me.email)}</div>
              </div>
            </div>
          ` : ''}

          <div class="sidebar-actions-row">
            <button class="sos-button" style="flex:1" onclick="triggerEmergencySOS()" title="Broadcast Emergency SOS to Family via SMS">🚨 SOS</button>
            <button id="themeToggleBtn" class="btn secondary sm" style="padding:8px 10px" title="Toggle Dark/Light Mode" onclick="toggleTheme()">${themeIcon}</button>
            <button class="btn secondary sm" style="padding:8px 10px" title="Mobile QR Scanner & Install App" onclick="showQrCodeModal()">📱</button>
            <button class="btn secondary sm" style="padding:8px 10px" title="Listen to Voice Safety Briefing" onclick="speakCurrentAdvisory()">🔊</button>
            <button class="btn secondary sm" style="padding:8px 10px" title="Print Emergency Medical Passport" onclick="exportMedicalPassport()">📄</button>
            <button class="btn secondary sm" style="padding:8px 10px" title="Logout" onclick="logout()">🚪</button>
          </div>
        </div>
      </aside>

      <!-- Main Content Scrolling Wrapper -->
      <div class="main-wrapper">
        <!-- Mobile Topbar with Hamburger -->
        <div class="mobile-topbar">
          <button class="btn secondary sm" onclick="toggleMobileSidebar()">☰ Menu</button>
          <div style="font-weight:800;font-size:17px;color:var(--primary)" onclick="showQrCodeModal()">AeroSense 📱</div>
          <button class="sos-button" onclick="triggerEmergencySOS()">🚨 SOS</button>
        </div>

        <div class="main-content">
          ${content}
        </div>

        <footer class="footer">
          <div style="font-weight:700;color:var(--text-main);margin-bottom:6px">AeroSense • Global Atmospheric Intelligence & Family Safety Platform</div>
          <div>Live telemetry from Open-Meteo & WHO • Maps from OpenStreetMap • Protected with Emergency SMS Dispatch</div>
          <small style="display:block;margin-top:6px;color:var(--text-muted)">Atmospheric vulnerability estimate only • Not a medical prescription or diagnostic system</small>
        </footer>
      </div>
    </div>
  `;
  loadBell();
}

// ============================================================================
// Auth Pages
// ============================================================================
function loginPage() {
  app.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth card">
        <img src="/icon.png" alt="AeroSense" style="width:64px;height:64px;border-radius:16px;box-shadow:0 8px 24px var(--primary-glow);display:block;margin:0 auto 16px auto">
        <h1 style="text-align:center">AeroSense Sign In</h1>
        <p class="muted" style="text-align:center">Access global atmospheric air quality tracking, family safety radar, and live WHO health intelligence.</p>
        <form id="login" style="margin-top:18px">
          <div class="field">
            <label>Email Address</label>
            <input id="email" type="email" placeholder="name@example.com" required autocomplete="email">
          </div>
          <div class="field">
            <label>Password</label>
            <input id="password" type="password" minlength="8" placeholder="••••••••" required autocomplete="current-password">
          </div>
          <button class="btn" style="width:100%;margin-top:8px">Sign In to AeroSense</button>
        </form>
        <p id="msg" style="margin-top:14px"></p>
        <hr style="border:0;border-top:1px solid var(--border-subtle);margin:22px 0">
        <div style="text-align:center">
          <span class="muted">New to AeroSense? </span>
          <button class="btn secondary sm" onclick="registerPage()">Create an account</button>
        </div>
      </div>
    </div>
  `;
  const form = document.getElementById('login');
  const msg = document.getElementById('msg');
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const d = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      token = d.token;
      localStorage.setItem('aerosense_token', token);
      me = d.user;
      toast(`Welcome back, ${me.name}!`, 'success');
      go('home');
    } catch (err) {
      msg.innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

function registerPage() {
  app.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth card" style="max-width:550px">
        <img src="/icon.png" alt="AeroSense" style="width:64px;height:64px;border-radius:16px;box-shadow:0 8px 24px var(--primary-glow);display:block;margin:0 auto 16px auto">
        <h1 style="text-align:center">Create AeroSense Account</h1>
        <p class="muted" style="text-align:center">Join AeroSense to monitor global atmospheric exposure and protect your family with automated risk alerts.</p>
        <form id="reg" style="margin-top:18px">
          <div class="field">
            <label>Full Name</label>
            <input id="name" placeholder="e.g. Jane Doe" required autocomplete="name">
          </div>
          <div class="row">
            <div class="field" style="flex:1">
              <label>Email Address</label>
              <input id="email" type="email" placeholder="jane@example.com" required autocomplete="email">
            </div>
            <div class="field" style="flex:1">
              <label>Phone (For Family SMS Alerts)</label>
              <input id="phone" type="tel" placeholder="+1 (555) 019-2834" autocomplete="tel">
            </div>
          </div>
          <div class="row">
            <div class="field" style="flex:1">
              <label>Age</label>
              <input id="age" type="number" min="1" max="120" placeholder="e.g. 28">
            </div>
            <div class="field" style="flex:1">
              <label>Gender</label>
              <select id="gender">
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div class="field" style="flex:1">
              <label>Blood Group</label>
              <select id="bloodGroup">
                <option value="">Select</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>Account Type</label>
            <select id="role">
              <option value="user">User / Family Member</option>
              <option value="expert">Professional Health & Environmental Expert</option>
            </select>
          </div>
          <div class="field">
            <label>Password (Min. 8 characters)</label>
            <input id="password" type="password" minlength="8" placeholder="••••••••" required autocomplete="new-password">
          </div>
          <button class="btn" style="width:100%;margin-top:12px;padding:12px">Complete Registration</button>
        </form>
        <p id="msg" style="margin-top:14px"></p>
        <hr style="border:0;border-top:1px solid var(--border-subtle);margin:22px 0">
        <div style="text-align:center;padding-bottom:10px">
          <span class="muted">Already registered? </span>
          <button class="btn secondary sm" onclick="loginPage()">Back to sign in</button>
        </div>
      </div>
    </div>
  `;

  const reg = document.getElementById('reg');
  const msg = document.getElementById('msg');
  reg.onsubmit = async e => {
    e.preventDefault();
    try {
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const phone = document.getElementById('phone').value;
      const age = document.getElementById('age').value;
      const gender = document.getElementById('gender').value;
      const bloodGroup = document.getElementById('bloodGroup').value;
      const role = document.getElementById('role').value;
      const password = document.getElementById('password').value;
      const d = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, age, gender, bloodGroup, role, password })
      });
      token = d.token;
      localStorage.setItem('aerosense_token', token);
      me = d.user;
      toast(`Account created! Welcome to AeroSense, ${me.name}!`, 'success');
      go('home');
    } catch (err) {
      msg.innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

async function loadMe() {
  if (!token) return false;
  try {
    me = (await api('/auth/me')).user;
    return true;
  } catch {
    logout(false);
    return false;
  }
}

function logout(redir = true) {
  token = null;
  me = null;
  localStorage.removeItem('aerosense_token');
  if (redir) {
    toast('You have been logged out.', 'info');
    loginPage();
  }
}

async function go(route) {
  if (isSidebarOpen) toggleMobileSidebar();
  if (!token && route !== 'login' && route !== 'register') return loginPage();
  if (route === 'home') return home();
  if (route === 'tracking') return tracking();
  if (route === 'pollen') return pollen();
  if (route === 'planner') return planner();
  if (route === 'disease') return disease();
  if (route === 'precautions') return precautions();
  if (route === 'family') return family();
  if (route === 'profile') return profile();
  if (route === 'settings') return settings();
  if (route === 'notifications') return notificationsPage();
  if (route === 'expert') return expert();
}

// ============================================================================
// Global City Search Component
// ============================================================================
function renderCitySearchBar() {
  return `
    <div class="city-search-container">
      <div class="city-search-input-wrapper">
        <span style="font-size:16px;margin-right:4px">🔍</span>
        <input id="citySearchInput" class="city-search-input" placeholder="Search any city globally (e.g. New York, Tokyo, London, Delhi, Paris, Sydney, Dubai)..." autocomplete="off">
        <button id="citySearchBtn" class="city-search-btn">Search Location</button>
      </div>
      <div id="citySuggestions" class="city-suggestions" style="display:none"></div>
      <div class="city-presets">
        <span style="font-size:11.5px;font-weight:700;color:var(--text-muted);display:inline-flex;align-items:center">Popular:</span>
        <button class="preset-chip" onclick="searchAndLoadCity('New York', 40.7128, -74.0060, 'United States')">🗽 New York</button>
        <button class="preset-chip" onclick="searchAndLoadCity('London', 51.5074, -0.1278, 'United Kingdom')">🎡 London</button>
        <button class="preset-chip" onclick="searchAndLoadCity('Tokyo', 35.6762, 139.6503, 'Japan')">🗼 Tokyo</button>
        <button class="preset-chip" onclick="searchAndLoadCity('Delhi', 28.6139, 77.2090, 'India')">🕌 Delhi</button>
        <button class="preset-chip" onclick="searchAndLoadCity('Paris', 48.8566, 2.3522, 'France')">🗼 Paris</button>
        <button class="preset-chip" onclick="searchAndLoadCity('Sydney', -33.8688, 151.2093, 'Australia')">🏖️ Sydney</button>
        <button class="preset-chip" onclick="searchAndLoadCity('Singapore', 1.3521, 103.8198, 'Singapore')">🏙️ Singapore</button>
        <button class="preset-chip" onclick="searchAndLoadCity('Dubai', 25.2048, 55.2708, 'UAE')">🏙️ Dubai</button>
        <button class="preset-chip" style="background:var(--primary-light);color:var(--primary);border-color:var(--primary)" onclick="getUserGpsLocation()">📍 My Current GPS</button>
      </div>
    </div>
  `;
}

function bindCitySearchEvents() {
  const input = document.getElementById('citySearchInput');
  const btn = document.getElementById('citySearchBtn');
  const suggestionsBox = document.getElementById('citySuggestions');
  if (!input || !suggestionsBox) return;

  const performSearch = async query => {
    const q = query.trim();
    if (q.length < 2) {
      suggestionsBox.style.display = 'none';
      return;
    }
    try {
      const d = await api(`/geocoding/search?q=${encodeURIComponent(q)}`);
      if (d.results && d.results.length > 0) {
        suggestionsBox.innerHTML = d.results.map(r => `
          <div class="city-suggestion-item" onclick="selectCityFromSearch('${esc(r.name)}', ${r.lat}, ${r.lon}, '${esc(r.country)}')">
            <div>
              <b>${esc(r.name)}</b>
              <span class="muted" style="font-size:12px;margin-left:6px">${esc(r.admin1 ? r.admin1 + ', ' : '')}${esc(r.country)}</span>
            </div>
            <span class="pill low" style="font-size:11px">📍 ${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}</span>
          </div>
        `).join('');
        suggestionsBox.style.display = 'block';
      } else {
        suggestionsBox.innerHTML = `<div class="city-suggestion-item muted">No places found matching "${esc(q)}"</div>`;
        suggestionsBox.style.display = 'block';
      }
    } catch {
      suggestionsBox.style.display = 'none';
    }
  };

  input.oninput = e => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => performSearch(e.target.value), 280);
  };

  btn.onclick = () => performSearch(input.value);

  document.addEventListener('click', e => {
    if (!e.target.closest('.city-search-container')) {
      suggestionsBox.style.display = 'none';
    }
  });
}

window.selectCityFromSearch = function(name, lat, lon, country) {
  const suggestionsBox = document.getElementById('citySuggestions');
  if (suggestionsBox) suggestionsBox.style.display = 'none';
  const input = document.getElementById('citySearchInput');
  if (input) input.value = `${name}, ${country}`;
  searchAndLoadCity(name, lat, lon, country);
};

window.searchAndLoadCity = async function(name, lat, lon, country = '') {
  currentSearchedPlace = { name, lat, lon, country };
  toast(`Loading atmospheric telemetry for ${name}...`, 'info');

  if (map) {
    map.flyTo([lat, lon], 12, { duration: 1.2 });
  }

  try {
    const atmo = await api(`/atmosphere?lat=${lat}&lon=${lon}`);
    lastTelemetryData = atmo;
    updateAtmosphericUI(atmo, name, lat, lon);
    loadHospitals(lat, lon);
  } catch (e) {
    toast(`Unable to retrieve live telemetry for ${name}: ${e.message}`, 'error');
  }
};

window.getUserGpsLocation = function() {
  if (navigator.geolocation) {
    toast('Accessing GPS coordinates...', 'info');
    navigator.geolocation.getCurrentPosition(
      p => searchAndLoadCity('Your Current Location', p.coords.latitude, p.coords.longitude, 'Live GPS'),
      () => toast('GPS access was denied. Using default map coordinate.', 'warn')
    );
  }
};

function updateAtmosphericUI(d, placeName, lat, lon) {
  const risk = d.risk || { score: 0, level: 'low' };
  const curr = d.current || {};

  const riskEl = document.getElementById('risk');
  const riskText = document.getElementById('riskText');
  const locationLabel = document.getElementById('activeLocationLabel');

  if (riskEl) {
    riskEl.textContent = `${risk.score}/100`;
    riskEl.className = `stat ${risk.level==='high'?'danger':risk.level==='moderate'?'warn':'ok'}`;
  }
  if (riskText) {
    riskText.innerHTML = `<b>${risk.level.toUpperCase()} EXPOSURE</b> at ${esc(placeName)} (${lat.toFixed(3)}, ${lon.toFixed(3)}). ${esc(risk.advisory || '')}`;
  }
  if (locationLabel) {
    locationLabel.innerHTML = `📍 <b>${esc(placeName)}</b> (Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)})`;
  }

  const envBox = document.getElementById('env');
  if (envBox) {
    envBox.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <div class="stat ${risk.level==='high'?'danger':risk.level==='moderate'?'warn':'ok'}">${risk.score}<span style="font-size:18px">/100</span></div>
          <span class="pill ${risk.level}">${esc(risk.level)} Exposure</span>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:18px">${curr.temperature_2m ?? '—'}°C</div>
          <div class="muted" style="font-size:11.5px">Humidity: ${curr.relative_humidity_2m ?? '—'}%</div>
        </div>
      </div>
      <div style="font-size:12.5px;color:var(--text-sub);line-height:1.6">
        • <b>PM2.5:</b> ${curr.pm2_5 ?? '—'} µg/m³<br>
        • <b>PM10:</b> ${curr.pm10 ?? '—'} µg/m³<br>
        • <b>Nitrogen Dioxide (NO₂):</b> ${curr.nitrogen_dioxide ?? '—'} µg/m³<br>
        • <b>Ozone (O₃):</b> ${curr.ozone ?? '—'} µg/m³
      </div>
    `;
  }

  renderPollutantChart(curr);
}

// ============================================================================
// Home Dashboard
// ============================================================================
let userLat = 28.6139, userLon = 77.2090;

async function home() {
  layout(`
    <section class="hero">
      <div style="display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:99px;background:rgba(255,255,255,0.15);font-size:12.5px;font-weight:700;margin-bottom:12px">
        <span>🟢 Global Atmospheric Intelligence Active</span>
      </div>
      <h1>Global Atmospheric Risk & Family Safety Dashboard</h1>
      <p>Real-time continuous environmental modeling for any location worldwide, automated family emergency SMS dispatching, live WHO outbreak surveillance, and mapped hospital discovery.</p>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn" style="background:white;color:var(--primary);box-shadow:0 4px 14px rgba(0,0,0,0.15)" onclick="go('tracking')">
          📡 Explore Global Radar
        </button>
        <button class="btn secondary" style="background:rgba(255,255,255,0.15);color:white;border-color:rgba(255,255,255,0.3)" onclick="go('planner')">
          🏃‍♂️ Clean Air Workout Planner
        </button>
        <button class="btn secondary" style="background:rgba(255,255,255,0.15);color:white;border-color:rgba(255,255,255,0.3)" onclick="speakCurrentAdvisory()">
          🔊 Voice Safety Briefing
        </button>
        <button class="sos-button" onclick="triggerEmergencySOS()">🚨 Emergency SOS</button>
      </div>
    </section>

    <!-- Global Search Bar -->
    <div class="card" style="margin-bottom:20px">
      <h3 style="margin-bottom:10px">🌍 Detect Air Quality for Any Place Worldwide</h3>
      ${renderCitySearchBar()}
    </div>

    <!-- Top KPI Stats Grid -->
    <div class="grid">
      <div class="card stat-card span-4">
        <div class="stat-header">
          <div class="muted">Live Exposure Score</div>
          <div class="stat-icon">📈</div>
        </div>
        <div id="risk" class="stat">—</div>
        <p id="riskText" class="muted">Select a city or search above to calculate.</p>
      </div>

      <div class="card stat-card span-4">
        <div class="stat-header">
          <div class="muted">WHO Disease Surveillance</div>
          <div class="stat-icon" style="background:var(--secondary-light);color:var(--secondary)">🦠</div>
        </div>
        <div id="whoCount" class="stat" style="color:var(--secondary)">—</div>
        <p class="muted">Active international outbreaks monitored in real time.</p>
      </div>

      <div class="card stat-card span-4">
        <div class="stat-header">
          <div class="muted">Family on Radar</div>
          <div class="stat-icon" style="background:var(--accent-family-light);color:var(--accent-family)">👨‍👩‍👧</div>
        </div>
        <div id="familyCount" class="stat" style="color:var(--accent-family)">—</div>
        <p class="muted">Connected family members protected with SMS alerts.</p>
      </div>

      <!-- Main Risk Map Section -->
      <div class="card span-8">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <h2>Atmospheric & Family Radar Map</h2>
            <div id="activeLocationLabel" class="muted" style="font-size:12.5px;margin-top:2px">📍 Click anywhere on map to inspect localized air quality</div>
          </div>
          <button class="btn secondary sm" onclick="centerMapOnUser()">📍 Center My Position</button>
        </div>
        <div id="map"></div>
      </div>

      <!-- Family on Radar & Emergency Healthcare Panel -->
      <div class="card span-4">
        <h2>Family Members on Radar</h2>
        <p class="muted" style="margin-bottom:14px;font-size:13px">Click any family member to locate position and atmospheric risk.</p>
        <div id="homeFamilyList" class="list" style="max-height:180px;overflow-y:auto">
          <div class="muted">Loading family radar…</div>
        </div>
        
        <h3 style="margin-top:18px">Nearby Hospitals & Emergency Rooms</h3>
        <div id="homeHospitals" class="list" style="max-height:220px;overflow-y:auto;margin-top:8px"></div>
      </div>
    </div>
  `, 'home');

  bindCitySearchEvents();

  // Load KPI Stats
  try {
    const d = await api('/family');
    const accepted = d.connections.filter(x => x.status === 'accepted');
    const el = document.getElementById('familyCount');
    if (el) el.textContent = accepted.length;
  } catch {}

  try {
    const d = await api('/who/outbreaks');
    const el = document.getElementById('whoCount');
    if (el) el.textContent = d.count;
  } catch {}

  // Init Map
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      p => {
        initMapWithFamily(p.coords.latitude, p.coords.longitude);
        searchAndLoadCity('Your Current Location', p.coords.latitude, p.coords.longitude, 'Live GPS');
      },
      () => {
        initMapWithFamily(28.6139, 77.2090);
        searchAndLoadCity('Delhi', 28.6139, 77.2090, 'India');
      }
    );
  } else {
    initMapWithFamily(28.6139, 77.2090);
    searchAndLoadCity('Delhi', 28.6139, 77.2090, 'India');
  }
}

function centerMapOnUser() {
  if (map && userLat && userLon) {
    map.flyTo([userLat, userLon], 13);
  }
}

function flyToFamilyMember(lat, lon, name) {
  if (!map) return;
  map.flyTo([lat, lon], 14, { duration: 1.2 });
  const marker = familyMarkers.get(name);
  if (marker) {
    setTimeout(() => marker.openPopup(), 1300);
  }
  toast(`Viewing ${name}'s atmospheric position`, 'info');
}

async function initMapWithFamily(lat, lon) {
  userLat = lat; userLon = lon;
  if (!window.L) return;
  
  setTimeout(async () => {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    
    if (map) {
      map.remove();
      map = null;
    }
    
    map = L.map('map').setView([lat, lon], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const userIcon = L.divIcon({
      className: 'user-map-pin-wrapper',
      html: `<div class="user-map-pin" title="Active Sensor Location"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    L.marker([lat, lon], { icon: userIcon }).addTo(map).bindPopup('<b>📍 Active Sensor Node</b><br>Coordinates: ' + lat.toFixed(3) + ', ' + lon.toFixed(3)).openPopup();

    map.on('click', async e => {
      const clickLat = e.latlng.lat;
      const clickLon = e.latlng.lng;
      toast(`Inspecting air quality at [${clickLat.toFixed(3)}, ${clickLon.toFixed(3)}]`, 'info');
      searchAndLoadCity(`Custom Coordinate (${clickLat.toFixed(3)}, ${clickLon.toFixed(3)})`, clickLat, clickLon, 'Map Pin');
    });

    try {
      const d = await api(`/atmosphere/grid?lat=${lat}&lon=${lon}`);
      d.points.forEach(p => {
        const color = p.risk.level === 'high' ? '#ef4444' : p.risk.level === 'moderate' ? '#f59e0b' : '#0284c7';
        L.circle([p.lat, p.lon], {
          radius: 3500,
          color,
          fillColor: color,
          fillOpacity: 0.16,
          weight: 1.5
        }).addTo(map).bindPopup(`
          <div style="font-family:var(--font-body);padding:4px">
            <b>Atmospheric Risk Zone</b><br>
            Score: <b>${p.risk.score}/100</b> (${p.risk.level.toUpperCase()})<br>
            <small>Source: Open-Meteo Air Quality</small>
          </div>
        `);
      });
    } catch {}

    await loadFamilyPinsOnMap(map);
  }, 0);
}

async function loadFamilyPinsOnMap(leafletMap) {
  familyMarkers.clear();
  const listEl = document.getElementById('homeFamilyList') || document.getElementById('trackingFamilyList');
  
  try {
    const d = await api('/tracking/family');
    const active = (d.locations || []).filter(x => x.location && x.location.lat && x.location.lon);
    
    if (listEl) {
      if (!active.length) {
        listEl.innerHTML = `<div class="muted" style="padding:10px 0">No family members sharing location. Invite in <a href="javascript:go('family')">Family</a>.</div>`;
      } else {
        listEl.innerHTML = '';
      }
    }

    for (const item of active) {
      const { user: fUser, location: fLoc } = item;
      const fName = fUser?.name || 'Family Member';
      const initial = fName[0].toUpperCase();
      
      let fRisk = { score: 45, level: 'moderate' };
      try {
        const atmo = await api(`/atmosphere?lat=${fLoc.lat}&lon=${fLoc.lon}`);
        if (atmo.risk) fRisk = atmo.risk;
      } catch {}

      const riskClass = fRisk.level === 'high' ? 'high-risk' : fRisk.level === 'moderate' ? 'mod-risk' : 'low-risk';
      const badgeClass = fRisk.level === 'high' ? 'high' : fRisk.level === 'moderate' ? 'mod' : 'low';

      const familyIcon = L.divIcon({
        className: 'family-pin-wrapper',
        html: `
          <div class="family-map-pin ${riskClass}" title="${esc(fName)} (${fRisk.score}/100 Risk)">
            <div class="family-pin-avatar">${initial}</div>
            <span>${esc(fName)}</span>
            <span class="family-pin-badge ${badgeClass}">${fRisk.score}</span>
          </div>
        `,
        iconSize: [120, 32],
        iconAnchor: [60, 16]
      });

      const marker = L.marker([fLoc.lat, fLoc.lon], { icon: familyIcon }).addTo(leafletMap);
      marker.bindPopup(`
        <div style="font-family:var(--font-body);padding:6px">
          <div style="font-weight:800;font-size:15px;color:var(--text-main)">👨‍👩‍👧 ${esc(fName)}</div>
          <div class="muted" style="font-size:12px">${esc(fUser?.phone ? '📱 ' + fUser.phone : fUser?.email)}</div>
          <div style="margin:8px 0;padding:6px 10px;border-radius:8px;background:${fRisk.level==='high'?'#fee2e2':fRisk.level==='moderate'?'#fef3c7':'#dcfce7'}">
            <b>Atmospheric Risk: ${fRisk.score}/100</b> (${fRisk.level.toUpperCase()})
          </div>
          <button class="btn sm purple" style="width:100%" onclick="flyToFamilyMember(${fLoc.lat}, ${fLoc.lon}, '${esc(fName)}')">
            🎯 Zoom to ${esc(fName)}
          </button>
        </div>
      `);

      familyMarkers.set(fName, marker);

      if (listEl) {
        const itemEl = document.createElement('div');
        itemEl.className = 'family-radar-item';
        itemEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px">
            <div class="family-radar-avatar">${initial}</div>
            <div>
              <div style="font-weight:700;font-size:13.5px">${esc(fName)}</div>
              <div class="muted" style="font-size:11.5px">Risk: <b style="color:${fRisk.level==='high'?'var(--danger)':fRisk.level==='moderate'?'var(--warn)':'var(--ok)'}">${fRisk.score}/100 (${fRisk.level})</b></div>
            </div>
          </div>
          <span class="pill ${fRisk.level}" style="font-size:11px">${fRisk.level}</span>
        `;
        itemEl.onclick = () => flyToFamilyMember(fLoc.lat, fLoc.lon, fName);
        listEl.appendChild(itemEl);
      }
    }

    // Render Registered Kids School Locations
    if (d.kids && d.kids.length) {
      for (const kid of d.kids) {
        let kRisk = { score: 35, level: 'low' };
        try {
          const atmo = await api(`/atmosphere?lat=${kid.lat}&lon=${kid.lon}`);
          if (atmo.risk) kRisk = atmo.risk;
        } catch {}

        const schoolIcon = L.divIcon({
          className: 'school-pin-wrapper',
          html: `
            <div class="family-map-pin ${kRisk.level==='high'?'high-risk':kRisk.level==='moderate'?'mod-risk':'low-risk'}" style="border-color:#10b981" title="${esc(kid.name)}'s School (${esc(kid.schoolName)})">
              <div class="family-pin-avatar" style="background:#10b981">🎒</div>
              <span>${esc(kid.name)}'s School</span>
              <span class="family-pin-badge ${kRisk.level==='high'?'high':kRisk.level==='moderate'?'mod':'low'}">${kRisk.score}</span>
            </div>
          `,
          iconSize: [140, 32],
          iconAnchor: [70, 16]
        });

        const sMarker = L.marker([kid.lat, kid.lon], { icon: schoolIcon }).addTo(leafletMap);
        sMarker.bindPopup(`
          <div style="font-family:var(--font-body);padding:6px">
            <div style="font-weight:800;font-size:15px;color:#10b981">🎒 ${esc(kid.name)} • ${esc(kid.schoolName)}</div>
            <div class="muted" style="font-size:12px">Grade: ${esc(kid.grade || 'N/A')} • Age: ${kid.age || 'N/A'}</div>
            ${kid.allergies?.length ? `<div style="font-size:11.5px;color:var(--danger);margin:4px 0">⚠️ Sensitivities: ${esc(kid.allergies.join(', '))}</div>` : ''}
            <div style="margin:8px 0;padding:6px 10px;border-radius:8px;background:${kRisk.level==='high'?'#fee2e2':kRisk.level==='moderate'?'#fef3c7':'#dcfce7'}">
              <b>School Air Exposure: ${kRisk.score}/100</b> (${kRisk.level.toUpperCase()})
            </div>
            <button class="btn sm" style="width:100%;background:#10b981" onclick="flyToFamilyMember(${kid.lat}, ${kid.lon}, '${esc(kid.name)}')">
              🎯 Zoom to ${esc(kid.name)}'s School
            </button>
          </div>
        `);

        familyMarkers.set(kid.name, sMarker);
      }
    }
  } catch {}
}


// ============================================================================
// Global Tracking & City AQI Explorer
// ============================================================================
async function tracking() {
  layout(`
    <section class="hero">
      <h1>Global Atmospheric Radar & Live GPS Tracking</h1>
      <p>Search air quality in any city worldwide or stream live GPS sensor telemetry to assess personalized infection-susceptibility and map nearest hospitals.</p>
      <div class="row">
        <button class="btn" id="start" style="background:#ffffff;color:var(--primary)">▶ Start Live GPS Tracking</button>
        <button class="btn secondary" id="stop" style="background:rgba(255,255,255,0.15);color:white;border-color:rgba(255,255,255,0.3)">⏹ Stop Tracking</button>
        <button class="sos-button" onclick="triggerEmergencySOS()">🚨 Send Emergency SOS</button>
      </div>
    </section>

    <!-- Global Search -->
    <div class="card" style="margin-bottom:20px">
      <h3>🌍 Detect Air Quality for Any Place or City</h3>
      ${renderCitySearchBar()}
    </div>

    <div class="grid">
      <!-- Interactive Map -->
      <div class="card span-8">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h2>Live Satellite Position & Atmospheric Zones</h2>
          <span id="trackingBadge" class="pill low">GPS Standby</span>
        </div>
        <div id="map"></div>
      </div>

      <!-- Environment Telemetry & Family Radar Panel -->
      <div class="card span-4">
        <h2>Live Environment Metrics</h2>
        <div id="env" style="margin-bottom:16px">
          <div class="notice">Select any city above or click <b>"Start Live GPS Tracking"</b> to stream localized telemetry.</div>
        </div>

        <h3 style="margin-top:18px">Family Radar</h3>
        <div id="trackingFamilyList" class="list" style="max-height:150px;overflow-y:auto;margin-bottom:18px">
          <div class="muted" style="font-size:12px">Family members sharing location will show here.</div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
          <h3>Nearby Hospitals</h3>
          <select id="hospitalRadius" style="padding:4px 8px;font-size:12px;border-radius:6px" onchange="loadHospitals(userLat, userLon)">
            <option value="3000">3 km</option>
            <option value="5000" selected>5 km</option>
            <option value="10000">10 km</option>
            <option value="15000">15 km</option>
          </select>
        </div>
        <div id="hospitals" class="list" style="max-height:220px;overflow-y:auto;margin-top:8px">
          <div class="muted">Loading emergency healthcare centers…</div>
        </div>
      </div>

      <!-- Chart.js Pollutants Distribution Card -->
      <div class="card span-12">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h2>Atmospheric Pollutants & Infection Susceptibility Breakdown</h2>
            <p class="muted">Real-time concentration levels for airborne particulate matter, nitrogen dioxide, and ground ozone.</p>
          </div>
        </div>
        <div class="chart-wrapper">
          <canvas id="pollutantChart"></canvas>
        </div>
        <div id="pollutantsCardsGrid" class="pollutants-grid"></div>
      </div>
    </div>
  `, 'tracking');

  bindCitySearchEvents();
  initMapWithFamily(userLat, userLon);
  loadHospitals(userLat, userLon);

  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const envBox = document.getElementById('env');
  const badge = document.getElementById('trackingBadge');

  startBtn.onclick = () => {
    if (!navigator.geolocation) {
      envBox.innerHTML = '<div class="error">Geolocation is not supported by your browser.</div>';
      return;
    }
    toast('Live GPS tracking requested. Awaiting satellite lock...', 'info');
    if (badge) { badge.textContent = 'GPS Active'; badge.className = 'pill low'; }

    watchId = navigator.geolocation.watchPosition(async p => {
      const { latitude: lat, longitude: lon, accuracy } = p.coords;
      userLat = lat; userLon = lon;

      try {
        await api('/tracking/location', { method: 'POST', body: JSON.stringify({ lat, lon, accuracy }) });
      } catch {}

      if (map) map.setView([lat, lon], 14);

      try {
        const d = await api(`/atmosphere?lat=${lat}&lon=${lon}`);
        lastTelemetryData = d;
        const score = d.risk?.score || 0;

        if (score >= 70) {
          api('/family/environment-alert', { method: 'POST', body: JSON.stringify({ score }) }).catch(() => {});
          toast(`High environmental exposure detected (${score}/100). Family alerted via SMS.`, 'error');
        }

        updateAtmosphericUI(d, 'Your Live GPS Location', lat, lon);
      } catch (e) {
        envBox.innerHTML = `<div class="error">${esc(e.message)}</div>`;
      }

      loadHospitals(lat, lon);
    }, () => {
      envBox.innerHTML = '<div class="error">Location permission was denied. Please allow browser location access or search any city above.</div>';
      if (badge) { badge.textContent = 'GPS Inactive'; badge.className = 'pill high'; }
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 });
  };

  stopBtn.onclick = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    envBox.innerHTML = '<div class="notice">Tracking stopped. Telemetry is on standby.</div>';
    if (badge) { badge.textContent = 'GPS Standby'; badge.className = 'pill moderate'; }
    toast('Live GPS tracking stopped.', 'info');
  };
}

function renderPollutantChart(curr = {}) {
  const canvas = document.getElementById('pollutantChart');
  if (!canvas || !window.Chart) return;

  const pm25 = Number(curr.pm2_5 || 15);
  const pm10 = Number(curr.pm10 || 28);
  const no2 = Number(curr.nitrogen_dioxide || 22);
  const o3 = Number(curr.ozone || 35);
  const co = Number(curr.carbon_monoxide || 150) / 10;

  if (currentAqiChart) currentAqiChart.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  currentAqiChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['PM2.5 (Fine)', 'PM10 (Coarse)', 'NO₂ (Dioxide)', 'O₃ (Ozone)', 'CO (Scaled)'],
      datasets: [{
        label: 'Pollutant Concentration (µg/m³)',
        data: [pm25, pm10, no2, o3, co],
        backgroundColor: [
          pm25 > 35 ? '#ef4444' : '#0284c7',
          pm10 > 50 ? '#f59e0b' : '#38bdf8',
          '#6366f1',
          '#8b5cf6',
          '#10b981'
        ],
        borderRadius: 8,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#475569',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: 'Inter', weight: 600 } },
          grid: { display: false }
        },
        y: {
          ticks: { color: textColor, font: { family: 'Inter' } },
          grid: { color: gridColor }
        }
      }
    }
  });

  const cardsGrid = document.getElementById('pollutantsCardsGrid');
  if (cardsGrid) {
    cardsGrid.innerHTML = `
      <div class="pollutant-card">
        <div class="pollutant-name">PM2.5</div>
        <div class="pollutant-val" style="color:${pm25>35?'var(--danger)':'var(--primary)'}">${pm25}</div>
        <div class="pollutant-unit">µg/m³ • Fine particles</div>
      </div>
      <div class="pollutant-card">
        <div class="pollutant-name">PM10</div>
        <div class="pollutant-val" style="color:${pm10>50?'var(--warn)':'var(--primary)'}">${pm10}</div>
        <div class="pollutant-unit">µg/m³ • Dust & smoke</div>
      </div>
      <div class="pollutant-card">
        <div class="pollutant-name">NO₂</div>
        <div class="pollutant-val">${no2}</div>
        <div class="pollutant-unit">µg/m³ • Vehicle emissions</div>
      </div>
      <div class="pollutant-card">
        <div class="pollutant-name">Ozone (O₃)</div>
        <div class="pollutant-val">${o3}</div>
        <div class="pollutant-unit">µg/m³ • Ground-level ozone</div>
      </div>
    `;
  }
}

// ============================================================================
// NEW: Live Pollen & Allergen Index Radar
// ============================================================================
async function pollen() {
  layout(`
    <div class="card" style="margin-bottom:20px">
      <h1>🌿 Live Pollen & Allergen Forecast Radar</h1>
      <p class="muted">Continuous biological allergen surveillance: Tree pollen, Grass pollen, Ragweed density, Mold spores, and UV Radiation index.</p>
      ${renderCitySearchBar()}
    </div>

    <div class="grid">
      <div class="card span-12">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">
          <div>
            <h2>Current Allergen Concentrations</h2>
            <div id="pollenLocationTitle" class="muted">📍 Showing atmospheric allergen levels</div>
          </div>
          <button class="btn secondary sm" onclick="speakCurrentAdvisory()">🔊 Listen to Allergy Advisory</button>
        </div>

        <div id="pollenCardsGrid" class="pollen-grid">
          <div class="muted">Loading allergen radar telemetry…</div>
        </div>
      </div>

      <div class="card span-6">
        <h2>🛡️ Allergic Respiratory Protection</h2>
        <div class="list" style="margin-top:14px">
          <div class="listitem">
            <b>🌲 Tree & Birch Pollen Peaks (Morning)</b>
            <p class="muted">Highest counts occur between 5:00 AM and 10:00 AM. Wear sunglasses and rinse hair after extended outdoor exposure.</p>
          </div>
          <div class="listitem">
            <b>🌾 Grass & Ragweed Sensitivities</b>
            <p class="muted">Dry windy afternoons accelerate grass pollen dispersal. Keep car windows closed and use HEPA recirculation.</p>
          </div>
          <div class="listitem">
            <b>🍄 Humidity & Mold Spore Risk</b>
            <p class="muted">Relative humidity exceeding 70% accelerates indoor and outdoor fungal spore proliferation.</p>
          </div>
        </div>
      </div>

      <div class="card span-6">
        <h2>☀️ Solar UV Radiation & Sun Protection</h2>
        <div id="uvInfoCard" class="listitem" style="margin-top:14px">
          <div style="font-weight:700;font-size:16px;color:var(--warn)">UV Index Telemetry</div>
          <p class="muted" style="margin:6px 0">UV radiation accelerates ozone formation and respiratory airway inflammation.</p>
        </div>
      </div>
    </div>
  `, 'pollen');

  bindCitySearchEvents();
  loadPollenData(userLat, userLon);
}

async function loadPollenData(lat, lon) {
  const box = document.getElementById('pollenCardsGrid');
  const uvBox = document.getElementById('uvInfoCard');
  if (!box) return;

  try {
    const d = await api(`/atmosphere?lat=${lat}&lon=${lon}`);
    lastTelemetryData = d;
    const p = d.pollen || {};

    box.innerHTML = `
      <div class="pollen-card">
        <div class="muted">🌲 Tree & Birch Pollen</div>
        <div class="pollen-val" style="color:${p.treePollen?.level==='High'?'var(--danger)':p.treePollen?.level==='Moderate'?'var(--warn)':'var(--ok)'}">
          ${p.treePollen?.count || 18} <span style="font-size:14px">grains/m³</span>
        </div>
        <span class="pill ${p.treePollen?.level==='High'?'high':p.treePollen?.level==='Moderate'?'moderate':'low'}">${p.treePollen?.level || 'Low'} Density</span>
      </div>

      <div class="pollen-card">
        <div class="muted">🌾 Grass Pollen</div>
        <div class="pollen-val" style="color:${p.grassPollen?.level==='High'?'var(--danger)':p.grassPollen?.level==='Moderate'?'var(--warn)':'var(--ok)'}">
          ${p.grassPollen?.count || 12} <span style="font-size:14px">grains/m³</span>
        </div>
        <span class="pill ${p.grassPollen?.level==='High'?'high':p.grassPollen?.level==='Moderate'?'moderate':'low'}">${p.grassPollen?.level || 'Low'} Density</span>
      </div>

      <div class="pollen-card">
        <div class="muted">🌿 Ragweed & Weed Pollen</div>
        <div class="pollen-val" style="color:${p.ragweedPollen?.level==='High'?'var(--danger)':p.ragweedPollen?.level==='Moderate'?'var(--warn)':'var(--ok)'}">
          ${p.ragweedPollen?.count || 8} <span style="font-size:14px">grains/m³</span>
        </div>
        <span class="pill ${p.ragweedPollen?.level==='High'?'high':p.ragweedPollen?.level==='Moderate'?'moderate':'low'}">${p.ragweedPollen?.level || 'Low'} Density</span>
      </div>

      <div class="pollen-card">
        <div class="muted">🍄 Mold Spore Activity</div>
        <div class="pollen-val" style="color:${p.moldSpores?.level==='High Risk'?'var(--danger)':p.moldSpores?.level==='Moderate'?'var(--warn)':'var(--ok)'}">
          ${p.moldSpores?.riskScore || 30}<span style="font-size:14px">/100</span>
        </div>
        <span class="pill ${p.moldSpores?.level==='High Risk'?'high':p.moldSpores?.level==='Moderate'?'moderate':'low'}">${p.moldSpores?.level || 'Low'}</span>
      </div>
    `;

    if (uvBox) {
      uvBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:800;font-size:22px;color:${p.uvIndex>=8?'var(--danger)':p.uvIndex>=6?'var(--warn)':'var(--ok)'}">
            ☀️ UV Index: ${p.uvIndex} (${p.uvLevel})
          </div>
          <span class="pill ${p.uvIndex>=8?'high':p.uvIndex>=6?'moderate':'low'}">${p.uvLevel}</span>
        </div>
        <p style="margin:10px 0;font-size:13px;color:var(--text-sub)">
          ${p.uvIndex>=6 ? '⚠️ High UV radiation: Wear broad-spectrum SPF 30+ sunscreen, UV-blocking sunglasses, and seek shade between 11 AM - 4 PM.' : '✓ Normal UV index: Minimal solar burn hazard under ordinary conditions.'}
        </p>
      `;
    }
  } catch (e) {
    box.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

// ============================================================================
// NEW: AI Clean Air Outdoor Activity Planner
// ============================================================================
async function planner() {
  layout(`
    <div class="card" style="margin-bottom:20px">
      <h1>🏃‍♂️ AI Clean Air Outdoor Activity & Workout Planner</h1>
      <p class="muted">Hourly diurnal air-quality forecast identifying the safest time windows for outdoor running, cycling, children's outdoor play, and senior walks.</p>
      ${renderCitySearchBar()}
    </div>

    <div class="grid">
      <div class="card span-12">
        <h2>Hourly Outdoor Exercise Safety Timeline (Next 12 Hours)</h2>
        <div id="plannerHoursList" class="timeline-hours-grid">
          <div class="muted">Computing hourly atmospheric safety windows…</div>
        </div>
      </div>

      <div class="card span-6">
        <h2>Activity Recommendations</h2>
        <div class="list" style="margin-top:14px">
          <div class="listitem">
            <b>🏃 High-Intensity Cardio (Running / Cycling)</b>
            <p class="muted">High respiration rates increase pulmonary particle deposition by 300%. Only perform heavy outdoor cardio when PM2.5 is under 25 µg/m³.</p>
          </div>
          <div class="listitem">
            <b>👶 Pediatric Outdoor Play</b>
            <p class="muted">Children inhale more air per pound of body weight. Restrict outdoor play when localized risk score exceeds 45.</p>
          </div>
        </div>
      </div>

      <div class="card span-6">
        <h2>Personalized Asthma & Condition Alert</h2>
        <div class="notice">
          Your profile health conditions (e.g. ${esc(me?.healthIssues?.join(', ') || 'Standard profile')}) are factored into the safety thresholds above.
        </div>
      </div>
    </div>
  `, 'planner');

  bindCitySearchEvents();
  loadPlannerData(userLat, userLon);
}

async function loadPlannerData(lat, lon) {
  const box = document.getElementById('plannerHoursList');
  if (!box) return;

  try {
    const d = await api(`/atmosphere?lat=${lat}&lon=${lon}`);
    lastTelemetryData = d;
    const hours = d.hourly || [];

    if (!hours.length) {
      box.innerHTML = '<div class="muted">No hourly forecast data available.</div>';
      return;
    }

    box.innerHTML = hours.map(h => `
      <div class="hour-card ${h.safetyStatus}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-size:15px;color:var(--text-main)">⏰ ${esc(h.time)}</b>
          <span class="pill ${h.safetyStatus==='hazardous'?'high':h.safetyStatus==='moderate'?'moderate':'low'}" style="font-size:10.5px">
            ${esc(h.safetyStatus)}
          </span>
        </div>
        <div style="margin:10px 0">
          <div style="font-size:18px;font-weight:800;color:var(--primary)">${h.temp}°C</div>
          <div class="muted" style="font-size:12px">PM2.5: <b>${h.pm25} µg/m³</b> • UV: <b>${h.uv}</b></div>
        </div>
        <div style="font-size:11.5px;color:var(--text-sub);line-height:1.4">
          ${esc(h.recommendation)}
        </div>
      </div>
    `).join('');
  } catch (e) {
    box.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

// ============================================================================
// Resilient Hospital Discovery
// ============================================================================
async function loadHospitals(lat, lon) {
  const box = document.getElementById('hospitals') || document.getElementById('homeHospitals');
  if (!box) return;
  const radiusEl = document.getElementById('hospitalRadius');
  const radius = radiusEl ? radiusEl.value : 5000;

  try {
    const d = await api(`/hospitals?lat=${lat}&lon=${lon}&radius=${radius}`);
    if (d.items && d.items.length) {
      box.innerHTML = d.items.map(x => `
        <div class="listitem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-weight:700;font-size:14px;color:var(--text-main)">🏥 ${esc(x.name)}</div>
            <span class="pill ${x.emergency?'high':'low'}" style="font-size:10px">${x.distanceKm ? x.distanceKm + ' km' : 'Nearby'}</span>
          </div>
          <div class="muted" style="font-size:12px;margin:3px 0">${esc(x.address)}</div>
          ${x.type ? `<div style="font-size:11.5px;color:var(--primary);font-weight:600;margin-bottom:4px">🏷️ ${esc(x.type)}</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            ${x.phone ? `<a href="tel:${esc(x.phone)}" class="btn sm" style="font-size:11px;background:var(--ok)">☎ Call ${esc(x.phone)}</a>` : '<a href="tel:911" class="btn sm" style="font-size:11px;background:var(--danger)">☎ Emergency 911</a>'}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lon}" target="_blank" rel="noreferrer" class="btn sm secondary" style="font-size:11px">🗺️ Directions</a>
          </div>
        </div>
      `).join('');
    } else {
      box.innerHTML = '<div class="muted">No hospitals returned. Expanding radius...</div>';
    }
  } catch (e) {
    box.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

// ============================================================================
// WHO Outbreak Feed & Disease Tracker
// ============================================================================
let currentDiseaseFilter = 'all';

async function disease() {
  layout(`
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div>
          <h1>World Health Organization (WHO) Disease Spread Intelligence</h1>
          <p class="muted">Verified public-health disease outbreak surveillance, transmission dynamics, clinical symptoms, and infection precautions.</p>
        </div>
        <span class="pill low">Verified WHO & CDC Surveillance</span>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 20px 0">
        <button class="btn sm ${currentDiseaseFilter==='all'?'':'secondary'}" onclick="filterDiseases('all')">🌐 All Global Notices</button>
        <button class="btn sm ${currentDiseaseFilter==='High'?'':'secondary'}" onclick="filterDiseases('High')">🚨 High Risk Alerts</button>
        <button class="btn sm ${currentDiseaseFilter==='airborne'?'':'secondary'}" onclick="filterDiseases('airborne')">💨 Airborne / Bio-Aerosol</button>
        <button class="btn sm ${currentDiseaseFilter==='vector'?'':'secondary'}" onclick="filterDiseases('vector')">🦟 Vector-Borne</button>
      </div>

      <div id="diseaseList" class="list">
        <div class="muted" style="padding:20px;text-align:center">Loading live WHO outbreak surveillance data…</div>
      </div>
    </div>
  `, 'disease');

  loadDiseaseData();
}

async function loadDiseaseData() {
  const box = document.getElementById('diseaseList');
  if (!box) return;

  try {
    const d = await api('/who/disease-tracker');
    let list = d.diseases || [];

    if (currentDiseaseFilter === 'High') {
      list = list.filter(x => x.riskLevel === 'High');
    } else if (currentDiseaseFilter === 'airborne') {
      list = list.filter(x => x.airborneTransmissionRisk && (x.airborneTransmissionRisk.toLowerCase().includes('high') || x.airborneTransmissionRisk.toLowerCase().includes('moderate')));
    } else if (currentDiseaseFilter === 'vector') {
      list = list.filter(x => x.airborneTransmissionRisk && x.airborneTransmissionRisk.toLowerCase().includes('vector'));
    }

    box.innerHTML = list.map(x => `
      <article class="disease-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <h2 style="margin:0;font-size:17px;color:var(--primary)">${esc(x.title)}</h2>
            <div class="muted" style="font-size:12.5px;margin-top:2px">🌍 <b>Region:</b> ${esc(x.region)} • <b>Pathogen:</b> ${esc(x.pathogen)}</div>
          </div>
          <span class="pill ${x.riskLevel==='High'?'high':'moderate'}" style="font-size:11.5px">Risk: ${esc(x.riskLevel)}</span>
        </div>

        <p style="margin:12px 0;font-size:13.5px;color:var(--text-sub);line-height:1.6">${esc(x.summary)}</p>

        <div class="disease-meta-row">
          <div class="disease-meta-item">
            <span class="muted">Airborne Transmission:</span>
            <b style="color:var(--primary);margin-left:4px">${esc(x.airborneTransmissionRisk || 'Standard Contact')}</b>
          </div>
          <div class="disease-meta-item">
            <span class="muted">Incubation Period:</span>
            <b style="margin-left:4px">${esc(x.incubationPeriod || 'Variable')}</b>
          </div>
          <div class="disease-meta-item">
            <span class="muted">Notice Date:</span>
            <b style="margin-left:4px">${esc(x.date || 'Active')}</b>
          </div>
        </div>

        ${x.keySymptoms && x.keySymptoms.length ? `
          <div style="margin-top:10px">
            <span style="font-size:12px;font-weight:700;color:var(--text-main)">Key Clinical Symptoms:</span>
            <div class="symptoms-tags">
              ${x.keySymptoms.map(s => `<span class="symptom-tag">⚠️ ${esc(s)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${x.preventionTips && x.preventionTips.length ? `
          <div style="margin-top:10px;font-size:12.5px;color:var(--text-sub)">
            <b>WHO Prevention Measures:</b>
            <ul style="margin:4px 0 0 18px;line-height:1.5">
              ${x.preventionTips.map(t => `<li>${esc(t)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${x.url ? `<div style="margin-top:12px"><a href="${esc(x.url)}" target="_blank" rel="noreferrer" class="btn sm secondary" style="font-size:11.5px">Read Full WHO Notice ↗</a></div>` : ''}
      </article>
    `).join('') || '<p class="muted">No disease notices matching current filter.</p>';
  } catch (e) {
    box.innerHTML = `<div class="error">Unable to load WHO disease intelligence: ${esc(e.message)}</div>`;
  }
}

window.filterDiseases = function(filter) {
  currentDiseaseFilter = filter;
  disease();
};

// ============================================================================
// Precautions
// ============================================================================
function precautions() {
  layout(`
    <div class="grid">
      <div class="card span-8">
        <h1>Health Precautions & Respiratory Protection</h1>
        <p class="muted">Practical preventative steps aligned with international air-quality safety and disease infection standards.</p>
        <div class="list" style="margin-top:18px">
          <div class="listitem">
            <b>🛡️ Reduce Strenuous Outdoor Activity During Pollution Spikes</b>
            <p class="muted" style="margin-top:4px">When localized PM2.5 or PM10 exceeds moderate thresholds, limit outdoor running, cycling, or heavy exertion.</p>
          </div>
          <div class="listitem">
            <b>🏡 Maintain Indoor Air Filtration</b>
            <p class="muted" style="margin-top:4px">Keep windows closed during high-risk exposure periods and consider HEPA air filtration if available.</p>
          </div>
          <div class="listitem">
            <b>📱 Automated Family SMS Warnings</b>
            <p class="muted" style="margin-top:4px">AeroSense automatically dispatches an SMS message to your registered family phone numbers if a connected member enters a high environmental risk zone (Score ≥ 70).</p>
          </div>
          <div class="listitem">
            <b>🏥 Emergency Clinical Care & Trauma Centers</b>
            <p class="muted" style="margin-top:4px">For acute shortness of breath, severe chest tightness, wheezing, or allergic distress, use the Emergency SOS button or contact local emergency healthcare immediately.</p>
          </div>
        </div>
      </div>
      <div class="card span-4">
        <h2>Your Personalized Risk Assessment</h2>
        <p class="muted" style="margin:10px 0">AeroSense adjusts susceptibility calculations based on your Age and Health Profile (Asthma, COPD, Allergies, Cardiovascular history).</p>
        <button class="btn" style="width:100%;margin-bottom:10px" onclick="go('profile')">Update Health Profile</button>
        <button class="btn secondary" style="width:100%" onclick="go('tracking')">Check Global Radar</button>
      </div>
    </div>
  `, 'precautions');
}

// ============================================================================
// Family Network, Kids School Safe Zones & SMS Radar
// ============================================================================
async function family() {
  layout(`
    <div class="grid">
      <!-- Column 1: Connect Family & Emergency SOS -->
      <div class="card span-4">
        <h2>Connect Family Member</h2>
        <p class="muted" style="font-size:12.5px;margin-bottom:12px">Enter a family member's registered email to share mutual location telemetry and automated emergency SMS alerts.</p>
        <form id="familyForm">
          <div class="field">
            <label>Registered Email</label>
            <input id="familyEmail" type="email" placeholder="relative@example.com" required>
          </div>
          <button class="btn" style="width:100%">Send Connection Request</button>
        </form>
        <p id="familyMsg" style="margin-top:10px"></p>

        <hr style="border:0;border-top:1px solid var(--border-subtle);margin:18px 0">
        <h3>Emergency SMS Panic Trigger</h3>
        <p class="muted" style="font-size:12px;margin-bottom:10px">Broadcast an instant emergency panic SMS alert to all family phone numbers:</p>
        <button class="sos-button" style="width:100%" onclick="triggerEmergencySOS()">🚨 Dispatch Family Emergency SOS</button>
      </div>

      <!-- Column 2: Connected Family Members & SMS History -->
      <div class="card span-4">
        <h2>Connected Family Members</h2>
        <div id="familyList" class="list" style="margin-top:12px">
          <div class="muted">Loading connections…</div>
        </div>

        <h3 style="margin-top:20px">📱 Dispatched SMS Logs</h3>
        <div id="smsAlertList" class="list" style="max-height:180px;overflow-y:auto;margin-top:8px">
          <div class="muted">Loading SMS logs…</div>
        </div>
      </div>

      <!-- Column 3: NEW Kids & School Safe Zones -->
      <div class="card span-4">
        <h2>🎒 Kids & School Safe Zones</h2>
        <p class="muted" style="font-size:12.5px;margin-bottom:12px">Track real-time air quality & pollution risks at your children's schools during school hours.</p>

        <form id="kidForm" style="margin-bottom:16px;background:var(--bg-app);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
          <div class="field">
            <label>Child's Full Name</label>
            <input id="kidName" placeholder="e.g. Liam Doe" required>
          </div>
          <div class="field">
            <label>School Name</label>
            <input id="kidSchool" placeholder="e.g. St. Xavier's Academy" required>
          </div>
          <div class="row">
            <div class="field" style="flex:1">
              <label>School Latitude</label>
              <input id="kidLat" type="number" step="any" placeholder="28.6139" required>
            </div>
            <div class="field" style="flex:1">
              <label>School Longitude</label>
              <input id="kidLon" type="number" step="any" placeholder="77.2090" required>
            </div>
          </div>
          <div class="row">
            <div class="field" style="flex:1">
              <label>Age / Grade</label>
              <input id="kidGrade" placeholder="e.g. 8 yrs • 3rd Grade">
            </div>
            <div class="field" style="flex:1">
              <label>Sensitivities</label>
              <input id="kidAllergies" placeholder="e.g. Asthma, Pollen">
            </div>
          </div>
          <button class="btn sm" style="width:100%;background:var(--ok)">+ Register School Safe Zone</button>
        </form>

        <h3>Tracked Children</h3>
        <div id="kidsList" class="list" style="margin-top:8px;max-height:220px;overflow-y:auto">
          <div class="muted">Loading kids school profiles…</div>
        </div>
      </div>
    </div>
  `, 'family');

  const familyForm = document.getElementById('familyForm');
  const familyEmail = document.getElementById('familyEmail');
  const familyMsg = document.getElementById('familyMsg');

  familyForm.onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/family/request', { method: 'POST', body: JSON.stringify({ email: familyEmail.value }) });
      familyMsg.innerHTML = '<div class="notice">Connection request sent successfully!</div>';
      familyEmail.value = '';
      toast('Connection request sent!', 'success');
      refreshFamily();
    } catch (err) {
      familyMsg.innerHTML = `<div class="error">${esc(err.message)}</div>`;
      toast(err.message, 'error');
    }
  };

  const kidForm = document.getElementById('kidForm');
  if (kidForm) {
    // Prefill coordinates with user's current city/coordinates
    document.getElementById('kidLat').value = userLat || 28.6139;
    document.getElementById('kidLon').value = userLon || 77.2090;

    kidForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const name = document.getElementById('kidName').value;
        const schoolName = document.getElementById('kidSchool').value;
        const lat = Number(document.getElementById('kidLat').value);
        const lon = Number(document.getElementById('kidLon').value);
        const grade = document.getElementById('kidGrade').value;
        const allergies = document.getElementById('kidAllergies').value;

        await api('/family/kids', {
          method: 'POST',
          body: JSON.stringify({ name, schoolName, lat, lon, grade, allergies })
        });
        toast(`🎒 ${name}'s school safe zone registered!`, 'success');
        document.getElementById('kidName').value = '';
        document.getElementById('kidSchool').value = '';
        document.getElementById('kidGrade').value = '';
        document.getElementById('kidAllergies').value = '';
        refreshFamily();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  }

  refreshFamily();
  loadSmsAlerts();
}

async function refreshFamily() {
  try {
    const d = await api('/family');
    const list = document.getElementById('familyList');
    const kidsList = document.getElementById('kidsList');

    if (list) {
      if (!d.connections || !d.connections.length) {
        list.innerHTML = '<div class="muted">No family connections yet. Invite family members using their registered email!</div>';
      } else {
        list.innerHTML = d.connections.map(x => {
          const otherName = esc(x.other?.name || 'User');
          const otherEmail = esc(x.other?.email || '');
          const otherPhone = x.other?.phone ? esc(x.other.phone) : 'No phone listed';
          const isAccepted = x.status === 'accepted';
          const isIncoming = x.status === 'pending' && x.to === me.id;

          const loc = x.location || { lat: 28.6139, lon: 77.2090 };

          return `
            <div class="listitem">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:700;font-size:14px;color:var(--text-main)">👨‍👩‍👧 ${otherName}</div>
                  <div class="muted" style="font-size:12px">${otherEmail} • 📱 ${otherPhone}</div>
                </div>
                <span class="pill ${isAccepted?'low':'moderate'}">${esc(x.status)}</span>
              </div>
              <div style="margin-top:8px;font-size:12px;color:var(--text-sub)">
                📍 <b>Location:</b> ${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)}
                <button class="btn sm secondary" style="margin-left:8px;padding:3px 8px;font-size:11px" onclick="go('tracking')">🗺️ View on Map</button>
              </div>
              ${isIncoming ? `
                <div style="margin-top:10px;display:flex;gap:6px">
                  <button class="btn sm" onclick="respond('${x.id}', true)">Accept Connection</button>
                  <button class="btn sm secondary" onclick="respond('${x.id}', false)">Decline</button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }

    if (kidsList) {
      if (!d.kids || !d.kids.length) {
        kidsList.innerHTML = '<div class="muted">No kids registered yet. Add your child and school coordinates above to monitor their school air quality.</div>';
      } else {
        kidsList.innerHTML = '';
        for (const kid of d.kids) {
          let kRisk = { score: 35, level: 'low' };
          try {
            const atmo = await api(`/atmosphere?lat=${kid.lat}&lon=${kid.lon}`);
            if (atmo.risk) kRisk = atmo.risk;
          } catch {}

          const itemEl = document.createElement('div');
          itemEl.className = 'listitem';
          itemEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div style="font-weight:700;font-size:14px;color:#10b981">🎒 ${esc(kid.name)}</div>
                <div class="muted" style="font-size:12px">🏫 ${esc(kid.schoolName)} (${kid.grade || 'Student'})</div>
              </div>
              <span class="pill ${kRisk.level==='high'?'high':kRisk.level==='moderate'?'moderate':'low'}" style="font-size:10.5px">Risk: ${kRisk.score}/100</span>
            </div>
            ${kid.allergies?.length ? `<div style="font-size:11px;color:var(--warn);margin-top:4px">⚠️ Sensitivities: ${esc(kid.allergies.join(', '))}</div>` : ''}
            <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
              <span class="muted" style="font-size:11px">📍 [${kid.lat.toFixed(3)}, ${kid.lon.toFixed(3)}]</span>
              <div style="display:flex;gap:6px">
                <button class="btn sm secondary" style="padding:3px 8px;font-size:11px" onclick="go('tracking')">🗺️ Map</button>
                <button class="btn sm secondary" style="padding:3px 8px;font-size:11px;color:var(--danger)" onclick="removeKidProfile('${kid.id}')">🗑️</button>
              </div>
            </div>
          `;
          kidsList.appendChild(itemEl);
        }
      }
    }
  } catch (e) {
    const list = document.getElementById('familyList');
    if (list) list.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

window.removeKidProfile = async function(id) {
  if (!confirm('Remove this child school safe zone?')) return;
  try {
    await api(`/family/kids/${id}`, { method: 'DELETE' });
    toast('Kid school profile removed', 'info');
    refreshFamily();
  } catch (e) {
    toast(e.message, 'error');
  }
};

async function loadSmsAlerts() {
  const box = document.getElementById('smsAlertList');
  if (!box) return;
  try {
    const d = await api('/family/sms-alerts');
    if (d.alerts && d.alerts.length) {
      box.innerHTML = d.alerts.map(a => `
        <div class="sms-log-item ${a.severity==='danger'||a.severity==='emergency'?'danger':''}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b>📱 Recipient: ${esc(a.toName)} (${esc(a.toPhone)})</b>
            <span class="sms-carrier-badge">✓ DELIVERED VIA SMS</span>
          </div>
          <p style="margin:6px 0;color:var(--text-sub);font-size:12.5px">${esc(a.message)}</p>
          <small class="muted">Sent: ${new Date(a.timestamp).toLocaleString()} • Coordinates: ${esc(a.coordinates || 'N/A')}</small>
        </div>
      `).join('');
    } else {
      box.innerHTML = '<div class="muted">No emergency SMS logs dispatched yet.</div>';
    }
  } catch {
    box.innerHTML = '<div class="muted">SMS logs not loaded.</div>';
  }
}


async function respond(id, accept) {
  try {
    await api(`/family/${id}/respond`, { method: 'POST', body: JSON.stringify({ accept }) });
    toast(accept ? 'Family request accepted!' : 'Family request declined', accept ? 'success' : 'info');
    refreshFamily();
  } catch (e) {
    toast(e.message, 'error');
  }
}

window.triggerEmergencySOS = async function() {
  const confirmSOS = confirm('🚨 Are you sure you want to broadcast an EMERGENCY SOS PANIC ALERT via SMS to all connected family members and your emergency contact?');
  if (!confirmSOS) return;

  try {
    toast('Transmitting Emergency SOS via SMS Gateway...', 'warn');
    await api('/family/sos-alert', { method: 'POST' });
    toast('🚨 Emergency SOS successfully dispatched to all family phone numbers!', 'error');
    if (document.getElementById('smsAlertList')) loadSmsAlerts();
  } catch (e) {
    toast(e.message, 'error');
  }
};

// ============================================================================
// Comprehensive Health Profile (Age, Gender, Health Issues, Blood, Emergency)
// ============================================================================
const ALL_HEALTH_CONDITIONS = [
  'Asthma',
  'COPD',
  'Cardiovascular / Heart Disease',
  'Pollen & Dust Allergies',
  'Bronchitis',
  'Pregnancy',
  'Smoker',
  'Immunocompromised',
  'Senior Citizen (65+)',
  'Pediatric (<12)'
];

let selectedConditions = new Set();

async function profile() {
  selectedConditions = new Set(me.healthIssues || []);

  layout(`
    <div class="card" style="max-width:750px;margin:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap">
        <div>
          <h1>Personal & Health Profile</h1>
          <p class="muted">Provide your age, gender, emergency contact, and respiratory sensitivities to personalize your risk estimates.</p>
        </div>
        <button class="btn secondary sm" onclick="exportMedicalPassport()">📄 Print Medical Passport</button>
      </div>
      
      <form id="profileForm" style="margin-top:18px">
        <div class="field">
          <label>Full Name</label>
          <input id="pname" value="${esc(me.name || '')}" required>
        </div>

        <div class="row">
          <div class="field" style="flex:1">
            <label>Registered Email</label>
            <input value="${esc(me.email || '')}" disabled>
          </div>
          <div class="field" style="flex:1">
            <label>Your Phone (For SMS Alerts)</label>
            <input id="pphone" value="${esc(me.phone || '')}" placeholder="+1 (555) 019-2834">
          </div>
        </div>

        <div class="row">
          <div class="field" style="flex:1">
            <label>Age</label>
            <input id="page" type="number" min="1" max="120" value="${me.age || ''}" placeholder="e.g. 28">
          </div>
          <div class="field" style="flex:1">
            <label>Gender</label>
            <select id="pgender">
              <option value="">Select gender</option>
              <option value="Female" ${me.gender==='Female'?'selected':''}>Female</option>
              <option value="Male" ${me.gender==='Male'?'selected':''}>Male</option>
              <option value="Non-binary" ${me.gender==='Non-binary'?'selected':''}>Non-binary</option>
              <option value="Prefer not to say" ${me.gender==='Prefer not to say'?'selected':''}>Prefer not to say</option>
            </select>
          </div>
          <div class="field" style="flex:1">
            <label>Blood Group</label>
            <select id="pbloodGroup">
              <option value="">Select</option>
              <option value="A+" ${me.bloodGroup==='A+'?'selected':''}>A+</option>
              <option value="A-" ${me.bloodGroup==='A-'?'selected':''}>A-</option>
              <option value="B+" ${me.bloodGroup==='B+'?'selected':''}>B+</option>
              <option value="B-" ${me.bloodGroup==='B-'?'selected':''}>B-</option>
              <option value="AB+" ${me.bloodGroup==='AB+'?'selected':''}>AB+</option>
              <option value="AB-" ${me.bloodGroup==='AB-'?'selected':''}>AB-</option>
              <option value="O+" ${me.bloodGroup==='O+'?'selected':''}>O+</option>
              <option value="O-" ${me.bloodGroup==='O-'?'selected':''}>O-</option>
            </select>
          </div>
        </div>

        <h3 style="margin-top:20px">Pre-Existing Health Conditions & Sensitivities</h3>
        <p class="muted" style="font-size:12.5px">Click to toggle conditions. These directly weight your environmental risk score:</p>
        
        <div class="condition-chips-grid">
          ${ALL_HEALTH_CONDITIONS.map(cond => `
            <div class="condition-chip ${selectedConditions.has(cond)?'active':''}" onclick="toggleCondition('${esc(cond)}')">
              <span>${selectedConditions.has(cond)?'✓':'＋'}</span> ${esc(cond)}
            </div>
          `).join('')}
        </div>

        <div class="field" style="margin-top:12px">
          <label>Additional Clinical Notes (Optional)</label>
          <input id="pnotes" value="${esc(me.healthProfile?.notes || '')}" placeholder="e.g. Inhaler dosage, dust allergy severity, pacemaker">
        </div>

        <h3 style="margin-top:20px">Designated Emergency Contact</h3>
        <p class="muted" style="font-size:12.5px">Direct contact number notified during environmental risk spikes or SOS panics:</p>
        <div class="row">
          <div class="field" style="flex:1">
            <label>Contact Person Name</label>
            <input id="pemName" value="${esc(me.emergencyContactName || '')}" placeholder="e.g. Dr. Robert Doe / Spouse">
          </div>
          <div class="field" style="flex:1">
            <label>Emergency Phone Number</label>
            <input id="pemPhone" value="${esc(me.emergencyContactPhone || '')}" placeholder="+1 (555) 012-9988">
          </div>
        </div>

        <button class="btn" style="margin-top:18px;width:100%">Save Complete Health Profile</button>
      </form>
      <p id="profileMsg" style="margin-top:12px"></p>
    </div>
  `, 'profile');

  const profileForm = document.getElementById('profileForm');
  const profileMsg = document.getElementById('profileMsg');

  profileForm.onsubmit = async e => {
    e.preventDefault();
    try {
      const pname = document.getElementById('pname').value;
      const pphone = document.getElementById('pphone').value;
      const page = document.getElementById('page').value;
      const pgender = document.getElementById('pgender').value;
      const pbloodGroup = document.getElementById('pbloodGroup').value;
      const pnotes = document.getElementById('pnotes').value;
      const pemName = document.getElementById('pemName').value;
      const pemPhone = document.getElementById('pemPhone').value;

      const d = await api('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: pname,
          phone: pphone,
          age: page ? Number(page) : null,
          gender: pgender,
          bloodGroup: pbloodGroup,
          healthIssues: Array.from(selectedConditions),
          emergencyContactName: pemName,
          emergencyContactPhone: pemPhone,
          healthProfile: { notes: pnotes }
        })
      });
      me = d.user;
      profileMsg.innerHTML = '<div class="notice">Health profile and emergency contact saved successfully!</div>';
      toast('Health profile updated!', 'success');
    } catch (err) {
      profileMsg.innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

window.toggleCondition = function(cond) {
  if (selectedConditions.has(cond)) selectedConditions.delete(cond);
  else selectedConditions.add(cond);
  profile();
};

// ============================================================================
// Printable Medical Emergency Passport Export
// ============================================================================
window.exportMedicalPassport = function() {
  const issues = me?.healthIssues?.length ? me.healthIssues.join(', ') : 'None reported';
  const age = me?.age ? `${me.age} years` : 'Not specified';
  const blood = me?.bloodGroup || 'Not specified';
  const emName = me?.emergencyContactName || 'None designated';
  const emPhone = me?.emergencyContactPhone || 'N/A';
  const notes = me?.healthProfile?.notes || 'No specific clinical notes';

  const w = window.open('', '_blank');
  if (!w) {
    toast('Pop-up blocked. Please allow pop-ups to print passport.', 'warn');
    return;
  }

  w.document.write(`
    <!doctype html>
    <html>
    <head>
      <title>AeroSense Emergency Health Passport - ${esc(me?.name)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; color: #0f172a; line-height: 1.6; }
        .card { border: 2px solid #0284c7; border-radius: 12px; padding: 24px; max-width: 600px; margin: auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
        .brand { font-size: 20px; font-weight: 800; color: #0284c7; }
        .badge { background: #fee2e2; color: #dc2626; padding: 4px 10px; border-radius: 99px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
        .label { color: #64748b; font-size: 13px; font-weight: 600; }
        .val { font-weight: 700; font-size: 14px; }
        .print-btn { background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; cursor: pointer; margin-top: 18px; }
        @media print { .print-btn { display: none; } }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div>
            <div class="brand">AeroSense Emergency Medical Passport</div>
            <small style="color:#64748b">Verified Clinical Health Card</small>
          </div>
          <span class="badge">Emergency Patient Telemetry</span>
        </div>

        <div class="row"><span class="label">Patient Full Name:</span><span class="val">${esc(me?.name)}</span></div>
        <div class="row"><span class="label">Registered Email / ID:</span><span class="val">${esc(me?.email)}</span></div>
        <div class="row"><span class="label">Primary Phone:</span><span class="val">${esc(me?.phone || 'N/A')}</span></div>
        <div class="row"><span class="label">Age:</span><span class="val">${esc(age)}</span></div>
        <div class="row"><span class="label">Gender:</span><span class="val">${esc(me?.gender || 'N/A')}</span></div>
        <div class="row"><span class="label">Blood Group:</span><span class="val" style="color:#dc2626">${esc(blood)}</span></div>
        <div class="row"><span class="label">Pre-Existing Sensitivities:</span><span class="val">${esc(issues)}</span></div>
        <div class="row"><span class="label">Clinical Notes:</span><span class="val">${esc(notes)}</span></div>
        <div class="row"><span class="label">Emergency Contact Name:</span><span class="val">${esc(emName)}</span></div>
        <div class="row"><span class="label">Emergency Contact Phone:</span><span class="val">${esc(emPhone)}</span></div>

        <div style="margin-top:16px;font-size:11px;color:#64748b;text-align:center">
          Generated via AeroSense Cloud Telemetry System • Date: ${new Date().toLocaleDateString()}
        </div>
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
      </div>
    </body>
    </html>
  `);
  w.document.close();
};

// ============================================================================
// Settings & Notifications
// ============================================================================
function settings() {
  layout(`
    <div class="card" style="max-width:650px;margin:auto">
      <h1>Preferences & Privacy Settings</h1>
      <p class="muted">Configure live family telemetry sharing and automatic SMS exposure alerts.</p>
      <form id="settingsForm" style="margin-top:20px">
        <div class="listitem" style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <b>Automated Environmental SMS Alerts</b>
            <div class="muted" style="font-size:12.5px">Dispatch SMS to family phone numbers when entering hazardous exposure zones (Score ≥ 70)</div>
          </div>
          <input id="noti" type="checkbox" style="width:20px;height:20px" ${me.settings?.notifications !== false ? 'checked' : ''}>
        </div>

        <div class="listitem" style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
          <div>
            <b>Family Location Sharing</b>
            <div class="muted" style="font-size:12.5px">Broadcast your live GPS coordinates to accepted family members</div>
          </div>
          <input id="sharing" type="checkbox" style="width:20px;height:20px" ${me.settings?.locationSharing ? 'checked' : ''}>
        </div>

        <button class="btn" style="margin-top:20px;width:100%">Save Privacy & Alert Settings</button>
      </form>
      <p id="setMsg" style="margin-top:12px"></p>
    </div>
  `, 'settings');

  const settingsForm = document.getElementById('settingsForm');
  const setMsg = document.getElementById('setMsg');

  settingsForm.onsubmit = async e => {
    e.preventDefault();
    try {
      const noti = document.getElementById('noti');
      const sharing = document.getElementById('sharing');
      const d = await api('/settings', { method: 'PUT', body: JSON.stringify({ notifications: noti.checked, locationSharing: sharing.checked }) });
      me.settings = { ...me.settings, ...d.settings };
      setMsg.innerHTML = '<div class="notice">Settings saved successfully.</div>';
      toast('Settings updated!', 'success');
    } catch (err) {
      setMsg.innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

async function notificationsPage() {
  layout(`
    <div class="card" style="max-width:800px;margin:auto">
      <h1>Notifications & Alerts</h1>
      <div id="notifs" class="list" style="margin-top:16px">
        <div class="muted">Loading notifications…</div>
      </div>
    </div>
  `, 'notifications');

  try {
    const d = await api('/notifications');
    const notifs = document.getElementById('notifs');
    if (notifs) {
      notifs.innerHTML = (d.items || []).map(n => `
        <div class="listitem">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b>${esc(n.title)}</b>
            <span class="pill ${n.severity==='danger'||n.severity==='emergency'?'high':n.severity==='warning'?'moderate':'low'}">${esc(n.severity)}</span>
          </div>
          <p style="margin:8px 0;font-size:13.5px;color:var(--text-sub)">${esc(n.message)}</p>
          <small class="muted">${new Date(n.createdAt).toLocaleString()}</small>
        </div>
      `).join('') || '<p class="muted">No notifications yet.</p>';
    }
  } catch (e) {
    const notifs = document.getElementById('notifs');
    if (notifs) notifs.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

async function expert() {
  layout(`
    <div class="card" style="max-width:850px;margin:auto">
      <h1>🩺 Professional Healthcare & Environmental Expert Portal</h1>
      <p class="muted">Review consented clinical telemetry and atmospheric anomaly reports.</p>
      <div id="expertCases" class="list" style="margin-top:16px">Loading…</div>
    </div>
  `, 'expert');

  try {
    const d = await api('/expert/cases');
    const box = document.getElementById('expertCases');
    if (box) box.innerHTML = `<div class="notice">${esc(d.note)}</div>`;
  } catch (e) {
    const box = document.getElementById('expertCases');
    if (box) box.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

async function loadBell() {
  try {
    const d = await api('/notifications');
    const el = document.getElementById('sidebarBellDot');
    if (el && d.items && d.items.some(x => !x.read)) {
      el.style.display = 'inline-block';
    }
  } catch {}
}

// ============================================================================
// PWA Install & QR Code Scanner Modal
// ============================================================================
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) banner.style.display = 'flex';
});

let qrCodeInstance = null;

async function showQrCodeModal() {
  let defaultUrl = window.location.origin;
  let localIpUrl = '';
  try {
    const net = await api('/network-info');
    if (net && net.primaryUrl) {
      localIpUrl = net.primaryUrl;
      // If we are currently on localhost, default to the local IP URL
      if (defaultUrl.includes('localhost') || defaultUrl.includes('127.0.0.1')) {
        defaultUrl = localIpUrl;
      }
    }
  } catch {}

  const modal = document.createElement('div');
  modal.id = 'qrModal';
  modal.className = 'modal-overlay';
  modal.onclick = e => {
    if (e.target === modal) modal.remove();
  };

  modal.innerHTML = `
    <div class="modal-box" style="max-width:520px">
      <button class="modal-close-btn" onclick="document.getElementById('qrModal').remove()">✕</button>
      
      <div style="font-size:32px;margin-bottom:6px">📱</div>
      <h2 style="font-size:20px;color:var(--text-main)">Open AeroSense on Mobile Phone</h2>
      <p class="muted" style="font-size:12.5px;margin:6px 0">Point your iPhone Camera or Android Google Lens at this QR code to open the app:</p>

      <div class="qr-code-wrapper">
        <div id="qrcode"></div>
      </div>

      <div style="margin:10px 0;text-align:left">
        <label style="font-size:11.5px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">TARGET APP URL / CLOUD LINK:</label>
        <div style="display:flex;gap:6px">
          <input id="qrTargetUrlInput" value="${esc(defaultUrl)}" placeholder="https://your-app.onrender.com or http://192.168.x.x:3000" style="font-size:13px;padding:8px 12px">
          <button class="btn sm" style="padding:8px 14px" onclick="updateModalQrCode()">Update</button>
        </div>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        ${localIpUrl ? `<button class="preset-chip" onclick="setQrUrl('${esc(localIpUrl)}')">📶 Local Wi-Fi (${esc(localIpUrl)})</button>` : ''}
        <button class="preset-chip" onclick="setQrUrl(window.location.origin)">💻 Current Browser URL</button>
      </div>

      <div style="font-size:12px;color:var(--text-sub);text-align:left;background:var(--bg-app);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
        <b>💡 Why might Local Wi-Fi take long or timeout?</b>
        <div style="margin-top:4px;line-height:1.5;color:var(--text-muted)">
          • Some Wi-Fi routers (Campus/Office/Hotspot) have <i>AP Client Isolation</i> enabled, blocking phones from reaching the laptop directly.<br>
          • <b>Solution:</b> Deploy on <b><a href="https://render.com" target="_blank" style="font-weight:700">Render (Free)</a></b> or run <code>npm run tunnel</code> in your terminal to get an instant worldwide HTTPS URL!
        </div>
      </div>

      <div style="margin-top:14px;display:flex;gap:8px">
        <button class="btn" style="flex:1" onclick="installPwaApp()">📲 Install App on Phone</button>
        <button class="btn secondary" onclick="document.getElementById('qrModal').remove()">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  renderModalQr(defaultUrl);
}

function renderModalQr(url) {
  const qrContainer = document.getElementById('qrcode');
  if (!qrContainer) return;
  qrContainer.innerHTML = '';
  if (window.QRCode) {
    qrCodeInstance = new QRCode(qrContainer, {
      text: url,
      width: 180,
      height: 180,
      colorDark: '#0284c7',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    qrContainer.innerHTML = `<p class="muted" style="word-break:break-all">${esc(url)}</p>`;
  }
}

window.setQrUrl = function(url) {
  const input = document.getElementById('qrTargetUrlInput');
  if (input) input.value = url;
  renderModalQr(url);
  toast(`QR Code updated for: ${url}`, 'info');
};

window.updateModalQrCode = function() {
  const input = document.getElementById('qrTargetUrlInput');
  if (input && input.value.trim()) {
    renderModalQr(input.value.trim());
    toast('QR Code updated!', 'success');
  }
};

window.copyQrUrl = function(url) {
  navigator.clipboard.writeText(url).then(() => {
    toast('Network URL copied to clipboard!', 'success');
  }).catch(() => {
    toast(url, 'info');
  });
};

window.installPwaApp = async function() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast('Thank you for installing AeroSense!', 'success');
    }
    deferredPrompt = null;
  } else {
    toast('To install: In your phone browser, tap the Share/Menu button ➔ "Add to Home Screen"!', 'info');
  }
};

window.showQrCodeModal = showQrCodeModal;


// Global Export bindings
window.go = go;
window.logout = logout;
window.registerPage = registerPage;
window.loginPage = loginPage;
window.respond = respond;
window.toggleTheme = toggleTheme;
window.centerMapOnUser = centerMapOnUser;
window.flyToFamilyMember = flyToFamilyMember;
window.loadHospitals = loadHospitals;
window.toggleMobileSidebar = toggleMobileSidebar;
window.speakCurrentAdvisory = speakCurrentAdvisory;

// Boot
initTheme();
(async () => {
  if (await loadMe()) go('home');
  else loginPage();
})();
