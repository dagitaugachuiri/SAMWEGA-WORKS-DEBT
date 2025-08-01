const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const initializeFirebase = async () => {
  try {
    if (process.env.DEMO_MODE === 'true') {
      console.log('🎭 Running in DEMO MODE - Firebase disabled');
      return;
    }

    // Validate environment variables
    if (!process.env.FIREBASE_SERVER_EMAIL) {
      throw new Error('FIREBASE_SERVER_EMAIL is not set in .env');
    }
    if (!process.env.FIREBASE_SERVER_PASSWORD) {
      throw new Error('FIREBASE_SERVER_PASSWORD is not set in .env');
    }

    // Sign in server as a Firebase user
    const userCredential = await signInWithEmailAndPassword(
      auth,
      process.env.FIREBASE_SERVER_EMAIL,
      process.env.FIREBASE_SERVER_PASSWORD
    );
    console.log('✅ Firebase Client SDK initialized successfully, signed in as:', userCredential.user.email);
    return userCredential.user.uid; // Return server UID for use in auth.js
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    throw error;
  }
};

const getFirestoreApp = () => {
  if (process.env.DEMO_MODE === 'true') {
    // Mock Firestore object for demo mode that works with client SDK syntax
    return {
      // Mock collection function that returns a mock collection reference
      collection: () => ({
        add: async () => ({ id: 'demo-' + Date.now() }),
        doc: () => ({
          get: async () => ({ exists: false }),
          update: async () => ({}),
          ref: { update: async () => ({}) }
        }),
        where: () => ({
          limit: () => ({
            get: async () => ({ empty: true, docs: [] })
          }),
          get: async () => ({ empty: true, size: 0, forEach: () => {} })
        }),
        orderBy: () => ({
          limit: () => ({
            offset: () => ({
              get: async () => ({ docs: [], forEach: () => {} })
            })
          })
        }),
        get: async () => ({ size: 0, forEach: () => {} })
      })
    };
  }
  return db;
};

module.exports = {
  initializeFirebase,
  getFirestoreApp,
};