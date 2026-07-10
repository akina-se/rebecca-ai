import { OAuth1 } from '@xdevplatform/xdk';
import * as dotenv from 'dotenv';
dotenv.config();

const appKey = process.env.X_API_KEY;
const appSecret = process.env.X_API_SECRET;
const accessToken = process.env.X_ACCESS_TOKEN;
const accessSecret = process.env.X_ACCESS_SECRET;
let myUserId = process.env.X_MY_USER_ID;

async function getLists() {
    if (!appKey || !appSecret || !accessToken || !accessSecret) {
        console.error('API keys are missing in .env');
        return;
    }

    const oauth1Client = new OAuth1({
        apiKey: appKey,
        apiSecret: appSecret,
        callback: 'oob',
        accessToken: accessToken,
        accessTokenSecret: accessSecret,
    });

    try {
        console.log('Fetching owned lists...');
        
        // Need to resolve string username to numeric ID if necessary
        if (!/^\d+$/.test(myUserId || '')) {
            const meRes = await fetch('https://api.twitter.com/2/users/me', {
                headers: { 'Authorization': await oauth1Client.buildRequestHeader('GET', 'https://api.twitter.com/2/users/me') }
            });
            const meData = await meRes.json();
            myUserId = meData.data.id;
        }

        const url = `https://api.twitter.com/2/users/${myUserId}/owned_lists`;
        const authHeader = await oauth1Client.buildRequestHeader('GET', url);
        
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': authHeader }
        });

        const data = await res.json();
        if (!res.ok) {
            console.error('Failed to fetch lists:', data);
            return;
        }

        console.log(`\n=== Owned Lists for User ID: ${myUserId} ===\n`);
        if (!data.data || data.data.length === 0) {
            console.log('No lists found.');
        } else {
            data.data.forEach((list: any) => {
                console.log(`- Name: ${list.name}\n  ID: ${list.id}\n`);
            });
        }
    } catch (error) {
        console.error('Error fetching lists:', error);
    }
}

getLists();
