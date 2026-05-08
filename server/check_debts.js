const admin = require('./services/firebase-admin');
require('dotenv').config();

const db = admin.firestore();

async function checkDebts() {
    try {
        console.log('Checking debts collection...');
        const snapshot = await db.collection('debts').get();
        console.log(`Total debts found: ${snapshot.size}`);
        
        const userStats = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const uid = data.userId || 'unknown';
            userStats[uid] = (userStats[uid] || 0) + 1;
        });

        console.log('Debts per User:');
        console.table(userStats);

    } catch (error) {
        console.error('Error checking debts:', error);
    } finally {
        process.exit();
    }
}

checkDebts();
