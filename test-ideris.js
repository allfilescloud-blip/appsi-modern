
import axios from 'axios';
import { URLSearchParams } from 'url';

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

    // Test Multiple SKU Search manually
    try {
        console.log("\nTesting Multiple SKU Search (manual params construction)...");
        const skus = ["36", "101"]; // Example SKUs
        const params = new URLSearchParams();
        skus.forEach(s => params.append("sku", s));

        console.log("Query String:", params.toString()); // Should be sku=36&sku=101

        const sr = await api.get(`/sku/search`, {
            params: params,
            headers: authHeader
        });

        const items = sr.data.obj || sr.data.items || sr.data;
        console.log(`Found ${Array.isArray(items) ? items.length : 0} items.`);

        if (Array.isArray(items)) {
            items.forEach(i => console.log(`- ${i.sku}: ${i.title}`));
        }

    } catch (error) {
        console.error("Bulk SKU Search Failed:", error.message, error.response?.status);
    }
}

run();
