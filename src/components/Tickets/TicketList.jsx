import { useState, useEffect, useRef } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Plus, Search, Filter, FilterX, Eye, Paperclip, X, Calendar, AlertTriangle, Ticket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Helper to format YYYY-MM-DD date without timezone shift
const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateStr;
    }
};

export default function TicketList() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(localStorage.getItem('ticketSearchTerm') || '');
    const [statusFilter, setStatusFilter] = useState(localStorage.getItem('ticketStatusFilter') || 'Todos');
    const navigate = useNavigate();
    const searchInputRef = useRef(null);

    useEffect(() => {
        // Auto-focus search on mount
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'chamados'), orderBy('dataAbertura', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ticketData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTickets(ticketData);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar chamados:", error);
            if (error.code === 'permission-denied') {
                // Optional: show a toast or set error state
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Dynamic Filter Options
    const [ticketTypesOptions, setTicketTypesOptions] = useState([]);
    const [marketplacesOptions, setMarketplacesOptions] = useState([]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'sys_settings', 'general');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTicketTypesOptions(data.ticketTypes || []);
                    setMarketplacesOptions(data.marketplaces || []);
                } else {
                    // Fallback defaults
                    setTicketTypesOptions([
                        'Devolução', 'Reembolso', 'Fraude', 'Contatar MarketPlace', 'Contatar Cliente',
                        'Interno', 'Defeito', 'Prejuízo', 'Atraso na entrega', 'Produto errado',
                        'Faltou item', 'Dúvida técnica', 'Cancelamento'
                    ]);
                    setMarketplacesOptions(['Mercado Livre', 'Amazon', 'Interno', 'Shopee', 'Magalu']);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        };
        fetchSettings();
    }, []);

    const [typeFilter, setTypeFilter] = useState(localStorage.getItem('ticketTypeFilter') || 'Todos');
    const [marketplaceFilter, setMarketplaceFilter] = useState(localStorage.getItem('ticketMarketplaceFilter') || 'Todos');
    const [responsibleFilter, setResponsibleFilter] = useState(localStorage.getItem('ticketResponsibleFilter') || 'Todos');

    // Persistence Effects
    useEffect(() => { localStorage.setItem('ticketSearchTerm', searchTerm); }, [searchTerm]);
    useEffect(() => { localStorage.setItem('ticketStatusFilter', statusFilter); }, [statusFilter]);
    useEffect(() => { localStorage.setItem('ticketTypeFilter', typeFilter); }, [typeFilter]);
    useEffect(() => { localStorage.setItem('ticketMarketplaceFilter', marketplaceFilter); }, [marketplaceFilter]);
    useEffect(() => { localStorage.setItem('ticketResponsibleFilter', responsibleFilter); }, [responsibleFilter]);

    const handleClearFilters = () => {
        setSearchTerm('');
        setStatusFilter('Todos');
        setTypeFilter('Todos');
        setMarketplaceFilter('Todos');
        setResponsibleFilter('Todos');
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        if (searchInputRef.current) {
            searchInputRef.current.blur();
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    };

    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch =
            ticket.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.assunto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.responsavel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.pedido?.toLowerCase().includes(searchTerm.toLowerCase()); // Added search by Order ID

        const matchesStatus = statusFilter === 'Todos' || ticket.status === statusFilter;
        const matchesType = typeFilter === 'Todos' || ticket.tipo === typeFilter;
        const matchesMarketplace = marketplaceFilter === 'Todos' || ticket.marketplace === marketplaceFilter;
        const matchesResponsible = responsibleFilter === 'Todos' || ticket.responsavel === responsibleFilter;

        return matchesSearch && matchesStatus && matchesType && matchesMarketplace && matchesResponsible;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'Aberto': return 'bg-blue-100 text-blue-800';
            case 'Pendente': return 'bg-yellow-100 text-yellow-800';
            case 'Revisão': return 'bg-purple-100 text-purple-800';
            case 'Fechado': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const isExpired = (dateStr) => {
        if (!dateStr) return false;
        try {
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date < today;
        } catch (e) {
            return false;
        }
    };

    // Pagination Logic
    const itemsPerPage = 50;
    const [currentPage, setCurrentPage] = useState(1);

    // Reset to first page when search or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, typeFilter, marketplaceFilter, responsibleFilter]);

    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Ticket className="w-8 h-8 text-blue-600" />
                        Chamados
                    </h1>
                    <div className="flex gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Abertos: {tickets.filter(t => t.status === 'Aberto').length}</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Pendentes: {tickets.filter(t => t.status === 'Pendente').length}</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Em Revisão: {tickets.filter(t => t.status === 'Revisão').length}</span>

                    </div>
                </div>
                <button
                    onClick={() => navigate('/chamados/novo')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Novo Chamado
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col gap-4">
                    <div className="relative h-10">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Buscar por código, assunto ou responsável..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                        />
                        {searchTerm && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 flex items-center justify-center h-8 w-8"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 w-full">
                        <div className="flex items-center justify-between w-full md:w-auto">
                            <span className="text-sm font-medium text-gray-700 md:hidden">Filtros</span>
                            <div className="flex items-center justify-center w-8 h-8 flex-shrink-0 mr-1 md:mr-0">
                                {(statusFilter !== 'Todos' || typeFilter !== 'Todos' || marketplaceFilter !== 'Todos' || responsibleFilter !== 'Todos') ? (
                                    <button
                                        onClick={handleClearFilters}
                                        className="text-red-500 hover:text-red-700 transition-colors flex items-center justify-center w-full h-full"
                                        title="Limpar todos os filtros"
                                    >
                                        <FilterX className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <div className="text-gray-500 flex items-center justify-center w-full h-full" title="Filtrar chamados">
                                        <Filter className="w-5 h-5" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap lg:flex-nowrap items-center gap-2 w-full">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                                <option value="Todos">Todos os Status</option>
                                <option value="Aberto">Aberto</option>
                                <option value="Pendente">Pendente</option>
                                <option value="Revisão">Revisão</option>
                                <option value="Fechado">Fechado</option>
                            </select>

                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                                <option value="Todos">Todos os Tipos</option>
                                {ticketTypesOptions.map(tipo => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                            </select>

                            <select
                                value={marketplaceFilter}
                                onChange={(e) => setMarketplaceFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                                <option value="Todos">Todos os Marketplaces</option>
                                {marketplacesOptions.map(mp => (
                                    <option key={mp} value={mp}>{mp}</option>
                                ))}
                            </select>

                            <select
                                value={responsibleFilter}
                                onChange={(e) => setResponsibleFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                                <option value="Todos">Todos os Responsáveis</option>
                                {[...new Set(tickets.map(t => t.responsavel).filter(Boolean))].sort().map(resp => (
                                    <option key={resp} value={resp}>{resp}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-100 border-b-2 border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-white">Código</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-white">Assunto</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-white">Retorno</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-white">Responsável</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-white">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-white">Data</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                            Carregando chamados...
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedTickets.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        Nenhum chamado encontrado.
                                    </td>
                                </tr>
                            ) : (
                                paginatedTickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/chamados/${ticket.id}`)}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                                            {ticket.codigo}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 font-medium">{ticket.assunto}</div>
                                            <div className="text-xs text-gray-500">{ticket.tipo}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {ticket.dataRetorno ? (
                                                <span className={`text-xs ${isExpired(ticket.dataRetorno) ? 'text-red-600 font-bold' : 'text-gray-700 font-medium'}`}>
                                                    {formatDate(ticket.dataRetorno)}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                    {ticket.responsavel ? ticket.responsavel.charAt(0) : '?'}
                                                </div>
                                                <span className="text-sm text-gray-700">{ticket.responsavel || 'Não atribuído'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-xs text-gray-900 font-medium">
                                                {new Date(ticket.dataAbertura).toLocaleDateString('pt-BR')}
                                            </div>
                                            {ticket.dataAtualizacao && (
                                                <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-tighter">
                                                    Alt: {new Date(ticket.dataAtualizacao).toLocaleDateString('pt-BR')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-3">
                                                {isExpired(ticket.dataRetorno) && (
                                                    <div className="text-red-500 animate-pulse" title="Atenção: Data de retorno expirou">
                                                        <AlertTriangle className="w-5 h-5" />
                                                    </div>
                                                )}
                                                {ticket.anexos && ticket.anexos.length > 0 && (
                                                    <Paperclip className="w-4 h-4 text-gray-400" title="Possui anexos" />
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/chamados/${ticket.id}`);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-900"
                                                    title="Ver Detalhes"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View (Cards) */}
                <div className="md:hidden">
                    {loading ? (
                        <div className="p-10 text-center text-gray-500">
                            <div className="flex justify-center items-center gap-2">
                                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                Carregando chamados...
                            </div>
                        </div>
                    ) : paginatedTickets.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            Nenhum chamado encontrado.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {paginatedTickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer"
                                    onClick={() => navigate(`/chamados/${ticket.id}`)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-bold text-blue-600 text-sm block">{ticket.codigo}</span>
                                            <h3 className="text-gray-900 font-medium flex items-center gap-2">
                                                {ticket.assunto}
                                                {isExpired(ticket.dataRetorno) && (
                                                    <div className="text-red-500 animate-pulse" title="Atenção: Data de retorno expirou">
                                                        <AlertTriangle className="w-4 h-4" />
                                                    </div>
                                                )}
                                                {ticket.anexos && ticket.anexos.length > 0 && (
                                                    <Paperclip className="w-4 h-4 text-gray-400" />
                                                )}
                                            </h3>
                                        </div>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                                            {ticket.status}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                {ticket.responsavel ? ticket.responsavel.charAt(0) : '?'}
                                            </div>
                                            <span>{ticket.responsavel || 'Não atribuído'}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs">{new Date(ticket.dataAbertura).toLocaleDateString('pt-BR')}</span>
                                            {ticket.dataRetorno && (
                                                <span className={`text-xs font-bold mt-1 ${isExpired(ticket.dataRetorno) ? 'text-red-600' : 'text-blue-600'}`}>
                                                    Ret: {formatDate(ticket.dataRetorno)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between sm:justify-end gap-4 rounded-b-xl">
                        <span className="text-sm text-gray-700">
                            Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{totalPages}</span>
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
