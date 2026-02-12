
import axios from 'axios';
import fs from 'fs';

const PRIVATE_KEY = "4d18596794934f399c0cc00e40ca613504f966f5188d41c888c345a41fe2632bc38691279dac4d5da8be0675beadb70f";
const API_URL = "https://apiv3.ideris.com.br";

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' }
});

async function run() {
    console.log("Testing Login...");
    let token;
    try {
        const response = await api.post(`/Login`, `"${PRIVATE_KEY}"`);
        if (typeof response.data === 'string') token = response.data;
        else if (response.data?.token) token = response.data.token;
    } catch (error) {
        console.error("Login Failed");
        return;
    }

    if (!token) return;
    const authHeader = { 'Authorization': `Bearer ${token}` };

    try {
        console.log("Fetching SKU sample...");
        const sr = await api.get(`/sku/search`, {
            params: { limit: 1 },
            headers: authHeader
        });

        const items = sr.data.obj || sr.data.items || sr.data;
        if (Array.isArray(items) && items.length > 0) {
            fs.writeFileSync('sku_sample.json', JSON.stringify(items[0], null, 2), 'utf8');
            console.log("Written to sku_sample.json");
        } else {
            console.log("No items found");
        }
    } catch (error) {
        console.error("SKU Search Failed:", error.message);
    }
}

run();
