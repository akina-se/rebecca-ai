import { OAuth1 } from '@xdevplatform/xdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const appKey = process.env.X_API_KEY;
const appSecret = process.env.X_API_SECRET;
const accessToken = process.env.X_ACCESS_TOKEN;
const accessSecret = process.env.X_ACCESS_SECRET;

async function createList() {
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
        console.log('Creating new list "特別扱い"...');
        const url = `https://api.twitter.com/2/lists`;
        const body = JSON.stringify({
            name: "特別扱い",
            description: "Rebecca's Special Treatment List",
            private: false // X API v2: private can be set, but let's just make it public or private depending on user needs. Actually, "こっそり感" (stealth) means it's better to be private. 
            // Wait, the user said "リスト追加は相手に分かったりするの？であればこっそり感あっていいよね" meaning they want it to notify the user. If it's private, they aren't notified. Let's make it public so they get a notification. 
        });

        const authHeader = await oauth1Client.buildRequestHeader('POST', url);
        
        const res = await fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body
        });

        const data = await res.json();
        if (!res.ok) {
            console.error('Failed to create list:', data);
            return;
        }

        const listId = String(data.data.id);
        if (!/^\d+$/.test(listId)) {
            console.error('Invalid list ID received:', listId);
            return;
        }
        console.log(`Successfully created list. ID: ${listId}`);

        // Append to .env
        const envPath = path.resolve(__dirname, '../.env');
        let envContent = '';
        try {
            envContent = fs.readFileSync(envPath, 'utf8');
        } catch (e: unknown) {
            if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code !== 'ENOENT') {
                throw e;
            }
        }
        
        if (envContent.includes('X_TARGET_LIST_ID=')) {
            envContent = envContent.replace(/X_TARGET_LIST_ID=.*/, `X_TARGET_LIST_ID=${listId}`);
        } else {
            envContent += `\nX_TARGET_LIST_ID=${listId}\n`;
        }
        
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('Saved X_TARGET_LIST_ID to .env file.');

    } catch (error) {
        console.error('Error creating list:', error);
    }
}

createList();
