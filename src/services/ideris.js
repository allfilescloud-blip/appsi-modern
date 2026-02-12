import axios from 'axios';

// Em produção, isso deve ser uma URL para seu backend/proxy seguro
// Para este MVP, usaremos a chave direta mas via variável de ambiente
const API_URL = "https://apiv3.ideris.com.br";
const PRIVATE_KEY = import.meta.env.VITE_IDERIS_PRIVATE_KEY || "4d18596794934f399c0cc00e40ca613504f966f5188d41c888c345a41fe2632bc38691279dac4d5da8be0675beadb70f";

let jwtToken = null;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json'
    }
});

export const loginIderis = async () => {
    try {
        const response = await axios.post(`${API_URL}/Login`, `"${PRIVATE_KEY}"`, {
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*',
            }
        });

        let token = null;
        const raw = response.data;

        // Legacy token parsing logic
        if (typeof raw === 'string') {
            token = raw;
        } else if (raw && (raw.token || raw.jwt)) {
            token = raw.token || raw.jwt;
        }

        // Fallback cleanup similar to legacy
        if (!token && typeof raw === 'string') {
            const cleaned = raw.trim().replace(/^"|"$/g, "");
            if (/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(cleaned)) {
                token = cleaned;
            }
        }

        if (token) {
            jwtToken = token;
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            return token;
        }
        throw new Error("Token não encontrado na resposta");
    } catch (error) {
        console.error("Erro no login Ideris:", error);
        throw error;
    }
};

// Legacy: buscarDetalhesPedido uses GET /order/{codigo}
// Legacy: buscarPedidosPorPeriodo uses GET /order/search
export const getOrder = async (identifier) => {
    if (!jwtToken) await loginIderis();

    // Try strict legacy approach first: GET /order/{identifier}
    // Note: Legacy used encodeURIComponent(codigo)
    try {
        const response = await api.get(`/order/${encodeURIComponent(identifier)}`);
        // Legacy returned data.obj
        if (response.data && response.data.obj) {
            return response.data.obj;
        }
    } catch (error) {
        // If direct fetch fails (e.g. 404 or 400 because it required int), fall back to search
        console.warn("Direct order fetch failed, trying search...", error.message);
    }

    // Fallback: Search by parameter
    const response = await api.get(`/order/search`, {
        params: {
            orderCode: identifier,
            limit: 1
        }
    });

    // Legacy search returned data.obj which was a list?
    // inspect-schema said /order/search returns items? 
    // Legacy `buscarPedidosPorPeriodo` returned `data.obj || []`.
    // So let's check both data.obj (legacy) and items (swagger)
    const items = response.data.obj || response.data.items || response.data;
    if (Array.isArray(items) && items.length > 0) {
        return items[0];
    }

    throw new Error("Pedido não encontrado");
};

// Legacy: buscarInformacoesProduto uses /sku/search?sku={sku} and returns data.obj[0]
// Legacy: buscarInformacoesProduto uses /sku/search?sku={sku} and returns data.obj[0]
export const searchSku = async (sku) => {
    if (!jwtToken) await loginIderis();

    const response = await api.get(`/sku/search`, {
        params: { sku: sku, limit: 1 }
    });

    // Legacy expected data.obj
    const items = response.data.obj || response.data.items || response.data;

    if (Array.isArray(items) && items.length > 0) {
        const item = items[0];
        // Map fields to what front-end expects
        return {
            ...item,
            image: item.thumbnail || item.image,
            // Calculate total stock from all warehouses if stocks array exists
            stockAmount: Array.isArray(item.stocks)
                ? item.stocks.reduce((acc, s) => acc + (Number(s.currentStock) || 0), 0)
                : (item.stockAmount || 0)
        };
    }

    throw new Error("SKU não encontrado");
};

// Legacy: buscarSKUsEstoque behavior (multiple SKUs)
export const searchMultipleSkus = async (skuList) => {
    if (!jwtToken) await loginIderis();

    // Legacy manually constructs "sku=A&sku=B"
    const params = new URLSearchParams();
    skuList.forEach(s => params.append("sku", s));

    const response = await api.get(`/sku/search`, {
        params: params
    });

    const items = response.data.obj || response.data.items || response.data;

    if (Array.isArray(items)) {
        return items.map(item => ({
            ...item,
            image: item.thumbnail || item.image,
            stockAmount: Array.isArray(item.stocks)
                ? item.stocks.reduce((acc, s) => acc + (Number(s.currentStock) || 0), 0)
                : (item.stockAmount || 0)
        }));
    }

    return [];
};

export const updateStock = async (sku, quantity) => {
    if (!jwtToken) await loginIderis();
    // Legacy: PUT /sku/stock body: { sku, currentStock }
    const response = await api.put('/sku/stock', {
        sku: sku,
        currentStock: quantity
    });
    return response.data;
};

export default api;
