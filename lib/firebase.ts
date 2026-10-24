import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function assertConfig() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase config: ${missing.join(", ")}. Set NEXT_PUBLIC_FIREBASE_* in .env.local.`,
    );
  }
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

/** Browser / client Firestore. Safe to import from client components. */
export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  assertConfig();
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getDb(): Firestore {
  if (db) return db;
  db = getFirestore(getFirebaseApp());
  return db;
}
