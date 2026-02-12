import { useState, useEffect } from 'react';
import { db, storage } from '../../services/firebase';
import { collection, addDoc, doc, updateDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Save, ArrowLeft, Upload, X, FileText, AlertTriangle } from 'lucide-react';

// Constants removed - using dynamic values from Firestore

export default function TicketForm() {
    const { id } = useParams();
    const isEdit = !!id;
    const navigate = useNavigate();
    const { userData } = useAuth();

    const [loading, setLoading] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState(false);
    const [formData, setFormData] = useState({
        pedido: '',
        tipo: '',
        marketplace: '',
        assunto: '',
        descricao: '',
        responsavel: userData?.nome || ''
    });

    const [files, setFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [users, setUsers] = useState([]);

    // Dynamic Options
    const [ticketTypes, setTicketTypes] = useState([]);
    const [marketplaces, setMarketplaces] = useState([]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'sys_settings', 'general');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTicketTypes(data.ticketTypes || []);
                    setMarketplaces(data.marketplaces || []);
                } else {
                    // Fallback defaults if not found (optional, but good for stability)
                    setTicketTypes([
                        'Devolução', 'Reembolso', 'Fraude', 'Contatar MarketPlace', 'Contatar Cliente',
                        'Interno', 'Defeito', 'Prejuízo', 'Atraso na entrega', 'Produto errado',
                        'Faltou item', 'Dúvida técnica', 'Cancelamento'
                    ]);
                    setMarketplaces(['Mercado Livre', 'Amazon', 'Interno', 'Shopee', 'Magalu']);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'usuarios'));
                const usersList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setUsers(usersList);
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        if (isEdit) {
            const fetchTicket = async () => {
                try {
                    const docRef = doc(db, 'chamados', id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setFormData(data);
                        if (data.anexos) setExistingAttachments(data.anexos);
                    } else {
                        toast.error("Chamado não encontrado");
                        navigate('/chamados');
                    }
                } catch (error) {
                    console.error("Erro ao buscar chamado:", error);
                    toast.error("Erro ao carregar dados do chamado");
                }
            };
            fetchTicket();
        }
    }, [id, isEdit, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'pedido') {
            checkDuplicate(value);
        }
    };

    const checkDuplicate = async (pedidoVal) => {
        if (!pedidoVal || isEdit) return; // Don't check on edit or empty
        const q = query(collection(db, 'chamados'), where('pedido', '==', pedidoVal));
        try {
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setDuplicateWarning(true);
            } else {
                setDuplicateWarning(false);
            }
        } catch (error) {
            console.error("Error checking for duplicate:", error);
        }
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);

        // Validar tamanho (max 5MB total)
        let totalSize = files.reduce((acc, file) => acc + file.size, 0);
        for (const file of selectedFiles) {
            totalSize += file.size;
        }

        if (totalSize > 5 * 1024 * 1024) {
            toast.error("O tamanho total dos arquivos não pode exceder 5MB");
            return;
        }

        if (files.length + selectedFiles.length > 3) {
            toast.error("Máximo de 3 arquivos permitidos");
            return;
        }

        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const generateCode = async () => {
        // Simplificação: Em produção idealmente usaria uma Cloud Function ou contador atômico
        // Aqui vamos usar um timestamp + random para garantir unicidade no MVP sem complexidade
        const timestamp = Date.now().toString().slice(-4);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `CH${timestamp}${random}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let anexos = [...existingAttachments];

            // Upload de arquivos
            if (files.length > 0) {
                for (const file of files) {
                    const storageRef = ref(storage, `chamados/${Date.now()}_${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(snapshot.ref);

                    anexos.push({
                        nome: file.name,
                        url: url,
                        tamanho: file.size,
                        tipo: file.type
                    });
                }
            }

            if (isEdit) {
                await updateDoc(doc(db, 'chamados', id), {
                    ...formData,
                    anexos,
                    dataAtualizacao: new Date().toISOString()
                });
                toast.success("Chamado atualizado com sucesso!");
                navigate(`/chamados/${id}`);
            } else {
                const codigo = await generateCode();
                const docRef = await addDoc(collection(db, 'chamados'), {
                    ...formData,
                    codigo,
                    anexos,
                    status: 'Aberto',
                    dataAbertura: new Date().toISOString(),
                    criadoPor: userData?.email || 'Sistema',
                    interacoes: [
                        {
                            autor: 'Sistema',
                            mensagem: `Chamado criado por ${userData?.nome || userData?.email || 'Usuário'}`,
                            data: new Date().toISOString()
                        }
                    ]
                });
                toast.success("Chamado criado com sucesso!");
                navigate(`/chamados/${docRef.id}`);
            }
        } catch (error) {
            console.error("Erro ao salvar chamado:", error);
            toast.error("Erro ao salvar chamado.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/chamados')}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">
                    {isEdit ? 'Editar Chamado' : 'Novo Chamado'}
                </h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Número do Pedido</label>
                            <input
                                type="text"
                                name="pedido"
                                required
                                value={formData.pedido}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${duplicateWarning ? 'border-orange-500 bg-orange-50' : 'border-gray-300'}`}
                                placeholder="Ex: 123456"
                            />
                            {duplicateWarning && (
                                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1 font-medium">
                                    <AlertTriangle className="w-3 h-3" />
                                    Já existe um chamado aberto para este pedido.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                            <select
                                name="responsavel"
                                value={formData.responsavel}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                <option value="">Selecione...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.nome}>{u.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Chamado</label>
                            <select
                                name="tipo"
                                required
                                value={formData.tipo}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Selecione...</option>
                                {ticketTypes.map(tipo => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Marketplace</label>
                            <select
                                name="marketplace"
                                value={formData.marketplace}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Selecione...</option>
                                {marketplaces.map(mp => (
                                    <option key={mp} value={mp}>{mp}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
                        <input
                            type="text"
                            name="assunto"
                            required
                            value={formData.assunto}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Resumo do problema"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                        <textarea
                            name="descricao"
                            required
                            rows={4}
                            value={formData.descricao}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                            placeholder="Detalhes completos do chamado..."
                        />
                    </div>

                    {/* Área de Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Anexos</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">Clique ou arraste arquivos aqui</p>
                            <p className="text-xs text-gray-400 mt-1">Máx. 3 arquivos (5MB total)</p>
                        </div>

                        {/* Lista de Arquivos Selecionados */}
                        {(files.length > 0 || existingAttachments.length > 0) && (
                            <div className="mt-4 space-y-2">
                                {existingAttachments.map((file, idx) => (
                                    <div key={`existing-${idx}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                            <span className="text-sm text-blue-900 truncate">{file.nome}</span>
                                            <span className="text-xs text-blue-500">(Existente)</span>
                                        </div>
                                    </div>
                                ))}
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-gray-500" />
                                            <div>
                                                <p className="text-sm text-gray-700 truncate">{file.name}</p>
                                                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="text-gray-400 hover:text-red-500 p-1"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => navigate('/chamados')}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Salvar Chamado
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
