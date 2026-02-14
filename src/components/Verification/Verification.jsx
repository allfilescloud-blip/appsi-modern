import { useState, useRef, useEffect } from 'react';
import { getOrder } from '../../services/ideris';
import { toast } from 'react-toastify';
import { Search, CheckCircle, XCircle, Package, Camera, Printer, Trash2, Globe, WifiOff, ScanBarcode, StopCircle, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

export default function Verification() {
    const [inputCode, setInputCode] = useState('');
    const [loading, setLoading] = useState(false);

    // localMode = false => Ideris API (Default)
    // localMode = true => Modo Local
    const [localMode, setLocalMode] = useState(false);
    const [verifiedList, setVerifiedList] = useState([]);
    const [lastResult, setLastResult] = useState(null);

    // Scanner State
    const [isScannerActive, setIsScannerActive] = useState(false);
    const [cameras, setCameras] = useState([]);
    const [currentCameraId, setCurrentCameraId] = useState(null);

    const scannerRef = useRef(null);
    const inputRef = useRef(null);
    const isProcessingRef = useRef(false);

    const verifiedListRef = useRef(verifiedList);
    useEffect(() => {
        verifiedListRef.current = verifiedList;
    }, [verifiedList]);

    useEffect(() => {
        // Focus input unless scanner is active (to avoid keyboard popping up on mobile while scanning)
        if (!isScannerActive) {
            inputRef.current?.focus();
        }

        return () => {
            // No action needed here as we have separate cleanup
        };
        // REMOVED verifiedList and lastResult from dependencies
    }, [isScannerActive]);

    // cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(err => console.error("Cleanup error:", err));
                scannerRef.current = null;
            }
        }
    }, [])

    const playSound = (type) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
        } else if (type === 'error') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.linearRampToValueAtTime(100, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        }
    };

    const handleSearch = async (e, codeOverride = null) => {
        if (e) e.preventDefault();
        const code = codeOverride || inputCode.trim();
        if (!code) return 'empty'; // Return status

        // 1. Check for Duplicates (Local Check)
        const isDuplicate = verifiedListRef.current.some(item => item.code === code);
        if (isDuplicate) {
            const result = {
                code,
                status: 'DUPLICADO',
                type: 'error',
                timestamp: new Date(),
                img: null
            };
            setLastResult(result);
            setVerifiedList(prev => [result, ...prev]);
            toast.warn(`Código ${code} já foi verificado!`);
            playSound('error');
            setInputCode('');
            return 'duplicate'; // Return status
        }

        // 2. Local Mode (No API)
        if (localMode) {
            const result = {
                code,
                status: 'Conferido',
                type: 'success',
                timestamp: new Date(),
                img: null
            };
            setLastResult(result);
            setVerifiedList(prev => [result, ...prev]);
            toast.success(`Código ${code} conferido.`);
            playSound('success');
            setInputCode('');
            return 'success'; // Return status
        }

        // 3. API Verification
        setLoading(true);
        try {
            const data = await getOrder(code);
            const statusDesc = data.statusDescription || data.status || 'Encontrado';
            const isCancelled = statusDesc.toLowerCase().includes('cancelado') || statusDesc.toLowerCase().includes('erro');

            const result = {
                code,
                status: statusDesc,
                type: isCancelled ? 'error' : 'success',
                timestamp: new Date(),
                customer: data.customer?.name,
                img: data.items?.[0]?.image
            };

            setLastResult(result);
            setVerifiedList(prev => [result, ...prev]);

            if (isCancelled) {
                toast.error(`Pedido ${code}: ${statusDesc}`);
                playSound('error');
                return 'error'; // Return status
            } else {
                toast.success(`Pedido ${code} verificado!`);
                playSound('success');
                return 'success'; // Return status
            }

        } catch (error) {
            const result = {
                code,
                status: 'Não encontrado / Erro',
                type: 'error',
                timestamp: new Date(),
                img: null
            };
            setLastResult(result);
            setVerifiedList(prev => [result, ...prev]);
            toast.error(error.message);
            playSound('error');
            return 'error'; // Return status
        } finally {
            setLoading(false);
            setInputCode('');
            // Return cursor to field if not using camera scanner
            if (!isScannerActive) {
                setTimeout(() => {
                    inputRef.current?.focus();
                }, 100);
            }
        }
    };

    const handleRemoveItem = (indexToRemove) => {
        if (window.confirm("Remover este item da lista?")) {
            setVerifiedList(prev => prev.filter((_, idx) => idx !== indexToRemove));
            toast.info("Item removido.");
        }
    };

    const handleClear = () => {
        if (window.confirm("Tem certeza que deseja limpar todo o histórico de verificação?")) {
            setVerifiedList([]);
            setLastResult(null);
            setInputCode('');
            toast.info("Histórico limpo.");
            inputRef.current?.focus();
        }
    };

    const startScanner = async () => {
        if (isScannerActive) stopScanner();

        // 1. Enable scanner UI first
        setIsScannerActive(true);

        // 2. Wait for DOM update
        await new Promise(r => setTimeout(r, 450));

        const readerElement = document.getElementById("reader-v");
        if (!readerElement) {
            console.error("Reader element not found");
            setIsScannerActive(false);
            return;
        }

        try {
            const html5QrCode = new Html5Qrcode("reader-v");
            scannerRef.current = html5QrCode;

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
                async (decodedText) => {
                    if (isProcessingRef.current) return;
                    isProcessingRef.current = true;

                    playSound('success');

                    try {
                        await handleSearch(null, decodedText);
                        stopScanner();
                    } finally {
                        setTimeout(() => { isProcessingRef.current = false; }, 1500);
                    }
                },
                (errorMessage) => {
                    // skip error
                }
            );

        } catch (err) {
            console.error("Erro ao iniciar scanner:", err);
            toast.error("Não foi possível acessar a câmera.");
            setIsScannerActive(false);
        }
    };

    // handleImageUpload removido (conforme solicitado)

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

    const handlePrint = () => {
        window.print();
    };

    const codeCounts = verifiedList.reduce((acc, item) => {
        acc[item.code] = (acc[item.code] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            {/* Screen Content - Hidden when printing */}
            <div className="print:hidden space-y-6">
                {/* Header / Top Controls */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <CheckCircle className="w-8 h-8 text-blue-600" />
                        Verificação
                    </h1>

                    <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!localMode} // Checked = API Mode (localMode false)
                                    onChange={(e) => setLocalMode(!e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                <span className="ml-3 text-sm font-bold text-gray-700 flex items-center gap-2">
                                    {!localMode ? (
                                        <>
                                            <Globe className="w-4 h-4 text-blue-600" />
                                            Ideris API
                                        </>
                                    ) : (
                                        <>
                                            <WifiOff className="w-4 h-4 text-gray-500" />
                                            Modo Local
                                        </>
                                    )}
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Input & Call to Action Area */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value)}
                                placeholder="Bipe ou digite o código..."
                                className="w-full pl-10 pr-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={loading || !inputCode.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm hover:shadow transition-all disabled:opacity-70 flex-1 md:flex-none"
                            >
                                {loading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : 'Verificar'}
                            </button>

                            <button
                                type="button"
                                onClick={toggleScanner}
                                className={`p-3 rounded-lg border transition-colors ${isScannerActive
                                    ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                title={isScannerActive ? 'Parar Scanner' : 'Abrir Câmera'}
                            >
                                {isScannerActive ? <StopCircle size={20} /> : <ScanBarcode size={20} />}
                            </button>

                            {isScannerActive && cameras.length > 1 && (
                                <button
                                    type="button"
                                    onClick={toggleCamera}
                                    className="p-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors"
                                    title="Alternar Câmera"
                                >
                                    <RefreshCw size={20} />
                                </button>
                            )}
                        </div>
                    </form>

                    {/* Scanner View */}
                    {isScannerActive && (
                        <div id="reader-v" className="mt-4 overflow-hidden rounded-xl bg-black relative" style={{ minHeight: '300px' }}>
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

                            <p className="text-center text-white py-2 text-sm bg-black font-semibold absolute bottom-0 left-0 w-full opacity-70 z-10">
                                Escaneando...
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            onClick={handlePrint}
                            className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                        >
                            <Printer className="w-4 h-4" /> Imprimir Lista
                        </button>
                        <button
                            onClick={handleClear}
                            className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" /> Limpar Tudo
                        </button>
                    </div>
                </div>

                {/* Highlight Section (Last Result) */}
                {lastResult && (
                    <div className={`rounded-xl shadow-lg border-l-8 p-6 animate-fade-in ${lastResult.type === 'success' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
                        }`}>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="text-center md:text-left">
                                <p className="text-sm font-bold opacity-60 uppercase mb-1">Última Verificação</p>
                                <h2 className="text-4xl font-black tracking-tight text-gray-900">{lastResult.code}</h2>
                                <p className={`text-2xl font-bold mt-2 ${lastResult.type === 'success' ? 'text-green-700' : 'text-red-600'
                                    }`}>
                                    {lastResult.status}
                                </p>
                                {lastResult.customer && (
                                    <p className="text-gray-600 mt-1 font-medium">{lastResult.customer}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-4">
                                {lastResult.type === 'success' ? (
                                    <CheckCircle className="w-24 h-24 text-green-500 opacity-20" />
                                ) : (
                                    <XCircle className="w-24 h-24 text-red-500 opacity-20" />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* List Section */}
                {verifiedList.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print-visible">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700">Histórico ({verifiedList.length})</h3>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                                    <tr>
                                        <th className="px-6 py-3 text-left w-20">#</th>
                                        <th className="px-6 py-3 text-left">Hora</th>
                                        <th className="px-6 py-3 text-left">Código</th>
                                        <th className="px-6 py-3 text-left">Cliente</th>
                                        <th className="px-6 py-3 text-left">Status</th>
                                        <th className="px-6 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {verifiedList.map((item, idx) => {
                                        const isDuplicate = codeCounts[item.code] > 1;
                                        const itemNumber = verifiedList.length - idx;

                                        let rowClass = "hover:bg-gray-50";

                                        // 1. Error/Duplicate Item gets Red Background
                                        if (item.type === 'error') {
                                            rowClass += " bg-red-50 hover:bg-red-100";
                                        }

                                        // 2. Duplicate Border Logic
                                        const borderClass = isDuplicate ? "border-l-4 border-red-500" : "border-l-4 border-transparent";

                                        return (
                                            <tr key={idx} className={rowClass}>
                                                <td className={`px-6 py-3 text-sm font-bold text-gray-400 w-16 ${borderClass}`}>
                                                    #{itemNumber}
                                                </td>
                                                <td className="px-6 py-3 text-sm text-gray-500">
                                                    {item.timestamp.toLocaleTimeString('pt-BR')}
                                                </td>
                                                <td className="px-6 py-3 font-bold text-gray-900">{item.code}</td>
                                                <td className="px-6 py-3 text-sm text-gray-600">{item.customer || '-'}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${item.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <button
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="text-gray-400 hover:text-red-500 p-2 rounded transition-colors"
                                                        title="Remover item"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-gray-200">
                            {verifiedList.map((item, idx) => {
                                const isDuplicate = codeCounts[item.code] > 1;
                                const itemNumber = verifiedList.length - idx;

                                let cardClass = "p-4 transition-colors duration-150 relative";
                                if (item.type === 'error') {
                                    cardClass += " bg-red-50";
                                } else {
                                    cardClass += " bg-white";
                                }

                                if (isDuplicate) {
                                    cardClass += " border-l-4 border-red-500";
                                }

                                return (
                                    <div key={idx} className={cardClass}>
                                        <div className="flex justify-between items-start">
                                            {/* Left Column: Details */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-bold text-gray-400">#{itemNumber}</span>
                                                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                        {item.timestamp.toLocaleTimeString('pt-BR')}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${item.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                </div>

                                                <div>
                                                    <p className="text-xl font-bold text-gray-900 break-all">{item.code}</p>
                                                    {item.customer && <p className="text-sm text-gray-600 line-clamp-1">{item.customer}</p>}
                                                </div>
                                            </div>

                                            {/* Right Column: Icons (Trash + Status) */}
                                            <div className="flex flex-col items-end gap-3 ml-4">
                                                <button
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="text-gray-400 hover:text-red-500 p-1"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>

                                                {item.type === 'success' ? (
                                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                                ) : (
                                                    <XCircle className="w-6 h-6 text-red-500" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Print Layout - Unchanged */}
            <div className="hidden print:block p-8 bg-white text-black bg-white">
                <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wide">Relatório de Conferência</h1>
                        <p className="text-lg mt-1">{new Date().toLocaleDateString('pt-BR')} - {new Date().toLocaleTimeString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold uppercase">Total de Itens</p>
                        <p className="text-4xl font-black">{verifiedList.length}</p>
                    </div>
                </div>

                <table className="w-full text-sm border-collapse mb-8">
                    <thead>
                        <tr className="border-b-2 border-black">
                            <th className="text-left py-2 px-3 font-bold uppercase w-16">#</th>
                            <th className="text-left py-2 px-3 font-bold uppercase w-32">Hora</th>
                            <th className="text-left py-2 px-3 font-bold uppercase">Código</th>
                            <th className="text-left py-2 px-3 font-bold uppercase w-40">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...verifiedList].reverse().map((item, idx) => (
                            <tr key={idx} className={`border-b border-gray-300 ${idx % 2 === 0 ? 'bg-gray-100' : 'bg-white'}`}>
                                <td className="py-3 px-3 text-gray-700">{idx + 1}</td>
                                <td className="py-3 px-3 font-mono">{item.timestamp.toLocaleTimeString('pt-BR')}</td>
                                <td className="py-3 px-3 font-bold text-lg">{item.code}</td>
                                <td className="py-3 px-3 uppercase font-medium">{item.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex flex-col items-center justify-center mt-20 pt-10">
                    <div className="w-96 border-b-2 border-black mb-3"></div>
                    <p className="text-sm uppercase font-bold tracking-wider">Assinatura do Responsável</p>
                </div>
            </div>
        </div>
    );
}
