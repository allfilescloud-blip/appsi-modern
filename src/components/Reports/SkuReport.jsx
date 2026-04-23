import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMarketplaces, getIderisStatuses, searchOrdersByFilters, fetchOrderDetailsBatch } from '../../services/ideris';
import { toast } from 'react-toastify';
import { Search, Filter, BarChart2, Package, Calendar, ChevronDown, Printer, Eraser, X } from 'lucide-react';
import { format, subDays } from 'date-fns';

const DropdownCheckboxes = ({ title, options, selectedIds, onChange, optionKey = 'id', optionLabel = 'name' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleSelection = (id) => {
        if (selectedIds.includes(String(id))) {
            onChange(selectedIds.filter(v => v !== String(id)));
        } else {
            onChange([...selectedIds, String(id)]);
        }
    };

    const displayTitle = selectedIds.length === 0 
        ? 'Todos' 
        : selectedIds.length === 1 
            ? options.find(o => String(o[optionKey]) === selectedIds[0])?.[optionLabel] || `${selectedIds.length} selecionado`
            : `${selectedIds.length} selecionados`;

    return (
        <div className="relative" ref={dropdownRef}>
            <div 
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white flex justify-between items-center cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="text-sm truncate text-gray-700 font-medium">{displayTitle}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto py-1">
                    {options.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">Carregando...</div>
                    ) : (
                        options.map(opt => {
                            const isChecked = selectedIds.includes(String(opt[optionKey]));
                            return (
                                <label key={opt[optionKey]} className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm transition-colors border-b border-gray-50 last:border-0">
                                    <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleSelection(opt[optionKey])}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                    />
                                    <span className="truncate text-gray-700">{opt[optionLabel]}</span>
                                </label>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};
export default function SkuReport() {
    const { iderisSettings } = useAuth();
    
    // Filtros
    const [dateStart, setDateStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [dateEnd, setDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [statusIds, setStatusIds] = useState(['1007']); // Padrão: Aberto
    const [accountIds, setAccountIds] = useState([]);
    
    // Dados auxiliares
    const [marketplaces, setMarketplaces] = useState([]);
    const [statuses, setStatuses] = useState([]);
    
    // Estado da busca
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [fetchingStage, setFetchingStage] = useState(''); // 'Buscando pedidos...', 'Processando itens...'
    
    // Resultados
    const [aggregatedData, setAggregatedData] = useState([]);
    const [totalOrders, setTotalOrders] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    
    // Pesquisa direcionada
    const [skuSearch, setSkuSearch] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [mkts, stats] = await Promise.all([
                    getMarketplaces(),
                    getIderisStatuses()
                ]);
                setMarketplaces(mkts);
                setStatuses(stats);
            } catch (error) {
                console.error("Erro ao carregar dados iniciais", error);
            }
        };
        fetchInitialData();
    }, []);

    const handleVerify = async (e) => {
        e.preventDefault();
        
        if (!dateStart || !dateEnd) {
            toast.warning("Selecione o período inicial e final.");
            return;
        }

        setLoading(true);
        setProgress(0);
        setAggregatedData([]);
        setTotalOrders(0);
        setTotalItems(0);
        
        try {
            setFetchingStage('Buscando cabeçalhos dos pedidos...');
            
            // 1. Buscar todos os pedidos nos filtros (lidando com paginação se houver muitos)
            let allOrderIds = [];
            
            const startStr = `${dateStart}T00:00:00`;
            const endStr = `${dateEnd}T23:59:59`;
            
            // Se vazio, significa "Todos"
            const accountsToSearch = accountIds.length > 0 ? accountIds : [undefined];
            const statusesToSearch = statusIds.length > 0 ? statusIds : [undefined];

            for (const accId of accountsToSearch) {
                for (const statId of statusesToSearch) {
                    let offset = 0;
                    const limit = 50;
                    let hasMore = true;

                    while (hasMore) {
                        const { items } = await searchOrdersByFilters({
                            authenticationId: accId,
                            statusId: statId,
                            dateStart: startStr,
                            dateEnd: endStr,
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
                        
                        if (allOrderIds.length > 5000) {
                            hasMore = false;
                        }
                    }
                }
            }

            setTotalOrders(allOrderIds.length);

            if (allOrderIds.length === 0) {
                toast.info("Nenhum pedido encontrado para estes filtros.");
                setLoading(false);
                return;
            }

            setFetchingStage(`Processando itens de ${allOrderIds.length} pedidos...`);
            setProgress(0);

            // 2. Buscar detalhes em lote
            const details = await fetchOrderDetailsBatch(allOrderIds, (p) => setProgress(p));
            
            // 3. Agregar itens por SKU
            const skuMap = {};
            let sumItems = 0;

            details.forEach(order => {
                const items = order.items || order.products || [];
                items.forEach(item => {
                    const sku = String(item.sku || item.codeProduct || 'Sem SKU').trim();
                    const qty = Number(item.quantity) || 1;
                    
                    if (!skuMap[sku]) {
                        skuMap[sku] = {
                            sku: sku,
                            title: item.title || item.name || 'Produto Sem Nome',
                            quantity: 0
                        };
                    }
                    skuMap[sku].quantity += qty;
                    sumItems += qty;
                });
            });

            // Converter para array e ordenar por quantidade desc
            const aggregatedArray = Object.values(skuMap).sort((a, b) => b.quantity - a.quantity);
            
            setAggregatedData(aggregatedArray);
            setTotalItems(sumItems);
            
            toast.success("Análise concluída com sucesso!");

        } catch (error) {
            console.error("Erro na busca", error);
            toast.error("Ocorreu um erro ao verificar os pedidos.");
        } finally {
            setLoading(false);
            setFetchingStage('');
            setProgress(0);
        }
    };

    // Filter by targeted SKU
    const filteredData = useMemo(() => {
        if (!skuSearch.trim()) return aggregatedData;
        const term = skuSearch.toLowerCase().trim();
        return aggregatedData.filter(item => 
            item.sku.toLowerCase().includes(term) || 
            item.title.toLowerCase().includes(term)
        );
    }, [aggregatedData, skuSearch]);

    const handleClear = () => {
        setDateStart(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
        setDateEnd(format(new Date(), 'yyyy-MM-dd'));
        setStatusIds(['1007']);
        setAccountIds([]);
        setSkuSearch('');
        setAggregatedData([]);
        setTotalOrders(0);
        setTotalItems(0);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <BarChart2 className="w-8 h-8 text-blue-600" />
                Relatórios SKU
            </h1>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 print:hidden">
                <form onSubmit={handleVerify} className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter className="w-5 h-5 text-gray-500" />
                        <h2 className="text-lg font-semibold text-gray-700">Filtros de Busca</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">Data Inicial</label>
                            <input 
                                type="date" 
                                value={dateStart}
                                onChange={(e) => setDateStart(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">Data Final</label>
                            <input 
                                type="date" 
                                value={dateEnd}
                                onChange={(e) => setDateEnd(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">Status</label>
                            <DropdownCheckboxes 
                                options={statuses} 
                                selectedIds={statusIds} 
                                onChange={setStatusIds} 
                                optionKey="id" 
                                optionLabel="name" 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-600">Marketplaces</label>
                            <DropdownCheckboxes 
                                options={marketplaces} 
                                selectedIds={accountIds} 
                                onChange={setAccountIds} 
                                optionKey="id" 
                                optionLabel="descricao" 
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-gray-500 font-medium italic">
                            * Se deixar Status ou Marketplaces vazios, o sistema buscará TODOS.
                        </p>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={loading}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed w-full md:w-auto"
                            >
                                <Eraser className="w-5 h-5" />
                                <span>Limpar</span>
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed w-full md:w-auto"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                                        <span>Verificando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-5 h-5" />
                                        <span>Verificar</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Progress Bar */}
                {loading && fetchingStage && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 animate-in fade-in">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-semibold text-blue-800">{fetchingStage}</span>
                            <span className="text-sm font-bold text-blue-600">{progress}%</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2.5">
                            <div 
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                            Aguarde, processando grandes volumes pode levar alguns segundos...
                        </p>
                    </div>
                )}
            </div>

            {/* Results Area */}
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                                <Package className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total de Pedidos</p>
                                <p className="text-3xl font-black text-gray-800">{totalOrders}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                                <BarChart2 className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total de Itens</p>
                                <p className="text-3xl font-black text-gray-800">{totalItems}</p>
                            </div>
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h3 className="font-bold text-gray-700 text-lg">Demanda Agrupada por SKU</h3>
                            
                            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto print:hidden">
                                <div className="relative w-full md:w-72">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Pesquisa direcionada (SKU)..."
                                        value={skuSearch}
                                        onChange={(e) => setSkuSearch(e.target.value)}
                                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                    {skuSearch && (
                                        <button
                                            onClick={() => setSkuSearch('')}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                                            title="Limpar pesquisa"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                <button 
                                    onClick={() => window.print()}
                                    className="flex items-center justify-center bg-white hover:bg-gray-50 text-gray-700 p-2.5 rounded-lg transition-colors border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    title="Imprimir relatório"
                                >
                                    <Printer className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white">
                                    <tr>
                                        <th className="px-6 py-4 text-sm font-semibold text-gray-500 border-b">SKU</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-gray-500 border-b">Produto</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-gray-500 border-b text-center">Quantidade Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredData.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                                                {skuSearch ? "Nenhum SKU encontrado para sua pesquisa." : "Nenhum dado disponível."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredData.map((item, index) => (
                                            <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                        {item.sku}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-700 font-medium">
                                                    {item.title}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-green-50 text-green-700 font-bold text-sm border border-green-200 min-w-[3rem]">
                                                        {item.quantity}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
        </div>
    );
}
