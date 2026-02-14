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
    CheckCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
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
                scannerRef.current.stop().catch(err => console.error("Error stopping scanner on cleanup:", err));
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

    const generateAutoAlias = () => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `Relatório_Flex_${day}${month}${year}${hours}${minutes}`;
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
    const openNewReportModal = () => {
        setReportForm({
            alias: generateAutoAlias(),
            generalObservation: '',
            items: [],
            displayId: generateReportId()
        });
        setCurrentReportId(null);
        setIsModalOpen(true);
        setUseMlLabel(true);
    };

    const openEditReportModal = (report) => {
        setReportForm({
            alias: report.alias,
            generalObservation: report.generalObservation || '',
            items: report.items || [],
            displayId: report.id
        });
        setCurrentReportId(report.firebaseId);
        setIsModalOpen(true);
        setUseMlLabel(true);
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

        // 1. Enable scanner UI first so "reader" element is rendered
        setIsScannerActive(true);

        // 2. Wait for DOM update
        await new Promise(r => setTimeout(r, 450));

        const readerElement = document.getElementById("reader");
        if (!readerElement) {
            console.error("Reader element not found after activation");
            setIsScannerActive(false);
            return;
        }

        try {
            const html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;

            // Get cameras to populate the list for toggle
            const devices = await Html5Qrcode.getCameras();
            setCameras(devices);

            let selectedCameraId = currentCameraId;
            if (!selectedCameraId && devices.length > 0) {
                const backCamera = devices.find(device =>
                    device.label.toLowerCase().includes('back') ||
                    device.label.toLowerCase().includes('traseira') ||
                    device.label.toLowerCase().includes('rear')
                );
                selectedCameraId = backCamera ? backCamera.id : devices[0].id;
                setCurrentCameraId(selectedCameraId);
            }

            if (!selectedCameraId && devices.length === 0) {
                // Try fallback to device orientation if ID not found but we can request environment
                selectedCameraId = { facingMode: "environment" };
            }

            const config = {
                fps: 20,
                qrbox: { width: 300, height: 150 },
                aspectRatio: 1.0,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            };

            await html5QrCode.start(
                selectedCameraId || { facingMode: "environment" },
                config,
                (decodedText) => {
                    if (isProcessingRef.current) return;
                    isProcessingRef.current = true;

                    playSound('success');
                    addItem(decodedText);
                    toast.success("Código lido!");

                    setTimeout(() => { isProcessingRef.current = false; }, 1500);
                },
                (errorMessage) => {
                    // console.log("Scanning...", errorMessage);
                }
            );

        } catch (err) {
            console.error("Erro ao iniciar scanner:", err);
            toast.error("Não foi possível acessar a câmera ou permissão negada.");
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

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current = null;
            } catch (err) {
                console.error("Erro ao parar scanner:", err);
            }
        }
        setIsScannerActive(false);
    };

    // Auto-stop on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(err => console.error("Unmount cleanup error:", err));
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
            alias: reportForm.alias || generateAutoAlias(),
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
                setReports(prev => prev.map(r => r.firebaseId === currentReportId ? { ...dataToSave, firebaseId: currentReportId } : r));

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
                    onClick={openNewReportModal}
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
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
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
                <div className="flex-reports-header">
                    <div>Data</div>
                    <div>ID</div>
                    <div>Alias</div>
                    <div>Itens</div>
                    <div>Ações</div>
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
                                <div className="flex-report-id">
                                    <span className="mobile-label">ID:</span>
                                    {report.id}
                                </div>
                                <div className="font-semibold text-gray-800 truncate w-full">
                                    <span className="mobile-label">Alias:</span>
                                    {report.alias}
                                </div>
                                <div>
                                    <span className="mobile-label">Itens:</span>
                                    <span className="flex-report-items-count">
                                        {report.items?.length || 0} itens
                                    </span>
                                </div>
                                <div className="flex-report-actions">
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
                                                onClick={() => setReportForm(prev => ({ ...prev, alias: generateAutoAlias() }))}
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
                                    <input
                                        type="text"
                                        value={sendIdInput}
                                        onChange={(e) => setSendIdInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addItem(sendIdInput)}
                                        placeholder="Digite ou escaneie o ID..."
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />

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
                                id="reader"
                                className="mb-4 overflow-hidden rounded-xl bg-black relative"
                                style={{ display: isScannerActive ? 'block' : 'none', minHeight: '300px' }}
                            >
                                {/* Visual Overlay */}
                                <div className="scanner-overlay-container">
                                    <div className="scanner-box">
                                        <div className="scanner-corner-tl"></div>
                                        <div className="scanner-corner-tr"></div>
                                        <div className="scanner-corner-bl"></div>
                                        <div className="scanner-corner-br"></div>
                                        <div className="scanning-line"></div>
                                        <p className="scanner-hint">Aponte para o código</p>
                                    </div>
                                </div>

                                {/* html5-qrcode will inject its own video here */}
                                <p className="text-center text-white py-2 text-sm bg-black font-semibold absolute bottom-0 left-0 w-full opacity-70 z-10">
                                    Escaneando...
                                </p>
                            </div>

                            {/* Items List */}
                            <div className="flex-items-list mb-6">
                                <h3 className="flex items-center gap-2 mb-3 font-semibold text-gray-700">
                                    <List size={18} /> Itens do Relatório
                                    <span className="ml-auto bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-sm">
                                        {reportForm.items.length} {reportForm.items.length === 1 ? 'item' : 'itens'}
                                    </span>
                                </h3>
                                <div className="max-h-60 overflow-auto border rounded-lg">
                                    <table className="flex-items-table mb-0">
                                        <thead>
                                            <tr>
                                                <th width="40%">ID</th>
                                                <th width="50%">Observação</th>
                                                <th width="10%"></th>
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
                                    <Save size={18} /> Salvar Relatório
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

            {/* Confirm Delete */}
            {
                isDeleteConfirmOpen && (
                    <div className="flex-modal">
                        <div className="bg-white p-6 rounded-lg max-w-sm w-full text-center shadow-xl">
                            <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold mb-2">Excluir Relatório?</h3>
                            <p className="text-gray-600 mb-6">Esta ação não pode ser desfeita.</p>
                            <div className="flex gap-3 justify-center">
                                <button className="flex-btn flex-btn-danger" onClick={deleteReport}>Sim, Excluir</button>
                                <button className="flex-btn flex-btn-secondary" onClick={() => setIsDeleteConfirmOpen(false)}>Cancelar</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Confirm Print After Save */}
            {
                isPrintConfirmOpen && lastSavedReport && (
                    <div className="flex-modal">
                        <div className="bg-white p-6 rounded-lg max-w-sm w-full text-center shadow-xl">
                            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold mb-2">Salvo com Sucesso!</h3>
                            <p className="text-gray-600 mb-6">Deseja imprimir agora?</p>
                            <div className="flex gap-3 justify-center">
                                <button className="flex-btn flex-btn-info" onClick={() => {
                                    handlePrint(lastSavedReport);
                                    setIsPrintConfirmOpen(false);
                                }}>
                                    <Printer size={18} /> Imprimir
                                </button>
                                <button className="flex-btn flex-btn-secondary" onClick={() => setIsPrintConfirmOpen(false)}>
                                    Agora não
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Flex;
