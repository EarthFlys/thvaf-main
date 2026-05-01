// ========== DATA (loaded from JSON) ==========
let rosterData    = [];
let communityData = [];
let fleetData     = [];
let navlogData    = [];
let missionsData  = [];
let galleryImages = [];

// Derived after JSON loads — numeric IVAO VIDs for all members
let MEMBER_VIDS = [];

// ========== LOAD ALL JSON DATA ==========
async function loadAllData() {
    try {
        const [rosterJson, fleetJson, missionsJson, galleryJson] = await Promise.all([
            fetch('src/data/roster.json').then(r => r.json()),
            fetch('src/data/fleet.json').then(r => r.json()),
            fetch('src/data/missions.json').then(r => r.json()),
            fetch('src/data/gallery.json').then(r => r.json()),
        ]);

        rosterData    = rosterJson.roster    || [];
        communityData = rosterJson.community || [];
        fleetData     = Array.isArray(fleetJson) ? fleetJson : [];
        navlogData    = missionsJson.navlog   || [];
        missionsData  = missionsJson.missions || [];
        galleryImages = Array.isArray(galleryJson) ? galleryJson : [];

        // Build MEMBER_VIDS — numeric VIDs only (IVAO userId is always an integer)
        MEMBER_VIDS = [...rosterData, ...communityData]
            .filter(m => m.ivaoId)
            .flatMap(m =>
                m.ivaoId.split('/').map(vid => ({
                    vid:      vid.trim(),
                    callsign: m.callsign
                }))
            )
            .filter(m => /^\d+$/.test(m.vid));

    } catch (err) {
        console.error('Failed to load JSON data:', err);
    }
}

// ========== LIVE FLIGHT TRACKER ==========
function headingArrow(hdg) {
    const arrows = ['↑','↗','→','↘','↓','↙','←','↖'];
    return arrows[Math.round((hdg ?? 0) / 45) % 8];
}

async function fetchLiveFlights() {
    const container   = document.getElementById('liveFlights');
    const lastUpdated = document.getElementById('lastUpdated');
    if (!container) return;

    const memberVidSet = new Set(MEMBER_VIDS.map(m => m.vid));

    try {
        const response = await fetch('https://api.ivao.aero/v2/tracker/whazzup', {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
        });
        const data = await response.json();

        const allPilots     = data?.clients?.pilots ?? [];
        const activeMembers = allPilots.filter(p => memberVidSet.has(String(p.userId)));

        if (activeMembers.length === 0) {
            container.innerHTML = `
                <div class="no-flights sharp-card">
                    <i class="fas fa-moon"></i> No members currently flying on IVAO.
                </div>`;
        } else {
            container.innerHTML = activeMembers.map(pilot => {
                const member = MEMBER_VIDS.find(m => m.vid === String(pilot.userId));
                const fp     = pilot.flightPlan ?? pilot.flight_plan ?? {};
                const dep    = fp.departureId ?? fp.departure ?? 'N/A';
                const arr    = fp.arrivalId   ?? fp.arrival   ?? 'N/A';
                const ac     = fp.aircraftId  ?? fp.aircraft  ?? 'Unknown';
                const track  = pilot.lastTrack ?? pilot.last_track ?? {};
                const spd    = track.groundSpeed ?? 0;
                const alt    = track.altitude    ?? 0;
                const hdg    = track.heading     ?? 0;
                return `
                    <div class="flight-card sharp-card">
                        <div class="flight-header">
                            <span class="flight-callsign">${pilot.callsign}</span>
                            <span class="flight-member">${member?.callsign ?? 'Member'}</span>
                            <span class="mission-status status-pending">● LIVE</span>
                        </div>
                        <div class="flight-details">
                            <div class="flight-route">
                                <span>${dep}</span>
                                <i class="fas fa-arrow-right"></i>
                                <span>${arr}</span>
                            </div>
                            <div class="flight-stats">
                                <span><i class="fas fa-plane"></i> ${ac}</span>
                                <span><i class="fas fa-tachometer-alt"></i> ${spd} kts</span>
                                <span><i class="fas fa-mountain"></i> ${Number(alt).toLocaleString()} ft</span>
                                <span title="Heading">${headingArrow(hdg)} ${hdg}°</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const now = new Date();
        lastUpdated.textContent = `Last updated: ${now.toUTCString()} — ${activeMembers.length} member(s) online`;

    } catch (err) {
        console.error('Live flights error:', err);
        container.innerHTML = `
            <div class="no-flights sharp-card">
                <i class="fas fa-exclamation-triangle"></i> Unable to fetch live data. Will retry shortly.
            </div>`;
    }
}

// ========== RENDER FUNCTIONS ==========
function renderRoster() {
    const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 90 90'%3E%3Crect width='90' height='90' fill='%23333'/%3E%3Ccircle cx='45' cy='35' r='18' fill='%23666'/%3E%3Cellipse cx='45' cy='75' rx='28' ry='20' fill='%23666'/%3E%3C/svg%3E";
    const grid = document.getElementById('rosterGrid');
    if (!grid) return;
    grid.innerHTML = rosterData.map(m => `
        <div class="sharp-card member-card">
            <div class="member-avatar">
                <img src="${m.image || DEFAULT_AVATAR}" alt="${m.callsign}"
                     onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}';">
            </div>
            <div class="member-rank">${m.rank}</div>
            <div class="member-callsign">${m.callsign}</div>
            <div class="member-name"><i class="fas fa-user-tie"></i> ${m.name}</div>
            <div class="member-role"><i class="fas fa-bolt"></i> ${m.role || ''}</div>
            <div style="margin-top:10px;font-size:0.75rem;"><i class="fas fa-id-card"></i> IVAO: ${m.ivaoId}</div>
            <div style="margin-top:6px;"><i class="fas fa-check-circle" style="color:var(--accent);"></i> Active</div>
        </div>
    `).join('');
}

function renderCommunity() {
    const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 90 90'%3E%3Crect width='90' height='90' fill='%23333'/%3E%3Ccircle cx='45' cy='35' r='18' fill='%23666'/%3E%3Cellipse cx='45' cy='75' rx='28' ry='20' fill='%23666'/%3E%3C/svg%3E";
    const grid = document.getElementById('communityGrid');
    if (!grid) return;
    grid.innerHTML = communityData.map(m => `
        <div class="sharp-card member-card">
            <div class="member-avatar">
                <img src="${m.image || DEFAULT_AVATAR}" alt="${m.callsign}"
                     onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}';">
            </div>
            <div class="member-rank">${m.rank}</div>
            <div class="member-callsign">${m.callsign}</div>
            <div class="member-name"><i class="fas fa-user-tie"></i> ${m.name}</div>
            <div style="margin-top:10px;font-size:0.75rem;"><i class="fas fa-id-card"></i> IVAO: ${m.ivaoId}</div>
            <div style="margin-top:6px;"><i class="fas fa-check-circle" style="color:var(--accent);"></i> Active</div>
        </div>
    `).join('');
}

function renderFleet(category = 'all') {
    const grid = document.getElementById('fleetGrid');
    if (!grid) return;

    const filtered = category === 'all' ? fleetData : fleetData.filter(ac => ac.category === category);
    const categoryNames   = { fighter: 'FIGHTER', transport: 'TRANSPORT', trainer: 'TRAINER', aew: 'AEW' };
    const categoryClasses = { fighter: 'category-fighter', transport: 'category-transport', trainer: 'category-trainer', aew: 'category-aew' };

    grid.innerHTML = filtered.map(ac => {
        const actualIndex = fleetData.findIndex(item => item.name === ac.name);
        return `
            <div class="sharp-card fleet-card" data-fleet-index="${actualIndex}">
                <div class="fleet-img" style="background-image:url('${ac.image}');background-size:cover;background-position:center;"></div>
                <div class="fleet-info">
                    <h3>${ac.name}</h3>
                    <p style="font-weight:600;font-size:1.0rem;">${ac.role} | ${ac.origin}</p>
                    <span class="fleet-category ${categoryClasses[ac.category]}">${categoryNames[ac.category] || ac.category.toUpperCase()}</span>
                    <span class="fleet-badge"><i class="fas fa-info-circle"></i> Information</span>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.fleet-card').forEach(card => {
        card.addEventListener('click', () => {
            const idx = card.getAttribute('data-fleet-index');
            if (idx !== null) showFleetModal(parseInt(idx));
        });
    });

    if (filtered.length === 0)
        grid.innerHTML = '<div class="no-data" style="grid-column:1/-1;text-align:center;padding:3rem;">In Progress</div>';
}

function initFleetFilters() {
    document.querySelectorAll('.fleet-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fleet-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderFleet(btn.getAttribute('data-category'));
        });
    });
}

function showFleetModal(index) {
    const aircraft = fleetData[index];
    if (!aircraft) return;
    document.getElementById('modalBody').innerHTML = `
        <div style="height:200px;background-image:url('${aircraft.image}');background-size:cover;background-position:center;border-radius:12px;margin-bottom:1rem;"></div>
        <h2 style="font-family:'Rajdhani',monospace;margin:0.5rem 0;">${aircraft.name}</h2>
        <p style="color:var(--accent);font-weight:700;font-size:1.0rem;">${aircraft.role}</p>
        <p style="margin:0.8rem 0;line-height:1.5;">${aircraft.desc}</p>
        <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:1rem;margin:1rem 0;text-align:left;">
            <strong style="color:var(--gold);"><i class="fas fa-microchip"></i> Technical Information</strong><br>
            <span style="font-size:0.85rem;">${aircraft.specs}</span><br><br>
            <strong style="color:var(--gold);"><i class="fas fa-industry"></i> Origin</strong><br>
            <span style="font-size:0.85rem;">${aircraft.origin}</span>
        </div>
        <div style="display:flex;gap:1rem;justify-content:center;margin-top:1rem;">
            <button onclick="closeFleetModal()" style="background:var(--accent);border:none;padding:0.5rem 1.5rem;border-radius:30px;font-weight:bold;cursor:pointer;">Close</button>
        </div>
    `;
    document.getElementById('fleetModal').classList.add('active');
}

function closeFleetModal() {
    document.getElementById('fleetModal').classList.remove('active');
}
window.closeFleetModal = closeFleetModal;

function renderNavlog(filter = 'all') {
    const container = document.getElementById('missionList');
    if (!container) return;
    let filtered = navlogData;
    if (filter === 'ongoing')   filtered = navlogData.filter(m => m.status === 'pending');
    if (filter === 'completed') filtered = navlogData.filter(m => m.status === 'completed');
    const statusText  = { pending: 'PLANNED', completed: 'DONE' };
    const statusClass = { pending: 'status-pending', completed: 'status-completed' };
    container.innerHTML = filtered.map(m => `
        <div class="navlog-row">
            <div class="nl-col">${m.id}</div>
            <div class="nl-col">${m.dep}</div>
            <div class="nl-col">${m.arr}</div>
            <div class="nl-col">${m.aircraft}</div>
            <div class="nl-col"><span class="mission-status ${statusClass[m.status]}">${statusText[m.status]}</span></div>
        </div>
    `).join('');
    if (filtered.length === 0)
        container.innerHTML = '<div class="navlog-row"><div class="nl-col">No mission data available</div></div>';
}

function renderMissions(filter = 'all') {
    const container = document.getElementById('missionsList');
    if (!container) return;
    let filtered = missionsData;
    if (filter === 'pending')   filtered = missionsData.filter(m => m.status === 'pending');
    if (filter === 'completed') filtered = missionsData.filter(m => m.status === 'completed');
    if (filter === 'planned')   filtered = missionsData.filter(m => m.status === 'planned');
    const statusText  = { pending: 'PENDING', completed: 'COMPLETED', planned: 'PLANNED' };
    const statusClass = { pending: 'status-pending', completed: 'status-completed', planned: 'status-planned' };
    container.innerHTML = filtered.map(m => `
        <div class="mission-item">
            <div>
                <div class="mission-date"><i class="far fa-calendar-alt"></i> ${m.date}</div>
                <div class="mission-title">${m.title}</div>
                <div class="mission-desc">${m.description}</div>
            </div>
            <span class="mission-status ${statusClass[m.status]}">${statusText[m.status]}</span>
        </div>
    `).join('');
    if (filtered.length === 0)
        container.innerHTML = '<div class="sharp-card" style="padding:2rem;text-align:center;">No missions found</div>';
}

function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = galleryImages.map(imageUrl => `
        <div class="gallery-item">
            <img src="${imageUrl}" alt="Thai VAF" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">
        </div>
    `).join('');
}

// ========== MODAL CONTROLS ==========
const modal      = document.getElementById('fleetModal');
const modalClose = document.querySelector('.modal-close');
if (modalClose) modalClose.addEventListener('click', () => modal.classList.remove('active'));
modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

// ========== PAGE ROUTING ==========
const pages = {
    home:        document.getElementById('homePage'),
    roster:      document.getElementById('rosterPage'),
    fleet:       document.getElementById('fleetPage'),
    missions:    document.getElementById('missionsPage'),
    pastflights: document.getElementById('pastflightsPage'),
    gallery:     document.getElementById('galleryPage')
};
const navLinks = document.querySelectorAll('.nav-link');

function showPage(pageId) {
    if (!pageId) return;
    pageId = String(pageId).replace('#', '').trim();
    Object.values(pages).forEach(p => p?.classList.add('hidden-page'));
    pages[pageId]?.classList.remove('hidden-page');
    navLinks.forEach(link => {
        link.classList.remove('active-page');
        if (link.getAttribute('data-page') === pageId) link.classList.add('active-page');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function routeToHash() {
    const hash = window.location.hash.replace('#', '').trim();
    showPage(hash && pages[hash] ? hash : 'home');
}

navLinks.forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        if (page) { window.location.hash = page; showPage(page); }
        document.getElementById('navLinks')?.classList.remove('show');
    });
});
window.addEventListener('hashchange', routeToHash);

// ========== FILTERS ==========
function initFilters() {
    document.querySelectorAll('#missionFiltersHome .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#missionFiltersHome .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNavlog(btn.getAttribute('data-filter'));
        });
    });
    document.querySelectorAll('#missionFiltersPage .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#missionFiltersPage .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMissions(btn.getAttribute('data-filter'));
        });
    });
}

// ========== MOBILE MENU ==========
document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('navLinks')?.classList.toggle('show');
});

// ========== HERO SLIDESHOW ==========
function initHeroSlideshow() {
    const slides = document.querySelectorAll('.hero-slideshow .slide');
    if (!slides.length) return;
    let current = 0;
    setInterval(() => {
        slides[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
    }, 5000);
}

// ========== INIT ==========
window.addEventListener('load', async () => {
    await loadAllData();

    renderRoster();
    renderCommunity();
    renderFleet('all');
    renderNavlog('all');
    renderMissions('all');
    renderGallery();
    initFilters();
    initFleetFilters();
    initHeroSlideshow();

    fetchLiveFlights();
    setInterval(fetchLiveFlights, 15000);

    if (!window.location.hash) {
        window.location.hash = 'home';
    } else {
        routeToHash();
    }
});

// ========== PAST FLIGHTS (30 DAYS) ==========
(function () {
    let allFlights      = [];
    let filteredFlights = [];
    let currentPage     = 1;
    const PAGE_SIZE     = 20;
    let loaded          = false;

    function fmtDuration(min) {
        if (!min && min !== 0) return '—';
        return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
    }
    function fmtDate(iso) {
        if (!iso) return '—';
        try { return new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + 'Z'; }
        catch { return iso; }
    }
    function escHtml(s) {
        return String(s || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function get30DaysAgo() {
        const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString();
    }

    async function fetchPastFlights() {
        showLoading();
        const numericMembers = MEMBER_VIDS.filter(m => /^\d+$/.test(m.vid));
        const from = get30DaysAgo();
        let flights = [];

        const results = await Promise.allSettled(
            numericMembers.map(async member => {
                const resp = await fetch(
                    `https://api.ivao.aero/v2/tracker/${member.vid}/pilot/tracks`,
                    { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) }
                );
                if (!resp.ok) return [];
                const json   = await resp.json();
                const tracks = Array.isArray(json) ? json : (json.items || json.data || []);
                return tracks
                    .filter(t => (t.departureTime || t.startTime || t.createdAt || '') >= from)
                    .map(t => normalise(t, member));
            })
        );

        results.forEach(r => { if (r.status === 'fulfilled') flights.push(...r.value.filter(Boolean)); });
        flights.sort((a, b) => new Date(b.date) - new Date(a.date));
        allFlights = flights;
        updateSummary();
        applyFiltersAndRender();
    }

    function normalise(t, member) {
        try {
            const fp  = t.flightPlan || t.flight_plan || {};
            const dep = fp.departureId || fp.departure || '????';
            const arr = fp.arrivalId   || fp.arrival   || '????';
            const ac  = fp.aircraftId  || fp.aircraft  || '?';
            const depTime = t.departureTime || t.startTime || t.createdAt;
            const arrTime = t.arrivalTime   || t.endTime   || t.updatedAt;
            let durationMin = null;
            if (depTime && arrTime) {
                durationMin = Math.round((new Date(arrTime) - new Date(depTime)) / 60000);
                if (durationMin < 0 || durationMin > 1440) durationMin = null;
            }
            return { callsign: t.callsign || member.callsign, pilot: member.callsign, dep, arr, ac, duration: durationMin, date: depTime || arrTime || '' };
        } catch { return null; }
    }

    function showLoading() {
        const tb = document.getElementById('pfTableBody');
        if (tb) tb.innerHTML = `<tr><td colspan="6" style="padding:3rem;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading past flights from IVAO...</td></tr>`;
        const pg = document.getElementById('pfPagination'); if (pg) pg.innerHTML = '';
        const ib = document.getElementById('pfInfoBar');    if (ib) ib.textContent = '';
    }

    function updateSummary() {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('pfTotalFlights',   allFlights.length);
        set('pfTotalHours',     (allFlights.reduce((s,f) => s+(f.duration||0), 0)/60).toFixed(1));
        set('pfUniquePilots',   new Set(allFlights.map(f=>f.pilot)).size);
        set('pfUniqueAircraft', new Set(allFlights.map(f=>f.ac)).size);
    }

    function applyFiltersAndRender() {
        const query = (document.getElementById('pfSearch')?.value || '').toLowerCase().trim();
        const sort  = document.getElementById('pfSort')?.value || 'date_desc';
        filteredFlights = query
            ? allFlights.filter(f => [f.callsign,f.pilot,f.dep,f.arr,f.ac].some(v=>(v||'').toLowerCase().includes(query)))
            : [...allFlights];
        filteredFlights.sort((a, b) => {
            switch (sort) {
                case 'date_asc':      return new Date(a.date) - new Date(b.date);
                case 'duration_desc': return (b.duration||0) - (a.duration||0);
                case 'duration_asc':  return (a.duration||0) - (b.duration||0);
                case 'callsign_asc':  return (a.callsign||'').localeCompare(b.callsign||'');
                default:              return new Date(b.date) - new Date(a.date);
            }
        });
        currentPage = 1;
        renderTable();
        renderPagination();
    }

    function renderTable() {
        const tbody   = document.getElementById('pfTableBody');
        const infoBar = document.getElementById('pfInfoBar');
        if (!tbody) return;
        if (filteredFlights.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:3rem;text-align:center;color:#888;"><i class="fas fa-search"></i> No flights found for your members in the last 30 days.</td></tr>`;
            if (infoBar) infoBar.textContent = '';
            return;
        }
        const start = (currentPage - 1) * PAGE_SIZE;
        const end   = Math.min(start + PAGE_SIZE, filteredFlights.length);
        if (infoBar) infoBar.textContent = `Showing ${start+1}–${end} of ${filteredFlights.length} flight(s)`;
        tbody.innerHTML = filteredFlights.slice(start, end).map(f => `
            <tr>
                <td style="font-family:'Orbitron',monospace;font-size:0.78rem;font-weight:600;color:#fff;">${escHtml(f.callsign)}</td>
                <td style="font-size:0.8rem;">${escHtml(f.pilot)}</td>
                <td style="font-family:'Rajdhani',sans-serif;font-weight:600;font-size:0.9rem;">
                    ${escHtml(f.dep)}<span style="color:#4fc3f7;margin:0 6px;">›</span>${escHtml(f.arr)}
                </td>
                <td><span style="display:inline-block;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);padding:2px 8px;border-radius:3px;font-size:0.74rem;font-family:'Rajdhani',sans-serif;font-weight:600;">${escHtml(f.ac)}</span></td>
                <td style="font-family:'Orbitron',monospace;font-size:0.76rem;color:#a5d6a7;">${fmtDuration(f.duration)}</td>
                <td style="font-size:0.78rem;color:#90a4ae;">${fmtDate(f.date)}</td>
            </tr>
        `).join('');
    }

    function renderPagination() {
        const container  = document.getElementById('pfPagination');
        if (!container) return;
        const totalPages = Math.ceil(filteredFlights.length / PAGE_SIZE);
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = '';
        if (currentPage > 1) html += `<button class="pf-page-btn" data-p="${currentPage-1}">‹ Prev</button>`;
        for (let p = 1; p <= totalPages; p++) {
            if (p === 1 || p === totalPages || Math.abs(p-currentPage) <= 2)
                html += `<button class="pf-page-btn ${p===currentPage?'active':''}" data-p="${p}">${p}</button>`;
            else if (Math.abs(p-currentPage) === 3)
                html += `<span style="color:#666;padding:0 4px">…</span>`;
        }
        if (currentPage < totalPages) html += `<button class="pf-page-btn" data-p="${currentPage+1}">Next ›</button>`;
        container.innerHTML = html;
        container.querySelectorAll('.pf-page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.p);
                renderTable(); renderPagination();
                document.getElementById('pastflightsPage')?.scrollIntoView({ behavior:'smooth', block:'start' });
            });
        });
    }

    function tryLoad() {
        if (!loaded) { loaded = true; fetchPastFlights(); }
    }

    function init() {
        document.getElementById('pfSearch')?.addEventListener('input', applyFiltersAndRender);
        document.getElementById('pfSort')?.addEventListener('change', applyFiltersAndRender);
        document.querySelectorAll('[data-page="pastflights"]').forEach(link => {
            link.addEventListener('click', () => setTimeout(tryLoad, 100));
        });
        const target = document.getElementById('pastflightsPage');
        if (target) {
            new MutationObserver(() => {
                if (!target.classList.contains('hidden-page')) tryLoad();
            }).observe(target, { attributes: true, attributeFilter: ['class'] });
        }
        if (window.location.hash === '#pastflights') tryLoad();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
