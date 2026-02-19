import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot, where, doc, getDoc } from 'firebase/firestore';
import { Plus, Search, Filter, Eye, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TicketList() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const navigate = useNavigate();

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

    const [typeFilter, setTypeFilter] = useState('Todos');
    const [marketplaceFilter, setMarketplaceFilter] = useState('Todos');
    const [responsibleFilter, setResponsibleFilter] = useState('Todos');

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Chamados</h1>
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
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar por código, assunto ou responsável..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-4 lg:mt-0">
                        <Filter className="text-gray-400 w-5 h-5 hidden sm:block" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="Todos">Todos os Status</option>
                            <option value="Aberto">Aberto</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Revisão">Revisão</option>
                            <option value="Fechado">Fechado</option>
                        </select>

                        <select
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="Todos">Todos os Tipos</option>
                            {ticketTypesOptions.map(tipo => (
                                <option key={tipo} value={tipo}>{tipo}</option>
                            ))}
                        </select>

                        <select
                            onChange={(e) => setMarketplaceFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="Todos">Todos os Marketplaces</option>
                            {marketplacesOptions.map(mp => (
                                <option key={mp} value={mp}>{mp}</option>
                            ))}
                        </select>

                        <select
                            value={responsibleFilter}
                            onChange={(e) => setResponsibleFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="Todos">Todos os Responsáveis</option>
                            {[...new Set(tickets.map(t => t.responsavel).filter(Boolean))].sort().map(resp => (
                                <option key={resp} value={resp}>{resp}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assunto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
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
                            ) : filteredTickets.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                        Nenhum chamado encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredTickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/chamados/${ticket.id}`)}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                                            {ticket.codigo}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 font-medium">{ticket.assunto}</div>
                                            <div className="text-xs text-gray-500">{ticket.tipo}</div>
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(ticket.dataAbertura).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-3">
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
                    ) : filteredTickets.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            Nenhum chamado encontrado.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {filteredTickets.map((ticket) => (
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
                                        <span>{new Date(ticket.dataAbertura).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
