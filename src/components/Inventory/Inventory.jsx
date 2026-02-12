import { useState, useEffect } from 'react';
import { searchMultipleSkus, updateStock } from '../../services/ideris';
import { toast } from 'react-toastify';
import { Search, Save, Trash2, CheckCircle } from 'lucide-react';

export default function Inventory() {
    const [searchInput, setSearchInput] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [lastSearch, setLastSearch] = useState('');

    // Store new stock values: { [sku]: number }
    const [stockUpdates, setStockUpdates] = useState({});

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

        // Legacy logic: Split by comma, trim, filter empty
        const skuList = searchInput.split(',').map(s => s.trim()).filter(Boolean);
        if (skuList.length === 0) return;

        setLoading(true);
        try {
            const data = await searchMultipleSkus(skuList);
            // Sort by SKU numerically/alphabetically to match legacy
            data.sort((a, b) => String(a.sku).localeCompare(String(b.sku), undefined, { numeric: true, sensitivity: 'base' }));

            setProducts(data);
            setLastSearch(searchInput);

            // Save to localStorage
            localStorage.setItem('inventoryLastSearch', searchInput);
            localStorage.setItem('inventoryProducts', JSON.stringify(data));

            if (data.length === 0) {
                toast.info("Nenhum produto encontrado para os SKUs informados.");
            } else {
                toast.success(`${data.length} produto(s) encontrado(s).`);
            }
        } catch (error) {
            toast.error("Erro ao buscar SKUs.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setProducts([]);
        setSearchInput('');
        setLastSearch('');
        setStockUpdates({});

        // Clear from localStorage
        localStorage.removeItem('inventoryLastSearch');
        localStorage.removeItem('inventoryProducts');

        toast.info("Lista limpa.");
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

        setUpdating(true);
        let successCount = 0;
        let failCount = 0;

        // Iterate and update one by one as per legacy logic
        for (const sku of skusToUpdate) {
            const newQty = parseInt(stockUpdates[sku], 10);
            try {
                await updateStock(sku, newQty);

                // Update local state to reflect change immediately
                setProducts(prev => {
                    const updatedProducts = prev.map(p =>
                        p.sku === sku ? { ...p, stockAmount: newQty } : p
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
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Gestão de Estoque</h1>

            {/* Search Bar Area */}
            {/* Search Bar Area */}
            {/* Search Bar Area */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Digite os SKUs separados por vírgula (ex: 235, 101, 50)"
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
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
                        <button
                            type="button"
                            onClick={handleBulkUpdate}
                            disabled={updating || products.length === 0}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:shadow-none"
                        >
                            {updating ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-5 h-5" />}
                            Atualizar
                        </button>
                    </div>
                </form>

                {lastSearch && (
                    <div className="mt-4 text-center text-sm text-gray-500">
                        <p>Última pesquisa: {lastSearch}</p>
                        {!loading && <p className="mt-1 text-green-600 font-medium">Consulta concluída.</p>}
                    </div>
                )}
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {products.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Nenhum produto listado.
                    </div>
                ) : (
                    <>
                        {/* Desktop View (Table) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">SKU</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Produto</th>
                                        <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">Estoque Atual</th>
                                        <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">Atualizar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {products.map((product) => (
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
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View (Cards) */}
                        <div className="md:hidden space-y-4 p-4 min-h-screen bg-transparent">
                            {products.map((product) => (
                                <div key={product.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-lg">
                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-xl font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 font-mono">
                                                {product.sku}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-gray-900 leading-relaxed text-lg mb-4">
                                            {product.title || product.nome}
                                        </h3>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center flex flex-col justify-center">
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Atual</p>
                                                <p className="text-2xl font-black text-gray-800">{product.stockAmount}</p>
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
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
