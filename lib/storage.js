const HISTORY_KEY = "hitungpadel.history";
const LIVE_KEY = "hitungpadel.live";
const HISTORY_EVENT = "hitungpadel-history";
const LIVE_EVENT = "hitungpadel-live";

const EMPTY_HISTORY = [];
const EMPTY_LIVE = { screen: "home", match: null, past: [] };

let historyRaw;
let historySnapshot = EMPTY_HISTORY;
let liveRaw;
let liveSnapshot = EMPTY_LIVE;

function emit(name) {
  window.dispatchEvent(new Event(name));
}

export function subscribeHistory(listener) {
  window.addEventListener(HISTORY_EVENT, listener);
  return () => window.removeEventListener(HISTORY_EVENT, listener);
}

export function getHistorySnapshot() {
  const raw = window.localStorage.getItem(HISTORY_KEY);
  if (raw === historyRaw) {
    return historySnapshot;
  }

  historyRaw = raw;
  if (!raw) {
    historySnapshot = EMPTY_HISTORY;
    return historySnapshot;
  }

  try {
    const list = JSON.parse(raw);
    historySnapshot = Array.isArray(list) ? list : EMPTY_HISTORY;
  } catch {
    historySnapshot = EMPTY_HISTORY;
  }
  return historySnapshot;
}

export function getServerHistory() {
  return EMPTY_HISTORY;
}

export function subscribeLive(listener) {
  window.addEventListener(LIVE_EVENT, listener);
  return () => window.removeEventListener(LIVE_EVENT, listener);
}

export function getLiveSnapshot() {
  const raw = window.sessionStorage.getItem(LIVE_KEY);
  if (raw === liveRaw) {
    return liveSnapshot;
  }

  liveRaw = raw;
  if (!raw) {
    liveSnapshot = EMPTY_LIVE;
    return liveSnapshot;
  }

  try {
    const data = JSON.parse(raw);
    if (!data?.match || data.match.status === "finished") {
      liveSnapshot = EMPTY_LIVE;
    } else {
      liveSnapshot = {
        screen: "play",
        match: data.match,
        past: Array.isArray(data.past) ? data.past : [],
      };
    }
  } catch {
    liveSnapshot = EMPTY_LIVE;
  }
  return liveSnapshot;
}

export function getServerLive() {
  return EMPTY_LIVE;
}

export function saveFinishedMatch(match) {
  const summary = {
    id: match.id,
    teams: match.teams,
    sets: match.sets,
    winner: match.winner,
    rules: match.rules,
    finishedAt: match.finishedAt || new Date().toISOString(),
  };
  const list = [summary, ...getHistorySnapshot().filter((item) => item.id !== summary.id)].slice(0, 40);
  const raw = JSON.stringify(list);
  window.localStorage.setItem(HISTORY_KEY, raw);
  historyRaw = raw;
  historySnapshot = list;
  emit(HISTORY_EVENT);
}

export function removeHistory(id) {
  const list = getHistorySnapshot().filter((item) => item.id !== id);
  const raw = JSON.stringify(list);
  window.localStorage.setItem(HISTORY_KEY, raw);
  historyRaw = raw;
  historySnapshot = list.length ? list : EMPTY_HISTORY;
  if (!list.length) {
    historyRaw = "[]";
  }
  emit(HISTORY_EVENT);
}

export function saveLive(match, past) {
  const view = { screen: "play", match, past: past.slice(-80) };
  const raw = JSON.stringify({ match: view.match, past: view.past });
  window.sessionStorage.setItem(LIVE_KEY, raw);
  liveRaw = raw;
  liveSnapshot = view;
  emit(LIVE_EVENT);
}

export function clearLive() {
  window.sessionStorage.removeItem(LIVE_KEY);
  liveRaw = null;
  liveSnapshot = EMPTY_LIVE;
  emit(LIVE_EVENT);
}
