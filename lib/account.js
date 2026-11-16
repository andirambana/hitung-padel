import { GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { getFirebase, isCloudEnabled } from "@/lib/firebase";

const ACCOUNT_EVENT = "hitungpadel-account";
let account = null;
let authReady = false;

function emit() {
  window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

function toAccount(user) {
  if (!user) {
    return null;
  }
  return {
    uid: user.uid,
    name: user.displayName || user.email || "Player",
    email: user.email || "",
  };
}

export function subscribeAccount(listener) {
  window.addEventListener(ACCOUNT_EVENT, listener);
  return () => window.removeEventListener(ACCOUNT_EVENT, listener);
}

export function getAccountSnapshot() {
  return account;
}

export function getServerAccount() {
  return null;
}

export function getAuthReadySnapshot() {
  return authReady;
}

export function getServerAuthReady() {
  return false;
}

export function watchAccount() {
  const firebase = getFirebase();
  if (!firebase) {
    account = null;
    authReady = true;
    emit();
    return () => {};
  }
  getRedirectResult(firebase.auth).catch(() => {});
  return onAuthStateChanged(firebase.auth, (user) => {
    account = toAccount(user);
    authReady = true;
    emit();
  });
}

export async function signInWithGoogle() {
  const firebase = getFirebase();
  if (!firebase) {
    return;
  }
  const provider = new GoogleAuthProvider();
  const nativeOpen = window.open.bind(window);
  window.open = (url, target, features) => {
    const specs = [features, "popup=yes"].filter(Boolean).join(",");
    return nativeOpen(url ?? "", target, specs);
  };
  try {
    await signInWithPopup(firebase.auth, provider);
  } catch (error) {
    if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
      return;
    }
    throw error;
  } finally {
    window.open = nativeOpen;
  }
}

export async function signOutAccount() {
  const firebase = getFirebase();
  if (!firebase) {
    return;
  }
  await signOut(firebase.auth);
}

export { isCloudEnabled };
