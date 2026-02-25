import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage, auth } from '../../services/firebase';
import { doc, getDoc, updateDoc, arrayUnion, collection, addDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify';
import { ArrowLeft, Send, Paperclip, User, Clock, CheckCircle, AlertCircle, Lock, FileText, X, Eye, Download } from 'lucide-react';

export default function TicketDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);

    // Chat state
    const [newMessage, setNewMessage] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [sending, setSending] = useState(false);
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);

    // Business Rules State
    const [isResponsableLocked, setIsResponsableLocked] = useState(false);
    const [isStatusLocked, setIsStatusLocked] = useState(false);
    const [isTypeLocked, setIsTypeLocked] = useState(false);

    // Image Preview State
    const [previewImage, setPreviewImage] = useState(null);

    useEffect(() => {
        // Load Users for Dropdown
        const loadUsers = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'usuarios'));
                const usersList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setUsers(usersList);
            } catch (error) {
                console.error("Error loading users:", error);
            }
        };

        loadUsers();

        // Real-time Ticket Listener
        const unsubscribe = onSnapshot(doc(db, 'chamados', id), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTicket({ id: docSnap.id, ...data });

                // Determine Locks based on legacy/new flags
                // Rule: If responsavel is set AND (responsavelAlterado is true OR it was set in legacy), lock it.
                // Simpler Rule requested: "Can be changed only ONCE".
                // If data.responsavelAlterado exists and is true, it's locked.
                setIsResponsableLocked(!!data.responsavelAlterado);
                setIsStatusLocked(!!data.statusAlterado);
                setIsTypeLocked(!!data.tipoAlterado);

                setLoading(false);
            } else {
                toast.error("Chamado não encontrado.");
                navigate('/chamados');
            }
        }, (error) => {
            console.error("Error fetching ticket:", error);
            toast.error("Erro ao carregar chamado.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id, navigate]);

    // Auto-update status to 'Pendente' if > 24h
    useEffect(() => {
        if (ticket?.status === 'Aberto' && ticket?.dataAbertura) {
            const aberturaDate = new Date(ticket.dataAbertura);
            const now = new Date();
            const diffInHours = (now - aberturaDate) / (1000 * 60 * 60);

            if (diffInHours > 24) {
                updateDoc(doc(db, 'chamados', id), { status: 'Pendente' });
            }
        }
    }, [ticket, id]);

    useEffect(() => {
        // Scroll to bottom of chat
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [ticket?.interacoes]);

    // Helper to get current user name
    const getCurrentUserName = () => {
        if (!auth.currentUser) return 'Usuário';
        const user = users.find(u => u.email === auth.currentUser.email);
        return user?.nome || auth.currentUser.displayName || auth.currentUser.email || 'Usuário';
    };

    const handleResponsavelChange = async (e) => {
        const newResponsavelId = e.target.value;
        const selectedUser = users.find(u => u.nome === newResponsavelId); // Value is name in legacy, or ID? Legacy seems to store Name. Let's assume Name for consistency with legacy app.js code viewed essentially. 
        // Actually legacy app.js used `userData.nome`.

        if (!selectedUser) return;
        const newResponsavelName = selectedUser.nome;

        if (window.confirm(`Confirma a atribuição deste chamado para ${newResponsavelName}? Esta ação não poderá ser desfeita.`)) {
            try {
                // Atomic Update: Change Responsible + Log Interaction
                const systemMsg = {
                    autor: 'Sistema',
                    mensagem: `Responsável alterado para ${newResponsavelName} por ${getCurrentUserName()}`,
                    data: new Date().toISOString()
                };

                await updateDoc(doc(db, 'chamados', id), {
                    responsavel: newResponsavelName,
                    responsavelAlterado: true,
                    interacoes: arrayUnion(systemMsg)
                });

                // Create Notification
                await addDoc(collection(db, 'notificacoes'), {
                    para: newResponsavelName, // Or ID if we have it better. Legacy likely matched by Name.
                    mensagem: `Você foi atribuído ao chamado ${ticket.codigo}`,
                    lido: false,
                    data: new Date().toISOString(),
                    link: `/chamados/${id}`
                });

                toast.success(`Responsável atribuído: ${newResponsavelName}`);
            } catch (error) {
                console.error("Error updating responsible:", error);
                toast.error("Erro ao atribuir responsável.");
            }
        }
    };

    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;

        if (window.confirm(`Confirma a alteração de status para "${newStatus}"? Esta ação não poderá ser desfeita.`)) {
            try {
                // Atomic Update: Change Status + Log Interaction
                const systemMsg = {
                    autor: 'Sistema',
                    mensagem: `Status alterado para ${newStatus} por ${getCurrentUserName()}`,
                    data: new Date().toISOString()
                };

                await updateDoc(doc(db, 'chamados', id), {
                    status: newStatus,
                    statusAlterado: true,
                    interacoes: arrayUnion(systemMsg)
                });

                toast.success(`Status alterado para: ${newStatus}`);
            } catch (error) {
                console.error("Error updating status:", error);
                toast.error("Erro ao alterar status.");
            }
        }
    };

    const handleFileUpload = (e) => {
        if (e.target.files) {
            setAttachments([...attachments, ...Array.from(e.target.files)]);
        }
    };

    const removeAttachment = (index) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if ((!newMessage.trim() && attachments.length === 0) || sending) return;

        setSending(true);
        try {
            const uploadedAttachments = [];

            // Upload files first
            for (const file of attachments) {
                const storageRef = ref(storage, `chamados/${id}/${Date.now()}_${file.name}`);
                const uploadResult = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(uploadResult.ref);
                uploadedAttachments.push({
                    nome: file.name,
                    url: downloadURL,
                    tipo: file.type
                });
            }

            const interaction = {
                autor: getCurrentUserName(),
                mensagem: newMessage,
                data: new Date().toISOString(),
                anexos: uploadedAttachments
            };

            await updateDoc(doc(db, 'chamados', id), {
                interacoes: arrayUnion(interaction),
                // Auto-update status to 'Pendente' if it was 'Aberto'
                ...(ticket.status === 'Aberto' ? { status: 'Pendente' } : {})
            });

            setNewMessage('');
            setAttachments([]);
            toast.success("Mensagem enviada!");
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Erro ao enviar mensagem.");
        } finally {
            setSending(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Aberto': return 'bg-blue-100 text-blue-800';
            case 'Pendente': return 'bg-yellow-100 text-yellow-800';
            case 'Revisão': return 'bg-purple-100 text-purple-800';
            case 'Fechado': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) return <div className="p-10 text-center">Carregando detalhes...</div>;
    if (!ticket) return null;

    const AttachmentItem = ({ anexo, compact = false }) => {
        const isImage = anexo.tipo?.startsWith('image/') || anexo.nome.match(/\.(jpg|jpeg|png|gif|webp)$/i);

        return (
            <div className={`flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg transition-colors group ${compact ? 'text-xs' : 'text-sm'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className={`text-gray-400 group-hover:text-blue-500 transition-colors ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                    <span className="text-gray-700 truncate max-w-[150px]">{anexo.nome}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            if (isImage) {
                                setPreviewImage(anexo.url);
                            } else {
                                window.open(anexo.url, '_blank');
                            }
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Visualização Rápida"
                    >
                        <Eye className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                    </button>
                    <a
                        href={anexo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Download / Abrir Original"
                    >
                        <Download className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                    </a>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto flex flex-col h-full lg:h-[calc(100vh-140px)] gap-4 pb-4">
            {/* Header */}
            <div className="flex items-center gap-4 px-1">
                <button onClick={() => navigate('/chamados')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-800">{ticket.codigo}</h1>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">{ticket.tipo}</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                {/* Main Chat Area */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-0 overflow-hidden">

                    {/* Description Section */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                        {ticket.assunto && (
                            <div className="mb-3 pb-3 border-b border-gray-100">
                                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Assunto</p>
                                <h2 className="text-lg font-bold text-gray-800 leading-snug">{ticket.assunto}</h2>
                            </div>
                        )}
                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Descrição do Problema</p>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                            {ticket.descricao}
                        </p>
                    </div>



                    <div className="flex-1 lg:overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                        {ticket.interacoes && ticket.interacoes.map((msg, idx) => {
                            const currentUserName = getCurrentUserName();
                            const isMe = msg.autor === currentUserName || msg.autor === auth.currentUser?.email;

                            return (
                                <div key={idx} className={`flex flex-col ${msg.autor === 'Sistema' ? 'items-center my-4' : (isMe ? 'items-end' : 'items-start')}`}>
                                    {msg.autor === 'Sistema' ? (
                                        <div className="bg-gray-200 text-gray-600 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                                            {msg.mensagem}
                                        </div>
                                    ) : (
                                        <div className={`max-w-[80%] ${isMe ? 'bg-blue-600 text-white rounded-l-xl rounded-tr-xl' : 'bg-white border border-gray-200 text-gray-800 rounded-r-xl rounded-tl-xl'} p-4 shadow-sm`}>
                                            <div className="flex justify-between items-center gap-4 mb-1 opacity-80 text-xs">
                                                <span className="font-bold">{msg.autor}</span>
                                                <span>{new Date(msg.data).toLocaleString('pt-BR')}</span>
                                            </div>
                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.mensagem}</p>

                                            {msg.anexos && msg.anexos.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    {msg.anexos.map((anexo, i) => (
                                                        <AttachmentItem key={i} anexo={anexo} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-200">
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {attachments.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm border border-blue-100">
                                        <span className="max-w-[150px] truncate">{file.name}</span>
                                        <button onClick={() => removeAttachment(i)} className="hover:text-blue-900"><X className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <form onSubmit={sendMessage} className="flex gap-2 items-end">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-3 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Anexar arquivo"
                                disabled={ticket.status === 'Fechado' && ticket.jaFoiRevisado}
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                                multiple
                                disabled={ticket.status === 'Fechado' && ticket.jaFoiRevisado}
                            />
                            <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage(e);
                                    }
                                }}
                                placeholder={ticket.status === 'Fechado' && ticket.jaFoiRevisado ? "Chamado finalizado. Não é possível enviar mensagens." : "Digite sua mensagem..."}
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none max-h-32 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                rows={1}
                                disabled={ticket.status === 'Fechado' && ticket.jaFoiRevisado}
                            />
                            <button
                                type="submit"
                                disabled={sending || (!newMessage.trim() && attachments.length === 0) || (ticket.status === 'Fechado' && ticket.jaFoiRevisado)}
                                className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </form>

                        {/* Finalizar Chamado Button */}
                        <div className="flex justify-center pt-4 border-t border-gray-100 mt-4">
                            <button
                                onClick={async () => {
                                    if (ticket.status === 'Fechado') {
                                        if (ticket.jaFoiRevisado) return;

                                        if (window.confirm("Deseja reabrir este chamado para revisão?")) {
                                            try {
                                                const systemMsg = {
                                                    autor: 'Sistema',
                                                    mensagem: `Chamado reaberto para revisão por ${getCurrentUserName()}`,
                                                    data: new Date().toISOString()
                                                };

                                                await updateDoc(doc(db, 'chamados', id), {
                                                    status: 'Revisão',
                                                    jaFoiRevisado: true,
                                                    interacoes: arrayUnion(systemMsg)
                                                });
                                                toast.success("Chamado em revisão.");
                                            } catch (e) {
                                                console.error(e);
                                                toast.error("Erro ao alterar status.");
                                            }
                                        }
                                    } else {
                                        if (window.confirm("Deseja finalizar este chamado?")) {
                                            try {
                                                const systemMsg = {
                                                    autor: 'Sistema',
                                                    mensagem: `Chamado finalizado por ${getCurrentUserName()}`,
                                                    data: new Date().toISOString()
                                                };

                                                await updateDoc(doc(db, 'chamados', id), {
                                                    status: 'Fechado',
                                                    interacoes: arrayUnion(systemMsg)
                                                });
                                                toast.success("Chamado finalizado!");
                                            } catch (e) {
                                                console.error(e);
                                                toast.error("Erro ao finalizar.");
                                            }
                                        }
                                    }
                                }}
                                disabled={ticket.status === 'Fechado' && ticket.jaFoiRevisado}
                                className={`px-6 py-2 rounded-lg font-bold text-white shadow-sm transition-all transform active:scale-95 flex items-center gap-2 text-sm ${ticket.status === 'Fechado'
                                    ? ticket.jaFoiRevisado
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-orange-500 hover:bg-orange-600'
                                    : 'bg-green-600 hover:bg-green-700'
                                    }`}
                            >
                                {ticket.status === 'Fechado' ? (
                                    ticket.jaFoiRevisado ? (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Chamado Finalizado
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="w-4 h-4" />
                                            Revisar
                                        </>
                                    )
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        Finalizar Chamado
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar / Details */}
                <div className="w-full lg:w-80 space-y-6 lg:overflow-y-auto pr-1 custom-scrollbar">
                    {/* Status & Responsible Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" /> Tipo
                            </label>
                            <div className="relative">
                                <select
                                    value={ticket.tipo || ''}
                                    onChange={async (e) => {
                                        const newType = e.target.value;
                                        if (window.confirm(`Deseja alterar o tipo para "${newType}"?`)) {
                                            try {
                                                // Atomic Update: Change Type + Log Interaction
                                                const systemMsg = {
                                                    autor: 'Sistema',
                                                    mensagem: `Tipo alterado para ${newType} por ${getCurrentUserName()}`,
                                                    data: new Date().toISOString()
                                                };

                                                await updateDoc(doc(db, 'chamados', id), {
                                                    tipo: newType,
                                                    tipoAlterado: true,
                                                    interacoes: arrayUnion(systemMsg)
                                                });

                                                toast.success(`Tipo alterado para: ${newType}`);
                                            } catch (error) {
                                                console.error("Error updating type:", error);
                                                toast.error("Erro ao alterar tipo.");
                                            }
                                        }
                                    }}
                                    disabled={isTypeLocked}
                                    className={`w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg appearance-none text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-base ${isTypeLocked ? 'opacity-60 cursor-not-allowed bg-gray-100' : 'cursor-pointer hover:border-blue-300'}`}
                                >
                                    <option value="Devolucao">Devolução</option>
                                    <option value="Reembolso">Reembolso</option>
                                    <option value="Fraude">Fraude</option>
                                    <option value="Contatar MarketPlace">Contatar MarketPlace</option>
                                    <option value="Contatar Cliente">Contatar Cliente</option>
                                    <option value="Interno">Interno</option>
                                    <option value="Defeito">Defeito</option>
                                    <option value="Prejuizo">Prejuízo</option>
                                    <option value="Atraso na entrega">Atraso na entrega</option>
                                    <option value="Produto errado">Produto errado</option>
                                    <option value="Faltou item">Faltou item</option>
                                    <option value="Duvida tecnica">Dúvida técnica</option>
                                    <option value="Cancelamento">Cancelamento</option>
                                </select>
                                {isTypeLocked && (
                                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                )}
                            </div>
                            {isTypeLocked && <p className="text-xs text-orange-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Alteração única permitida.</p>}
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-400 uppercase font-bold">Pedido</p>
                            <p className="text-lg font-bold text-gray-800">{ticket.pedido || 'N/A'}</p>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-gray-400 uppercase font-bold">Marketplace</p>
                            <p className="text-sm font-medium text-gray-700">{ticket.marketplace || 'N/A'}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                                <User className="w-4 h-4" /> Responsável
                            </label>
                            <div className="relative">
                                <select
                                    value={ticket.responsavel || ''}
                                    onChange={handleResponsavelChange}
                                    disabled={isResponsableLocked}
                                    className={`w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg appearance-none text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium ${isResponsableLocked ? 'opacity-60 cursor-not-allowed bg-gray-100' : 'cursor-pointer hover:border-blue-300'}`}
                                >
                                    <option value="" disabled>Selecionar...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.nome}>{u.nome}</option>
                                    ))}
                                </select>
                                {isResponsableLocked && (
                                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                )}
                            </div>
                            {isResponsableLocked && <p className="text-xs text-orange-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Alteração única permitida.</p>}
                        </div>



                        <hr className="border-gray-100" />

                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Aberto em</p>
                                <div className="flex items-center gap-2 text-gray-600 font-medium text-sm">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    {new Date(ticket.dataAbertura).toLocaleString('pt-BR')}
                                </div>
                            </div>

                            {/* Initial Attachments (Moved to Sidebar) */}
                            {ticket.anexos && ticket.anexos.length > 0 && (
                                <div>
                                    <p className="text-xs text-gray-400 uppercase font-bold mb-2">Anexos do Chamado</p>
                                    <div className="flex flex-col gap-2">
                                        {ticket.anexos.map((anexo, i) => (
                                            <AttachmentItem key={i} anexo={anexo} compact={true} />
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>


            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
                        onClick={() => setPreviewImage(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )
            }
        </div >
    );
}
