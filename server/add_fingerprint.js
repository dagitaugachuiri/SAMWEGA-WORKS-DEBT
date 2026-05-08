const admin = require('./services/firebase-admin');
require('dotenv').config();

const db = admin.firestore();

async function addFingerprint() {
    const fingerprint = '1ce2ef8b10044c5778087683b906fc0871bc1ee912841bb6a314136e417de8fd';
    const docRef = db.collection('config').doc('allowed_devices');

    console.log(`Connecting to Firestore for project: ${process.env.FIREBASE_PROJECT_ID || 'default'}`);
    console.log(`Target fingerprint: ${fingerprint}`);

    try {
        const doc = await docRef.get();
        if (!doc.exists) {
            console.log('Document config/allowed_devices does not exist. Creating it...');
            await docRef.set({ fingerprints: [fingerprint] });
            console.log('✅ Document created and fingerprint added.');
        } else {
            const data = doc.data();
            const fingerprints = data.fingerprints || [];

            if (fingerprints.includes(fingerprint)) {
                console.log('ℹ️ Fingerprint already exists in allowed_devices.');
            } else {
                fingerprints.push(fingerprint);
                await docRef.update({ fingerprints });
                console.log('✅ Fingerprint added successfully.');
            }

            // Final verification
            const updatedDoc = await docRef.get();
            console.log('Current fingerprints in DB:', updatedDoc.data().fingerprints);
        }
    } catch (error) {
        console.error('❌ Error updating Firestore:', error);
    } finally {
        process.exit();
    }
}

addFingerprint();
