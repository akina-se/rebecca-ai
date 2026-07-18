"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onConversationLogCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const db_1 = require("@rebecca/db");
/**
 * Cloud Function trigger that executes when a new conversation log document is created in Firestore.
 * Updates user statistics (daily reply count, last reply date) and Daily Active Users (DAU) system stats.
 */
exports.onConversationLogCreated = (0, firestore_1.onDocumentCreated)(`${db_1.COLLECTIONS.CONVERSATION_LOGS}/{logId}`, async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log('No data associated with the event');
        return;
    }
    const log = snapshot.data();
    if (!log.userId) {
        console.log('No userId in the conversation log');
        return;
    }
    const db = admin.firestore();
    const batch = db.batch();
    // Update User Stats (daily_reply_count and last_reply_date)
    const userRef = db.collection(db_1.COLLECTIONS.USERS).doc(log.userId);
    batch.set(userRef, {
        daily_reply_count: admin.firestore.FieldValue.increment(1),
        last_reply_date: log.timestamp || new Date().toISOString(),
    }, { merge: true });
    // Update DAU (Daily Active Users) System Stats
    // Format timestamp to YYYY-MM-DD
    const dateStr = log.timestamp ? log.timestamp.split('T')[0] : new Date().toISOString().split('T')[0];
    const dauRef = db.collection(db_1.COLLECTIONS.SYSTEM_STATS).doc(`dau_${dateStr}`);
    // We can use an array union to keep track of unique active users today
    batch.set(dauRef, {
        date: dateStr,
        active_users: admin.firestore.FieldValue.arrayUnion(log.userId),
        // For simple numeric count in dashboard, we could increment a raw counter,
        // but array size is more accurate for DAU to prevent double counting same user.
        // We will increment total_interactions for the day as well.
        total_interactions: admin.firestore.FieldValue.increment(1),
    }, { merge: true });
    // Commit the batch
    await batch.commit();
    console.log(`Successfully updated stats for user ${log.userId} and DAU for ${dateStr}`);
});
//# sourceMappingURL=onConversationLogCreated.js.map