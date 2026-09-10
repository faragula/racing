"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const timerElement = document.getElementById("timer");
const bestTimeElement = document.getElementById("bestTime");
const startPrompt = document.getElementById("startPrompt");
const finishPanel = document.getElementById("finishPanel");
const finishTime = document.getElementById("finishTime");
const finishPlace = document.getElementById("finishPlace");
const finishDelta = document.getElementById("finishDelta");
const finishRating = document.getElementById("finishRating");
const restartButton = document.getElementById("restartButton");
const slipSlider = document.getElementById("slipSlider");
const slipValue = document.getElementById("slipValue");
const seedInput = document.getElementById("seedInput");
const seedStatus = document.getElementById("seedStatus");
const generateButton = document.getElementById("generateButton");
const forgetGhostButton = document.getElementById("forgetGhostButton");
const lobby = document.getElementById("lobby");
const raceStrip = document.getElementById("raceStrip");
const raceGhostLabel = document.getElementById("raceGhostLabel");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardHint = document.getElementById("leaderboardHint");
const finishLeaderboard = document.getElementById("finishLeaderboard");
const playerNameInput = document.getElementById("playerNameInput");
const finishNameInput = document.getElementById("finishNameInput");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const dailyModeButton = document.getElementById("dailyModeButton");
const freeModeButton = document.getElementById("freeModeButton");
const dailyDateLabel = document.getElementById("dailyDateLabel");
const dailyDateValue = document.getElementById("dailyDateValue");
const dailyCountdown = document.getElementById("dailyCountdown");
const lobbyKicker = document.getElementById("lobbyKicker");
const lobbyDate = document.getElementById("lobbyDate");
const lobbyCountdown = document.getElementById("lobbyCountdown");
const lobbyWr = document.getElementById("lobbyWr");
const lobbyWrName = document.getElementById("lobbyWrName");
const lobbyPb = document.getElementById("lobbyPb");
const ghostHudValue = document.getElementById("ghostHudValue");
const todayButton = document.getElementById("todayButton");
const yesterdayButton = document.getElementById("yesterdayButton");
const ghostWrButton = document.getElementById("ghostWrButton");
const ghostSelfButton = document.getElementById("ghostSelfButton");
const ghostOffButton = document.getElementById("ghostOffButton");
const lobbyToggleButton = document.getElementById("lobbyToggleButton");
const playLayout = document.querySelector(".play-layout");
const raceWrButton = document.getElementById("raceWrButton");
const raceSelfButton = document.getElementById("raceSelfButton");
const authGate = document.getElementById("authGate");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authCopy = document.getElementById("authCopy");
const authUsernameInput = document.getElementById("authUsernameInput");
const authPasswordInput = document.getElementById("authPasswordInput");
const authPasswordHint = document.getElementById("authPasswordHint");
const authSubmitButton = document.getElementById("authSubmitButton");
const authStatus = document.getElementById("authStatus");
const loginTabButton = document.getElementById("loginTabButton");
const signupTabButton = document.getElementById("signupTabButton");
const logoutButton = document.getElementById("logoutButton");
const gameShell = document.getElementById("gameShell");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_RADIUS = 18;
const MAX_SPEED = 285;
const ACCELERATION = 220;
const TRACK_VERSION = 2;
const RECORD_INTERVAL = 1 / 30;
const DEFAULT_SEED = "6-6-6gh4df6h";
const DAILY_COLS = 6;
const DAILY_ROWS = 6;
const DAILY_SLIP = 260;
const dailySeedCache = new Map();
const AUTH_SESSION_STORAGE_KEY = "mania2d-auth-session";
const BASE_GHOST_STORAGE_KEY = "mania2d-best-ghost";
const LEADERBOARD_CONFIG = window.MANIA2D_LEADERBOARD || {};
const LEADERBOARD_LIMIT = 10;
const MAX_GHOST_FRAMES = 4000;
const TILE_SIZE = 240;
const WORLD_PADDING = 120;
const GAMEPAD_DEADZONE = 0.18;
const keys = { up: false, down: false, left: false, right: false, brake: false };
const trails = [];
const camera = { x: 0, y: 0 };
const gamepadInput = { x: 0, y: 0, brake: false, active: false };

const DIRS = {
  N: { dx: 0, dy: -1, angle: -Math.PI / 2 },
  E: { dx: 1, dy: 0, angle: 0 },
  S: { dx: 0, dy: 1, angle: Math.PI / 2 },
  W: { dx: -1, dy: 0, angle: Math.PI },
};

const player = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  angle: 0,
  drift: 0,
};

let currentTrack = null;
let started = false;
let finished = false;
let startTime = 0;
let elapsed = 0;
let lastFrame = performance.now();
let checkpointFlash = 0;
let runRecording = [];
let nextRecordTime = 0;
let ghostFrameIndex = 0;
let localGhost = null;
let activeGhost = null;
let selectedGhostId = null;
let ghostMuted = false;
let leaderboardRows = [];
let scoreSubmitted = false;
let pendingFinishTimeMs = 0;
let pendingFrames = [];
let playMode = "daily";
let dailyOffset = 0;
let ghostPick = "wr";
let inLobby = true;
let lastSeenDateKey = "";
let dailyTrackResolved = false;
let dailyTrackRequestId = 0;
let authMode = "login";
let authSession = null;
let currentUser = null;

const keyMap = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "brake",
};

window.addEventListener("keydown", (event) => {
  if (!currentUser) return;
  if (isTypingTarget(event.target)) {
    if (event.code === "Enter") {
      event.preventDefault();
      if (event.target === playerNameInput || event.target === finishNameInput) {
        event.target.blur();
        if (finished) submitRankedScore();
      } else {
        applySeedFromInput();
      }
    }
    return;
  }
  if (keyMap[event.code]) {
    keys[keyMap[event.code]] = true;
    event.preventDefault();
  }
  if (event.code === "KeyR") resetGame();
});

window.addEventListener("keyup", (event) => {
  if (!currentUser) return;
  if (isTypingTarget(event.target)) return;
  if (keyMap[event.code]) {
    keys[keyMap[event.code]] = false;
    event.preventDefault();
  }
});

window.addEventListener("blur", clearKeys);
restartButton.addEventListener("click", resetGame);
generateButton.addEventListener("click", applySeedFromInput);
forgetGhostButton.addEventListener("click", forgetBestGhost);
playerNameInput.addEventListener("keydown", (event) => {
  if (event.code === "Enter") {
    event.preventDefault();
    playerNameInput.blur();
    if (finished) submitRankedScore();
  }
});
finishNameInput.addEventListener("keydown", (event) => {
  if (event.code === "Enter") {
    event.preventDefault();
    submitRankedScore();
  }
});
playerNameInput.addEventListener("input", () => syncNameInputs(playerNameInput));
finishNameInput.addEventListener("input", () => syncNameInputs(finishNameInput));
leaderboardList.addEventListener("click", onLeaderboardClick);
dailyModeButton.addEventListener("click", () => setPlayMode("daily"));
freeModeButton.addEventListener("click", () => setPlayMode("free"));
todayButton.addEventListener("click", () => applyDailyTrack(0));
yesterdayButton.addEventListener("click", () => applyDailyTrack(-1));
ghostWrButton.addEventListener("click", () => selectGhostPick("wr"));
ghostSelfButton.addEventListener("click", () => selectGhostPick("self"));
ghostOffButton.addEventListener("click", () => selectGhostPick("off"));
lobbyToggleButton.addEventListener("click", () => {
  playLayout.classList.toggle("board-collapsed");
});
canvas.addEventListener("pointerdown", enterArena);
raceWrButton.addEventListener("click", () => {
  inLobby = false;
  selectGhostPick("wr").then(() => resetGame());
});
raceSelfButton.addEventListener("click", () => {
  inLobby = false;
  selectGhostPick("self");
  resetGame();
});
loginTabButton.addEventListener("click", () => setAuthMode("login"));
signupTabButton.addEventListener("click", () => setAuthMode("signup"));
authUsernameInput.addEventListener("input", () => {
  authUsernameInput.value = authUsernameInput.value.toLowerCase().replace(/[^a-z0-9]/g, "");
});
authForm.addEventListener("submit", handleAuthSubmit);
logoutButton.addEventListener("click", logout);
slipSlider.addEventListener("input", () => {
  slipValue.value = `${slipSlider.value} %`;
});

document.querySelectorAll("[data-key]").forEach((button) => {
  const input = button.dataset.key;
  const setPressed = (pressed) => {
    keys[input] = pressed;
    button.classList.toggle("active", pressed);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setPressed(true);
  });
  button.addEventListener("pointerup", () => setPressed(false));
  button.addEventListener("pointercancel", () => setPressed(false));
  button.addEventListener("lostpointercapture", () => setPressed(false));
});

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
}

function clearKeys() {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
  document.querySelectorAll("[data-key]").forEach((button) => button.classList.remove("active"));
}

function applyDeadzone(value, deadzone = GAMEPAD_DEADZONE) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone));
}

function updateGamepadInput() {
  gamepadInput.x = 0;
  gamepadInput.y = 0;
  gamepadInput.brake = false;
  gamepadInput.active = false;

  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = Array.from(gamepads).find((candidate) => candidate?.connected);
  if (!pad) return;

  const axisX = applyDeadzone(pad.axes?.[0] ?? 0);
  const axisY = applyDeadzone(pad.axes?.[1] ?? 0);
  const dpadX = Number(pad.buttons?.[15]?.pressed) - Number(pad.buttons?.[14]?.pressed);
  const dpadY = Number(pad.buttons?.[13]?.pressed) - Number(pad.buttons?.[12]?.pressed);
  const mergedX = Math.abs(axisX) >= Math.abs(dpadX) ? axisX : dpadX;
  const mergedY = Math.abs(axisY) >= Math.abs(dpadY) ? axisY : dpadY;
  const brakePressed = Boolean(
    pad.buttons?.[0]?.pressed
    || pad.buttons?.[1]?.pressed
    || pad.buttons?.[6]?.pressed
    || pad.buttons?.[7]?.pressed
  );

  gamepadInput.x = mergedX;
  gamepadInput.y = mergedY;
  gamepadInput.brake = brakePressed;
  gamepadInput.active = brakePressed || Math.hypot(mergedX, mergedY) > 0;
}

function applyTrackSeed(seedString, { resetGhostPick = false } = {}) {
  try {
    currentTrack = generateTrack(seedString);
    seedInput.value = currentTrack.seed;
    seedStatus.textContent = `${currentTrack.cols}x${currentTrack.rows} · ${currentTrack.path.length} tiles · ${currentTrack.seedSuffix}`;
    seedStatus.dataset.state = "ok";
    if (resetGhostPick) {
      ghostMuted = false;
      selectedGhostId = null;
      ghostPick = playMode === "daily" ? "wr" : "self";
    }
    localGhost = loadBestGhost(personalGhostStorageKey(currentTrack.storageKey));
    if (ghostPick === "off" || ghostMuted) {
      setActiveGhost(null);
    } else {
      setActiveGhost(localGhost);
    }
    resetGame();
    refreshLeaderboard();
    return true;
  } catch (error) {
    seedStatus.textContent = error.message;
    seedStatus.dataset.state = "error";
    return false;
  }
}

function applySeedFromInput() {
  applyTrackSeed(seedInput.value || DEFAULT_SEED, { resetGhostPick: true });
}

function utcDateFromOffset(offset) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
}

function utcDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function utcDateSql(date) {
  const key = utcDateKey(date);
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

function formatCzechUtcDate(date) {
  return `${date.getUTCDate()}. ${date.getUTCMonth() + 1}. ${date.getUTCFullYear()}`;
}

function dailySuffix(dateKey, attempt) {
  if (attempt === 0) return dateKey;
  const rng = createRng(`daily-${dateKey}-${attempt}`);
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "d";
  for (let index = 0; index < 7; index += 1) {
    suffix += chars[Math.floor(rng() * chars.length)];
  }
  return suffix;
}

function makeDailySeed(dateKey) {
  if (dailySeedCache.has(dateKey)) return dailySeedCache.get(dateKey);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const seed = `${DAILY_COLS}-${DAILY_ROWS}-${dailySuffix(dateKey, attempt)}`;
    try {
      generateTrack(seed);
      dailySeedCache.set(dateKey, seed);
      return seed;
    } catch {
      // Some suffixes do not compose a valid path; try another.
    }
  }
  throw new Error("Could not build today's track.");
}

function dailySeedForOffset(offset) {
  return makeDailySeed(utcDateKey(utcDateFromOffset(offset)));
}

function msUntilNextUtcMidnight() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateDailyLabels() {
  const date = utcDateFromOffset(dailyOffset);
  const label = dailyOffset === 0 ? "TODAY" : "YESTERDAY";
  const countdown = `Next map in ${formatCountdown(msUntilNextUtcMidnight())}`;
  dailyDateLabel.textContent = label;
  dailyDateValue.textContent = formatCzechUtcDate(date);
  lobbyKicker.textContent = label;
  lobbyDate.textContent = formatCzechUtcDate(date);
  dailyCountdown.textContent = dailyOffset === 0 ? countdown : "Yesterday archive";
  lobbyCountdown.textContent = dailyOffset === 0
    ? countdown
    : "Archive · yesterday's times are not saved here";
  if (playMode === "daily") {
    const todayKey = utcDateKey(utcDateFromOffset(0));
    if (lastSeenDateKey && todayKey !== lastSeenDateKey) {
      lastSeenDateKey = todayKey;
      dailySeedCache.clear();
      applyDailyTrack(0);
      return;
    }
    lastSeenDateKey = todayKey;
  }
}

async function applyDailyTrack(offset) {
  const requestId = ++dailyTrackRequestId;
  dailyOffset = offset;
  dailyTrackResolved = false;
  inLobby = true;
  todayButton.classList.toggle("active", offset === 0);
  yesterdayButton.classList.toggle("active", offset === -1);
  updateDailyLabels();

  let seed;
  try {
    seed = dailySeedForOffset(offset);
  } catch (error) {
    seedStatus.textContent = error.message;
    seedStatus.dataset.state = "error";
    return;
  }

  let source = "local";
  let resolveError = "";
  if (currentUser && isLeaderboardConfigured()) {
    seedStatus.textContent = "Loading official daily track…";
    delete seedStatus.dataset.state;
    try {
      const track = await requestRpc("get_or_create_daily_track", {
        p_session_token: authSession.session_token,
        p_race_date: utcDateSql(utcDateFromOffset(offset)),
        p_default_seed: seed,
      });
      if (requestId !== dailyTrackRequestId || playMode !== "daily") return;
      if (Number(track.slip) !== DAILY_SLIP || Number(track.track_version) !== TRACK_VERSION) {
        throw new Error("The scheduled track uses an unsupported game version.");
      }
      seed = track.seed;
      source = track.source;
      dailyTrackResolved = true;
    } catch (error) {
      if (requestId !== dailyTrackRequestId || playMode !== "daily") return;
      resolveError = error.message || "Could not load the official daily track.";
    }
  }

  const applied = applyTrackSeed(seed, { resetGhostPick: true });
  if (!applied) {
    dailyTrackResolved = false;
    return;
  }
  if (resolveError) {
    seedStatus.textContent = `${resolveError} · practice only`;
    seedStatus.dataset.state = "error";
  } else if (source !== "local") {
    seedStatus.textContent += source === "planned" ? " · planned daily" : " · daily";
  }
}

function setPlayMode(mode) {
  playMode = mode;
  document.body.dataset.mode = mode;
  dailyModeButton.classList.toggle("active", mode === "daily");
  freeModeButton.classList.toggle("active", mode === "free");
  inLobby = mode === "daily";
  if (mode === "daily") {
    slipSlider.value = String(DAILY_SLIP);
    slipValue.value = `${DAILY_SLIP} %`;
    slipSlider.disabled = true;
    applyDailyTrack(0);
  } else {
    dailyTrackResolved = false;
    dailyTrackRequestId += 1;
    slipSlider.disabled = false;
    applySeedFromInput();
  }
  syncLeaderboardVisibility();
}

function enterArena() {
  if (!currentTrack || finished) return;
  inLobby = false;
  playerNameInput.blur();
  finishNameInput.blur();
  clearKeys();
  syncLeaderboardVisibility();
}

function resetGame() {
  if (!currentTrack) return;
  player.x = currentTrack.startPosition.x;
  player.y = currentTrack.startPosition.y;
  player.vx = 0;
  player.vy = 0;
  player.angle = currentTrack.startAngle;
  player.drift = 0;
  started = false;
  finished = false;
  elapsed = 0;
  checkpointFlash = 0;
  runRecording = [];
  nextRecordTime = 0;
  ghostFrameIndex = 0;
  scoreSubmitted = false;
  pendingFinishTimeMs = 0;
  pendingFrames = [];
  trails.length = 0;
  timerElement.textContent = "00.00";
  startPrompt.style.opacity = "1";
  finishPanel.hidden = true;
  setLeaderboardStatus("");
  clearKeys();
  updateCamera(true);
  syncLeaderboardVisibility();
}

function forgetBestGhost() {
  if (!currentTrack) return;
  try {
    localStorage.removeItem(personalGhostStorageKey(currentTrack.storageKey));
  } catch {
    // The current session can continue even if storage is unavailable.
  }
  ghostMuted = true;
  selectedGhostId = null;
  localGhost = null;
  setActiveGhost(null);
  paintLeaderboard(loadPlayerName());
  updateGhostChrome();
}

function approach(value, target, amount) {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
}

function parseSeed(seedString) {
  const normalized = String(seedString).trim();
  const match = normalized.match(/^(\d+)-(\d+)-([A-Za-z0-9_-]+)$/);
  if (!match) throw new Error("Seed must be width-height-seed, e.g. 6-6-6gh4df6h.");
  const cols = Number(match[1]);
  const rows = Number(match[2]);
  const seedSuffix = match[3];
  if (cols < 3 || cols > 50 || rows < 3 || rows > 50) {
    throw new Error("Supported grid size is 3x3 to 50x50.");
  }
  return {
    seed: `${cols}-${rows}-${seedSuffix}`,
    cols,
    rows,
    seedSuffix,
  };
}

function hashString(input) {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function createRng(seed) {
  const seedFactory = hashString(seed);
  let state = seedFactory();
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle(array, rng) {
  const result = array.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function moveCell(cell, direction) {
  const vector = DIRS[direction];
  return { x: cell.x + vector.dx, y: cell.y + vector.dy };
}

function getEdgeSpecs(cols, rows) {
  const specs = [];
  for (let x = 0; x < cols; x += 1) {
    specs.push({ x, y: 0, outward: "N", inward: "S", side: "top" });
    specs.push({ x, y: rows - 1, outward: "S", inward: "N", side: "bottom" });
  }
  for (let y = 1; y < rows - 1; y += 1) {
    specs.push({ x: 0, y, outward: "W", inward: "E", side: "left" });
    specs.push({ x: cols - 1, y, outward: "E", inward: "W", side: "right" });
  }
  return specs;
}

function isInsideGrid(cell, cols, rows) {
  return cell.x >= 0 && cell.x < cols && cell.y >= 0 && cell.y < rows;
}

function getNeighbors(cell, cols, rows) {
  return Object.entries(DIRS)
    .map(([direction, vector]) => ({ x: cell.x + vector.dx, y: cell.y + vector.dy, direction }))
    .filter((neighbor) => isInsideGrid(neighbor, cols, rows));
}

function countFreeCells(cols, rows, visited) {
  return cols * rows - visited.size;
}

function chooseEndpoints(cols, rows, rng) {
  const edgeSpecs = getEdgeSpecs(cols, rows);
  const start = edgeSpecs[Math.floor(rng() * edgeSpecs.length)];
  const startInner = moveCell(start, start.inward);
  const finishCandidates = edgeSpecs.filter((spec) => {
    if (spec.x === start.x && spec.y === start.y) return false;
    const finishInner = moveCell(spec, spec.inward);
    if (Math.abs(startInner.x - finishInner.x) + Math.abs(startInner.y - finishInner.y) < 2) return false;
    if (spec.side === start.side && rng() < 0.7) return false;
    return true;
  });
  const fallbackFinish = edgeSpecs.find((spec) => spec.x !== start.x || spec.y !== start.y);
  return {
    start,
    finish: finishCandidates.length ? finishCandidates[Math.floor(rng() * finishCandidates.length)] : fallbackFinish,
  };
}

function buildCorePath(cols, rows, startSpec, finishSpec, rng) {
  const startCell = { x: startSpec.x, y: startSpec.y };
  const finishCell = { x: finishSpec.x, y: finishSpec.y };
  const startInner = moveCell(startCell, startSpec.inward);
  const finishInner = moveCell(finishCell, finishSpec.inward);
  const startKey = cellKey(startCell.x, startCell.y);
  const finishKey = cellKey(finishCell.x, finishCell.y);
  const startInnerKey = cellKey(startInner.x, startInner.y);
  const finishInnerKey = cellKey(finishInner.x, finishInner.y);

  if (startInnerKey === finishKey || finishInnerKey === startKey) return null;

  const visited = new Set([startKey, finishKey, startInnerKey]);
  const path = [startInner];
  const stepsCap = cols * rows * 120;
  let explored = 0;
  const maxCoreLength = Math.max(2, Math.floor(cols * rows * 0.75));
  const minCoreLength = Math.max(1, Math.min(maxCoreLength, Math.floor((cols + rows) * 1.3)));
  const targetCoreLength = randomInt(rng, minCoreLength, maxCoreLength);

  if (startInnerKey === finishInnerKey) {
    return targetCoreLength <= 1 ? path.slice() : null;
  }

  function canOccupy(candidate, previous) {
    const candidateKey = cellKey(candidate.x, candidate.y);
    if (visited.has(candidateKey)) return false;
    if (candidateKey === finishKey || candidateKey === startKey) return false;
    if (candidateKey === finishInnerKey && path.length < targetCoreLength - 1) return false;

    for (const adjacent of getNeighbors(candidate, cols, rows)) {
      const adjacentKey = cellKey(adjacent.x, adjacent.y);
      const isPrevious = adjacent.x === previous.x && adjacent.y === previous.y;
      const isStartJoin = candidateKey === startInnerKey && adjacentKey === startKey;
      const isFinishJoin = candidateKey === finishInnerKey && adjacentKey === finishKey;
      if (isPrevious || isStartJoin || isFinishJoin) continue;
      if (visited.has(adjacentKey)) return false;
    }
    return true;
  }

  function search(current) {
    explored += 1;
    if (explored > stepsCap) return false;

    if (current.x === finishInner.x && current.y === finishInner.y) {
      return path.length >= targetCoreLength;
    }

    const neighbors = shuffle(getNeighbors(current, cols, rows), rng).sort((a, b) => {
      const aTarget = Number(a.x === finishInner.x && a.y === finishInner.y);
      const bTarget = Number(b.x === finishInner.x && b.y === finishInner.y);
      return aTarget - bTarget;
    });

    for (const neighbor of neighbors) {
      if (!canOccupy(neighbor, current)) continue;
      const neighborKey = cellKey(neighbor.x, neighbor.y);
      visited.add(neighborKey);
      path.push({ x: neighbor.x, y: neighbor.y });
      const freeCells = countFreeCells(cols, rows, visited);
      const distanceToFinish = Math.abs(neighbor.x - finishInner.x) + Math.abs(neighbor.y - finishInner.y);
      const enoughSpace = path.length + distanceToFinish <= path.length + freeCells + 1;
      if (enoughSpace && search(neighbor)) return true;
      path.pop();
      visited.delete(neighborKey);
    }

    return false;
  }

  return search(startInner) ? path.slice() : null;
}

function directionBetween(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1) return "E";
  if (dx === -1) return "W";
  if (dy === 1) return "S";
  return "N";
}

function normalizeConnections(connections) {
  return connections.slice().sort().join("");
}

function getRotationForTile(type, connections) {
  const key = normalizeConnections(connections);
  if (type === "straight" || type === "start" || type === "finish") {
    return key === "NS" ? 90 : 0;
  }
  return {
    EN: 0,
    ES: 90,
    SW: 180,
    NW: 270,
  }[key] ?? 0;
}

function cellCenter(track, cell) {
  return {
    x: track.offsetX + cell.x * track.tileSize + track.tileSize / 2,
    y: track.offsetY + cell.y * track.tileSize + track.tileSize / 2,
  };
}

function edgePoint(track, spec) {
  const center = cellCenter(track, spec);
  const half = track.tileSize / 2;
  const point = { x: center.x, y: center.y };
  if (spec.outward === "N") point.y -= half;
  if (spec.outward === "S") point.y += half;
  if (spec.outward === "W") point.x -= half;
  if (spec.outward === "E") point.x += half;
  return point;
}

function getLongCornerDiagonal(current, previous, next) {
  return {
    x: previous.x + next.x - current.x,
    y: previous.y + next.y - current.y,
  };
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function leftNormal(direction) {
  return { x: -direction.y, y: direction.x };
}

function rightNormal(direction) {
  return { x: direction.y, y: -direction.x };
}

function normalizeAngle(angle) {
  let normalized = angle % (Math.PI * 2);
  if (normalized < 0) normalized += Math.PI * 2;
  return normalized;
}

function getPositiveAngleDelta(from, to) {
  const delta = normalizeAngle(to) - normalizeAngle(from);
  return delta >= 0 ? delta : delta + Math.PI * 2;
}

function getNegativeAngleDelta(from, to) {
  const delta = normalizeAngle(to) - normalizeAngle(from);
  return delta <= 0 ? delta : delta - Math.PI * 2;
}

function isCleanLongCornerBlock(track, path, index, diagonal) {
  const blockCells = [path[index - 1], path[index], path[index + 1], diagonal];
  const blockKeys = new Set(blockCells.map((cell) => cellKey(cell.x, cell.y)));
  const outsideContacts = [];

  for (const cell of blockCells) {
    for (const neighbor of getNeighbors(cell, track.cols, track.rows)) {
      const neighborKey = cellKey(neighbor.x, neighbor.y);
      if (blockKeys.has(neighborKey)) continue;
      if (!track.tiles.has(neighborKey)) continue;
      outsideContacts.push({
        from: cellKey(cell.x, cell.y),
        to: neighborKey,
      });
    }
  }

  if (outsideContacts.length !== 2) return false;

  const expectedEntry = cellKey(path[index - 1].x, path[index - 1].y);
  const expectedExit = cellKey(path[index + 1].x, path[index + 1].y);
  const actualContacts = new Set(outsideContacts.map((contact) => contact.from));
  if (!actualContacts.has(expectedEntry) || !actualContacts.has(expectedExit)) return false;
  if (actualContacts.size !== 2) return false;

  const previousOutside = path[index - 2];
  const nextOutside = path[index + 2];
  return outsideContacts.some((contact) =>
    contact.from === expectedEntry && contact.to === cellKey(previousOutside.x, previousOutside.y)
  ) && outsideContacts.some((contact) =>
    contact.from === expectedExit && contact.to === cellKey(nextOutside.x, nextOutside.y)
  );
}

function createLongCorner(track, path, index) {
  if (index <= 1 || index >= path.length - 2) return null;
  const current = path[index];
  const previous = path[index - 1];
  const next = path[index + 1];
  const currentTile = track.tiles.get(cellKey(current.x, current.y));
  if (!currentTile || currentTile.type !== "corner") return null;

  const diagonal = getLongCornerDiagonal(current, previous, next);
  if (!isInsideGrid(diagonal, track.cols, track.rows)) return null;
  if (track.tiles.has(cellKey(diagonal.x, diagonal.y))) return null;
  if (!isCleanLongCornerBlock(track, path, index, diagonal)) return null;

  const cells = [previous, current, next, diagonal];
  if (cells.some((cell) => track.longCornerCells.has(cellKey(cell.x, cell.y)))) return null;

  const key = normalizeConnections(currentTile.connections);
  if (!["NW", "EN", "ES", "SW"].includes(key)) return null;

  return {
    id: track.longCorners.length,
    key,
    pathIndex: index,
    previousOutside: path[index - 2],
    previous,
    current,
    next,
    nextOutside: path[index + 2],
    diagonal,
    cells,
    blockX: Math.min(previous.x, current.x, next.x, diagonal.x),
    blockY: Math.min(previous.y, current.y, next.y, diagonal.y),
  };
}

function buildLongCornerPolyline(track, longCorner, steps = 24) {
  const previousOutsideCenter = cellCenter(track, longCorner.previousOutside);
  const previousCenter = cellCenter(track, longCorner.previous);
  const nextCenter = cellCenter(track, longCorner.next);
  const nextOutsideCenter = cellCenter(track, longCorner.nextOutside);
  const start = midpoint(previousOutsideCenter, previousCenter);
  const end = midpoint(nextCenter, nextOutsideCenter);
  const entryDirection = {
    x: (previousCenter.x - previousOutsideCenter.x) / track.tileSize,
    y: (previousCenter.y - previousOutsideCenter.y) / track.tileSize,
  };
  const exitDirection = {
    x: (nextOutsideCenter.x - nextCenter.x) / track.tileSize,
    y: (nextOutsideCenter.y - nextCenter.y) / track.tileSize,
  };

  const normalOptionsA = [leftNormal(entryDirection), rightNormal(entryDirection)];
  const normalOptionsB = [leftNormal(exitDirection), rightNormal(exitDirection)];
  let geometry = null;

  for (const normalA of normalOptionsA) {
    for (const normalB of normalOptionsB) {
      const diffX = normalA.x - normalB.x;
      const diffY = normalA.y - normalB.y;
      let radius = null;
      if (Math.abs(diffX) > 0.001) radius = (end.x - start.x) / diffX;
      else if (Math.abs(diffY) > 0.001) radius = (end.y - start.y) / diffY;
      if (!Number.isFinite(radius) || radius <= 0) continue;

      const center = {
        x: start.x + normalA.x * radius,
        y: start.y + normalA.y * radius,
      };
      const endDistance = Math.hypot(end.x - center.x, end.y - center.y);
      if (Math.abs(endDistance - radius) > 0.5) continue;

      const minX = track.offsetX + longCorner.blockX * track.tileSize - 1;
      const minY = track.offsetY + longCorner.blockY * track.tileSize - 1;
      const maxX = minX + track.tileSize * 2 + 2;
      const maxY = minY + track.tileSize * 2 + 2;
      if (center.x < minX || center.x > maxX || center.y < minY || center.y > maxY) continue;

      const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
      const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
      const ccwTangent = { x: -Math.sin(startAngle), y: Math.cos(startAngle) };
      const cwTangent = { x: Math.sin(startAngle), y: -Math.cos(startAngle) };
      const useClockwise = ccwTangent.x * entryDirection.x + ccwTangent.y * entryDirection.y
        < cwTangent.x * entryDirection.x + cwTangent.y * entryDirection.y;

      geometry = {
        start,
        end,
        center,
        radius,
        startAngle,
        endAngle,
        clockwise: useClockwise,
      };
      break;
    }
    if (geometry) break;
  }

  if (!geometry) return [start, end];

  const delta = geometry.clockwise
    ? getNegativeAngleDelta(geometry.startAngle, geometry.endAngle)
    : getPositiveAngleDelta(geometry.startAngle, geometry.endAngle);
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const angle = geometry.startAngle + delta * t;
    points.push({
      x: geometry.center.x + Math.cos(angle) * geometry.radius,
      y: geometry.center.y + Math.sin(angle) * geometry.radius,
    });
  }
  return points;
}

function generateTrack(seedString) {
  const parsed = parseSeed(seedString);
  const rng = createRng(parsed.seed);
  const attempts = 180;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { start, finish } = chooseEndpoints(parsed.cols, parsed.rows, rng);
    const corePath = buildCorePath(parsed.cols, parsed.rows, start, finish, rng);
    if (!corePath) continue;

    const path = [{ x: start.x, y: start.y }, ...corePath, { x: finish.x, y: finish.y }];
    const tileSize = TILE_SIZE;
    const offsetX = WORLD_PADDING;
    const offsetY = WORLD_PADDING;
    const roadHalfWidth = tileSize * 0.35;
    const tileMap = new Map();

    const track = {
      seed: parsed.seed,
      seedSuffix: parsed.seedSuffix,
      cols: parsed.cols,
      rows: parsed.rows,
      gridLabel: `${parsed.cols}x${parsed.rows}`,
      storageKey: `${BASE_GHOST_STORAGE_KEY}:${parsed.seed}`,
      path,
      start,
      finish,
      tileSize,
      offsetX,
      offsetY,
      worldWidth: parsed.cols * tileSize + WORLD_PADDING * 2,
      worldHeight: parsed.rows * tileSize + WORLD_PADDING * 2,
      roadHalfWidth,
      tiles: tileMap,
      segments: [],
      longCorners: [],
      longCornerCells: new Map(),
      startPosition: null,
      startAngle: DIRS[start.inward].angle,
      finishCenter: null,
    };

    for (let index = 0; index < path.length; index += 1) {
      const cell = path[index];
      const previous = index === 0 ? { x: cell.x + DIRS[start.outward].dx, y: cell.y + DIRS[start.outward].dy } : path[index - 1];
      const next = index === path.length - 1
        ? { x: cell.x + DIRS[finish.outward].dx, y: cell.y + DIRS[finish.outward].dy }
        : path[index + 1];
      const connections = [directionBetween(cell, previous), directionBetween(cell, next)];
      const normalized = normalizeConnections(connections);
      const type = index === 0
        ? "start"
        : index === path.length - 1
          ? "finish"
          : normalized === "EW" || normalized === "NS"
            ? "straight"
            : "corner";
      tileMap.set(cellKey(cell.x, cell.y), {
        x: cell.x,
        y: cell.y,
        type,
        rotation: getRotationForTile(type, connections),
        connections,
        center: cellCenter(track, cell),
      });
    }

    for (let index = 1; index < path.length - 1; index += 1) {
      const longCorner = createLongCorner(track, path, index);
      if (!longCorner) continue;
      track.longCorners.push(longCorner);
      longCorner.cells.forEach((cell) => {
        track.longCornerCells.set(cellKey(cell.x, cell.y), longCorner.id);
      });
    }

    const skippedPairs = new Set();
    track.longCorners.forEach((longCorner) => {
      skippedPairs.add(`${cellKey(longCorner.previousOutside.x, longCorner.previousOutside.y)}>${cellKey(longCorner.previous.x, longCorner.previous.y)}`);
      skippedPairs.add(`${cellKey(longCorner.previous.x, longCorner.previous.y)}>${cellKey(longCorner.current.x, longCorner.current.y)}`);
      skippedPairs.add(`${cellKey(longCorner.current.x, longCorner.current.y)}>${cellKey(longCorner.next.x, longCorner.next.y)}`);
      skippedPairs.add(`${cellKey(longCorner.next.x, longCorner.next.y)}>${cellKey(longCorner.nextOutside.x, longCorner.nextOutside.y)}`);
    });

    const centerline = [edgePoint(track, start), ...path.map((cell) => cellCenter(track, cell))];
    for (let index = 0; index < centerline.length - 1; index += 1) {
      if (index > 0 && index < path.length) {
        const fromCell = path[index - 1];
        const toCell = path[index];
        if (skippedPairs.has(`${cellKey(fromCell.x, fromCell.y)}>${cellKey(toCell.x, toCell.y)}`)) {
          continue;
        }
      }
      track.segments.push({ from: centerline[index], to: centerline[index + 1] });
    }
    track.longCorners.forEach((longCorner) => {
      const curvePoints = buildLongCornerPolyline(track, longCorner);
      const previousOutsideCenter = cellCenter(track, longCorner.previousOutside);
      const nextOutsideCenter = cellCenter(track, longCorner.nextOutside);
      track.segments.push({ from: previousOutsideCenter, to: curvePoints[0] });
      for (let index = 0; index < curvePoints.length - 1; index += 1) {
        track.segments.push({ from: curvePoints[index], to: curvePoints[index + 1] });
      }
      track.segments.push({ from: curvePoints[curvePoints.length - 1], to: nextOutsideCenter });
    });
    track.startPosition = cellCenter(track, path[0]);
    track.finishCenter = cellCenter(track, path[path.length - 1]);
    return track;
  }

  throw new Error("This seed could not build a driveable track. Try another suffix.");
}

function isValidGhostFrames(frames) {
  return Array.isArray(frames)
    && frames.length > 1
    && frames.length <= MAX_GHOST_FRAMES
    && frames.every((frame) =>
      Array.isArray(frame) && frame.length === 4 && frame.every(Number.isFinite)
    );
}

function loadBestGhost(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.version !== TRACK_VERSION || !Number.isFinite(saved.time) || !isValidGhostFrames(saved.frames)) {
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

function personalGhostStorageKey(storageKey) {
  return `${storageKey}:${currentUser?.id || "signed-out"}`;
}

function saveBestGhost() {
  if (!currentTrack || !localGhost) return;
  try {
    localStorage.setItem(personalGhostStorageKey(currentTrack.storageKey), JSON.stringify(localGhost));
  } catch {
    // The run still works when storage is unavailable, only persistence is skipped.
  }
}

function setActiveGhost(ghost) {
  activeGhost = ghost;
  ghostFrameIndex = 0;
  updateBestTime();
  updateGhostChrome();
}

function updateBestTime() {
  bestTimeElement.textContent = localGhost ? localGhost.time.toFixed(2).padStart(5, "0") : "--.--";
  if (lobbyPb) lobbyPb.textContent = localGhost ? localGhost.time.toFixed(2).padStart(5, "0") : "--.--";
}

function isDailyMode() {
  return playMode === "daily";
}

function isBoardTrack() {
  return isDailyMode() && Boolean(currentTrack);
}

function canSubmitScore() {
  return Boolean(currentUser) && dailyTrackResolved && isBoardTrack() && dailyOffset === 0;
}

function isLeaderboardConfigured() {
  return Boolean(LEADERBOARD_CONFIG.supabaseUrl && LEADERBOARD_CONFIG.supabaseAnonKey);
}

function supabaseBaseUrl() {
  return String(LEADERBOARD_CONFIG.supabaseUrl).replace(/\/$/, "");
}

function leaderboardApiUrl() {
  return `${supabaseBaseUrl()}/rest/v1/leaderboard`;
}

function leaderboardHeaders(extra = {}) {
  return {
    apikey: LEADERBOARD_CONFIG.supabaseAnonKey,
    Authorization: `Bearer ${LEADERBOARD_CONFIG.supabaseAnonKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function rpcApiUrl(functionName) {
  return `${supabaseBaseUrl()}/rest/v1/rpc/${functionName}`;
}

async function readLeaderboardError(response, fallback) {
  try {
    const payload = await response.json();
    return payload?.message || payload?.msg || payload?.error_description || payload?.hint || fallback;
  } catch {
    return fallback;
  }
}

function loadPlayerName() {
  return currentUser?.username || "";
}

function savePlayerName(name) {
  if (!currentUser || name !== currentUser.username) return;
  playerNameInput.value = name;
  finishNameInput.value = name;
}

function normalizePlayerName(raw) {
  const name = String(raw ?? "").trim();
  if (!/^[a-z0-9]{3,16}$/.test(name)) return null;
  return name;
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "login";
  const signingUp = authMode === "signup";
  loginTabButton.classList.toggle("active", !signingUp);
  signupTabButton.classList.toggle("active", signingUp);
  authTitle.textContent = signingUp ? "CREATE ACCOUNT" : "LOG IN";
  authCopy.textContent = signingUp
    ? "Choose a unique pilot name and password."
    : "Log in to enter today's race.";
  authPasswordHint.textContent = signingUp ? "At least 6 characters" : "Enter your password";
  authPasswordInput.autocomplete = signingUp ? "new-password" : "current-password";
  authSubmitButton.textContent = signingUp ? "CREATE ACCOUNT" : "LOG IN";
  setAuthStatus("");
}

function setAuthStatus(message, state = "") {
  authStatus.textContent = message;
  if (state) authStatus.dataset.state = state;
  else delete authStatus.dataset.state;
}

function saveAuthSession(session) {
  if (!session?.session_token || !session?.user_id || !session?.username) return;
  authSession = session;
  try {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // The account still works until this tab is closed.
  }
}

function clearAuthSession() {
  authSession = null;
  currentUser = null;
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

function unlockGame(session) {
  const username = normalizePlayerName(session?.username);
  if (!username) throw new Error("This account has no valid pilot name.");
  currentUser = { id: session.user_id, username };
  playerNameInput.value = username;
  finishNameInput.value = username;
  authGate.hidden = true;
  gameShell.inert = false;
  gameShell.removeAttribute("aria-hidden");
  if (currentTrack) {
    localGhost = loadBestGhost(personalGhostStorageKey(currentTrack.storageKey));
    if (ghostPick === "self") setActiveGhost(localGhost);
  }
  updateBestTime();
  if (isDailyMode()) applyDailyTrack(dailyOffset);
  else refreshLeaderboard();
}

function lockGame(message = "") {
  clearKeys();
  clearAuthSession();
  playerNameInput.value = "";
  finishNameInput.value = "";
  gameShell.inert = true;
  gameShell.setAttribute("aria-hidden", "true");
  authGate.hidden = false;
  authPasswordInput.value = "";
  setAuthStatus(message, message ? "error" : "");
  authUsernameInput.focus();
}

async function requestRpc(functionName, body) {
  const response = await fetch(rpcApiUrl(functionName), {
    method: "POST",
    headers: leaderboardHeaders(),
    body: JSON.stringify(body || {}),
  });
  if (!response.ok) {
    throw new Error(await readLeaderboardError(response, `Account request failed (${response.status}).`));
  }
  return response.status === 204 ? {} : response.json();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!isLeaderboardConfigured()) {
    setAuthStatus("Add the Supabase URL and anon key in config.js.", "error");
    return;
  }
  const username = normalizePlayerName(authUsernameInput.value);
  if (!username) {
    setAuthStatus("Use 3–16 lowercase letters and numbers only.", "error");
    authUsernameInput.focus();
    return;
  }
  const password = authPasswordInput.value;
  if (password.length < 6 || password.length > 72) {
    setAuthStatus("Password must be 6–72 characters.", "error");
    authPasswordInput.focus();
    return;
  }

  authSubmitButton.disabled = true;
  setAuthStatus(authMode === "signup" ? "Creating account…" : "Logging in…");
  try {
    const payload = authMode === "signup"
      ? await requestRpc("create_game_account", {
        p_username: username,
        p_password: password,
      })
      : await requestRpc("login_game_account", {
        p_username: username,
        p_password: password,
      });
    if (!payload.session_token) {
      throw new Error("The account server returned no session.");
    }
    saveAuthSession(payload);
    unlockGame(payload);
  } catch (error) {
    const fallback = authMode === "signup"
      ? "Could not create the account. The username may already be taken."
      : "Could not log in.";
    const message = String(error.message || "");
    setAuthStatus(
      authMode === "signup" && /database error saving new user/i.test(message) ? fallback : message || fallback,
      "error",
    );
  } finally {
    authSubmitButton.disabled = false;
  }
}

async function restoreAuthSession() {
  if (!isLeaderboardConfigured()) {
    lockGame("Add the Supabase URL and anon key in config.js.");
    return;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY) || "null");
    if (!saved?.session_token) {
      lockGame();
      return;
    }
    const session = await requestRpc("get_game_session", {
      p_session_token: saved.session_token,
    });
    saveAuthSession(session);
    unlockGame(session);
  } catch {
    lockGame("Your session expired. Log in again.");
  }
}

async function logout() {
  const token = authSession?.session_token;
  lockGame();
  if (!token) return;
  try {
    await requestRpc("logout_game_account", { p_session_token: token });
  } catch {
    // Local logout is enough if Supabase is unreachable.
  }
}

function uniqueBestRows(rows) {
  const seen = new Set();
  const best = [];
  for (const row of rows) {
    const key = String(row.player_name || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    best.push(row);
    if (best.length >= LEADERBOARD_LIMIT) break;
  }
  return best;
}

function formatBoardTime(timeMs) {
  return (timeMs / 1000).toFixed(2).padStart(5, "0");
}

function ghostFromRow(row) {
  if (!row || !isValidGhostFrames(row.frames) || !Number.isFinite(Number(row.time_ms))) return null;
  return {
    version: TRACK_VERSION,
    time: Number(row.time_ms) / 1000,
    frames: row.frames,
    name: String(row.player_name || "GHOST"),
    id: row.id || null,
    source: "cloud",
  };
}

function renderLeaderboardList(listElement, rows, highlightName = "") {
  const highlight = highlightName.trim().toLowerCase();
  listElement.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.textContent = "Empty so far";
    listElement.append(empty);
    return;
  }

  rows.forEach((row, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("b");
    const name = document.createElement("span");
    const time = document.createElement("span");
    rank.textContent = String(index + 1);
    name.textContent = row.player_name;
    time.textContent = formatBoardTime(row.time_ms);
    if (row.id) {
      item.dataset.id = row.id;
      const action = document.createElement("button");
      action.type = "button";
      action.textContent = "RACE";
      action.dataset.id = row.id;
      item.append(rank, name, time, action);
    } else {
      item.append(rank, name, time);
    }
    if (highlight && String(row.player_name).trim().toLowerCase() === highlight) {
      item.classList.add("is-you");
    }
    if (row.id && row.id === selectedGhostId) {
      item.classList.add("is-ghost");
    }
    listElement.append(item);
  });
}

function syncNameInputs(source) {
  const value = source.value;
  if (playerNameInput !== source) playerNameInput.value = value;
  if (finishNameInput !== source) finishNameInput.value = value;
}

function currentPlayerName() {
  return playerNameInput.value.trim() || finishNameInput.value.trim() || loadPlayerName();
}

function updateGhostChrome() {
  const label = ghostMuted || !activeGhost
    ? "OFF"
    : ghostPick === "self"
      ? "YOU"
      : activeGhost.name || "WR";
  ghostHudValue.textContent = label;
  raceGhostLabel.textContent = activeGhost
    ? `${activeGhost.name || label} ${Number(activeGhost.time).toFixed(2)}`
    : "OFF";
  ghostWrButton.classList.toggle("active", ghostPick === "wr" && !ghostMuted);
  ghostSelfButton.classList.toggle("active", ghostPick === "self" && !ghostMuted);
  ghostOffButton.classList.toggle("active", ghostPick === "off" || ghostMuted);
}

async function selectGhostPick(pick) {
  ghostPick = pick;
  ghostMuted = pick === "off";
  selectedGhostId = pick === "rival" ? selectedGhostId : null;
  if (pick === "off") {
    setActiveGhost(null);
    paintLeaderboard(loadPlayerName());
    return;
  }
  if (pick === "self") {
    setActiveGhost(localGhost);
    paintLeaderboard(loadPlayerName());
    return;
  }
  await ensureActiveCloudGhost();
  paintLeaderboard(loadPlayerName());
}

function formatDeltaSeconds(delta) {
  if (!Number.isFinite(delta)) return "—";
  if (Math.abs(delta) < 0.005) return "±0.00";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)}`;
}

function describeFinish(timeMs) {
  if (!isBoardTrack()) {
    finishPlace.textContent = "FREE PLAY";
    finishDelta.textContent = "This time is not saved to the daily board.";
    return;
  }
  if (!canSubmitScore()) {
    finishPlace.textContent = "ARCHIVE";
    finishDelta.textContent = "Yesterday's map · time is not saved.";
    return;
  }
  const rows = uniqueBestRows(leaderboardRows);
  const wr = rows[0];
  const name = currentPlayerName().trim().toLowerCase();
  const existing = rows.findIndex((row) => String(row.player_name).trim().toLowerCase() === name);
  let rank;
  if (existing >= 0 && rows[existing].time_ms <= timeMs) {
    rank = existing + 1;
  } else {
    rank = rows.findIndex((row) => timeMs < row.time_ms);
    rank = rank === -1 ? rows.length + 1 : rank + 1;
  }
  finishPlace.textContent = `P${rank}`;
  const parts = [];
  if (wr) parts.push(`WR ${formatDeltaSeconds(timeMs / 1000 - wr.time_ms / 1000)}`);
  if (activeGhost?.time) {
    parts.push(`${activeGhost.name || "GHOST"} ${formatDeltaSeconds(elapsed - activeGhost.time)}`);
  }
  finishDelta.textContent = parts.join(" · ") || "First time today";
}

function syncLeaderboardVisibility() {
  const board = isBoardTrack();
  lobby.hidden = !board;
  raceStrip.hidden = !board || !started || finished;
  finishLeaderboard.hidden = !board || !finished;
  raceWrButton.hidden = !board;
  raceSelfButton.hidden = !board;
  startPrompt.style.opacity = started || finished ? "0" : "1";
  updateGhostChrome();
}

function paintLeaderboard(highlightName = "") {
  const rows = uniqueBestRows(leaderboardRows);
  renderLeaderboardList(leaderboardList, rows, highlightName);
  lobbyWr.textContent = rows[0] ? formatBoardTime(rows[0].time_ms) : "--.--";
  lobbyWrName.textContent = rows[0]?.player_name || "—";
  lobbyPb.textContent = localGhost ? localGhost.time.toFixed(2).padStart(5, "0") : "--.--";
  updateGhostChrome();
  if (!isLeaderboardConfigured()) {
    leaderboardHint.textContent = "Add the URL and anon key in config.js";
    return;
  }
  if (isBoardTrack() && !canSubmitScore()) {
    leaderboardHint.textContent = "Yesterday archive · you can still race ghosts";
    return;
  }
  if (ghostMuted || ghostPick === "off") {
    leaderboardHint.textContent = "No ghost · RACE picks an opponent";
    return;
  }
  if (activeGhost?.source === "cloud") {
    leaderboardHint.textContent = `Ghost: ${activeGhost.name}`;
    return;
  }
  leaderboardHint.textContent = rows.length
    ? `Pick a ghost · top ${rows.length}`
    : "Today's first time will be WR";
}

function onLeaderboardClick(event) {
  const item = event.target.closest("[data-id]");
  if (!item?.dataset.id) return;
  event.preventDefault();
  ghostPick = "rival";
  ghostMuted = false;
  loadCloudGhost(item.dataset.id);
}

async function loadCloudGhost(rowId) {
  if (!currentUser || !isLeaderboardConfigured() || !rowId) return;
  try {
    const query = new URLSearchParams({
      select: "id,player_name,time_ms,slip,frames",
      id: `eq.${rowId}`,
      limit: "1",
    });
    const response = await fetch(`${leaderboardApiUrl()}?${query}`, {
      headers: leaderboardHeaders(),
    });
    if (!response.ok) {
      throw new Error(await readLeaderboardError(response, `Could not load ghost (${response.status}).`));
    }
    const [row] = await response.json();
    const ghost = ghostFromRow(row);
    if (!ghost) throw new Error("This time has no usable recording.");
    selectedGhostId = ghost.id;
    ghostPick = "rival";
    ghostMuted = false;
    setActiveGhost(ghost);
    paintLeaderboard(loadPlayerName());
  } catch (error) {
    if (!localGhost) setActiveGhost(null);
    setLeaderboardStatus(error.message || "Could not load ghost.", "error");
    leaderboardHint.textContent = "Ghost unavailable right now";
  }
}

async function ensureActiveCloudGhost() {
  if (!isBoardTrack() || ghostMuted || ghostPick === "off" || ghostPick === "self" || !isLeaderboardConfigured()) return;
  const rows = uniqueBestRows(leaderboardRows);
  if (!rows.length) {
    if (activeGhost?.source === "cloud") setActiveGhost(localGhost);
    return;
  }
  const preferred = rows.find((row) => row.id === selectedGhostId) || (ghostPick === "wr" ? rows[0] : null);
  if (!preferred?.id || preferred.id === activeGhost?.id) return;
  await loadCloudGhost(preferred.id);
  ghostPick = selectedGhostId === rows[0]?.id ? "wr" : "rival";
  updateGhostChrome();
}

function setLeaderboardStatus(message, state = "") {
  leaderboardStatus.textContent = message;
  if (state) {
    leaderboardStatus.dataset.state = state;
  } else {
    delete leaderboardStatus.dataset.state;
  }
}

async function refreshLeaderboard() {
  syncLeaderboardVisibility();
  if (!isBoardTrack()) {
    leaderboardRows = [];
    if (activeGhost?.source === "cloud") setActiveGhost(localGhost);
    paintLeaderboard();
    return;
  }
  if (!isLeaderboardConfigured()) {
    leaderboardRows = [];
    paintLeaderboard();
    setLeaderboardStatus("Add Supabase details in config.js.", "error");
    return;
  }
  if (!currentUser) {
    leaderboardRows = [];
    paintLeaderboard();
    return;
  }

  try {
    const query = new URLSearchParams({
      select: "id,player_name,time_ms,slip,created_at",
      seed: `eq.${currentTrack.seed}`,
      track_version: `eq.${TRACK_VERSION}`,
      order: "time_ms.asc",
      limit: "80",
    });
    const response = await fetch(`${leaderboardApiUrl()}?${query}`, {
      headers: leaderboardHeaders(),
    });
    if (!response.ok) {
      throw new Error(await readLeaderboardError(response, `Could not load board (${response.status}).`));
    }
    leaderboardRows = await response.json();
    paintLeaderboard(loadPlayerName());
    if (!finished) setLeaderboardStatus("");
    await ensureActiveCloudGhost();
  } catch (error) {
    leaderboardRows = [];
    paintLeaderboard();
    setLeaderboardStatus(error.message || "Could not load leaderboard.", "error");
    leaderboardHint.textContent = "Board unavailable right now";
  }
}

async function submitRankedScore() {
  if (!canSubmitScore() || scoreSubmitted || !pendingFinishTimeMs) return;
  if (!isLeaderboardConfigured()) {
    setLeaderboardStatus("Add Supabase details in config.js.", "error");
    return;
  }

  const name = currentUser?.username;
  if (!name || !currentUser?.id) {
    setLeaderboardStatus("Log in before saving a time.", "error");
    return;
  }
  if (pendingFinishTimeMs < 1000) {
    setLeaderboardStatus("Time is too short for the board.", "error");
    return;
  }
  if (!isValidGhostFrames(pendingFrames)) {
    setLeaderboardStatus("The run recording could not be saved.", "error");
    return;
  }

  const frames = pendingFrames.slice();
  savePlayerName(name);
  playerNameInput.value = name;
  finishNameInput.value = name;
  setLeaderboardStatus("Saving time…");

  try {
    const leaderboardChanged = await requestRpc("submit_game_score", {
      p_session_token: authSession.session_token,
      p_seed: currentTrack.seed,
      p_time_ms: pendingFinishTimeMs,
      p_slip: DAILY_SLIP,
      p_track_version: TRACK_VERSION,
      p_frames: frames,
    });
    scoreSubmitted = true;
    await refreshLeaderboard();
    const best = uniqueBestRows(leaderboardRows);
    const rank = best.findIndex((row) => String(row.player_name).trim().toLowerCase() === name.toLowerCase()) + 1;
    const personalBest = best[rank - 1];
    paintLeaderboard(name);
    if (leaderboardChanged && rank > 0) {
      setLeaderboardStatus(`Leaderboard updated · P${rank}`, "ok");
    } else if (leaderboardChanged) {
      setLeaderboardStatus("Leaderboard updated.", "ok");
    } else if (personalBest) {
      setLeaderboardStatus(`No update · PB ${formatBoardTime(personalBest.time_ms)} s.`);
    } else {
      setLeaderboardStatus("No update · your leaderboard time is faster.");
    }
  } catch (error) {
    setLeaderboardStatus(error.message || "Could not save time.", "error");
  }
}

function recordRunFrame() {
  if (elapsed < nextRecordTime) return;
  runRecording.push([elapsed, player.x, player.y, player.angle]);
  nextRecordTime = elapsed + RECORD_INTERVAL;
}

function getGhostPose(time) {
  if (!activeGhost) return null;
  const frames = activeGhost.frames;
  if (time <= frames[0][0]) {
    return { x: frames[0][1], y: frames[0][2], angle: frames[0][3] };
  }
  if (time >= frames[frames.length - 1][0]) {
    const frame = frames[frames.length - 1];
    return { x: frame[1], y: frame[2], angle: frame[3] };
  }

  while (ghostFrameIndex < frames.length - 2 && frames[ghostFrameIndex + 1][0] <= time) {
    ghostFrameIndex += 1;
  }
  const from = frames[ghostFrameIndex];
  const to = frames[ghostFrameIndex + 1];
  const progress = (time - from[0]) / (to[0] - from[0]);
  const angleDifference = ((to[3] - from[3] + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return {
    x: from[1] + (to[1] - from[1]) * progress,
    y: from[2] + (to[2] - from[2]) * progress,
    angle: from[3] + angleDifference * progress,
  };
}

function closestPointOnSegment(point, segment) {
  const dx = segment.to.x - segment.from.x;
  const dy = segment.to.y - segment.from.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = ((point.x - segment.from.x) * dx + (point.y - segment.from.y) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  return {
    x: segment.from.x + dx * t,
    y: segment.from.y + dy * t,
  };
}

function getTrackAllowedRadius(track) {
  return Math.max(14, track.roadHalfWidth - PLAYER_RADIUS * 0.2);
}

function getVisibleTileConnections(tile) {
  if (tile.type !== "finish") return tile.connections;
  return tile.connections.filter((direction) => direction !== currentTrack.finish.outward);
}

function constrainPlayerToTrack(previousX, previousY) {
  if (!currentTrack) return;
  let closest = null;
  let bestDistance = Infinity;

  for (const segment of currentTrack.segments) {
    const point = closestPointOnSegment(player, segment);
    const distance = Math.hypot(player.x - point.x, player.y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = point;
    }
  }

  const allowedRadius = getTrackAllowedRadius(currentTrack);
  if (!closest || bestDistance <= allowedRadius) return;

  let nx = player.x - closest.x;
  let ny = player.y - closest.y;
  let distance = Math.hypot(nx, ny);
  if (distance < 0.001) {
    nx = player.x - previousX;
    ny = player.y - previousY;
    distance = Math.hypot(nx, ny) || 1;
  }
  nx /= distance;
  ny /= distance;
  player.x = closest.x + nx * allowedRadius;
  player.y = closest.y + ny * allowedRadius;

  const outwardVelocity = player.vx * nx + player.vy * ny;
  if (outwardVelocity > 0) {
    player.vx -= nx * outwardVelocity * 1.06;
    player.vy -= ny * outwardVelocity * 1.06;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateCamera(snap = false) {
  if (!currentTrack) return;
  const maxX = Math.max(0, currentTrack.worldWidth - WIDTH);
  const maxY = Math.max(0, currentTrack.worldHeight - HEIGHT);
  const targetX = clamp(player.x - WIDTH / 2, 0, maxX);
  const targetY = clamp(player.y - HEIGHT / 2, 0, maxY);

  if (snap) {
    camera.x = targetX;
    camera.y = targetY;
    return;
  }

  camera.x += (targetX - camera.x) * 0.12;
  camera.y += (targetY - camera.y) * 0.12;
}

function update(dt, now) {
  if (!currentUser || !currentTrack || finished) return;

  updateGamepadInput();

  const keyboardX = Number(keys.right) - Number(keys.left);
  const keyboardY = Number(keys.down) - Number(keys.up);
  const keyboardLength = Math.hypot(keyboardX, keyboardY);
  let inputX = gamepadInput.active ? gamepadInput.x : keyboardX;
  let inputY = gamepadInput.active ? gamepadInput.y : keyboardY;
  if (gamepadInput.active && keyboardLength > 0) {
    inputX = gamepadInput.x + keyboardX;
    inputY = gamepadInput.y + keyboardY;
  }
  const inputLength = Math.hypot(inputX, inputY);
  const brakeActive = keys.brake || gamepadInput.brake;
  const speedBefore = Math.hypot(player.vx, player.vy);
  const slipperiness = Number(slipSlider.value);
  const coastDeceleration = 520 / (1 + slipperiness / 25);
  const naturalGrip = 4.8 / (1 + slipperiness / 35);

  if (inputLength > 0) {
    inputX /= inputLength;
    inputY /= inputLength;
    if (!started) {
      started = true;
      startTime = now;
      runRecording = [[0, player.x, player.y, player.angle]];
      nextRecordTime = RECORD_INTERVAL;
      ghostFrameIndex = 0;
      startPrompt.style.opacity = "0";
      syncLeaderboardVisibility();
    }

    const forwardSpeed = player.vx * inputX + player.vy * inputY;
    const lateralX = player.vx - inputX * forwardSpeed;
    const lateralY = player.vy - inputY * forwardSpeed;
    const lateralGrip = brakeActive ? 7.5 : naturalGrip;
    const gripFactor = Math.max(0, 1 - lateralGrip * dt);
    player.vx = inputX * forwardSpeed + lateralX * gripFactor;
    player.vy = inputY * forwardSpeed + lateralY * gripFactor;

    const counterForce = forwardSpeed < -20 ? 1.18 : 1;
    player.vx += inputX * ACCELERATION * counterForce * dt;
    player.vy += inputY * ACCELERATION * counterForce * dt;
  }

  if (brakeActive) {
    const speed = Math.hypot(player.vx, player.vy);
    const driftDrag = Math.max(70, 170 - slipperiness * 0.3);
    const reduced = Math.max(0, speed - driftDrag * dt);
    if (speed > 0) {
      player.vx *= reduced / speed;
      player.vy *= reduced / speed;
    }
  } else if (inputLength === 0) {
    const speed = Math.hypot(player.vx, player.vy);
    const nextSpeed = Math.max(0, speed - coastDeceleration * dt);
    if (speed > 0) {
      player.vx *= nextSpeed / speed;
      player.vy *= nextSpeed / speed;
    }
  }

  let speed = Math.hypot(player.vx, player.vy);
  if (speed > MAX_SPEED) {
    player.vx *= MAX_SPEED / speed;
    player.vy *= MAX_SPEED / speed;
    speed = MAX_SPEED;
  }

  const turnAmount = inputLength > 0 && speedBefore > 100
    ? Math.abs(player.vx * inputY - player.vy * inputX) / Math.max(speed, 1)
    : 0;
  const isDrifting = brakeActive && speed > 135 && turnAmount > 35;
  player.drift = approach(player.drift, isDrifting ? 1 : 0, dt * (isDrifting ? 7 : 4));

  if (player.drift > 0.15 && Math.random() < dt * 45) {
    trails.push({ x: player.x, y: player.y, life: 1, angle: Math.atan2(player.vy, player.vx) });
  }

  const previousX = player.x;
  const previousY = player.y;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = clamp(player.x, 20, currentTrack.worldWidth - 20);
  player.y = clamp(player.y, 20, currentTrack.worldHeight - 20);
  constrainPlayerToTrack(previousX, previousY);

  speed = Math.hypot(player.vx, player.vy);
  if (inputLength > 0) {
    const targetAngle = Math.atan2(inputY, inputX);
    const difference = ((targetAngle - player.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    player.angle += difference * Math.min(1, dt * (brakeActive ? 13 : 9));
  }

  trails.forEach((trail) => {
    trail.life -= dt * 1.8;
  });
  while (trails.length && trails[0].life <= 0) trails.shift();
  checkpointFlash = Math.max(0, checkpointFlash - dt);

  if (started) {
    elapsed = (now - startTime) / 1000;
    timerElement.textContent = elapsed.toFixed(2).padStart(5, "0");
    recordRunFrame();
  }

  if (started && Math.hypot(player.x - currentTrack.finishCenter.x, player.y - currentTrack.finishCenter.y) <= getTrackAllowedRadius(currentTrack) + 1) {
    checkpointFlash = 0.45;
    finishGame();
  }

  updateCamera();
}

function finishGame() {
  finished = true;
  const lastRecordedTime = runRecording.length ? runRecording[runRecording.length - 1][0] : -1;
  if (elapsed - lastRecordedTime > 0.001) {
    runRecording.push([elapsed, player.x, player.y, player.angle]);
  }
  pendingFrames = runRecording.slice();
  const isNewBest = !localGhost || elapsed < localGhost.time;
  if (isNewBest && runRecording.length > 1) {
    localGhost = {
      version: TRACK_VERSION,
      time: elapsed,
      frames: runRecording,
      name: loadPlayerName() || "YOU",
      source: "local",
    };
    saveBestGhost();
    updateBestTime();
  }
  finishTime.textContent = `${elapsed.toFixed(2)} s`;
  describeFinish(Math.round(elapsed * 1000));
  finishRating.textContent = isNewBest
    ? "NEW PERSONAL BEST · Ghost saved locally."
    : elapsed < 18
      ? "Elite run. The drift is under control."
      : elapsed <= 30
        ? "Finished under 30 seconds."
        : "Track done. Try a sharper brake into the corners.";
  finishPanel.hidden = false;
  syncLeaderboardVisibility();
  if (canSubmitScore()) {
    pendingFinishTimeMs = Math.round(elapsed * 1000);
    if (!playerNameInput.value.trim()) playerNameInput.value = loadPlayerName();
    if (!finishNameInput.value.trim()) finishNameInput.value = playerNameInput.value;
    if (currentPlayerName()) {
      submitRankedScore();
    } else {
      setLeaderboardStatus("Enter a name and save the time.");
      finishNameInput.focus();
    }
  } else if (isBoardTrack()) {
    setLeaderboardStatus("Archive · time is not saved.");
  }
}

function draw(now) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawArena(now);
  drawGhost();
  drawTrails();
  drawPlayer(now);
  ctx.restore();
  drawOverlay();

  if (checkpointFlash > 0) {
    ctx.fillStyle = `rgba(185, 255, 85, ${checkpointFlash * 0.13})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#102a34");
  gradient.addColorStop(0.55, "#0a2029");
  gradient.addColorStop(1, "#07171f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.strokeStyle = "rgba(101, 205, 220, 0.055)";
  ctx.lineWidth = 1;
  for (let x = 24; x < WIDTH; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 24; y < HEIGHT; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  if (!currentTrack) return;
}

function drawArena(now) {
  if (!currentTrack) return;

  ctx.save();
  ctx.fillStyle = "#081820";
  ctx.fillRect(0, 0, currentTrack.worldWidth, currentTrack.worldHeight);
  ctx.restore();

  const gridWidth = currentTrack.cols * currentTrack.tileSize;
  const gridHeight = currentTrack.rows * currentTrack.tileSize;

  ctx.save();
  ctx.strokeStyle = "rgba(86, 241, 255, 0.32)";
  ctx.lineWidth = 3;
  ctx.strokeRect(currentTrack.offsetX, currentTrack.offsetY, gridWidth, gridHeight);
  ctx.strokeStyle = "rgba(86, 241, 255, 0.08)";
  ctx.lineWidth = 10;
  ctx.strokeRect(currentTrack.offsetX + 4, currentTrack.offsetY + 4, gridWidth - 8, gridHeight - 8);
  ctx.restore();

  for (let y = 0; y < currentTrack.rows; y += 1) {
    for (let x = 0; x < currentTrack.cols; x += 1) {
      drawGridCell(x, y, now);
    }
  }

  currentTrack.longCorners.forEach((longCorner) => drawLongCorner(longCorner, now));
}

function drawOverlay() {
  if (!currentTrack) return;
  ctx.save();
  ctx.fillStyle = "rgba(207, 245, 249, 0.42)";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "left";
  ctx.fillText(
    playMode === "daily"
      ? `DAILY ${formatCzechUtcDate(utcDateFromOffset(dailyOffset))}`
      : `SEED ${currentTrack.seed}`,
    18,
    24,
  );
  ctx.restore();

  drawMinimap();
}

function drawMinimap() {
  const maxWidth = 220;
  const maxHeight = 160;
  const mapScale = Math.min(maxWidth / currentTrack.worldWidth, maxHeight / currentTrack.worldHeight);
  const mapWidth = currentTrack.worldWidth * mapScale;
  const mapHeight = currentTrack.worldHeight * mapScale;
  const panelWidth = mapWidth + 24;
  const panelHeight = mapHeight + 34;
  const panelX = WIDTH - panelWidth - 16;
  const panelY = 16;
  const mapX = panelX + 12;
  const mapY = panelY + 18;

  ctx.save();
  ctx.fillStyle = "rgba(4, 18, 24, 0.86)";
  ctx.strokeStyle = "rgba(86, 241, 255, 0.28)";
  ctx.lineWidth = 1;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  ctx.fillStyle = "rgba(207, 245, 249, 0.55)";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("MINIMAP", panelX + 12, panelY + 12);

  ctx.fillStyle = "rgba(7, 23, 31, 0.98)";
  ctx.fillRect(mapX, mapY, mapWidth, mapHeight);

  for (let y = 0; y < currentTrack.rows; y += 1) {
    for (let x = 0; x < currentTrack.cols; x += 1) {
      const tile = currentTrack.tiles.get(cellKey(x, y));
      const isLongCornerCell = currentTrack.longCornerCells.has(cellKey(x, y));
      const left = (currentTrack.offsetX + x * currentTrack.tileSize) * mapScale;
      const top = (currentTrack.offsetY + y * currentTrack.tileSize) * mapScale;
      const size = currentTrack.tileSize * mapScale;
      ctx.fillStyle = tile || isLongCornerCell ? "rgba(22, 48, 58, 0.95)" : "rgba(8, 18, 24, 0.95)";
      ctx.fillRect(mapX + left, mapY + top, size, size);
      if (tile && !isLongCornerCell) {
        ctx.strokeStyle = tile.type === "start" ? "#72ffc0" : tile.type === "finish" ? "#ffd795" : "rgba(86, 241, 255, 0.5)";
        ctx.lineWidth = Math.max(1, size * 0.12);
        for (const direction of getVisibleTileConnections(tile)) {
          const dx = DIRS[direction].dx * size * 0.36;
          const dy = DIRS[direction].dy * size * 0.36;
          ctx.beginPath();
          ctx.moveTo(mapX + left + size / 2, mapY + top + size / 2);
          ctx.lineTo(mapX + left + size / 2 + dx, mapY + top + size / 2 + dy);
          ctx.stroke();
        }
        if (tile.type === "finish") {
          ctx.fillStyle = "#ffd795";
          ctx.beginPath();
          ctx.arc(mapX + left + size / 2, mapY + top + size / 2, Math.max(2, size * 0.18), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  currentTrack.longCorners.forEach((longCorner) => {
    const curvePoints = buildLongCornerPolyline(currentTrack, longCorner, 16);
    ctx.strokeStyle = "rgba(86, 241, 255, 0.7)";
    ctx.lineWidth = Math.max(1.2, currentTrack.roadHalfWidth * mapScale * 0.7);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mapX + curvePoints[0].x * mapScale, mapY + curvePoints[0].y * mapScale);
    for (let index = 1; index < curvePoints.length; index += 1) {
      ctx.lineTo(mapX + curvePoints[index].x * mapScale, mapY + curvePoints[index].y * mapScale);
    }
    ctx.stroke();
  });

  ctx.strokeStyle = "rgba(86, 241, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    mapX + currentTrack.offsetX * mapScale,
    mapY + currentTrack.offsetY * mapScale,
    currentTrack.cols * currentTrack.tileSize * mapScale,
    currentTrack.rows * currentTrack.tileSize * mapScale,
  );

  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mapX + camera.x * mapScale, mapY + camera.y * mapScale, WIDTH * mapScale, HEIGHT * mapScale);

  ctx.fillStyle = "#bffbff";
  ctx.beginPath();
  ctx.arc(mapX + player.x * mapScale, mapY + player.y * mapScale, Math.max(2.5, 5 * mapScale), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGridCell(x, y, now) {
  const tileSize = currentTrack.tileSize;
  const left = currentTrack.offsetX + x * tileSize;
  const top = currentTrack.offsetY + y * tileSize;
  const tile = currentTrack.tiles.get(cellKey(x, y));
  const isLongCornerCell = currentTrack.longCornerCells.has(cellKey(x, y));

  ctx.save();
  ctx.fillStyle = tile || isLongCornerCell ? "rgba(12, 30, 38, 0.84)" : "rgba(5, 14, 19, 0.92)";
  ctx.fillRect(left, top, tileSize, tileSize);
  ctx.strokeStyle = "rgba(86, 241, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, tileSize, tileSize);

  if (isLongCornerCell) {
    ctx.restore();
    return;
  }

  if (!tile) {
    ctx.restore();
    return;
  }

  const center = tile.center;
  const roadWidth = currentTrack.roadHalfWidth * 2;
  const localEdge = {
    N: { x: center.x, y: top },
    E: { x: left + tileSize, y: center.y },
    S: { x: center.x, y: top + tileSize },
    W: { x: left, y: center.y },
  };

  const roadConnections = getVisibleTileConnections(tile);

  ctx.lineCap = "round";
  ctx.shadowColor = tile.type === "finish" ? "rgba(255, 208, 112, 0.22)" : "rgba(86, 241, 255, 0.18)";
  ctx.shadowBlur = 14;
  ctx.strokeStyle = "#17343d";
  ctx.lineWidth = roadWidth + 16;
  roadConnections.forEach((direction) => {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(localEdge[direction].x, localEdge[direction].y);
    ctx.stroke();
  });
  ctx.shadowBlur = 0;
  ctx.strokeStyle = tile.type === "finish" ? "#ffc97b" : tile.type === "start" ? "#72ffc0" : "#d8f5f7";
  ctx.lineWidth = roadWidth;
  roadConnections.forEach((direction) => {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(localEdge[direction].x, localEdge[direction].y);
    ctx.stroke();
  });

  const pulse = Math.sin(now * 0.005 + x + y) * 0.6;
  if (tile.type === "finish") {
    ctx.fillStyle = "#ffd795";
    ctx.beginPath();
    ctx.arc(center.x, center.y, roadWidth * 0.36 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffc97b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, currentTrack.roadHalfWidth * 0.72 + pulse, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = tile.type === "corner" ? "#b9ff55" : "#56f1ff";
    ctx.beginPath();
    ctx.arc(center.x, center.y, roadWidth * 0.36 + pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  if (tile.type === "start") {
    const primaryDirection = tile.connections.find((direction) => direction !== currentTrack.start.outward);
    const vector = DIRS[primaryDirection];
    const normal = { x: -vector.dy, y: vector.dx };
    ctx.strokeStyle = "rgba(114, 255, 192, 0.8)";
    ctx.lineWidth = 4;
    for (let index = -1; index <= 1; index += 1) {
      const offset = index * 9;
      ctx.beginPath();
      ctx.moveTo(
        center.x + normal.x * (currentTrack.roadHalfWidth - 6) + vector.dx * offset,
        center.y + normal.y * (currentTrack.roadHalfWidth - 6) + vector.dy * offset,
      );
      ctx.lineTo(
        center.x - normal.x * (currentTrack.roadHalfWidth - 6) + vector.dx * offset,
        center.y - normal.y * (currentTrack.roadHalfWidth - 6) + vector.dy * offset,
      );
      ctx.stroke();
    }
  }

  ctx.fillStyle = tile.type === "start" ? "#72ffc0" : tile.type === "finish" ? "#ffd795" : "rgba(86, 241, 255, 0.42)";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(tile.type === "start" ? "START" : tile.type === "finish" ? "FINISH" : tile.type === "corner" ? "CORNER" : "STRAIGHT", center.x, top + tileSize - 12);
  ctx.restore();
}

function drawLongCorner(longCorner, now) {
  const curvePoints = buildLongCornerPolyline(currentTrack, longCorner, 24);
  const roadWidth = currentTrack.roadHalfWidth * 2;
  const glow = 0.18 + Math.sin(now * 0.004 + longCorner.blockX + longCorner.blockY) * 0.03;

  function strokeCurve() {
    ctx.beginPath();
    ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
    for (let index = 1; index < curvePoints.length; index += 1) {
      ctx.lineTo(curvePoints[index].x, curvePoints[index].y);
    }
    ctx.stroke();
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(185, 255, 85, 0.24)";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = "#17343d";
  ctx.lineWidth = roadWidth + 16;
  strokeCurve();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#d8f5f7";
  ctx.lineWidth = roadWidth;
  strokeCurve();

  ctx.strokeStyle = `rgba(185, 255, 85, ${glow})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 14]);
  strokeCurve();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(185, 255, 85, 0.88)";
  ctx.beginPath();
  ctx.arc(curvePoints[0].x, curvePoints[0].y, roadWidth * 0.18, 0, Math.PI * 2);
  ctx.arc(curvePoints[curvePoints.length - 1].x, curvePoints[curvePoints.length - 1].y, roadWidth * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGhost() {
  const pose = getGhostPose(started ? elapsed : 0);
  if (!pose) return;

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  ctx.globalAlpha = 0.34;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowColor = "#000000";
  ctx.shadowBlur = 18;

  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(21, 0);
  ctx.lineTo(9, -14);
  ctx.lineTo(-13, -13);
  ctx.lineTo(-19, 0);
  ctx.lineTo(-13, 13);
  ctx.lineTo(9, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(3, -8);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-8, 6);
  ctx.lineTo(3, 8);
  ctx.closePath();
  ctx.stroke();

  ctx.rotate(-pose.angle);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "bold 9px Arial";
  ctx.fillText(activeGhost.name || "GHOST", 0, -29);
  ctx.restore();
}

function drawTrails() {
  trails.forEach((trail) => {
    ctx.save();
    ctx.translate(trail.x, trail.y);
    ctx.rotate(trail.angle);
    ctx.globalAlpha = Math.max(0, trail.life) * 0.35;
    ctx.strokeStyle = "#b9eff5";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.lineTo(-38, -10);
    ctx.moveTo(-18, 10);
    ctx.lineTo(-38, 10);
    ctx.stroke();
    ctx.restore();
  });
}

function drawPlayer(now) {
  const speed = Math.hypot(player.vx, player.vy);
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(3, 7, 25, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.rotate(player.angle);
  if (speed > 40) {
    const flame = 8 + (speed / MAX_SPEED) * 13 + Math.sin(now * 0.04) * 2;
    ctx.fillStyle = player.drift > 0.2 ? "#b9ff55" : "#56f1ff";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-17, -7);
    ctx.lineTo(-17 - flame, 0);
    ctx.lineTo(-17, 7);
    ctx.fill();
  }

  ctx.shadowColor = player.drift > 0.2 ? "#b9ff55" : "#56f1ff";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#d8f5f7";
  ctx.beginPath();
  ctx.moveTo(21, 0);
  ctx.lineTo(9, -14);
  ctx.lineTo(-13, -13);
  ctx.lineTo(-19, 0);
  ctx.lineTo(-13, 13);
  ctx.lineTo(9, 14);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#17343d";
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(3, -8);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-8, 6);
  ctx.lineTo(3, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = player.drift > 0.2 ? "#b9ff55" : "#56f1ff";
  ctx.fillRect(3, -3, 10, 6);
  ctx.restore();
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
  lastFrame = now;
  update(dt, now);
  draw(now);
  requestAnimationFrame(frame);
}

setPlayMode("daily");
updateDailyLabels();
setInterval(updateDailyLabels, 1000);
requestAnimationFrame(frame);
restoreAuthSession();
