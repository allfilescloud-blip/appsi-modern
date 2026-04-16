import { useAuth } from "../../context/AuthContext";
import { User, Shield, Bell, Save, Database, Plus, Trash2, Loader, RefreshCcw, Users, CheckCircle, Ban, Key, Settings as SettingsIcon, Download, Upload, HardDrive, AlertTriangle, Link } from "lucide-react";
import Swal from 'sweetalert2';
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "react-toastify";



export default function Settings() {
    const { userData, iderisSettings, setIderisSettings } = useAuth();
    const [activeTab, setActiveTab] = useState("perfil");
    const [notifications, setNotifications] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(false);

    // Dynamic settings state
    const [generalSettings, setGeneralSettings] = useState({
        ticketTypes: [],
        marketplaces: [],
        allowRegistration: true
    });
    const [newItem, setNewItem] = useState("");
    const [activeList, setActiveList] = useState("ticketTypes"); // 'ticketTypes' or 'marketplaces'

    // User Management State
    const [usersList, setUsersList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Database Management State
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);
    const [cleanupPeriod, setCleanupPeriod] = useState('total');
    const [cleanupModules, setCleanupModules] = useState({
        chamados: true,
        kanban: true,
        flex: true,
        suporte: true
    });

    // Ideris Integration State
    const [iderisForm, setIderisForm] = useState({ enabled: false, apiKey: '' });
    const [isSavingIderis, setIsSavingIderis] = useState(false);

    useEffect(() => {
        fetchGeneralSettings();
    }, []);

    useEffect(() => {
        if (activeTab === "seguranca" && userData?.isAdmin) {
            fetchUsersList();
        }
        if (activeTab === "ideris" && userData?.isAdmin) {
            setIderisForm({
                enabled: iderisSettings?.enabled || false,
                apiKey: iderisSettings?.apiKey || ''
            });
        }
    }, [activeTab, userData, iderisSettings]);

    const fetchUsersList = async () => {
        setLoadingUsers(true);
        try {
            const querySnapshot = await getDocs(collection(db, "usuarios"));
            const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsersList(users);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast.error("Erro ao carregar usuários.");
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleUpdateUserStatus = async (userId, newStatus) => {
        try {
            await updateDoc(doc(db, "usuarios", userId), { status: newStatus });
            setUsersList(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
            toast.success(`Usuário marcado como ${newStatus}.`);
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            toast.error("Erro ao atualizar status do usuário.");
        }
    };

    const handleResetUserPassword = async (userEmail) => {
        try {
            await sendPasswordResetEmail(auth, userEmail);
            toast.success(`Email de redefinição de senha enviado para ${userEmail}.`);
        } catch (error) {
            console.error("Erro ao enviar email de redefinição:", error);
            toast.error("Erro ao enviar email de redefinição.");
        }
    };

    const handleDeleteUser = async (userId) => {
        const result = await Swal.fire({
            title: 'Excluir usuário?',
            text: "Os dados desta conta serão removidos. Esta ação não afeta o login no Authentication (requer exclusão manual lá caso desejado), mas removerá o acesso ao sistema.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "usuarios", userId));
                setUsersList(prev => prev.filter(u => u.id !== userId));
                toast.success("Usuário removido da base de dados.");
            } catch (error) {
                console.error("Erro ao excluir usuário:", error);
                toast.error("Erro ao excluir usuário.");
            }
        }
    };

    const handleToggleAdmin = async (userId, currentIsAdmin) => {
        try {
            await updateDoc(doc(db, "usuarios", userId), { isAdmin: !currentIsAdmin });
            setUsersList(prev => prev.map(u =>
                u.id === userId ? { ...u, isAdmin: !currentIsAdmin } : u
            ));
            toast.success(`Usuário ${!currentIsAdmin ? 'promovido a Administrador' : 'rebaixado a Usuário Comum'}.`);
        } catch (error) {
            console.error("Erro ao alternar permissões de admin:", error);
            toast.error("Erro ao alterar privilégios de administrador.");
        }
    };

    const handleTogglePermission = async (userId, userPermissions, moduleName) => {
        const newPermissions = { ...userPermissions, [moduleName]: !userPermissions[moduleName] };
        try {
            await updateDoc(doc(db, "usuarios", userId), { permissions: newPermissions });
            setUsersList(prev => prev.map(u => u.id === userId ? { ...u, permissions: newPermissions } : u));
            toast.success("Permissão atualizada.");
        } catch (error) {
            console.error("Erro ao atualizar permissão:", error);
            toast.error("Erro ao atualizar permissão.");
        }
    };

    const fetchGeneralSettings = async () => {

        setLoadingSettings(true);
        try {
            const docRef = doc(db, "sys_settings", "general");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setGeneralSettings(docSnap.data());
            } else {
                // Initialize with defaults if not exists
                const defaults = {
                    ticketTypes: [
                        'Devolução', 'Reembolso', 'Fraude', 'Contatar MarketPlace', 'Contatar Cliente',
                        'Interno', 'Defeito', 'Prejuízo', 'Atraso na entrega', 'Produto errado',
                        'Faltou item', 'Dúvida técnica', 'Cancelamento'
                    ],
                    marketplaces: ['Mercado Livre', 'Amazon', 'Interno', 'Shopee', 'Magalu'],
                    allowRegistration: true
                };
                await setDoc(docRef, defaults);
                setGeneralSettings(defaults);
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
            toast.error("Erro ao carregar configurações.");
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleAddItem = async () => {
        if (!newItem.trim()) return;

        const updatedList = [...(generalSettings[activeList] || []), newItem.trim()];
        const updatedSettings = { ...generalSettings, [activeList]: updatedList };

        try {
            await setDoc(doc(db, "sys_settings", "general"), updatedSettings);
            setGeneralSettings(updatedSettings);
            setNewItem("");
            toast.success("Item adicionado com sucesso!");
        } catch (error) {
            console.error("Error adding item:", error);
            toast.error("Erro ao adicionar item.");
        }
    };

    const handleDeleteItem = async (itemToDelete) => {
        const updatedList = generalSettings[activeList].filter(item => item !== itemToDelete);
        const updatedSettings = { ...generalSettings, [activeList]: updatedList };

        try {
            await setDoc(doc(db, "sys_settings", "general"), updatedSettings);
            setGeneralSettings(updatedSettings);
            toast.success("Item removido com sucesso!");
        } catch (error) {
            console.error("Error deleting item:", error);
            toast.error("Erro ao remover item.");
        }
    };

    const handleSave = async () => {
        // Proteção: Não salvar se as listas estiverem vazias e o estado estiver carregando ou falhou
        if (generalSettings.ticketTypes.length === 0 && generalSettings.marketplaces.length === 0) {
            toast.error("Erro: Dados de configuração não carregados corretamente. Recarregue a página.");
            return;
        }

        setLoadingSettings(true);
        try {
            await setDoc(doc(db, "sys_settings", "general"), generalSettings, { merge: true });
            toast.success("Configurações salvas com sucesso!");
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Erro ao salvar configurações.");
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleSaveIderis = async () => {
        setIsSavingIderis(true);
        try {
            await setDoc(doc(db, "sys_settings", "ideris"), iderisForm);
            setIderisSettings(iderisForm);
            toast.success("Configurações do Ideris salvas com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar configs Ideris:", error);
            toast.error("Erro ao salvar configurações do Ideris.");
        } finally {
            setIsSavingIderis(false);
        }
    };

    const handleRestoreDefaults = async () => {
        const result = await Swal.fire({
            title: 'Restaurar Padrões?',
            text: "Isso irá repopular as listas com os valores originais (Devolução, Marketplaces, etc).",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, restaurar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            const defaults = {
                ticketTypes: [
                    'Devolução', 'Reembolso', 'Fraude', 'Contatar MarketPlace', 'Contatar Cliente',
                    'Interno', 'Defeito', 'Prejuízo', 'Atraso na entrega', 'Produto errado',
                    'Faltou item', 'Dúvida técnica', 'Cancelamento'
                ],
                marketplaces: ['Mercado Livre', 'Amazon', 'Interno', 'Shopee', 'Magalu'],
                allowRegistration: generalSettings.allowRegistration
            };

            setLoadingSettings(true);
            try {
                await setDoc(doc(db, "sys_settings", "general"), defaults, { merge: true });
                setGeneralSettings(defaults);
                toast.success("Padrões restaurados com sucesso!");
            } catch (error) {
                console.error("Error restoring defaults:", error);
                toast.error("Erro ao restaurar padrões.");
            } finally {
                setLoadingSettings(false);
            }
        }
    };

    const handleExportDatabase = async () => {
        setIsExporting(true);
        try {
            const collectionsToBackup = ['chamados', 'usuarios', 'notificacoes', 'erros_suporte', 'sys_settings', 'kanban_tarefas', 'kanban_todo', 'reports'];
            const backupData = {};

            for (const colName of collectionsToBackup) {
                const querySnapshot = await getDocs(collection(db, colName));
                backupData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
            }

            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `appsi_full_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Backup local concluído com sucesso!");
        } catch (error) {
            console.error("Erro no backup:", error);
            toast.error("Erro ao gerar arquivo de backup.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportDatabase = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const result = await Swal.fire({
            title: 'Restaurar Backup Completo?',
            text: "Atenção: Isso irá tentar regravar todos os dados do JSON nas coleções originais, podendo sobrescrever registros de mesmo ID. É recomendado limpar dados obsoletos antes, caso queira um espelho exato do arquivo. Continuar?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, Restaurar Arquivo',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            setIsImporting(true);
            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const backupData = JSON.parse(e.target.result);
                        let totalDocs = 0;
                        for (const colName of Object.keys(backupData)) {
                            const docsArray = backupData[colName];
                            for (const docData of docsArray) {
                                const { firebaseId, ...actualData } = docData;
                                if (firebaseId) {
                                    await setDoc(doc(db, colName, firebaseId), actualData);
                                    totalDocs++;
                                }
                            }
                        }
                        toast.success(`Restauração de ${totalDocs} registros concluída com sucesso!`);
                    } catch (err) {
                        console.error("Erro no parse JSON ou na inserção:", err);
                        toast.error("Arquivo JSON inválido ou erro de integração.");
                    } finally {
                        setIsImporting(false);
                        event.target.value = '';
                    }
                };
                reader.readAsText(file);
            } catch (error) {
                console.error("Erro ao ler arquivo:", error);
                toast.error("Erro inesperado na leitura do arquivo local.");
                setIsImporting(false);
                event.target.value = '';
            }
        } else {
            event.target.value = '';
        }
    };

    const confirmCleanup = async () => {
        const result = await Swal.fire({
            title: 'ATENÇÃO CRÍTICA: Lixeira Virtual',
            text: `Você está prestes a excluir registros permanentemente (${cleanupPeriod === 'total' ? 'TODOS do sistema' : `anteriores a ultima janela de ${cleanupPeriod} dias`}). Esta ação é IRREVERSÍVEL. Deseja iniciar a faxina?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sim, Executar Limpeza',
            cancelButtonText: 'Reconsiderar'
        });

        if (result.isConfirmed) handleCleanupDatabase();
    };

    const handleCleanupDatabase = async () => {
        setIsCleaning(true);
        let deletedCount = 0;
        try {
            const dateLimit = new Date();
            if (cleanupPeriod !== 'total') {
                dateLimit.setDate(dateLimit.getDate() - parseInt(cleanupPeriod));
            }

            const isBeforeLimit = (dateStr) => {
                if (cleanupPeriod === 'total') return true;
                if (!dateStr) return false;
                const docDate = new Date(dateStr);
                return docDate < dateLimit;
            };

            const collectionsToClean = [];
            if (cleanupModules.chamados) collectionsToClean.push({ name: 'chamados', dateField: 'dataAbertura' });
            if (cleanupModules.kanban) {
                collectionsToClean.push({ name: 'kanban_tarefas', dateField: 'dataCriacao' });
                collectionsToClean.push({ name: 'kanban_todo', dateField: 'dataCriacao' });
            }
            if (cleanupModules.flex) collectionsToClean.push({ name: 'reports', dateField: 'createdAt' });
            if (cleanupModules.suporte) collectionsToClean.push({ name: 'erros_suporte', dateField: 'createdAt' });

            for (const colInfo of collectionsToClean) {
                const snap = await getDocs(collection(db, colInfo.name));
                for (const docSnap of snap.docs) {
                    const data = docSnap.data();
                    const evalDate = data[colInfo.dateField] || data.dataCriacao || data.createdAt; // Fallbacks
                    if (isBeforeLimit(evalDate)) {
                        await deleteDoc(doc(db, colInfo.name, docSnap.id));
                        deletedCount++;
                    }
                }
            }

            toast.success(`Faxina concluída! ${deletedCount} registros velhos descartados definitivamente.`);
        } catch (error) {
            console.error("Erro na limpeza:", error);
            toast.error("Ocorreu um erro ao processar exclusões em massa.");
        } finally {
            setIsCleaning(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <SettingsIcon className="w-8 h-8 text-blue-600" />
                Configurações
            </h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab("perfil")}
                        className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === "perfil"
                            ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            }`}
                    >
                        <User className="w-4 h-4" /> Perfil
                    </button>
                    <button
                        onClick={() => setActiveTab("notificacoes")}
                        className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === "notificacoes"
                            ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            }`}
                    >
                        <Bell className="w-4 h-4" /> Notificações
                    </button>
                    {userData?.isAdmin && (
                        <button
                            onClick={() => setActiveTab("seguranca")}
                            className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === "seguranca"
                                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            <Shield className="w-4 h-4" /> Segurança
                        </button>
                    )}
                    <button

                        onClick={() => setActiveTab("cadastros")}
                        className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === "cadastros"
                            ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            }`}
                    >
                        <Database className="w-4 h-4" /> Cadastros Gerais
                    </button>
                    {userData?.isAdmin && (
                        <button
                            onClick={() => setActiveTab("database")}
                            className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === "database"
                                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            <HardDrive className="w-4 h-4" /> Banco de Dados
                        </button>
                    )}
                    {userData?.isAdmin && (
                        <button
                            onClick={() => setActiveTab("ideris")}
                            className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === "ideris"
                                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            <Link className="w-4 h-4" /> Ideris
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {activeTab === "perfil" && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">
                                    {userData?.nome?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{userData?.nome}</h3>
                                    <p className="text-gray-500">{userData?.email}</p>
                                    <p className="text-xs text-blue-600 font-medium mt-1">Administrador</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        defaultValue={userData?.nome}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        defaultValue={userData?.email}
                                        disabled
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "notificacoes" && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <div>
                                    <h3 className="font-medium text-gray-800">Notificações por Email</h3>
                                    <p className="text-sm text-gray-500">Receba atualizações sobre seus chamados.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={notifications}
                                        onChange={e => setNotifications(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === "seguranca" && userData?.isAdmin && (
                        <div className="space-y-8 animate-fade-in">
                            {/* General Security Settings */}
                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-blue-600" /> Configurações Gerais
                                </h2>
                                <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                                    <div>
                                        <h3 className="font-medium text-gray-800">Permitir Novos Cadastros</h3>
                                        <p className="text-sm text-gray-500">Habilita ou desabilita a opção de "Cadastre-se" na tela de login.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={generalSettings.allowRegistration}
                                            onChange={e => setGeneralSettings(prev => ({ ...prev, allowRegistration: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>

                            {/* User Management */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-blue-600" /> Gerenciamento de Usuários
                                    </h2>
                                    <button onClick={fetchUsersList} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                        <RefreshCcw className="w-4 h-4" /> Atualizar Lista
                                    </button>
                                </div>
                                <div className="p-4 overflow-x-auto">
                                    {loadingUsers ? (
                                        <div className="flex justify-center p-8"><Loader className="w-8 h-8 text-blue-600 animate-spin" /></div>
                                    ) : (
                                        <>
                                            {/* Desktop View */}
                                            <div className="hidden md:block">
                                                <table className="w-full text-left min-w-[800px]">
                                                    <thead className="bg-gray-100 border-b-2 border-slate-200">
                                                        <tr>
                                                            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-r border-white">Usuário</th>
                                                            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase text-center border-r border-white">Status</th>
                                                            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase text-center border-r border-white">Módulos Permitidos</th>
                                                            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase text-right">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {usersList.map(u => (
                                                            <tr key={u.id} className="hover:bg-gray-50">
                                                                <td className="px-4 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${(u.email === 'admin@admin.com' || u.isAdmin) ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                            {u.nome?.charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-semibold text-gray-800 flex items-center gap-1">
                                                                                {u.nome}
                                                                                {(u.email === 'admin@admin.com' || u.isAdmin) && <Shield className="w-3 h-3 text-purple-600" title="Administrador" />}
                                                                            </p>
                                                                            <p className="text-xs text-gray-500">{u.email}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4 text-center">
                                                                    <span className={`text-xs font-bold rounded-full px-3 py-1 ${u.status === 'pendente' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                                                        u.status === 'bloqueado' ? 'bg-red-100 text-red-800 border border-red-200' :
                                                                            'bg-green-100 text-green-800 border border-green-200'
                                                                        }`}>
                                                                        {u.status === 'pendente' ? 'Pendente' :
                                                                            u.status === 'bloqueado' ? 'Bloqueado' :
                                                                                'Aprovado'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="flex flex-wrap gap-1.5 justify-center">
                                                                        {['kanban', 'estoque', 'verificacao', 'suporte', 'flex'].map(mod => {
                                                                            const permissions = u.permissions || { kanban: true, estoque: true, verificacao: true, suporte: true, flex: true };
                                                                            const hasAccess = permissions[mod] === true;
                                                                            return (
                                                                                <button
                                                                                    key={mod}
                                                                                    onClick={() => handleTogglePermission(u.id, permissions, mod)}
                                                                                    disabled={u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email)}
                                                                                    className={`text-xs px-2 py-1 rounded-md border transition-colors capitalize ${hasAccess ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                                                                                        } ${(u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email)) && 'opacity-60 cursor-not-allowed'}`}
                                                                                    title={`Alternar acesso a ${mod}`}
                                                                                >
                                                                                    {mod}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4 text-right">
                                                                    <div className="flex justify-end gap-1">
                                                                        {u.status === 'pendente' && (
                                                                            <button
                                                                                onClick={() => handleUpdateUserStatus(u.id, 'aprovado')}
                                                                                disabled={u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email)}
                                                                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                                                title="Aprovar Usuário"
                                                                            >
                                                                                <CheckCircle className="w-5 h-5" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                                                                            disabled={u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email && userData.email !== 'admin@admin.com')}
                                                                            className={`p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${u.isAdmin || u.email === 'admin@admin.com' ? 'text-purple-600 bg-purple-50 hover:bg-purple-100' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}`}
                                                                            title={u.isAdmin || u.email === 'admin@admin.com' ? "Remover Privilégios de Administrador" : "Tornar Administrador"}
                                                                        >
                                                                            <Shield className="w-5 h-5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleResetUserPassword(u.email)}
                                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                            title="Enviar Email de Redefinição de Senha"
                                                                        >
                                                                            <Key className="w-5 h-5" />
                                                                        </button>
                                                                        {u.status === 'bloqueado' && u.email !== 'admin@admin.com' && (
                                                                            <button
                                                                                onClick={() => handleUpdateUserStatus(u.id, 'aprovado')}
                                                                                disabled={u.isAdmin && u.email !== userData.email}
                                                                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                                                title="Desbloquear Usuário"
                                                                            >
                                                                                <CheckCircle className="w-5 h-5" />
                                                                            </button>
                                                                        )}
                                                                        {u.status !== 'bloqueado' && u.email !== 'admin@admin.com' && (
                                                                            <button
                                                                                onClick={() => handleUpdateUserStatus(u.id, 'bloqueado')}
                                                                                disabled={u.isAdmin && u.email !== userData.email}
                                                                                className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                                                title="Bloquear Usuário"
                                                                            >
                                                                                <Ban className="w-5 h-5" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleDeleteUser(u.id)}
                                                                            disabled={u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email)}
                                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                                            title="Excluir Usuário"
                                                                        >
                                                                            <Trash2 className="w-5 h-5" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Mobile View */}
                                            <div className="md:hidden flex flex-col gap-4 pb-2">
                                                {usersList.map(u => (
                                                    <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                                                        {/* Header: User Info + Status */}
                                                        <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${(u.email === 'admin@admin.com' || u.isAdmin) ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                    {u.nome?.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-gray-800 flex items-center gap-1 text-sm">
                                                                        {u.nome}
                                                                        {(u.email === 'admin@admin.com' || u.isAdmin) && <Shield className="w-3 h-3 text-purple-600" title="Administrador" />}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 break-all">{u.email}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-bold rounded-full px-2 py-1 uppercase tracking-wider ${u.status === 'pendente' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                                                u.status === 'bloqueado' ? 'bg-red-100 text-red-800 border border-red-200' :
                                                                    'bg-green-100 text-green-800 border border-green-200'
                                                                }`}>
                                                                {u.status === 'pendente' ? 'Pendente' :
                                                                    u.status === 'bloqueado' ? 'Bloqueado' :
                                                                        'Aprovado'}
                                                            </span>
                                                        </div>

                                                        {/* Permissions */}
                                                        <div>
                                                            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Módulos Permitidos</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {['kanban', 'estoque', 'verificacao', 'suporte', 'flex'].map(mod => {
                                                                    const permissions = u.permissions || { kanban: true, estoque: true, verificacao: true, suporte: true, flex: true };
                                                                    const hasAccess = permissions[mod] === true;
                                                                    return (
                                                                        <button
                                                                            key={mod}
                                                                            onClick={() => handleTogglePermission(u.id, permissions, mod)}
                                                                            disabled={u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email)}
                                                                            className={`text-xs px-2 py-1 flex-1 min-w-[30%] justify-center rounded-md border transition-colors capitalize ${hasAccess ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                                                                                } ${(u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email)) && 'opacity-60 cursor-not-allowed'}`}
                                                                        >
                                                                            {mod}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="pt-3 border-t border-gray-100 flex justify-end gap-2 mt-1">
                                                            {u.status === 'pendente' && (
                                                                <button
                                                                    onClick={() => handleUpdateUserStatus(u.id, 'aprovado')}
                                                                    disabled={u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email)}
                                                                    className="p-2 text-gray-500 hover:text-green-600 bg-gray-50 hover:bg-green-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed border border-gray-200 transition-colors"
                                                                >
                                                                    <CheckCircle className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                                                                disabled={u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email && userData.email !== 'admin@admin.com')}
                                                                className={`p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed border transition-colors ${u.isAdmin || u.email === 'admin@admin.com' ? 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200' : 'text-gray-500 bg-gray-50 hover:text-purple-600 hover:bg-purple-50 border-gray-200'}`}
                                                            >
                                                                <Shield className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleResetUserPassword(u.email)}
                                                                className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors"
                                                            >
                                                                <Key className="w-4 h-4" />
                                                            </button>
                                                            {u.status === 'bloqueado' && u.email !== 'admin@admin.com' && (
                                                                <button
                                                                    onClick={() => handleUpdateUserStatus(u.id, 'aprovado')}
                                                                    disabled={u.isAdmin && u.email !== userData.email}
                                                                    className="p-2 text-gray-500 hover:text-green-600 bg-gray-50 hover:bg-green-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed border border-gray-200 transition-colors"
                                                                    title="Desbloquear Usuário"
                                                                >
                                                                    <CheckCircle className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {u.status !== 'bloqueado' && u.email !== 'admin@admin.com' && (
                                                                <button
                                                                    onClick={() => handleUpdateUserStatus(u.id, 'bloqueado')}
                                                                    disabled={u.isAdmin && u.email !== userData.email}
                                                                    className="p-2 text-gray-500 hover:text-orange-600 bg-gray-50 hover:bg-orange-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed border border-gray-200 transition-colors"
                                                                    title="Bloquear Usuário"
                                                                >
                                                                    <Ban className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteUser(u.id)}
                                                                disabled={u.email === 'admin@admin.com' || (u.isAdmin && u.email !== userData.email)}
                                                                className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed border border-gray-200 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}


                    {activeTab === "cadastros" && (
                        <div className="space-y-6 animate-fade-in">
                            {loadingSettings ? (
                                <div className="flex justify-center p-8">
                                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Sidebar for Lists */}
                                    <div className="md:col-span-1 space-y-2">
                                        <button
                                            onClick={() => setActiveList("ticketTypes")}
                                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeList === "ticketTypes"
                                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                                }`}
                                        >
                                            Tipos de Chamado
                                        </button>
                                        <button
                                            onClick={() => setActiveList("marketplaces")}
                                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeList === "marketplaces"
                                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                                }`}
                                        >
                                            Marketplaces
                                        </button>
                                    </div>

                                    {/* Management Area */}
                                    <div className="md:col-span-2 space-y-4">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <h3 className="text-lg font-bold text-gray-800">
                                                {activeList === "ticketTypes" ? "Gerenciar Tipos de Chamado" : "Gerenciar Marketplaces"}
                                            </h3>
                                            <button
                                                onClick={handleRestoreDefaults}
                                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded"
                                                title="Restaura os valores sugeridos pelo sistema"
                                            >
                                                <RefreshCcw className="w-3 h-3" /> Restaurar Padrões
                                            </button>
                                        </div>

                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Novo item..."
                                                value={newItem}
                                                onChange={(e) => setNewItem(e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                                            />
                                            <button
                                                onClick={handleAddItem}
                                                disabled={!newItem.trim()}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-[400px] overflow-y-auto divide-y divide-gray-100">
                                            {(generalSettings[activeList] || []).map((item, index) => (
                                                <div key={index} className="flex justify-between items-center p-3 hover:bg-white transition-colors">
                                                    <span className="text-gray-700 font-medium">{item}</span>
                                                    <button
                                                        onClick={() => handleDeleteItem(item)}
                                                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            {(generalSettings[activeList] || []).length === 0 && (
                                                <div className="p-6 text-center text-gray-400 text-sm">
                                                    Nenhum item cadastrado.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "database" && userData?.isAdmin && (
                        <div className="space-y-8 animate-fade-in p-2 sm:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Backup and Restore Card */}
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
                                    <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                                        <Database className="w-5 h-5 text-blue-600" /> Backup e Restauração
                                    </h2>
                                    <p className="text-sm text-gray-500 mb-6 flex-1">
                                        Faça o download de uma cópia de segurança local de todos os seus registros do banco de dados (Backup Full) ou recupere o sistema inteiro a partir de um arquivo gerado anteriormente.
                                    </p>

                                    <div className="space-y-4">
                                        <button
                                            onClick={handleExportDatabase}
                                            disabled={isExporting || isImporting || isCleaning}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {isExporting ? <Loader className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                            {isExporting ? 'Gerando Backup...' : 'Fazer Backup da Nuvem'}
                                        </button>

                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept=".json"
                                                id="restore-upload"
                                                onChange={handleImportDatabase}
                                                disabled={isExporting || isImporting || isCleaning}
                                                className="hidden"
                                            />
                                            <label
                                                htmlFor="restore-upload"
                                                className={`w-full bg-white border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-700 px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${isImporting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {isImporting ? <Loader className="w-5 h-5 animate-spin text-blue-600" /> : <Upload className="w-5 h-5 text-gray-500" />}
                                                {isImporting ? 'Restaurando...' : 'Restaurar Backup do PC'}
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Data Cleanup Card */}
                                <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm flex flex-col h-full bg-gradient-to-b from-white to-red-50/30">
                                    <h2 className="text-lg font-bold text-red-700 mb-2 flex items-center gap-2">
                                        <Trash2 className="w-5 h-5" /> Limpeza Inteligente
                                    </h2>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Selecione os módulos e a janela de tempo dos itens que deseja excluir em massa. Ideal para desafogar o sistema de dados antigos ou testes de implantação.
                                    </p>

                                    <div className="space-y-4 flex-1">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Período Limite (Retenção)</label>
                                            <select
                                                value={cleanupPeriod}
                                                onChange={(e) => setCleanupPeriod(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm bg-white"
                                            >
                                                <option value="total">Apagamento Total (Ignorar datas)</option>
                                                <option value="180">Excluir anteriores a 180 dias</option>
                                                <option value="90">Excluir anteriores a 90 dias</option>
                                                <option value="30">Excluir anteriores a 30 dias</option>
                                                <option value="15">Excluir anteriores a 15 dias</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Módulos Alvo</label>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white border transition-colors border-transparent hover:border-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanupModules.chamados}
                                                        onChange={(e) => setCleanupModules(p => ({ ...p, chamados: e.target.checked }))}
                                                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                                    />
                                                    Chamados
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white border transition-colors border-transparent hover:border-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanupModules.kanban}
                                                        onChange={(e) => setCleanupModules(p => ({ ...p, kanban: e.target.checked }))}
                                                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                                    />
                                                    Kanban
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white border transition-colors border-transparent hover:border-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanupModules.suporte}
                                                        onChange={(e) => setCleanupModules(p => ({ ...p, suporte: e.target.checked }))}
                                                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                                    />
                                                    Suporte
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white border transition-colors border-transparent hover:border-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={cleanupModules.flex}
                                                        onChange={(e) => setCleanupModules(p => ({ ...p, flex: e.target.checked }))}
                                                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                                    />
                                                    Relatórios Flex
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={confirmCleanup}
                                        disabled={isCleaning || isExporting || isImporting || Object.values(cleanupModules).every(v => v === false)}
                                        className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isCleaning ? <Loader className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
                                        {isCleaning ? 'Limpando Registros...' : 'Executar Limpeza Definitiva'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "ideris" && userData?.isAdmin && (
                        <div className="space-y-6 max-w-2xl animate-fade-in p-6">
                            <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
                                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <Link className="w-5 h-5 text-blue-600" /> API Ideris
                                </h3>
                                <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-4">
                                    Configure o comportamento dinâmico da integração em todo o sistema. Alterações aplicadas aqui impactam a visão dos módulos de Estoque, Verificação, e a listagem do Flex Imediatamente.
                                </p>

                                <div className="space-y-5">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div>
                                            <p className="font-semibold text-gray-700 text-sm">Habilitar Integração</p>
                                            <p className="text-xs text-gray-500">Liga/desliga a consulta ao Ideris no sistema</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={iderisForm.enabled}
                                                onChange={(e) => setIderisForm({ ...iderisForm, enabled: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Chave da API (Ideris Token)
                                        </label>
                                        <input
                                            type="password"
                                            value={iderisForm.apiKey}
                                            onChange={(e) => setIderisForm({ ...iderisForm, apiKey: e.target.value })}
                                            placeholder="Ex: 4d18596794934f39..."
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-shadow bg-gray-50"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">
                                            Mantenha este campo preenchido com seu Token gerado na plataforma Ideris.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                        {activeTab !== "cadastros" && activeTab !== "database" && activeTab !== "ideris" && (
                            <button
                                onClick={handleSave}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                            >
                                <Save className="w-5 h-5" /> Salvar Alterações
                            </button>
                        )}
                        {activeTab === "ideris" && (
                            <button
                                onClick={handleSaveIderis}
                                disabled={isSavingIderis}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isSavingIderis ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Salvar Integração Ideris
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}
