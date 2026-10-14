import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../services/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    limit,
    getDocs, // Used for initial check if needed
    where
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import {
    FileText,
    PlusCircle,
    Search,
    X,
    FilePlus,
    ScanBarcode,
    Camera,
    List,
    Save,
    Trash2,
    Printer,
    Edit,
    MessageSquare,
    AlertTriangle,
    RefreshCw,
    StopCircle,
    CheckCircle,
    ShoppingBag,
    Truck
} from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmationModal from '../Shared/ConfirmationModal';
import './Flex.css';

const Flex = () => {
    // State
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isPrintConfirmOpen, setIsPrintConfirmOpen] = useState(false);
    const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState('ml');

    // Current Report State (Form)
    const [currentReportId, setCurrentReportId] = useState(null); // Firebase ID
    const [reportForm, setReportForm] = useState({
        alias: '',
        generalObservation: '',
        items: [],
        displayId: '' // The 5-char ID
    });
    const [sendIdInput, setSendIdInput] = useState('');
    const [useMlLabel, setUseMlLabel] = useState(true);

    // Observation View State
    const [observationViewData, setObservationViewData] = useState(null);

    // Scanner State
    const [isScannerActive, setIsScannerActive] = useState(false);
    const [cameras, setCameras] = useState([]);
    const [currentCameraId, setCurrentCameraId] = useState(null);
    const videoRef = useRef(null);
    const scannerRef = useRef(null);
    const isProcessingRef = useRef(false);

    // Print State
    const [lastSavedReport, setLastSavedReport] = useState(null);

    // Auth
    const { userData, currentUser: user } = useAuth(); // Maps currentUser from context to user locally

    useEffect(() => {
        if (!user) return;




        const q = query(
            collection(db, "reports"),
            orderBy("createdAt", "desc")
        );

        // Debugging: Using getDocs instead of onSnapshot to bypass potential SES/Socket issues
        getDocs(q).then((snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({
                firebaseId: doc.id,
                ...doc.data()
            }));
            setReports(reportsData);
            setLoading(false);
        }).catch((error) => {
            console.error("Error loading reports (getDocs):", error);
            // More detailed error logging
            if (error.code === 'permission-denied') {
                toast.error("Erro de Permissão (403): Verifique regras do Firebase.");
            } else if (error.code === 'unavailable') {
                toast.error("Erro de Conexão: Verifique se o banco está acessível (Firewall/Extensões).");
            } else {
                toast.error("Erro ao carregar (getDocs): " + error.message);
            }
            setLoading(false);
        });

        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(err => console.error("Error stopping scanner:", err));
                scannerRef.current = null;
            }
        };
    }, [user]);

    const reportFormRef = useRef(reportForm);
    useEffect(() => {
        reportFormRef.current = reportForm;
    }, [reportForm]);

    // Helpers
    const generateReportId = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const generateAutoAlias = (platform = selectedPlatform || 'ml') => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const prefix = platform === 'amazon' ? 'Amz_' : 'Flex_';
        return `${prefix}${day}${month}${year}${hours}${minutes}`;
    };

    const extractMLIdFromJson = (jsonString) => {
        try {
            if (jsonString.trim().startsWith('{') && jsonString.trim().endsWith('}')) {
                const jsonData = JSON.parse(jsonString);
                if (jsonData.id) {
                    return jsonData.id.toString();
                }
            }
        } catch (error) {
            console.log('Não é um JSON válido da etiqueta ML:', error);
        }
        return jsonString;
    };

    const processSendId = (sendId) => {
        const trimmed = sendId.trim();
        if (useMlLabel) {
            return extractMLIdFromJson(trimmed);
        }
        return trimmed;
    };

    // Form Actions
    const handleSelectPlatform = (platform) => {
        setIsPlatformModalOpen(false);
        openNewReportModal(platform);
    };

    const openNewReportModal = (platform = 'ml') => {
        setSelectedPlatform(platform);
        setReportForm({
            alias: generateAutoAlias(platform),
            generalObservation: '',
            items: [],
            displayId: generateReportId()
        });
        setCurrentReportId(null);
        setIsModalOpen(true);
        setUseMlLabel(iderisSettings?.enabled ?? true);
    };

    const openEditReportModal = (report) => {
        const platform = report.platform || (report.alias?.startsWith('Amz') ? 'amazon' : 'ml');
        setSelectedPlatform(platform);
        setReportForm({
            alias: report.alias,
            generalObservation: report.generalObservation || '',
            items: report.items || [],
            displayId: report.id
        });
        setCurrentReportId(report.firebaseId);
        setIsModalOpen(true);
        setUseMlLabel(iderisSettings?.enabled ?? true);
    };

    const closeReportModal = () => {
        setIsModalOpen(false);
        stopScanner();
        setSendIdInput('');
    };

    // Item Management
    const addItem = (id, obs = '') => {
        const processedId = processSendId(id);

        if (!processedId) {
            toast.error("ID inválido.");
            return;
        }

        if (reportFormRef.current.items.some(item => item.sendId === processedId)) {
            toast.warning("Este ID já está na lista.");
            return;
        }

        const newItem = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sendId: processedId,
            observation: obs
        };

        setReportForm(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setSendIdInput('');
    };

    const removeItem = (index) => {
        setReportForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const updateItemObservation = (index, value) => {
        const newItems = [...reportForm.items];
        newItems[index].observation = value;
        setReportForm(prev => ({ ...prev, items: newItems }));
    };

    // Scanner Logic
    const startScanner = async () => {
        if (isScannerActive) stopScanner();

        setIsScannerActive(true);

        // Wait for DOM update
        await new Promise(r => setTimeout(r, 400));

        const readerElement = document.getElementById('reader-flex');
        if (!readerElement) {
            console.error("Reader element not found after activation");
            setIsScannerActive(false);
            return;
        }

        try {
            const devices = await Html5Qrcode.getCameras();
            setCameras(devices);

            const html5QrCode = new Html5Qrcode("reader-flex");
            scannerRef.current = html5QrCode;

            const config = {
                fps: 20,
                qrbox: { width: 300, height: 300 },
                aspectRatio: 1.0
            };

            const targetCamera = currentCameraId || { facingMode: "environment" };

            await html5QrCode.start(
                targetCamera,
                config,
                (decodedText) => {
                    if (isProcessingRef.current) return;
                    isProcessingRef.current = true;

                    playSound('success');
                    addItem(decodedText);
                    toast.success("Código lido!");

                    setTimeout(() => { isProcessingRef.current = false; }, 1500);
                },
                (errorMessage) => { }
            );

        } catch (err) {
            console.error("Erro ao iniciar scanner:", err);
            toast.error("Não foi possível acessar a câmera.");
            setIsScannerActive(false);
        }
    };

    const playSound = (type = 'success') => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            if (type === 'success') {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
            }
        } catch (e) {
            console.warn("Audio Context Error:", e);
        }
    };

    const toggleCamera = async () => {
        if (!scannerRef.current || cameras.length < 2) return;

        const currentIndex = cameras.findIndex(c => c.id === currentCameraId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        const nextCameraId = cameras[nextIndex].id;

        try {
            stopScanner();
            setCurrentCameraId(nextCameraId);
            // Re-start with next camera
            setTimeout(() => startScanner(), 100);
            toast.info(`Câmera alterada para: ${cameras[nextIndex].label || 'Próxima'}`);
        } catch (err) {
            console.error("Erro ao trocar câmera:", err);
            toast.error("Erro ao trocar de câmera.");
        }
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current = null;
                setIsScannerActive(false);
            }).catch(err => {
                console.error("Erro ao parar scanner:", err);
                setIsScannerActive(false);
            });
        } else {
            setIsScannerActive(false);
        }
    };

    // Auto-stop on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(err => console.error(err));
                scannerRef.current = null;
            }
        };
    }, []);

    const toggleScanner = () => {
        if (isScannerActive) {
            stopScanner();
        } else {
            startScanner();
        }
    };

    // Save/Delete
    const saveReport = async () => {
        if (reportForm.items.length === 0) {
            toast.error("Adicione pelo menos um item.");
            return;
        }

        if (!user) {
            toast.error("Usuário não autenticado.");
            return;
        }

        const dataToSave = {
            userId: user.uid, // Add userId to document
            userName: userData?.nome || user.email || 'Usuário',
            alias: reportForm.alias || generateAutoAlias(selectedPlatform),
            platform: selectedPlatform || (reportForm.alias?.startsWith('Amz') ? 'amazon' : 'ml'),
            items: reportForm.items.map(item => ({
                sendId: item.sendId,
                observation: item.observation || ''
            })),
            generalObservation: reportForm.generalObservation,
            updatedAt: new Date().toISOString(),
            itemCount: reportForm.items.length
        };

        try {
            if (currentReportId) {
                await updateDoc(doc(db, "reports", currentReportId), dataToSave);

                // Manual state update for Edit
                setReports(prev => prev.map(r => r.firebaseId === currentReportId ? { ...r, ...dataToSave } : r));

                toast.success("Relatório atualizado!");
                stopScanner(); // Auto-stop scanner on update
                closeReportModal();
            } else {
                dataToSave.id = reportForm.displayId;
                dataToSave.createdAt = new Date().toISOString();
                const docRef = await addDoc(collection(db, "reports"), dataToSave);

                // Manual state update for Create
                const newReport = { ...dataToSave, firebaseId: docRef.id };
                setReports(prev => [newReport, ...prev]);

                toast.success("Relatório criado!");

                setLastSavedReport(newReport);
                stopScanner(); // Auto-stop scanner on create
                closeReportModal();
                setIsPrintConfirmOpen(true);
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            if (error.code === 'permission-denied') {
                toast.error("Erro de permissão. Verifique se você está logado.");
            } else {
                toast.error("Erro ao salvar relatório.");
            }
        }
    };

    const deleteReport = async () => {
        if (!currentReportId) return;
        try {
            await deleteDoc(doc(db, "reports", currentReportId));
            // Manual state update since we are using getDocs (no listener)
            setReports(prev => prev.filter(r => r.firebaseId !== currentReportId));

            toast.success("Relatório excluído.");
            setIsDeleteConfirmOpen(false);
            closeReportModal();
        } catch (error) {
            console.error("Erro ao excluir:", error);
            toast.error("Erro ao excluir relatório.");
        }
    };

    // Print
    const handlePrint = (report) => {
        const printDate = new Date(report.createdAt || report.updatedAt).toLocaleDateString('pt-BR');
        const printTime = new Date().toLocaleTimeString('pt-BR');

        let itemsHtml = '';
        if (report.items && report.items.length > 0) {
            itemsHtml = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
                    <thead>
                        <tr>
                            <th style="background:#f2f2f2; padding:10px; border:1px solid #ddd; text-align:left; width:5%;">#</th>
                            <th style="background:#f2f2f2; padding:10px; border:1px solid #ddd; text-align:left; width:55%;">ID de Envio</th>
                            <th style="background:#f2f2f2; padding:10px; border:1px solid #ddd; text-align:left; width:40%;">Observação</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.items.map((item, index) => `
                            <tr>
                                <td style="padding:8px 10px; border:1px solid #ddd;">${index + 1}</td>
                                <td style="padding:8px 10px; border:1px solid #ddd;">${item.sendId || 'N/A'}</td>
                                <td style="padding:8px 10px; border:1px solid #ddd;">${item.observation || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            itemsHtml = '<div style="text-align:center; padding:20px; color:#888;">Nenhum item.</div>';
        }

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Relatório - ${report.alias}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; color: #333; }
                        h1 { font-size: 24px; margin-bottom: 5px; }
                        .info { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
                        .obs { margin-top: 20px; padding: 15px; background: #f8f9fa; border-left: 4px solid #4a6cf7; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div style="text-align:center; border-bottom:2px solid #333; padding-bottom:20px; margin-bottom:20px;">
                        <h1>${report.alias}</h1>
                        <p>Sistema de Relatórios Flex</p>
                    </div>
                    <div class="info">
                        <p><strong>ID:</strong> ${report.id}</p>
                        <p><strong>Data:</strong> ${printDate}</p>
                        <p><strong>Total de Itens:</strong> ${report.items?.length || 0}</p>
                    </div>
                    ${itemsHtml}
                    <div class="obs">
                        <h3>Observação Geral</h3>
                        <p>${report.generalObservation || 'Nenhuma.'}</p>
                    </div>
                    <div style="margin-top:40px; text-align:center; font-style:italic; border-top:1px solid #ddd; padding-top:20px; font-size:12px;">
                        Impresso em ${printDate} às ${printTime}
                    </div>
                    <div class="no-print" style="text-align:center; margin-top:20px;">
                        <button onclick="window.print()" style="padding:10px 20px; background:#4a6cf7; color:white; border:none; cursor:pointer;">Imprimir</button>
                    </div>
                    <script>
                        window.onload = () => setTimeout(() => window.print(), 500);
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    // Filter Logic
    const filteredReports = reports.filter(r => {
        const matchesTerm = searchTerm === '' ||
            r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.items && r.items.some(i => i.sendId.toLowerCase().includes(searchTerm.toLowerCase())));

        let matchesDate = true;
        if (filterDate) {
            const rDate = new Date(r.createdAt);
            // Compare YYYY-MM-DD
            const rDateStr = rDate.toISOString().split('T')[0];
            if (rDateStr !== filterDate) matchesDate = false;
        }

        return matchesTerm && matchesDate;
    });

    return (
        <div className="flex-container">
            {/* Header / Controls */}
            {/* Header / Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="w-8 h-8 text-blue-600" />
                    Relatórios Flex
                </h1>
                <button
                    onClick={() => setIsPlatformModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <PlusCircle className="w-5 h-5" />
                    Novo Relatório
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Pesquisar ID, alias ou item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Data:</span>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="border border-gray-300 rounded text-sm p-1.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                        {(filterDate || searchTerm) && (
                            <button
                                className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterDate('');
                                }}
                                title="Limpar filtros"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-reports-container">
                <div className="flex-reports-header bg-gray-100 border-b-2 border-slate-200 text-gray-600 uppercase text-xs tracking-wider rounded-t-lg">
                    <div className="font-semibold py-4 border-r-2 border-white flex items-center">Data</div>
                    <div className="font-semibold py-4 border-r-2 border-white flex items-center justify-center">ID</div>
                    <div className="font-semibold py-4 border-r-2 border-white flex items-center pl-4">Alias</div>
                    <div className="font-semibold py-4 border-r-2 border-white flex items-center justify-center">Itens</div>
                    <div className="font-semibold py-4 flex items-center justify-center">Ações</div>
                </div>

                <div className="flex-reports-list">
                    {loading ? (
                        <div className="text-center p-8 text-blue-600">
                            <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent rounded-full mb-2"></div>
                            <p>Carregando...</p>
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">
                            <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                            <h3>Nenhum relatório encontrado</h3>
                            <p>Tente ajustar os filtros ou crie um novo.</p>
                        </div>
                    ) : (
                        filteredReports.map(report => (
                            <div key={report.firebaseId} className="flex-report-item">
                                <div className="text-sm text-gray-600">
                                    <span className="mobile-label">Data:</span>
                                    {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                                </div>
                                <div className="flex justify-center items-center w-full">
                                    <span className="mobile-label">ID:</span>
                                    <span className="flex-report-id">
                                        {report.id}
                                    </span>
                                </div>
                                <div className="font-semibold text-gray-800 truncate w-full pl-4">
                                    <span className="mobile-label">Alias:</span>
                                    {report.alias}
                                </div>
                                <div className="flex justify-center items-center w-full">
                                    <span className="mobile-label">Itens:</span>
                                    <span className="flex-report-items-count">
                                        {report.items?.length || 0}
                                    </span>
                                </div>
                                <div className="flex-report-actions !justify-center w-full">
                                    <button
                                        className={`flex-btn-icon ${report.generalObservation ? 'flex-btn-info' : 'bg-gray-200 text-gray-400 cursor-default'}`}
                                        onClick={() => {
                                            if (report.generalObservation) {
                                                setObservationViewData(report);
                                                setIsObservationModalOpen(true);
                                            }
                                        }}
                                        title="Ver Observação"
                                    >
                                        <MessageSquare size={16} />
                                    </button>
                                    <button
                                        className="flex-btn-icon flex-btn-warning"
                                        onClick={() => openEditReportModal(report)}
                                        title="Editar"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        className="flex-btn-icon flex-btn-info"
                                        onClick={() => handlePrint(report)}
                                        title="Imprimir"
                                    >
                                        <Printer size={16} />
                                    </button>
                                    <button
                                        className="flex-btn-icon flex-btn-danger"
                                        onClick={() => {
                                            setCurrentReportId(report.firebaseId);
                                            setIsDeleteConfirmOpen(true);
                                        }}
                                        title="Excluir"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal Edit/New */}
            {isModalOpen && (
                <div className="flex-modal">
                    <div className="flex-modal-content">
                        <div className="flex-modal-header">
                            <h2>
                                {currentReportId ? <Edit size={24} /> : <FilePlus size={24} />}
                                {currentReportId ? 'Editar Relatório' : 'Novo Relatório'}
                            </h2>
                            <button className="flex-close-modal" onClick={closeReportModal}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-modal-body">
                            {/* Top Row: Alias + Quick Scan */}
                            <div className="flex-alias-scanner-row">
                                <div className="flex-alias-container">
                                    <div className="flex-form-group">
                                        <label>Alias (Opcional)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={reportForm.alias}
                                                onChange={(e) => setReportForm(prev => ({ ...prev, alias: e.target.value }))}
                                                placeholder="Nomeie seu relatório"
                                            />
                                            <button
                                                className="bg-blue-50 text-blue-600 px-3 py-2 rounded hover:bg-blue-100 transition-colors"
                                                onClick={() => setReportForm(prev => ({ ...prev, alias: generateAutoAlias(selectedPlatform) }))}
                                                title="Gerar Alias"
                                            >
                                                <RefreshCw size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ID Input Section - New Layout */}
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-4">
                                <h3 className="flex items-center gap-2 mb-2 font-semibold text-gray-700 text-sm">
                                    <ScanBarcode size={16} className="text-blue-600" /> Adicionar ID
                                </h3>

                                <div className="flex flex-col gap-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={sendIdInput}
                                            onChange={(e) => setSendIdInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addItem(sendIdInput)}
                                            placeholder="Digite ou escaneie o ID..."
                                            className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        {sendIdInput && (
                                            <button
                                                onClick={() => setSendIdInput('')}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                            onClick={() => addItem(sendIdInput)}
                                        >
                                            <PlusCircle size={18} /> Adicionar ID
                                        </button>

                                        <button
                                            className={`p-3 rounded-lg border transition-colors ${isScannerActive
                                                ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                            onClick={toggleScanner}
                                            title={isScannerActive ? 'Parar Scanner' : 'Abrir Câmera'}
                                        >
                                            {isScannerActive ? <StopCircle size={20} /> : <ScanBarcode size={20} />}
                                        </button>

                                        {isScannerActive && cameras.length > 1 && (
                                            <button
                                                className="p-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors"
                                                onClick={toggleCamera}
                                                title="Alternar Câmera"
                                            >
                                                <RefreshCw size={20} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="ml-label"
                                        checked={useMlLabel}
                                        onChange={(e) => setUseMlLabel(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="ml-label" className="text-xs text-gray-600 cursor-pointer select-none">Extrair ID de etiqueta ML (JSON)</label>
                                </div>
                            </div>

                            {/* Scanner View */}
                            <div
                                className="mb-4 overflow-hidden rounded-xl bg-black relative"
                                style={{ display: isScannerActive ? 'block' : 'none', minHeight: '300px' }}
                            >
                                <div id="reader-flex" className="w-full h-full"></div>
                                <p className="text-center text-white py-2 text-sm bg-black font-semibold absolute bottom-0 left-0 w-full opacity-70 border-t border-white/20">
                                    Escaneando...
                                </p>
                            </div>

                            {/* Items List */}
                            <div className="flex-items-list mb-6">
                                <h3 className="flex items-center gap-2 mb-3 font-semibold text-gray-700">
                                    <List size={18} /> Itens do Relatório
                                    <span className="ml-auto bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-sm">
                                        {reportForm.items.length}
                                    </span>
                                </h3>
                                <div className="max-h-60 overflow-auto border rounded-lg">
                                    <table className="flex-items-table mb-0">
                                        <thead className="bg-gray-100 border-b-2 border-slate-200">
                                            <tr>
                                                <th width="40%" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-white">ID</th>
                                                <th width="50%" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-white">Observação</th>
                                                <th width="10%" className="px-4 py-3 text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportForm.items.length === 0 ? (
                                                <tr>
                                                    <td colSpan="3" className="text-center p-4 text-gray-500">
                                                        Nenhum item adicionado.
                                                    </td>
                                                </tr>
                                            ) : (
                                                reportForm.items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="font-mono text-sm">{item.sendId}</td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                value={item.observation}
                                                                onChange={(e) => updateItemObservation(idx, e.target.value)}
                                                                className="w-full text-sm border-gray-200 rounded p-1"
                                                                placeholder="Obs..."
                                                            />
                                                        </td>
                                                        <td className="text-center">
                                                            <button
                                                                onClick={() => removeItem(idx)}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* General Observation */}
                            <div className="flex-form-group">
                                <label>Observação Geral</label>
                                <textarea
                                    value={reportForm.generalObservation}
                                    onChange={(e) => setReportForm(prev => ({ ...prev, generalObservation: e.target.value }))}
                                    placeholder="Observações do relatório..."
                                ></textarea>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    onClick={closeReportModal}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-70"
                                    onClick={saveReport}
                                >
                                    <Save size={18} /> Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Modal View Observation */}
            {
                isObservationModalOpen && observationViewData && (
                    <div className="flex-modal">
                        <div className="flex-modal-content" style={{ maxWidth: '500px' }}>
                            <div className="flex-modal-header">
                                <h2><MessageSquare size={20} /> Observação</h2>
                                <button className="flex-close-modal" onClick={() => setIsObservationModalOpen(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex-modal-body">
                                <h3 className="font-bold mb-2">{observationViewData.alias}</h3>
                                <div className="bg-gray-50 p-4 rounded-lg text-gray-700 whitespace-pre-wrap">
                                    {observationViewData.generalObservation}
                                </div>
                                <div className="mt-4 text-right">
                                    <button
                                        className="flex-btn flex-btn-secondary"
                                        onClick={() => setIsObservationModalOpen(false)}
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={deleteReport}
                title="Excluir Relatório?"
                message="Esta ação não pode ser desfeita."
                confirmText="Sim, Excluir"
                variant="danger"
                icon={Trash2}
            />

            <ConfirmationModal
                isOpen={isPrintConfirmOpen}
                onClose={() => setIsPrintConfirmOpen(false)}
                onConfirm={() => {
                    handlePrint(lastSavedReport);
                    setIsPrintConfirmOpen(false);
                }}
                title="Salvo com Sucesso!"
                message="Deseja imprimir este relatório agora?"
                confirmText="Imprimir"
                cancelText="Agora não"
                variant="info"
                icon={CheckCircle}
            />

            {/* Modal de Seleção de Plataforma (Amazon / Mercado Livre) */}
            {isPlatformModalOpen && (
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsPlatformModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <FilePlus size={22} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg leading-tight">Novo Relatório</h3>
                                    <p className="text-xs text-gray-500">Selecione o canal para iniciar</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPlatformModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Fechar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4 text-center font-medium">
                                Escolha a opção desejada para gerar o alias automaticamente:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Opção Amazon */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectPlatform('amazon')}
                                    className="flex flex-col items-center justify-center p-5 border-2 border-amber-200 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-500 rounded-2xl transition-all duration-200 group text-center cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-200 shadow-inner">
                                        <ShoppingBag size={28} />
                                    </div>
                                    <span className="font-bold text-gray-800 text-base mb-1 group-hover:text-amber-800">
                                        Amazon
                                    </span>
                                    <span className="text-xs font-semibold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                                        Alias: Amz_...
                                    </span>
                                </button>

                                {/* Opção Mercado Livre */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectPlatform('ml')}
                                    className="flex flex-col items-center justify-center p-5 border-2 border-yellow-200 bg-yellow-50/40 hover:bg-yellow-50 hover:border-yellow-500 rounded-2xl transition-all duration-200 group text-center cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-yellow-100 text-yellow-800 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-yellow-400 group-hover:text-gray-900 transition-all duration-200 shadow-inner">
                                        <Truck size={28} />
                                    </div>
                                    <span className="font-bold text-gray-800 text-base mb-1 group-hover:text-yellow-900">
                                        Mercado Livre
                                    </span>
                                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                                        Alias: Flex_...
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsPlatformModalOpen(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Flex;
