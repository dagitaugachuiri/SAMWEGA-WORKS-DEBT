const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Use environment variable for project ID to determine which service account to use
const projectId = process.env.FIREBASE_PROJECT_ID || 'samwega-9d990';
let serviceAccountPath;

if (projectId === 'samwega-9d990') {
  serviceAccountPath = path.join(__dirname, '..', 'samwega-9d990.json');
} else if (projectId === 'samworks-dev') {
  serviceAccountPath = path.join(__dirname, '..', 'samworks-dev-firebase-adminsdk-fbsvc-2725461793.json');
} else {
  // Fallback for other projects
  serviceAccountPath = path.join(__dirname, '..', `${projectId}-adminsdk.json`);
}

if (!admin.apps.length) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log(`✅ Firebase Admin SDK initialized for project: ${projectId}`);
  } catch (error) {
    console.error(`❌ Error initializing Firebase Admin SDK for ${projectId}:`, error.message);
    console.error(`👉 Action Required: Please ensure the service account JSON file exists at: ${serviceAccountPath}`);
  }
}

module.exports = admin;
