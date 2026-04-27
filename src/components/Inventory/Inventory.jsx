import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { searchMultipleSkus, updateStock, searchOrdersByFilters, fetchOrderDetailsBatch } from '../../services/ideris';
import { toast } from 'react-toastify';
import { Search, Save, Trash2, CheckCircle, X, Package, RefreshCcw, Download } from 'lucide-react';
import ConfirmationModal from '../Shared/ConfirmationModal';
import { db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function Inventory() {
    const { iderisSettings } = useAuth();
    const navigate = useNavigate();

    const [searchInput, setSearchInput] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingSales, setLoadingSales] = useState(false);
    const [lastSearch, setLastSearch] = useState('');

    // Store new stock values: { [sku]: number }
    const [stockUpdates, setStockUpdates] = useState({});

    // Store sales values: { [sku]: number }
    const [salesData, setSalesData] = useState({});
    
    // Feature flag
    const [enableSalesColumn, setEnableSalesColumn] = useState(false);

    // Progress tracking
    const [salesProgress, setSalesProgress] = useState(0);
    const [salesStatusText, setSalesStatusText] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "sys_settings", "general");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setEnableSalesColumn(docSnap.data().enableInventorySales !== false);
                }
            } catch (error) {
                console.error("Erro ao buscar configurações gerais:", error);
            }
        };
        fetchSettings();
    }, []);

    const handleLoadSales = async () => {
        if (products.length === 0) {
            toast.info("Não há itens na lista para carregar vendas.");
            return;
        }

        setLoadingSales(true);
        setSalesProgress(0);
        setSalesStatusText('Buscando pedidos em aberto...');
        try {
            let allOrderIds = [];
            let offset = 0;
            const limit = 50;
            let hasMore = true;

            while (hasMore) {
                const { items } = await searchOrdersByFilters({
                    statusId: '1007',
                    limit,
                    offset
                });
                
                if (items && items.length > 0) {
                    allOrderIds.push(...items.map(o => o.id || o.orderId));
                    offset += items.length;
                    
                    if (items.length < limit) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
                setSalesProgress(prev => Math.min(prev + 5, 15));
            }

            if (allOrderIds.length === 0) {
                toast.info("Não há pedidos em aberto no momento.");
                setSalesData({});
                setLoadingSales(false);
                setSalesStatusText('');
                setSalesProgress(0);
                return;
            }

            setSalesStatusText(`Baixando detalhes de ${allOrderIds.length} pedido(s)...`);
            const details = await fetchOrderDetailsBatch(allOrderIds, (progress) => {
                setSalesProgress(15 + Math.floor(progress * 0.85));
            });
            
            setSalesStatusText('Processando dados...');
            
            const newSalesData = {};
            details.forEach(order => {
                const items = order.items || order.products || [];
                items.forEach(item => {
                    const sku = String(item.sku || item.codeProduct).trim();
                    const qty = Number(item.quantity) || 1;
                    if (sku) {
                        newSalesData[sku] = (newSalesData[sku] || 0) + qty;
                    }
                });
            });

            setSalesData(newSalesData);
            setSalesProgress(100);
            toast.success("Vendas carregadas com sucesso!");
        } catch (error) {
            console.error("Erro ao carregar vendas:", error);
            toast.error("Ocorreu um erro ao buscar as vendas.");
        } finally {
            setLoadingSales(false);
            setTimeout(() => {
                setSalesStatusText('');
                setSalesProgress(0);
            }, 1000);
        }
    };

    useEffect(() => {
        if (iderisSettings && !iderisSettings.enabled) {
            toast.warning("O Módulo de Integração (Ideris) está desabilitado");
            navigate('/');
        }
    }, [iderisSettings, navigate]);

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        variant: 'danger'
    });

    // Load state from local storage on mount
    useEffect(() => {
        const savedSearch = localStorage.getItem('inventoryLastSearch');
        const savedProducts = localStorage.getItem('inventoryProducts');

        if (savedSearch) {
            setSearchInput(savedSearch);
            setLastSearch(savedSearch);
        }

        if (savedProducts) {
            try {
                setProducts(JSON.parse(savedProducts));
            } catch (e) {
                console.error("Erro ao carregar produtos salvos", e);
            }
        }
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchInput.trim()) return;

        const skuList = searchInput.split(',').map(s => s.trim()).filter(Boolean);
        if (skuList.length === 0) return;

        // Check for duplicates already in the list
        const existingSkus = new Set(products.map(p => String(p.sku)));
        const newSkusToSearch = skuList.filter(sku => !existingSkus.has(String(sku)));

        if (newSkusToSearch.length === 0) {
            toast.info("Os SKUs informados já estão na lista.");
            setSearchInput('');
            return;
        }

        setLoading(true);
        try {
            const data = await searchMultipleSkus(newSkusToSearch);
            
            // Merge and sort
            const updatedProducts = [...products, ...data];
            updatedProducts.sort((a, b) => String(a.sku).localeCompare(String(b.sku), undefined, { numeric: true, sensitivity: 'base' }));

            setProducts(updatedProducts);
            setLastSearch(searchInput);
            setSearchInput(''); // Clear input for next entry

            // Save to localStorage
            localStorage.setItem('inventoryProducts', JSON.stringify(updatedProducts));

            const foundCount = data.length;
            const notFoundCount = newSkusToSearch.length - foundCount;

            if (foundCount > 0) {
                toast.success(`${foundCount} produto(s) adicionado(s).`);
            }
            
            if (notFoundCount > 0) {
                toast.warning(`${notFoundCount} SKU(s) não encontrados no Ideris.`);
            }
        } catch (error) {
            toast.error("Erro ao buscar SKUs.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Limpar Lista',
            message: 'Deseja limpar todos os produtos e resultados da pesquisa atual?',
            variant: 'danger',
            onConfirm: () => {
                setProducts([]);
                setSearchInput('');
                setLastSearch('');
                setStockUpdates({});
                setSalesData({});

                // Clear from localStorage
                localStorage.removeItem('inventoryLastSearch');
                localStorage.removeItem('inventoryProducts');

                toast.info("Lista limpa.");
            }
        });
    };

    const handleRemoveProduct = (sku) => {
        setProducts(prev => {
            const updated = prev.filter(p => String(p.sku) !== String(sku));
            localStorage.setItem('inventoryProducts', JSON.stringify(updated));
            return updated;
        });

        // Remove from pending updates
        setStockUpdates(prev => {
            const next = { ...prev };
            delete next[sku];
            return next;
        });

        toast.info(`SKU ${sku} removido da lista.`);
    };

    const handleStockInputChange = (sku, value) => {
        setStockUpdates(prev => ({
            ...prev,
            [sku]: value
        }));
    };

    const handleBulkUpdate = async () => {
        // Strict filter: value must exist, not be an empty string (even after trim), and be a valid number
        const skusToUpdate = Object.keys(stockUpdates).filter(sku => {
            const val = stockUpdates[sku];
            return val !== null && val !== undefined && String(val).trim() !== "" && !isNaN(Number(val));
        });

        if (skusToUpdate.length === 0) {
            toast.warn("Nenhum item com novo estoque válido para atualizar.");
            return;
        }

        const hasSalesToDeduct = skusToUpdate.some(sku => salesData[sku] > 0);
        let confirmMessage = `Deseja atualizar o estoque de ${skusToUpdate.length} item(ns)? Esta ação alterará os valores no Ideris.`;
        
        if (hasSalesToDeduct) {
            confirmMessage = `Deseja atualizar o estoque de ${skusToUpdate.length} item(ns)?\n\n⚠️ ATENÇÃO: Os valores informados em "Novo Estoque" serão subtraídos as Vendas pendentes antes da atualização.`;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Atualizar Estoque',
            message: confirmMessage,
            variant: hasSalesToDeduct ? 'warning' : 'info',
            onConfirm: async () => {
                setUpdating(true);
                let successCount = 0;
                let failCount = 0;

                // Iterate and update one by one as per legacy logic
                for (const sku of skusToUpdate) {
                    const newQtyInput = parseInt(stockUpdates[sku], 10);
                    const sales = salesData[sku] || 0;
                    const finalQtyToAPI = newQtyInput - sales;

                    try {
                        await updateStock(sku, finalQtyToAPI);

                        // Update local state to reflect change immediately
                        setProducts(prev => {
                            const updatedProducts = prev.map(p =>
                                p.sku === sku ? { ...p, stockAmount: finalQtyToAPI } : p
                            );
                            // Update localStorage with new stock amounts
                            localStorage.setItem('inventoryProducts', JSON.stringify(updatedProducts));
                            return updatedProducts;
                        });

                        // Remove from pending updates
                        setStockUpdates(prev => {
                            const next = { ...prev };
                            delete next[sku];
                            return next;
                        });

                        successCount++;
                    } catch (error) {
                        console.error(`Falha ao atualizar SKU ${sku}:`, error);
                        failCount++;
                    }
                }

                if (successCount > 0) toast.success(`${successCount} SKU(s) atualizados com sucesso!`);
                if (failCount > 0) toast.error(`${failCount} falha(s) na atualização.`);

                setUpdating(false);
            }
        });
    };

    const handleRefreshAll = async () => {
        if (products.length === 0) {
            toast.info("Nenhum item na lista para atualizar.");
            return;
        }

        setRefreshing(true);
        try {
            const skusToRefresh = products.map(p => String(p.sku));
            const refreshedData = await searchMultipleSkus(skusToRefresh);
            
            refreshedData.sort((a, b) => String(a.sku).localeCompare(String(b.sku), undefined, { numeric: true, sensitivity: 'base' }));

            setProducts(refreshedData);
            setSalesData({});
            localStorage.setItem('inventoryProducts', JSON.stringify(refreshedData));
            toast.success("Estoque atualizado com sucesso.");
        } catch (error) {
            toast.error("Erro ao atualizar o estoque.");
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-8 h-8 text-blue-600" />
                Gestão de Estoque
            </h1>

            {/* Search Bar Area */}
            {/* Search Bar Area */}
            {/* Search Bar Area */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Digite os SKUs separados por vírgula (ex: 235, 101, 50)"
                            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => setSearchInput('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
                        <button
                            type="submit"
                            disabled={loading || !searchInput.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:shadow-none"
                        >
                            {loading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Search className="w-5 h-5" />}
                            Buscar
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 className="w-5 h-5" />
                            Limpar
                        </button>
                        {enableSalesColumn && (
                            <button
                                type="button"
                                onClick={handleLoadSales}
                                disabled={loadingSales || refreshing || products.length === 0}
                                className="bg-orange-500 hover:bg-orange-600 text-white p-2.5 rounded-lg font-medium shadow-sm hover:shadow transition-all flex items-center justify-center disabled:opacity-70 disabled:shadow-none"
                                title="Carregar vendas em Aberto"
                            >
                                {loadingSales ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Download className="w-5 h-5" />}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleRefreshAll}
                            disabled={refreshing || products.length === 0}
                            className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-lg font-medium shadow-sm hover:shadow transition-all flex items-center justify-center disabled:opacity-70 disabled:shadow-none"
                            title="Verificar estoque atual de todos os itens"
                        >
                            {refreshing ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <RefreshCcw className="w-5 h-5" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleBulkUpdate}
                            disabled={updating || products.length === 0}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:shadow-none"
                            title="Salvar alterações de estoque no Ideris"
                        >
                            {updating ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-5 h-5" />}
                            Salvar Alterações
                        </button>
                    </div>
                </form>

                {loadingSales && (
                    <div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{salesStatusText}</span>
                            <span className="text-xs font-bold text-orange-600">{salesProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
                            <div 
                                className="bg-orange-500 h-2.5 rounded-full transition-all duration-300 ease-out relative" 
                                style={{ width: `${salesProgress}%` }}
                            >
                                <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                )}

                {products.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">SKUs Monitorados:</span>
                            <div className="flex flex-wrap gap-1.5 font-mono">
                                {products.map((product) => (
                                    <span 
                                        key={product.id} 
                                        className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md text-xs border border-slate-200 shadow-sm flex items-center gap-1 animate-in fade-in zoom-in duration-300"
                                    >
                                        {product.sku}
                                    </span>
                                ))}
                            </div>
                            {!loading && (
                                <div className="ml-auto flex items-center gap-1.5 text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Atualizado</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Desktop View (Table) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-100 border-b-2 border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 border-r border-white">SKU</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 border-r border-white">Produto</th>
                                {enableSalesColumn && <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600 border-r border-white">Vendas</th>}
                                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600 border-r border-white">Estoque Atual</th>
                                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600 border-r border-white">Novo Estoque</th>
                                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">
                                        Nenhum produto listado.
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-blue-700 font-bold font-mono text-base bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                {product.sku}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-gray-800 font-medium" title={product.title || product.nome}>
                                                {product.title || product.nome}
                                            </span>
                                        </td>
                                        {enableSalesColumn && (
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-orange-50 text-orange-700 font-bold text-sm border border-orange-100 min-w-[2.5rem]">
                                                    {salesData[product.sku] !== undefined ? salesData[product.sku] : '-'}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-sm border border-blue-100">
                                                {product.stockAmount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="Novo"
                                                value={stockUpdates[product.sku] || ''}
                                                onChange={(e) => handleStockInputChange(product.sku, e.target.value)}
                                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center transition-all hover:border-blue-400"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleRemoveProduct(product.sku)}
                                                className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"
                                                title="Remover da lista"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="md:hidden space-y-4 p-4 min-h-screen bg-transparent">
                    {products.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
                            Nenhum produto listado.
                        </div>
                    ) : (
                        products.map((product) => (
                            <div key={product.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-lg">
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-xl font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 font-mono">
                                            {product.sku}
                                        </span>
                                        <button
                                            onClick={() => handleRemoveProduct(product.sku)}
                                            className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <h3 className="font-bold text-gray-900 leading-relaxed text-lg mb-4">
                                        {product.title || product.nome}
                                    </h3>

                                    <div className={`grid ${enableSalesColumn ? 'grid-cols-3 gap-3' : 'grid-cols-2 gap-4'}`}>
                                        {enableSalesColumn && (
                                            <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-center flex flex-col justify-center">
                                                <p className="text-[10px] text-orange-500 uppercase font-bold tracking-wider mb-1">Vendas</p>
                                                <p className="text-xl font-black text-gray-800">{salesData[product.sku] !== undefined ? salesData[product.sku] : '-'}</p>
                                            </div>
                                        )}

                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center flex flex-col justify-center">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Atual</p>
                                            <p className="text-xl font-black text-gray-800">{product.stockAmount}</p>
                                        </div>

                                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-center flex flex-col justify-center relative">
                                            <p className="text-xs text-blue-500 uppercase font-bold tracking-wider mb-1">Novo</p>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                placeholder="-"
                                                value={stockUpdates[product.sku] || ''}
                                                onChange={(e) => handleStockInputChange(product.sku, e.target.value)}
                                                className="w-full text-center text-2xl font-black text-blue-600 outline-none bg-transparent placeholder-blue-300 z-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
            />
        </div>
    );
}
