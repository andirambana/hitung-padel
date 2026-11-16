import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { getAccountSnapshot } from "@/lib/account";
import { getFirebase } from "@/lib/firebase";
import { getSessionsSnapshot, setSessionHooks } from "@/lib/session-store";

const CLOUD_EVENT = "hitungpadel-cloud";
const EMPTY = [];
const SERVER_CLOUD = { ready: false, sessions: EMPTY };

let cloudState = SERVER_CLOUD;

function emit() {
  window.dispatchEvent(new Event(CLOUD_EVENT));
}

function byRecent(list) {
  return [...list].sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
}

function pack(session, uid) {
  const next = {
    ...session,
    ownerId: uid,
    updatedAt: new Date().toISOString(),
  };
  return JSON.parse(JSON.stringify(next));
}

function commit(ready, sessions) {
  cloudState = { ready, sessions: sessions.length ? sessions : EMPTY };
  emit();
}

export function subscribeCloud(listener) {
  window.addEventListener(CLOUD_EVENT, listener);
  return () => window.removeEventListener(CLOUD_EVENT, listener);
}

export function getCloudSnapshot() {
  return cloudState;
}

export function getServerCloud() {
  return SERVER_CLOUD;
}

export async function publishSession(session, uid = getAccountSnapshot()?.uid) {
  const firebase = getFirebase();
  if (!firebase || !uid || !session?.id) {
    return false;
  }
  const next = pack(session, uid);
  await setDoc(doc(firebase.db, "sessions", session.id), next, { merge: true });
  const sessions = byRecent([next, ...cloudState.sessions.filter((item) => item.id !== next.id)]);
  commit(true, sessions);
  return true;
}

export async function publishLocalSessions(uid) {
  const local = getSessionsSnapshot();
  await Promise.all(local.map((session) => publishSession(session, uid).catch(() => false)));
}

export function watchCloud(uid) {
  const firebase = getFirebase();
  if (!firebase || !uid) {
    return () => {};
  }
  const owned = query(collection(firebase.db, "sessions"), where("ownerId", "==", uid));
  return onSnapshot(
    owned,
    (snapshot) => {
      const sessions = byRecent(snapshot.docs.map((item) => item.data()));
      commit(true, sessions);
    },
    () => commit(true, cloudState.sessions),
  );
}

export function watchSharedSession(id, onChange) {
  const firebase = getFirebase();
  if (!firebase || !id) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(
    doc(firebase.db, "sessions", id),
    (snapshot) => onChange(snapshot.exists() ? snapshot.data() : null),
    () => onChange(null),
  );
}

export function clearCloud() {
  cloudState = { ready: false, sessions: EMPTY };
  emit();
}

setSessionHooks({
  stamp(session) {
    const account = getAccountSnapshot();
    if (!account) {
      return session;
    }
    return pack(session, account.uid);
  },
  save(session) {
    const account = getAccountSnapshot();
    if (!account) {
      return;
    }
    publishSession(session, account.uid).catch(() => {});
  },
  remove(id) {
    const firebase = getFirebase();
    const account = getAccountSnapshot();
    if (!firebase || !account || !id) {
      return;
    }
    deleteDoc(doc(firebase.db, "sessions", id)).catch(() => {});
    commit(
      cloudState.ready,
      cloudState.sessions.filter((item) => item.id !== id),
    );
  },
});
