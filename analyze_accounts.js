
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

        console.log("Fetching 100 orders...");
        const res = await api.get('/order/search', {
            params: { limit: 100, statusId: 1007 }
        });

        const orders = res.data.obj || [];
        const uniqueAccounts = {};

        orders.forEach(o => {
            const id = o.authenticationId;
            if (!uniqueAccounts[id]) {
                uniqueAccounts[id] = {
                    count: 0,
                    mkt: o.marketplaceName,
                    origin: o.originName,
                    intermediary: o.intermediaryName
                };
            }
            uniqueAccounts[id].count++;
        });

        console.log("Unique Accounts found in 100 orders:");
        console.log(JSON.stringify(uniqueAccounts, null, 2));
    } catch (error) {
        console.error("Error:", error.message);
    }
}
run();
