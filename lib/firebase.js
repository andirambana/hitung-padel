import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function readConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}

export function isCloudEnabled() {
  const config = readConfig();
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function isDeveloper() {
  return process.env.NEXT_PUBLIC_DEV_ACCESS === "1";
  // return false;
}

export function getFirebase() {
  if (typeof window === "undefined" || !isCloudEnabled()) {
    return null;
  }
  const config = readConfig();
  const app = getApps().length ? getApp() : initializeApp(config);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}
