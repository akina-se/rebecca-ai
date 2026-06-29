import 'dotenv/config';
import { Client, OAuth1 } from '@xdevplatform/xdk';

async function testMe() {
    const oauth1 = new OAuth1({
        apiKey: process.env.X_API_KEY,
        apiSecret: process.env.X_API_SECRET,
        callback: 'oob',
        accessToken: process.env.X_ACCESS_TOKEN,
        accessTokenSecret: process.env.X_ACCESS_SECRET,
    });
    const client = new Client({ oauth1 });
    const me = await client.users.getMe();
    console.log(JSON.stringify(me, null, 2));
}
testMe();
