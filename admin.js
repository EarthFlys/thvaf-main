// ====== CONFIG ======
// ⚠️  Token is NEVER stored in source code — only in localStorage.
//     Enter your token, owner, and repo in the Settings tab.
let CONFIG = {
  token: "",
  owner: "karnnithi2548-ops",
  repo: "VTAF",
  branch: "main",
  paths: {
    roster: "src/data/roster.json",
    missions: "src/data/missions.json",
    fleet: "src/data/fleet.json",
    gallery: "src/data/gallery.json",
  },
};
let activityLog = [];
let currentFile = null;
let currentFileSHA = null;

function parseJsonArrayOrKey(f, keys = []) {
  try {
    const root = JSON.parse(f.content);
    if (Array.isArray(root)) return { data: root, root, key: null };
    for (const key of keys) {
      if (Array.isArray(root[key])) return { data: root[key], root, key };
    }
    return { data: [], root, key: null };
  } catch (e) {
    return { data: [], root: null, key: null };
  }
}

function buildJsonContent(parsed, data, defaultKey) {
  if (!parsed.root || Array.isArray(parsed.root) || parsed.key === null) {
    return JSON.stringify(data, null, 2);
  }
  const updated = { ...parsed.root, [parsed.key]: data };
  return JSON.stringify(updated, null, 2);
}
// ====== PASSWORD GATE ======
const ADMIN_PASSWORD = "iloveivaothailandjubjub";

function checkPassword() {
  const input = document.getElementById('pwInput').value;
  const CORRECT = 'iloveivaothailandjubjub';

  if (input === CORRECT) {
    sessionStorage.setItem('tvaf_auth', '1');
    document.getElementById('passwordGate').style.display = 'none';
    bootSequence();
  } else {
    const inp = document.getElementById('pwInput');
    document.getElementById('pwError').textContent = 'Incorrect password.';
    inp.classList.add('shake');
    setTimeout(() => inp.classList.remove('shake'), 500);
  }
}

// ====== INIT ======
window.onload = () => {
  // Check if already authenticated this session
  if (sessionStorage.getItem("tvaf_auth") === "1") {
    document.getElementById("passwordGate").style.display = "none";
    bootSequence();
  }
  // Otherwise password gate stays visible
};

async function bootSequence() {
  loadConfig();
  if (!CONFIG.token) {
    showSetupModal();
    await checkGitHub();
    loadDashboard();
    return;
  }
  await bootAdmin();
}

function showSetupModal() {
  const m = document.getElementById("setupModal");
  if (m) {
    m.style.display = "flex";
  }
  // Pre-fill if partially saved
  if (document.getElementById("setupToken"))
    document.getElementById("setupToken").value = CONFIG.token || "";
  if (document.getElementById("setupOwner"))
    document.getElementById("setupOwner").value = CONFIG.owner || "";
  if (document.getElementById("setupRepo"))
    document.getElementById("setupRepo").value = CONFIG.repo || "";
  if (document.getElementById("setupBranch"))
    document.getElementById("setupBranch").value = CONFIG.branch || "main";
}

function applySetup() {
  const token = (document.getElementById("setupToken")?.value || "").trim();
  const branch = (
    document.getElementById("setupBranch")?.value || "main"
  ).trim();
  if (!token) {
    toast("Please paste your GitHub token", "error");
    return;
  }
  CONFIG.token = token;
  CONFIG.branch = branch;
  persistConfig();
  const s = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  s("settingsToken", token);
  s("settingsBranch", branch);
  document.getElementById("setupModal").style.display = "none";
  toast("Token saved — connecting to karnnithi2548-ops/VTAF...", "success");
  bootAdmin();
}

function dismissSetup() {
  document.getElementById("setupModal").style.display = "none";
  bootAdmin();
}

async function bootAdmin() {
  await checkGitHub();
  loadDashboard();
  loadRosterData();
  loadMissionsData();
  loadFleetData();
  loadGalleryData();
  loadFileTree();
  loadCommits();
}

function loadConfig() {
  try {
    const saved = localStorage.getItem("tvaf_config");
    if (saved) {
      const c = JSON.parse(saved);
      if (c.token) CONFIG.token = c.token;
      // Only override owner/repo from localStorage if they were actually set
      if (c.owner && c.owner !== "karnnithi2548-ops") CONFIG.owner = c.owner;
      if (c.repo && c.repo !== "VTAF") CONFIG.repo = c.repo;
      if (c.branch) CONFIG.branch = c.branch;
      if (c.paths && typeof c.paths === "object") {
        Object.assign(CONFIG.paths, c.paths);
      }
    }
  } catch (e) {
    console.warn("TVAF: Could not load config", e);
  }
  const s = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  s("settingsToken", CONFIG.token);
  s("settingsOwner", CONFIG.owner);
  s("settingsRepo", CONFIG.repo);
  s("settingsBranch", CONFIG.branch || "main");
  s("pathRoster", CONFIG.paths.roster);
  s("pathMissions", CONFIG.paths.missions);
  s("pathFleet", CONFIG.paths.fleet);
  s("pathGallery", CONFIG.paths.gallery);
}

function saveSettings() {
  CONFIG.token = (document.getElementById("settingsToken")?.value || "").trim();
  CONFIG.owner = (document.getElementById("settingsOwner")?.value || "").trim();
  CONFIG.repo = (document.getElementById("settingsRepo")?.value || "").trim();
  CONFIG.branch = (
    document.getElementById("settingsBranch")?.value || "main"
  ).trim();
  persistConfig();
  const el = document.getElementById("settingsStatus");
  if (el) {
    el.textContent = "✓ Saved";
    setTimeout(() => (el.textContent = ""), 2000);
  }
  toast("Settings saved — testing connection...", "success");
  checkGitHub();
  // If all set, load data sections
  if (CONFIG.token && CONFIG.owner && CONFIG.repo) {
    loadRosterData();
    loadMissionsData();
    loadFleetData();
    loadGalleryData();
    loadFileTree();
    loadCommits();
  }
}

function persistConfig() {
  localStorage.setItem("tvaf_config", JSON.stringify(CONFIG));
}

function savePaths() {
  CONFIG.paths.roster = (
    document.getElementById("pathRoster")?.value || CONFIG.paths.roster
  ).trim();
  CONFIG.paths.missions = (
    document.getElementById("pathMissions")?.value || CONFIG.paths.missions
  ).trim();
  CONFIG.paths.fleet = (
    document.getElementById("pathFleet")?.value || CONFIG.paths.fleet
  ).trim();
  CONFIG.paths.gallery = (
    document.getElementById("pathGallery")?.value || CONFIG.paths.gallery
  ).trim();
  persistConfig();
  toast("Paths saved!", "success");
}

// ====== GITHUB API ======
async function ghFetch(path, opts = {}) {
  const base = `https://api.github.com`;
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `token ${CONFIG.token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function getFile(path) {
  if (!CONFIG.owner || !CONFIG.repo) return null;
  try {
    const d = await ghFetch(
      `/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`,
    );
    const content = atob(d.content.replace(/\n/g, ""));
    return { content, sha: d.sha, raw: d };
  } catch (e) {
    return null;
  }
}

async function putFile(path, content, sha, message) {
  const body = {
    message: message || `Admin update: ${path}`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: CONFIG.branch,
  };
  if (sha) body.sha = sha;
  return ghFetch(`/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function checkGitHub() {
  const dot = document.getElementById("ghStatusDot");
  const txt = document.getElementById("ghStatusText");
  dot.style.background = "#f59e0b";
  txt.textContent = "Connecting...";
  try {
    if (!CONFIG.token) throw new Error("No token");
    const user = await ghFetch("/user");
    dot.style.background = "var(--green)";
    if (CONFIG.owner && CONFIG.repo) {
      txt.textContent = `${CONFIG.owner}/${CONFIG.repo}`;
      const ri = document.getElementById("repoInfo");
      if (ri) {
        const repo = await ghFetch(`/repos/${CONFIG.owner}/${CONFIG.repo}`);
        ri.innerHTML = `
          <div class="config-row" style="padding:8px 0;"><div class="config-label">Repository</div><div style="font-size:13px;color:var(--accent2);">${repo.full_name}</div></div>
          <div class="config-row" style="padding:8px 0;"><div class="config-label">Branch</div><div style="font-size:13px;color:var(--text);">${CONFIG.branch}</div></div>
          <div class="config-row" style="padding:8px 0;"><div class="config-label">Stars</div><div style="font-size:13px;color:var(--gold);">${repo.stargazers_count}</div></div>
          <div class="config-row" style="padding:8px 0;"><div class="config-label">Last Push</div><div style="font-size:13px;color:var(--text2);">${new Date(repo.pushed_at).toLocaleString()}</div></div>
          <div class="config-row" style="padding:8px 0;"><div class="config-label">Visibility</div><div><span class="badge ${repo.private ? "badge-red" : "badge-green"}">${repo.private ? "Private" : "Public"}</span></div></div>
          <div style="margin-top:16px;"><a href="${repo.html_url}" target="_blank" class="btn btn-ghost" style="display:inline-flex;font-size:11px;padding:6px 14px;"><i class="fab fa-github"></i> Open on GitHub</a></div>
        `;
      }
      document.getElementById("ghStatusCard").innerHTML =
        `<div class="gh-status"><div class="gh-dot ok"></div> Connected to <strong>${CONFIG.owner}/${CONFIG.repo}</strong> (${CONFIG.branch})</div>`;
    } else {
      txt.textContent = `@${user.login}`;
      document.getElementById("ghStatusCard").innerHTML =
        `<div class="gh-status"><div class="gh-dot ok"></div> Authenticated as <strong>${user.login}</strong> — please set repo owner & name in Settings.</div>`;
      if (document.getElementById("repoInfo"))
        document.getElementById("repoInfo").innerHTML =
          `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Set repo owner & name in Settings</p></div>`;
    }
  } catch (e) {
    dot.style.background = "var(--red)";
    txt.textContent = "Disconnected";
    document.getElementById("ghStatusCard").innerHTML =
      `<div class="gh-status"><div class="gh-dot err"></div> ${e.message}</div>`;
    if (document.getElementById("repoInfo"))
      document.getElementById("repoInfo").innerHTML =
        `<div class="empty-state"><i class="fas fa-times-circle"></i><p>${e.message}</p></div>`;
  }
}

// ====== DASHBOARD ======
async function loadDashboard() {
  loadCommitsPanel();
  addActivity(
    "info",
    "fas fa-sign-in-alt",
    "Admin session started",
    new Date().toLocaleString(),
  );
}

async function loadCommitsPanel() {
  const el = document.getElementById("recentCommits");
  if (!el) return;
  if (!CONFIG.owner || !CONFIG.repo) {
    el.innerHTML =
      '<div class="empty-state"><i class="fas fa-cog"></i><p>Configure repo in Settings</p></div>';
    return;
  }
  try {
    const commits = await ghFetch(
      `/repos/${CONFIG.owner}/${CONFIG.repo}/commits?per_page=5`,
    );
    document.getElementById("statCommits").textContent = commits.length;
    el.innerHTML = commits
      .map(
        (c) => `
      <div class="activity-item">
        <div class="act-icon blue"><i class="fas fa-code-commit"></i></div>
        <div class="act-text">
          <div class="at-title">${c.commit.message.split("\n")[0].substring(0, 60)}${c.commit.message.length > 60 ? "..." : ""}</div>
          <div class="at-sub">${c.commit.author.name} · ${new Date(c.commit.author.date).toLocaleString()}</div>
        </div>
      </div>`,
      )
      .join("");
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation"></i><p>${e.message}</p></div>`;
  }
}

// ====== ROSTER ======
async function loadRosterData() {
  console.log("Loading roster data...");
  const wrap = document.getElementById("rosterTableWrap");
  if (!wrap) return;
  const f = await getFile(CONFIG.paths.roster);
  console.log("Roster file:", f);
  if (!f) {
    wrap.innerHTML =
      '<div class="empty-state"><i class="fas fa-users-slash"></i><p>No roster file found at ' +
      CONFIG.paths.roster +
      '</p><p style="font-size:12px;margin-top:8px;color:var(--text3);">Make sure GitHub token is configured in Settings tab.</p></div>';
    document.getElementById("statPilots").textContent = "0";
    return;
  }
  const parsed = parseJsonArrayOrKey(f, ["roster"]);
  console.log("Parsed roster:", parsed);
  const data = parsed.data;
  document.getElementById("statPilots").textContent = data.length;
  if (!data.length) {
    wrap.innerHTML =
      '<div class="empty-state"><i class="fas fa-users"></i><p>No pilots in roster</p></div>';
    return;
  }
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Callsign</th><th>Name</th><th>VID</th><th>Rank</th><th>Aircraft</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${data
      .map(
        (p, i) => `<tr>
      <td><strong style="color:#fff;font-family:'Rajdhani',sans-serif;letter-spacing:1px;">${p.callsign || "—"}</strong></td>
      <td>${p.name || "—"}</td>
      <td style="color:var(--accent2);">${p.vid || "—"}</td>
      <td>${p.rank || "—"}</td>
      <td>${p.aircraft || "—"}</td>
      <td><span class="badge ${p.status === "active" ? "badge-green" : p.status === "reserve" ? "badge-gold" : "badge-gray"}">${p.status || "unknown"}</span></td>
      <td>
        <button class="btn btn-ghost" style="padding:4px 10px;font-size:10px;" onclick="editRoster(${i})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger" style="padding:4px 10px;font-size:10px;margin-left:4px;" onclick="deleteRoster(${i})"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

let rosterEditIndex = -1;
async function editRoster(i) {
  const f = await getFile(CONFIG.paths.roster);
  if (!f) return;
  const parsed = parseJsonArrayOrKey(f, ["roster"]);
  const p = parsed.data[i];
  rosterEditIndex = i;
  document.getElementById("rCallsign").value = p.callsign || "";
  document.getElementById("rName").value = p.name || "";
  document.getElementById("rVID").value = p.vid || "";
  document.getElementById("rRank").value = p.rank || "Flight Cadet";
  document.getElementById("rAircraft").value = p.aircraft || "";
  document.getElementById("rStatus").value = p.status || "active";
  document.getElementById("rJoinDate").value = p.joinDate || "";
  document.getElementById("rRole").value = p.role || "member";
  navigate("roster");
  toast("Pilot loaded for editing", "info");
}

async function deleteRoster(i) {
  confirm(
    "Remove Pilot",
    "This will permanently delete this pilot from the roster.",
    async () => {
      const f = await getFile(CONFIG.paths.roster);
      if (!f) return;
      const parsed = parseJsonArrayOrKey(f, ["roster"]);
      const data = parsed.data;
      const removed = data.splice(i, 1);
      const content = buildJsonContent(parsed, data, "roster");
      await putFile(
        CONFIG.paths.roster,
        content,
        f.sha,
        `Remove pilot: ${removed[0]?.callsign}`,
      );
      toast("Pilot removed", "success");
      addActivity(
        "red",
        "fas fa-user-minus",
        `Removed pilot: ${removed[0]?.callsign}`,
        new Date().toLocaleString(),
      );
      loadRosterData();
    },
  );
}

async function saveRoster() {
  const btn = event.target.closest("button");
  btn.disabled = true;
  const status = document.getElementById("rosterSaveStatus");
  status.textContent = "Saving...";
  try {
    const f = await getFile(CONFIG.paths.roster);
    let parsed = { data: [], root: null, key: null };
    let sha = null;
    if (f) {
      parsed = parseJsonArrayOrKey(f, ["roster"]);
      sha = f.sha;
    }
    const data = parsed.data;
    const pilot = {
      callsign: document.getElementById("rCallsign").value.trim().toUpperCase(),
      name: document.getElementById("rName").value.trim(),
      vid: document.getElementById("rVID").value.trim(),
      rank: document.getElementById("rRank").value,
      aircraft: document.getElementById("rAircraft").value.trim(),
      status: document.getElementById("rStatus").value,
      joinDate: document.getElementById("rJoinDate").value,
      role: document.getElementById("rRole").value,
    };
    if (rosterEditIndex >= 0) {
      data[rosterEditIndex] = pilot;
      rosterEditIndex = -1;
    } else {
      data.push(pilot);
    }
    const content = buildJsonContent(parsed, data, "roster");
    await putFile(
      CONFIG.paths.roster,
      content,
      sha,
      `Update roster: ${pilot.callsign}`,
    );
    toast(`Pilot ${pilot.callsign} saved!`, "success");
    addActivity(
      "green",
      "fas fa-user-plus",
      `Saved pilot: ${pilot.callsign}`,
      new Date().toLocaleString(),
    );
    clearRosterForm();
    loadRosterData();
    status.textContent = "";
  } catch (e) {
    toast("Error: " + e.message, "error");
    status.textContent = "Error!";
  }
  btn.disabled = false;
}

function clearRosterForm() {
  ["rCallsign", "rName", "rVID", "rAircraft", "rJoinDate"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  document.getElementById("rRank").value = "Flight Cadet";
  document.getElementById("rStatus").value = "active";
  document.getElementById("rRole").value = "member";
  rosterEditIndex = -1;
}

// ====== MISSIONS ======
async function loadMissionsData() {
  console.log("Loading missions data...");
  const wrap = document.getElementById("missionsTableWrap");
  if (!wrap) return;
  const f = await getFile(CONFIG.paths.missions);
  console.log("Missions file:", f);
  if (!f) {
    wrap.innerHTML =
      '<div class="empty-state"><i class="fas fa-crosshairs"></i><p>No missions file found</p><p style="font-size:12px;margin-top:8px;color:var(--text3);">Make sure GitHub token is configured in Settings tab.</p></div>';
    document.getElementById("statMissions").textContent = "0";
    return;
  }
  const parsed = parseJsonArrayOrKey(f, ["missions"]);
  console.log("Parsed missions:", parsed);
  const data = parsed.data;
  document.getElementById("statMissions").textContent = data.length;
  if (!data.length) {
    wrap.innerHTML =
      '<div class="empty-state"><i class="fas fa-crosshairs"></i><p>No missions yet</p></div>';
    return;
  }
  const statusBadge = (s) =>
    ({
      planned: "badge-blue",
      pending: "badge-gold",
      ongoing: "badge-green",
      completed: "badge-gray",
      cancelled: "badge-red",
    })[s] || "badge-gray";
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Mission ID</th><th>Callsign</th><th>DEP</th><th>ARR</th><th>Aircraft</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${data
      .map(
        (m, i) => `<tr>
      <td><strong style="color:#fff;font-family:'Orbitron',monospace;font-size:11px;">${m.id || "—"}</strong></td>
      <td style="color:var(--accent2);">${m.callsign || "—"}</td>
      <td>${m.dep || "—"}</td>
      <td>${m.arr || "—"}</td>
      <td>${m.aircraft || "—"}</td>
      <td style="color:var(--text3);">${m.date || "—"}</td>
      <td><span class="badge ${statusBadge(m.status)}">${m.status || "unknown"}</span></td>
      <td>
        <button class="btn btn-ghost" style="padding:4px 10px;font-size:10px;" onclick="editMission(${i})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger" style="padding:4px 10px;font-size:10px;margin-left:4px;" onclick="deleteMission(${i})"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

let missionEditIndex = -1;
async function editMission(i) {
  const f = await getFile(CONFIG.paths.missions);
  if (!f) return;
  const parsed = parseJsonArrayOrKey(f, ["missions"]);
  const m = parsed.data[i];
  missionEditIndex = i;
  document.getElementById("mID").value = m.id || "";
  document.getElementById("mCallsign").value = m.callsign || "";
  document.getElementById("mStatus").value = m.status || "planned";
  document.getElementById("mDep").value = m.dep || "";
  document.getElementById("mArr").value = m.arr || "";
  document.getElementById("mAircraft").value = m.aircraft || "";
  document.getElementById("mDate").value = m.date || "";
  document.getElementById("mTime").value = m.time || "";
  document.getElementById("mAlt").value = m.altitude || "";
  document.getElementById("mNotes").value = m.notes || "";
  navigate("missions");
  toast("Mission loaded for editing", "info");
}

async function deleteMission(i) {
  confirm(
    "Delete Mission",
    "This will permanently delete this mission.",
    async () => {
      const f = await getFile(CONFIG.paths.missions);
      if (!f) return;
      const parsed = parseJsonArrayOrKey(f, ["missions"]);
      const data = parsed.data;
      const removed = data.splice(i, 1);
      const content = buildJsonContent(parsed, data, "missions");
      await putFile(
        CONFIG.paths.missions,
        content,
        f.sha,
        `Delete mission: ${removed[0]?.id}`,
      );
      toast("Mission deleted", "success");
      addActivity(
        "red",
        "fas fa-times-circle",
        `Deleted mission: ${removed[0]?.id}`,
        new Date().toLocaleString(),
      );
      loadMissionsData();
    },
  );
}

async function saveMission() {
  const btn = event.target.closest("button");
  btn.disabled = true;
  try {
    const f = await getFile(CONFIG.paths.missions);
    let parsed = { data: [], root: null, key: null };
    let sha = null;
    if (f) {
      parsed = parseJsonArrayOrKey(f, ["missions"]);
      sha = f.sha;
    }
    const data = parsed.data;
    const mission = {
      id: document.getElementById("mID").value.trim().toUpperCase(),
      callsign: document.getElementById("mCallsign").value.trim().toUpperCase(),
      status: document.getElementById("mStatus").value,
      dep: document.getElementById("mDep").value.trim().toUpperCase(),
      arr: document.getElementById("mArr").value.trim().toUpperCase(),
      aircraft: document.getElementById("mAircraft").value.trim(),
      date: document.getElementById("mDate").value,
      time: document.getElementById("mTime").value,
      altitude: document.getElementById("mAlt").value.trim(),
      notes: document.getElementById("mNotes").value.trim(),
    };
    if (missionEditIndex >= 0) {
      data[missionEditIndex] = mission;
      missionEditIndex = -1;
    } else {
      data.push(mission);
    }
    const content = buildJsonContent(parsed, data, "missions");
    await putFile(
      CONFIG.paths.missions,
      content,
      sha,
      `Update mission: ${mission.id}`,
    );
    toast(`Mission ${mission.id} saved!`, "success");
    addActivity(
      "blue",
      "fas fa-crosshairs",
      `Saved mission: ${mission.id}`,
      new Date().toLocaleString(),
    );
    clearMissionForm();
    loadMissionsData();
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
  btn.disabled = false;
}

function clearMissionForm() {
  [
    "mID",
    "mCallsign",
    "mDep",
    "mArr",
    "mAircraft",
    "mDate",
    "mTime",
    "mAlt",
    "mNotes",
  ].forEach((id) => (document.getElementById(id).value = ""));
  document.getElementById("mStatus").value = "planned";
  missionEditIndex = -1;
}

// ====== FLEET ======
async function loadFleetData() {
  const wrap = document.getElementById("fleetTableWrap");
  if (!wrap) return;
  const f = await getFile(CONFIG.paths.fleet);
  if (!f) {
    wrap.innerHTML =
      '<div class="empty-state"><i class="fas fa-fighter-jet"></i><p>No fleet file found</p></div>';
    document.getElementById("statAircraft").textContent = "0";
    return;
  }
  let data = [];
  try {
    data = JSON.parse(f.content);
  } catch (e) {
    data = [];
  }
  document.getElementById("statAircraft").textContent = data.length;
  if (!data.length) {
    wrap.innerHTML =
      '<div class="empty-state"><i class="fas fa-fighter-jet"></i><p>No aircraft registered</p></div>';
    return;
  }
  const catBadge = (c) =>
    ({
      fighter: "badge-red",
      transport: "badge-blue",
      trainer: "badge-green",
      aew: "badge-gold",
      helicopter: "badge-gray",
    })[c] || "badge-gray";
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Code</th><th>ICAO</th><th>Category</th><th>Addon</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${data
      .map(
        (a, i) => `<tr>
      <td><strong style="color:#fff;">${a.name || "—"}</strong></td>
      <td style="font-family:'Orbitron',monospace;font-size:11px;color:var(--accent2);">${a.code || "—"}</td>
      <td style="color:var(--text3);">${a.icao || "—"}</td>
      <td><span class="badge ${catBadge(a.category)}">${a.category || "—"}</span></td>
      <td style="color:var(--text2);">${a.addon || "—"}</td>
      <td><span class="badge ${a.status === "active" ? "badge-green" : a.status === "limited" ? "badge-gold" : "badge-gray"}">${a.status || "—"}</span></td>
      <td>
        <button class="btn btn-ghost" style="padding:4px 10px;font-size:10px;" onclick="editFleet(${i})"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger" style="padding:4px 10px;font-size:10px;margin-left:4px;" onclick="deleteFleet(${i})"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

let fleetEditIndex = -1;
async function editFleet(i) {
  const f = await getFile(CONFIG.paths.fleet);
  if (!f) return;
  const data = JSON.parse(f.content);
  const a = data[i];
  fleetEditIndex = i;
  document.getElementById("fName").value = a.name || "";
  document.getElementById("fCode").value = a.code || "";
  document.getElementById("fCat").value = a.category || "fighter";
  document.getElementById("fAddon").value = a.addon || "";
  document.getElementById("fICAO").value = a.icao || "";
  document.getElementById("fStatus").value = a.status || "active";
  document.getElementById("fDesc").value = a.description || "";
  navigate("fleet");
  toast("Aircraft loaded for editing", "info");
}

async function deleteFleet(i) {
  confirm(
    "Remove Aircraft",
    "Remove this aircraft from the fleet registry?",
    async () => {
      const f = await getFile(CONFIG.paths.fleet);
      if (!f) return;
      const data = JSON.parse(f.content);
      const removed = data.splice(i, 1);
      await putFile(
        CONFIG.paths.fleet,
        JSON.stringify(data, null, 2),
        f.sha,
        `Remove aircraft: ${removed[0]?.code}`,
      );
      toast("Aircraft removed", "success");
      addActivity(
        "gold",
        "fas fa-plane-slash",
        `Removed aircraft: ${removed[0]?.code}`,
        new Date().toLocaleString(),
      );
      loadFleetData();
    },
  );
}

async function saveFleet() {
  const btn = event.target.closest("button");
  btn.disabled = true;
  try {
    const f = await getFile(CONFIG.paths.fleet);
    let data = [],
      sha = null;
    if (f) {
      data = JSON.parse(f.content);
      sha = f.sha;
    }
    const aircraft = {
      name: document.getElementById("fName").value.trim(),
      code: document.getElementById("fCode").value.trim(),
      category: document.getElementById("fCat").value,
      addon: document.getElementById("fAddon").value.trim(),
      icao: document.getElementById("fICAO").value.trim().toUpperCase(),
      status: document.getElementById("fStatus").value,
      description: document.getElementById("fDesc").value.trim(),
    };
    if (fleetEditIndex >= 0) {
      data[fleetEditIndex] = aircraft;
      fleetEditIndex = -1;
    } else {
      data.push(aircraft);
    }
    await putFile(
      CONFIG.paths.fleet,
      JSON.stringify(data, null, 2),
      sha,
      `Update fleet: ${aircraft.code}`,
    );
    toast(`Aircraft ${aircraft.code} saved!`, "success");
    addActivity(
      "gold",
      "fas fa-fighter-jet",
      `Saved aircraft: ${aircraft.code}`,
      new Date().toLocaleString(),
    );
    clearFleetForm();
    loadFleetData();
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
  btn.disabled = false;
}

function clearFleetForm() {
  ["fName", "fCode", "fAddon", "fICAO", "fDesc"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  document.getElementById("fCat").value = "fighter";
  document.getElementById("fStatus").value = "active";
  fleetEditIndex = -1;
}

// ====== GALLERY ======
async function loadGalleryData() {
  const wrap = document.getElementById("galleryTableWrap");
  if (!wrap) return;
  const f = await getFile(CONFIG.paths.gallery);
  if (!f) {
    wrap.innerHTML =
      '<div class="empty-state"><i class="fas fa-images"></i><p>No gallery file found</p></div>';
    return;
  }
  let data = [];
  try {
    data = JSON.parse(f.content);
  } catch (e) {
    data = [];
  }
  if (!data.length) {
    wrap.innerHTML =
      '<div class="empty-state"><i class="fas fa-images"></i><p>No gallery items</p></div>';
    return;
  }
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Preview</th><th>Title</th><th>Pilot</th><th>Date</th><th>Caption</th><th>Actions</th></tr></thead>
    <tbody>${data
      .map(
        (g, i) => `<tr>
      <td><img src="${g.src || ""}" style="width:60px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--border);" onerror="this.style.display='none'"></td>
      <td><strong style="color:#fff;">${g.title || "—"}</strong></td>
      <td style="color:var(--accent2);">${g.pilot || "—"}</td>
      <td style="color:var(--text3);">${g.date || "—"}</td>
      <td style="color:var(--text2);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.caption || "—"}</td>
      <td>
        <button class="btn btn-danger" style="padding:4px 10px;font-size:10px;" onclick="deleteGallery(${i})"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

async function deleteGallery(i) {
  confirm("Delete Image", "Remove this image from the gallery?", async () => {
    const f = await getFile(CONFIG.paths.gallery);
    if (!f) return;
    const data = JSON.parse(f.content);
    const removed = data.splice(i, 1);
    await putFile(
      CONFIG.paths.gallery,
      JSON.stringify(data, null, 2),
      f.sha,
      `Remove gallery item: ${removed[0]?.title}`,
    );
    toast("Gallery item removed", "success");
    loadGalleryData();
  });
}

async function saveGallery() {
  const btn = event.target.closest("button");
  btn.disabled = true;
  try {
    const f = await getFile(CONFIG.paths.gallery);
    let data = [],
      sha = null;
    if (f) {
      data = JSON.parse(f.content);
      sha = f.sha;
    }
    const item = {
      src: document.getElementById("gSrc").value.trim(),
      title: document.getElementById("gTitle").value.trim(),
      pilot: document.getElementById("gPilot").value.trim(),
      date: document.getElementById("gDate").value,
      caption: document.getElementById("gCaption").value.trim(),
    };
    data.push(item);
    await putFile(
      CONFIG.paths.gallery,
      JSON.stringify(data, null, 2),
      sha,
      `Add gallery: ${item.title}`,
    );
    toast("Gallery item added!", "success");
    addActivity(
      "blue",
      "fas fa-image",
      `Added gallery: ${item.title}`,
      new Date().toLocaleString(),
    );
    clearGalleryForm();
    loadGalleryData();
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
  btn.disabled = false;
}

function clearGalleryForm() {
  ["gSrc", "gTitle", "gPilot", "gDate", "gCaption"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
}

// ====== FILE MANAGER ======
async function loadFileTree() {
  const list = document.getElementById("fileList");
  if (!list) return;
  if (!CONFIG.owner || !CONFIG.repo) {
    list.innerHTML =
      '<div style="font-size:12px;color:var(--text3);padding:10px;">Configure repo in Settings first.</div>';
    return;
  }
  try {
    const tree = await ghFetch(
      `/repos/${CONFIG.owner}/${CONFIG.repo}/git/trees/${CONFIG.branch}?recursive=1`,
    );
    const files = tree.tree.filter(
      (f) =>
        f.type === "blob" &&
        (f.path.endsWith(".json") ||
          f.path.endsWith(".js") ||
          f.path.endsWith(".html") ||
          f.path.endsWith(".css") ||
          f.path.endsWith(".md")),
    );
    list.innerHTML = files
      .map(
        (f) => `
      <div class="file-item" onclick="openFile('${f.path}')">
        <i class="fas ${f.path.endsWith(".json") ? "fa-database" : f.path.endsWith(".js") ? "fa-code" : f.path.endsWith(".css") ? "fa-paint-brush" : f.path.endsWith(".html") ? "fa-file-code" : "fa-file-alt"}"></i>
        <span class="fname">${f.path}</span>
        <span class="fsize">${(f.size / 1024).toFixed(1)}KB</span>
      </div>`,
      )
      .join("");
  } catch (e) {
    list.innerHTML = `<div style="font-size:12px;color:var(--red);padding:10px;">${e.message}</div>`;
  }
}

async function openFile(path) {
  const area = document.getElementById("fileEditorArea");
  area.innerHTML = `<div style="text-align:center;padding:40px;"><div class="loading-spin"></div><p style="color:var(--text3);margin-top:12px;font-size:12px;">Loading ${path}...</p></div>`;
  const f = await getFile(path);
  if (!f) {
    area.innerHTML = `<div class="empty-state"><i class="fas fa-times-circle"></i><p>Could not load ${path}</p></div>`;
    return;
  }
  currentFile = path;
  currentFileSHA = f.sha;
  area.innerHTML = `
    <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
      <i class="fas fa-file-code" style="color:var(--accent2);"></i>
      <span style="font-size:13px;color:var(--text2);">${path}</span>
      <span style="font-size:11px;color:var(--text3);margin-left:auto;">SHA: ${f.sha.substring(0, 8)}</span>
    </div>
    <textarea class="code-editor" id="fileContent">${escapeHtml(f.content)}</textarea>
    <div style="margin-top:10px;font-size:11px;color:var(--text3);">Edit carefully — this commits directly to the repository.</div>
  `;
}

async function commitFile() {
  if (!currentFile) {
    toast("No file open", "error");
    return;
  }
  const content = document.getElementById("fileContent").value;
  const msg = prompt("Commit message:", `Admin update: ${currentFile}`);
  if (!msg) return;
  try {
    await putFile(currentFile, content, currentFileSHA, msg);
    toast(`Committed: ${currentFile}`, "success");
    addActivity(
      "green",
      "fas fa-upload",
      `Committed: ${currentFile}`,
      new Date().toLocaleString(),
    );
    const f = await getFile(currentFile);
    if (f) currentFileSHA = f.sha;
  } catch (e) {
    toast("Error: " + e.message, "error");
  }
}

function closeFileEditor() {
  currentFile = null;
  currentFileSHA = null;
  document.getElementById("fileEditorArea").innerHTML =
    '<div class="empty-state"><i class="fas fa-file-code"></i><p>Select a file from the list to edit</p></div>';
}

// ====== COMMITS ======
async function loadCommits() {
  const el = document.getElementById("commitsList");
  if (!el) return;
  if (!CONFIG.owner || !CONFIG.repo) {
    el.innerHTML =
      '<div class="empty-state"><i class="fas fa-cog"></i><p>Configure repo in Settings</p></div>';
    return;
  }
  try {
    const commits = await ghFetch(
      `/repos/${CONFIG.owner}/${CONFIG.repo}/commits?per_page=20`,
    );
    el.innerHTML = commits
      .map(
        (c) => `
      <div class="activity-item">
        <div class="act-icon blue"><i class="fas fa-code-commit"></i></div>
        <div class="act-text">
          <div class="at-title">${c.commit.message.split("\n")[0]}</div>
          <div class="at-sub">${c.commit.author.name} · ${new Date(c.commit.author.date).toLocaleString()}</div>
        </div>
        <a href="${c.html_url}" target="_blank" style="color:var(--text3);font-size:11px;white-space:nowrap;font-family:monospace;">${c.sha.substring(0, 7)}</a>
      </div>`,
      )
      .join("");
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation"></i><p>${e.message}</p></div>`;
  }
}

// ====== UTIL ======
function navigate(section) {
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(section).classList.add("active");
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.querySelector(`[data-section="${section}"]`).classList.add("active");
  const titles = {
    dashboard: "Dashboard",
    roster: "Pilot Roster",
    missions: "Missions",
    fleet: "Fleet Registry",
    gallery: "Gallery",
    files: "File Manager",
    commits: "Commit History",
    settings: "Settings",
  };
  document.getElementById("pageTitle").textContent = titles[section] || section;
  document.getElementById("sidebar").classList.remove("open");
}

function toast(msg, type = "info") {
  const icons = {
    success: "check-circle",
    error: "times-circle",
    info: "info-circle",
  };
  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.innerHTML = `<i class="fas fa-${icons[type] || "info-circle"}" style="color:${type === "success" ? "var(--green)" : type === "error" ? "var(--red)" : "var(--accent2)"}"></i> ${msg}`;
  document.getElementById("toastContainer").appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function addActivity(color, icon, title, sub) {
  const colors = {
    blue: "blue",
    green: "green",
    red: "red",
    gold: "gold",
    info: "blue",
  };
  activityLog.unshift({
    color: colors[color] || "blue",
    icon,
    title,
    sub,
  });
  if (activityLog.length > 20) activityLog.pop();
  const el = document.getElementById("activityLog");
  if (el) {
    el.innerHTML = activityLog.length
      ? activityLog
          .map(
            (a) => `
      <div class="activity-item">
        <div class="act-icon ${a.color}"><i class="${a.icon}"></i></div>
        <div class="act-text">
          <div class="at-title">${a.title}</div>
          <div class="at-sub">${a.sub}</div>
        </div>
      </div>`,
          )
          .join("")
      : '<div class="empty-state" style="padding:20px;"><i class="fas fa-history"></i><p>No activity yet</p></div>';
  }
}

function confirm(title, msg, cb) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMsg").textContent = msg;
  document.getElementById("confirmModal").classList.add("open");
  document.getElementById("confirmOkBtn").onclick = () => {
    closeConfirm();
    cb();
  };
}

function closeConfirm() {
  document.getElementById("confirmModal").classList.remove("open");
}

function syncAll() {
  toast("Syncing all data...", "info");
  loadRosterData();
  loadMissionsData();
  loadFleetData();
  loadGalleryData();
  loadCommitsPanel();
  loadFileTree();
  loadCommits();
  setTimeout(() => toast("Sync complete", "success"), 1500);
}

function clearCache() {
  confirm("Clear Cache", "Clear all local config and reload?", () => {
    localStorage.removeItem("tvaf_config");
    sessionStorage.removeItem("tvaf_auth");
    location.reload();
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}