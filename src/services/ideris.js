import axios from 'axios';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

// Em produção, isso deve ser uma URL para seu backend/proxy seguro
// Para este MVP, usaremos a chave direta mas via variável de ambiente
const API_URL = "https://apiv3.ideris.com.br";

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
        let privateKey = import.meta.env.VITE_IDERIS_PRIVATE_KEY || "";

        try {
            const docSnap = await getDoc(doc(db, "sys_settings", "ideris"));
            if (docSnap.exists() && docSnap.data().apiKey) {
                privateKey = docSnap.data().apiKey;
            }
        } catch (e) {
            console.error("Não foi possível buscar a chave via banco de dados. Usando chave padrão.", e);
        }

        const response = await axios.post(`${API_URL}/Login`, `"${privateKey}"`, {
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

// Implementação para o Dashboard
export const getOpenOrdersSummary = async () => {
    if (!jwtToken) await loginIderis();

    try {
        // 1. Buscar todas as contas de marketplace ativas
        const mktResponse = await api.get('/settings/marketplace');
        const accounts = mktResponse.data.obj || [];

        // 2. Buscar o total de pedidos em aberto para cada conta em paralelo
        const accountStatsPromises = accounts.map(async (acc) => {
            try {
                const response = await api.get('/order/search', {
                    params: {
                        statusId: 1007, // Aberto
                        authenticationId: acc.id,
                        limit: 1 // Só precisamos do total no retorno
                    }
                });
                return {
                    name: acc.descricao || `Conta ${acc.id}`,
                    count: response.data.total || 0
                };
            } catch (error) {
                console.warn(`Erro ao buscar pedidos para conta ${acc.descricao}:`, error.message);
                return { name: acc.descricao, count: 0 };
            }
        });

        const byAccount = await Promise.all(accountStatsPromises);

        // 3. Calcular o total geral e filtrar apenas as que têm pedidos ou são relevantes
        const total = byAccount.reduce((sum, item) => sum + item.count, 0);

        return {
            total,
            byAccount: byAccount
                .filter(item => item.count > 0) // Mostra apenas as que têm pedidos pendentes
                .sort((a, b) => b.count - a.count)
        };
    } catch (error) {
        console.error("Erro ao buscar resumo de pedidos em aberto:", error);
        throw error;
    }
};

// --- Funções para o Relatório de SKU ---

export const getMarketplaces = async () => {
    if (!jwtToken) await loginIderis();
    const response = await api.get('/settings/marketplace');
    return response.data.obj || [];
};

export const getIderisStatuses = async () => {
    if (!jwtToken) await loginIderis();
    const response = await api.get('/status/search');
    const items = response.data.obj || response.data.result || response.data || [];
    return items
        .map(s => ({ id: s.id, name: s.description || s.name }))
        .filter(s => !s.name.toLowerCase().includes('b2w'))
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const searchOrdersByFilters = async ({ authenticationId, statusId, dateStart, dateEnd, offset = 0, limit = 50 }) => {
    if (!jwtToken) await loginIderis();
    
    const params = {
        limit,
        offset
    };
    
    if (authenticationId) params.authenticationId = authenticationId;
    if (statusId) params.statusId = statusId;
    if (dateStart) params.dateStart = dateStart;
    if (dateEnd) params.dateEnd = dateEnd;
    
    const response = await api.get('/order/search', { params });
    const items = response.data.obj || response.data.items || response.data.result || [];
    const total = response.data.total || items.length;
    
    return { items, total };
};

export const fetchOrderDetailsBatch = async (orderIds, onProgress) => {
    if (!jwtToken) await loginIderis();
    
    const BATCH_SIZE = 10;
    const allDetails = [];
    let completed = 0;
    
    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batch = orderIds.slice(i, i + BATCH_SIZE);
        const promises = batch.map(id => api.get(`/order/${id}`).catch(err => {
            console.error(`Erro ao buscar pedido ${id}`, err);
            return null;
        }));
        
        const results = await Promise.all(promises);
        
        results.forEach(res => {
            if (res && res.data) {
                allDetails.push(res.data.obj || res.data);
            }
        });
        
        completed += batch.length;
        if (onProgress) {
            onProgress(Math.min(100, Math.round((completed / orderIds.length) * 100)));
        }
    }
    
    return allDetails;
};

export default api;
