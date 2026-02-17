
import axios from 'axios';

const API_URL = "https://apiv3.ideris.com.br";
const PRIVATE_KEY = "4d18596794934f399c0cc00e40ca613504f966f5188d41c888c345a41fe2632bc38691279dac4d5da8be0675beadb70f";

async function run() {
    try {
        const loginResponse = await axios.post(`${API_URL}/Login`, `"${PRIVATE_KEY}"`, {
            headers: { 'Content-Type': 'application/json' }
        });
        const token = loginResponse.data.trim().replace(/^"|"$/g, "");
        const api = axios.create({
            baseURL: API_URL,
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("Fetching up to 500 orders...");
        let allOrders = [];
        for (let i = 0; i < 5; i++) {
            const res = await api.get('/order/search', {
                params: { limit: 100, offset: i * 100, statusId: 1007 }
            });
            const orders = res.data.obj || [];
            allOrders = allOrders.concat(orders);
            if (orders.length < 100) break;
        }

        const counts = {};
        allOrders.forEach(o => {
            const key = `MKT: ${o.marketplaceName} | ORIG: ${o.originName} | AUTH: ${o.authenticationId} | INTER: ${o.intermediaryName}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        console.log("Variations found:");
        console.log(JSON.stringify(counts, null, 2));

        // Group by authenticationId to see if multiple names exist for same ID
        const byAuthId = {};
        allOrders.forEach(o => {
            const id = o.authenticationId;
            if (!byAuthId[id]) byAuthId[id] = new Set();
            byAuthId[id].add(`${o.marketplaceName} - ${o.originName} - ${o.intermediaryName}`);
        });

        console.log("\nVariations per Authentication ID:");
        for (const [id, variations] of Object.entries(byAuthId)) {
            console.log(`Auth ID ${id}:`, Array.from(variations));
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}
run();
