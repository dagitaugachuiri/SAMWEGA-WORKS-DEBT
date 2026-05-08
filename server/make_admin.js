const admin = require('./services/firebase-admin');
require('dotenv').config();

const db = admin.firestore();

async function makeAdmin() {
    const userId = '9gKDtIfLxJNojMziihjx4A9CbS63';
    const email = 'edwardhiuhu0@gmail.com';
    const userDocRef = db.collection('users').doc(userId);

    console.log(`Setting role: 'admin' for user: ${email} (${userId})`);

    try {
        const doc = await userDocRef.get();
        if (!doc.exists) {
            console.error(`❌ User document with ID ${userId} not found.`);
        } else {
            await userDocRef.update({ role: 'admin' });
            console.log('✅ User role updated to admin successfully.');
            
            // Verification
            const updatedDoc = await userDocRef.get();
            console.log('Updated user data:', updatedDoc.data());
        }
    } catch (error) {
        console.error('❌ Error updating Firestore:', error);
    } finally {
        process.exit();
    }
}

makeAdmin();
