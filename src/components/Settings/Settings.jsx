import { useAuth } from "../../context/AuthContext";
import { User, Shield, Bell, Save, Database, Plus, Trash2, Loader, RefreshCcw } from "lucide-react";
import Swal from 'sweetalert2';
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { toast } from "react-toastify";

export default function Settings() {
    const { userData } = useAuth();
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

    useEffect(() => {
        fetchGeneralSettings();
    }, []);

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

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Configurações</h1>

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
                    <button
                        onClick={() => setActiveTab("seguranca")}
                        className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === "seguranca"
                            ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            }`}
                    >
                        <Shield className="w-4 h-4" /> Segurança
                    </button>
                    <button
                        onClick={() => setActiveTab("cadastros")}
                        className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === "cadastros"
                            ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            }`}
                    >
                        <Database className="w-4 h-4" /> Cadastros Gerais
                    </button>
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

                    {activeTab === "seguranca" && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
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

                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <h3 className="font-bold text-yellow-800 text-sm mb-1">Alterar Senha</h3>
                                <p className="text-yellow-700 text-sm">Para alterar sua senha, enviaremos um link de redefinição para seu email cadastrado.</p>
                                <button className="mt-3 text-sm font-medium text-yellow-900 underline hover:text-yellow-700">
                                    Enviar email de redefinição
                                </button>
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

                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                        {activeTab !== "cadastros" && (
                            <button
                                onClick={handleSave}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                            >
                                <Save className="w-5 h-5" /> Salvar Alterações
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
