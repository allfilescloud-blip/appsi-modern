import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Ticket,
    Columns,
    Package,
    CheckSquare,
    LifeBuoy,
    Settings,
    LogOut,
    Menu,
    X,
    User,
    ChevronDown,
    ScanBarcode,
    Bell
} from 'lucide-react';

export default function Layout({ children }) {
    const { userData, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Erro ao sair:", error);
        }
    };

    const [userTicketCount, setUserTicketCount] = useState(0);

    useEffect(() => {
        if (!userData?.nome) return;

        const q = query(
            collection(db, 'chamados'),
            where('responsavel', '==', userData.nome),
            where('status', 'in', ['Aberto', 'Pendente', 'Revisão'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUserTicketCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [userData]);

    const menuItems = [
        { icon: LayoutDashboard, label: 'Painel', path: '/' },
        { icon: Ticket, label: 'Chamados', path: '/chamados' },
        { icon: Columns, label: 'Kanban', path: '/kanban' },
        { icon: Package, label: 'Estoque', path: '/estoque' },
        { icon: CheckSquare, label: 'Verificação', path: '/verificacao' },
        { icon: LifeBuoy, label: 'Suporte', path: '/suporte' },
        { icon: ScanBarcode, label: 'Flex', path: '/flex' },
        { icon: Settings, label: 'Configurações', path: '/configuracoes' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex print:hidden flex-col w-64 bg-white border-r border-gray-200 fixed h-full z-10">
                <div className="p-6 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Ticket className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-xl text-gray-800">Appsi</span>
                    </div>

                    <button
                        onClick={() => toast.info(`Você tem ${userTicketCount} chamados ativos.`)}
                        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Minhas Pendências"
                    >
                        <Bell className="w-5 h-5" />
                        {userTicketCount > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
                        )}
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {userData?.nome?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {userData?.nome || 'Usuário'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                {userData?.email || 'email@exemplo.com'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden print:hidden fixed top-0 w-full bg-white border-b border-gray-200 z-20 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Ticket className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg text-gray-800">Appsi</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative p-2 cursor-pointer" onClick={() => toast.info(`Você tem ${userTicketCount} chamados ativos.`)}>
                        <Bell className="w-6 h-6 text-gray-600" />
                        {userTicketCount > 0 && (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                                {userTicketCount}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 bg-gray-800 bg-opacity-50 z-30" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="absolute right-0 top-0 h-full w-64 bg-white shadow-xl p-4 flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <span className="font-bold text-lg">Menu</span>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <nav className="flex-1 space-y-1">
                            {menuItems.map((item) => (
                                <button
                                    key={item.path}
                                    onClick={() => {
                                        navigate(item.path);
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${location.pathname === item.path
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                        <div className="border-t border-gray-100 pt-4 mt-4">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                            >
                                <LogOut className="w-4 h-4" />
                                Sair
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-6 pt-20 md:pt-6 print:m-0 print:p-0">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
