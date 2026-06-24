require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
    try {
        const response = await ai.models.list(); // returns an iterable
        for await (const model of response) {
            if (model.name.toLowerCase().includes('gemma')) {
                console.log(model.name);
            }
        }
    } catch (e) {
        console.error(e);
    }
}
run();
