import * as dotenv from 'dotenv';
dotenv.config();

import { Client, OAuth1 } from '@xdevplatform/xdk';

async function diagnose() {
    console.log("Initializing X API Client...");
    const oauth1 = new OAuth1({
        apiKey: process.env.X_API_KEY || '',
        apiSecret: process.env.X_API_SECRET || '',
        accessToken: process.env.X_ACCESS_TOKEN || '',
        accessTokenSecret: process.env.X_ACCESS_SECRET || '',
        callback: 'oob'
    });
    
    const client = new Client({
        oauth1,
        bearerToken: process.env.X_BEARER_TOKEN || ''
    });

    try {
        console.log("\n--- Fetching Webhooks ---");
        const webhooksRes = await client.webhooks.get();
        console.log("Webhooks API Response:");
        console.log(JSON.stringify(webhooksRes, null, 2));

        if (webhooksRes.data && webhooksRes.data.length > 0) {
            for (const wh of webhooksRes.data) {
                console.log(`\nChecking subscriptions for Webhook ID: ${wh.id}`);
                try {
                    const subRes = await client.accountActivity.getSubscriptions(wh.id);
                    console.log("Subscriptions:");
                    console.log(JSON.stringify(subRes, null, 2));

                    if (subRes.data && subRes.data.subscriptions && subRes.data.subscriptions.length === 0) {
                        console.log("\nNo subscriptions found! Attempting to subscribe the authenticated user...");
                        try {
                            const createSub = await client.accountActivity.createSubscription(wh.id);
                            console.log("Subscription created successfully:");
                            console.log(JSON.stringify(createSub, null, 2));
                        } catch (e: any) {
                            console.error(`Failed to create subscription: ${e.message}`);
                            console.error(e);
                        }
                    }
                } catch (e: any) {
                    console.error(`Failed to get subscriptions for ${wh.id}: ${e.message}`);
                }
            }
        }

        console.log("\n--- Checking recent mentions directly via API ---");
        try {
            const mentions = await client.users.getMentions("2068157985445269504", {
                "max_results": 5,
                "tweet.fields": ["created_at", "text", "author_id"]
            } as any);
            console.log("Recent Mentions:");
            console.log(JSON.stringify(mentions, null, 2));
        } catch(e: any) {
            console.error("Failed to get mentions:", e.message);
        }

    } catch (e: any) {
        console.error(`Error during diagnosis: ${e.message}`);
        console.error(e);
    }
}

diagnose();
