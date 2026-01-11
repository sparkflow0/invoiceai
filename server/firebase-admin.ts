import admin from "firebase-admin";

let firebaseApp: admin.app.App | null = null;
let firebaseInitError: Error | null = null;

function readFirebaseConfig(): { projectId?: string; storageBucket?: string } | null {
  const configRaw = process.env.FIREBASE_CONFIG;
  if (!configRaw) return null;
  try {
    const parsed = JSON.parse(configRaw);
    return {
      projectId: parsed.projectId,
      storageBucket: parsed.storageBucket,
    };
  } catch (error) {
    return null;
  }
}

export function getFirebaseApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;
  if (firebaseInitError) return null;

  try {
    const config = readFirebaseConfig();
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GCLOUD_PROJECT ?? config?.projectId,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? config?.storageBucket,
    });
    return firebaseApp;
  } catch (error) {
    firebaseInitError = error as Error;
    console.warn("Firebase admin initialization failed:", error);
    return null;
  }
}

export function getFirebaseAuth() {
  const app = getFirebaseApp();
  return app ? admin.auth(app) : null;
}

export function getFirestore() {
  const app = getFirebaseApp();
  return app ? admin.firestore(app) : null;
}

export function getStorageBucket() {
  const app = getFirebaseApp();
  return app ? admin.storage(app).bucket() : null;
}
