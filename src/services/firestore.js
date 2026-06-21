const { Firestore } = require('@google-cloud/firestore');
const config = require('../config');

const firestore = new Firestore({
  projectId: config.gcp.projectId,
  // Let it use application default credentials locally or in GCP
});

const getUserDoc = async (userId) => {
  const docRef = firestore.collection('users').doc(userId);
  const doc = await docRef.get();
  return doc.exists ? doc.data() : null;
};

const updateUserDoc = async (userId, data) => {
  const docRef = firestore.collection('users').doc(userId);
  await docRef.set(data, { merge: true });
};

const appendEpisodicBuffer = async (userId, logEntry) => {
  const docRef = firestore.collection('users').doc(userId);
  await docRef.set({
    episodicBuffer: Firestore.FieldValue.arrayUnion(logEntry),
    last_reply_date: new Date().toISOString()
  }, { merge: true });
};

const updateCoreProfile = async (userId, profileData) => {
  const docRef = firestore.collection('users').doc(userId);
  await docRef.set({
    coreProfile: profileData,
    episodicBuffer: [] // Flush episodic buffer after dreaming
  }, { merge: true });
};

const incrementGlobalRateLimit = async (type, timeKey) => {
    const docRef = firestore.collection('rate_limits').doc(`global_${type}_${timeKey}`);
    await docRef.set({
        count: Firestore.FieldValue.increment(1)
    }, { merge: true });
};

const getGlobalRateLimit = async (type, timeKey) => {
    const docRef = firestore.collection('rate_limits').doc(`global_${type}_${timeKey}`);
    const doc = await docRef.get();
    return doc.exists ? doc.data().count : 0;
};

const incrementUserDailyLimit = async (userId, dateStr) => {
    const docRef = firestore.collection('rate_limits').doc(`user_daily_${userId}_${dateStr}`);
    await docRef.set({
        count: Firestore.FieldValue.increment(1)
    }, { merge: true });
};

const getUserDailyLimit = async (userId, dateStr) => {
    const docRef = firestore.collection('rate_limits').doc(`user_daily_${userId}_${dateStr}`);
    const doc = await docRef.get();
    return doc.exists ? doc.data().count : 0;
};

const getAllUsers = async () => {
    const snapshot = await firestore.collection('users').get();
    const users = [];
    snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    return users;
}

const getDailyActiveUsersCount = async (dateStr) => {
    const docRef = firestore.collection('system_stats').doc(`dau_${dateStr}`);
    const doc = await docRef.get();
    return doc.exists ? doc.data().count : 1; // Default to 1 to avoid div by zero
};

module.exports = {
  firestore,
  getUserDoc,
  updateUserDoc,
  appendEpisodicBuffer,
  updateCoreProfile,
  incrementGlobalRateLimit,
  getGlobalRateLimit,
  incrementUserDailyLimit,
  getUserDailyLimit,
  getAllUsers,
  getDailyActiveUsersCount,
};
