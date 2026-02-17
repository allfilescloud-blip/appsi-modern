
import axios from 'axios';

const API_URL = "https://apiv3.ideris.com.br";
const PRIVATE_KEY = "4d18596794934f399c0cc00e40ca613504f966f5188d41c888c345a41fe2632bc38691279dac4d5da8be0675beadb70f";

async function discover() {
    try {
        const loginResponse = await axios.post(`${API_URL}/Login`, `"${PRIVATE_KEY}"`, {
            headers: { 'Content-Type': 'application/json', 'accept': '*/*' }
        });
        const token = loginResponse.data.trim().replace(/^"|"$/g, "");
        const api = axios.create({
            baseURL: API_URL,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        // Test Endpoint 1: Get single auth info
        const authId = 4; // From our previous order sample
        console.log(`Testing GET /authentication/${authId}...`);
        try {
            const res = await api.get(`/authentication/${authId}`);
            console.log("Result:", JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.log("Failed:", e.message);
        }

        // Test Endpoint 2: Get settings marketplace info
        console.log(`Testing GET /settings/marketplace/${authId}...`);
        try {
            const res = await api.get(`/settings/marketplace/${authId}`);
            console.log("Result:", JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.log("Failed:", e.message);
        }

        // Test Endpoint 3: Try to find a list of all authentications
        // Some systems use /search with no params or different tags
        console.log("Testing GET /authentication/search (params: limit=10)...");
        try {
            // Note: I tried /authentication/search and it matched /{id}. 
            // Let's try /authentication?limit=10
            const res = await api.get(`/authentication`, { params: { limit: 10 } });
            console.log("Result:", JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.log("Failed:", e.message);
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

discover();
