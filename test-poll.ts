import 'dotenv/config';
import { getMentions } from './src/services/xApi';
import { firestore, getLastMentionId, setLastMentionId } from './src/services/firestore';

async function test() {
    try {
        console.log("Fetching mentions...");
        const res = await getMentions();
        console.log("Success! Found:", res?.data?.length || 0, "mentions");
    } catch (e) {
        console.error("Error:", JSON.stringify(e, null, 2));
    }
}
test();
