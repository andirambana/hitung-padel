const SESSIONS_KEY = "hitungpadel.sessions";
const SESSIONS_EVENT = "hitungpadel-sessions";

const EMPTY_SESSIONS = [];
let sessionsRaw;
let sessionsSnapshot = EMPTY_SESSIONS;

function emit() {
  window.dispatchEvent(new Event(SESSIONS_EVENT));
}

let stampSession = (session) => session;
let afterSave = () => {};
let afterRemove = () => {};

export function setSessionHooks({ stamp, save, remove }) {
  stampSession = stamp || stampSession;
  afterSave = save || afterSave;
  afterRemove = remove || afterRemove;
}

function persist(list) {
  const raw = JSON.stringify(list);
  window.localStorage.setItem(SESSIONS_KEY, raw);
  sessionsRaw = raw;
  sessionsSnapshot = list.length ? list : EMPTY_SESSIONS;
  emit();
}

export function subscribeSessions(listener) {
  window.addEventListener(SESSIONS_EVENT, listener);
  return () => window.removeEventListener(SESSIONS_EVENT, listener);
}

export function getSessionsSnapshot() {
  const raw = window.localStorage.getItem(SESSIONS_KEY);
  if (raw === sessionsRaw) {
    return sessionsSnapshot;
  }
  sessionsRaw = raw;
  if (!raw) {
    sessionsSnapshot = EMPTY_SESSIONS;
    return sessionsSnapshot;
  }
  try {
    const list = JSON.parse(raw);
    sessionsSnapshot = Array.isArray(list) ? list : EMPTY_SESSIONS;
  } catch {
    sessionsSnapshot = EMPTY_SESSIONS;
  }
  return sessionsSnapshot;
}

export function getServerSessions() {
  return EMPTY_SESSIONS;
}

export function saveSession(session) {
  const next = stampSession(session);
  const list = [next, ...getSessionsSnapshot().filter((item) => item.id !== next.id)];
  persist(list);
  afterSave(next);
}

export function removeSession(id) {
  const current = getSessionsSnapshot();
  const target = current.find((item) => item.id === id);
  if (target && target.status !== "finished") {
    return;
  }
  persist(current.filter((item) => item.id !== id));
  afterRemove(id);
}
