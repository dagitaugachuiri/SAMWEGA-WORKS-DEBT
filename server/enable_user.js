const admin = require('./services/firebase-admin');
require('dotenv').config();

const db = admin.firestore();

async function enableUser() {
    const userId = '9gKDtIfLxJNojMziihjx4A9CbS63';
    const email = 'edwardhiuhu0@gmail.com';
    const userDocRef = db.collection('users').doc(userId);

    console.log(`Connecting to Firestore for project: ${serviceAccount.project_id}`);
    console.log(`Attempting to enable user: ${email} (${userId})`);

    try {
        const doc = await userDocRef.get();
        if (!doc.exists) {
            console.error(`❌ User document with ID ${userId} not found.`);
            
            // Search by email just in case
            console.log(`Searching for user by email: ${email}...`);
            const usersSnapshot = await db.collection('users').where('email', '==', email).get();
            
            if (usersSnapshot.empty) {
                console.error(`❌ No user found with email ${email}.`);
            } else {
                const actualDoc = usersSnapshot.docs[0];
                console.log(`✅ Found user with email ${email}. Actual ID: ${actualDoc.id}`);
                await actualDoc.ref.update({ disabled: false });
                console.log('✅ User account enabled successfully.');
            }
        } else {
            const userData = doc.data();
            console.log('Current user data:', userData);
            
            await userDocRef.update({ disabled: false });
            console.log('✅ User account enabled successfully.');
            
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

enableUser();
