import React, { useState, useEffect, useRef } from 'react';
import { db, storage, auth } from '../../services/firebase';
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
    getDocs,
    where,
    serverTimestamp
} from 'firebase/firestore';
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
    AlertTriangle,
    Upload,
    Search,
    Plus,
    FileText,
    Eye,
    Edit,
    Trash2,
    X,
    Save,
    Image as ImageIcon,
    Loader,
    MoreVertical
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function Support() {
    const { userData } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals state
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Selected record for View/Edit
    const [currentRecord, setCurrentRecord] = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        location: '',
        description: '',
        correction: '',
        notes: ''
    });

    // Image Upload State
    const [selectedImages, setSelectedImages] = useState([]); // { file, url, name, size, isExisting }
    const fileInputRef = useRef(null);
    const MAX_IMAGES = 3;
    const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

    // Fetch Records
    useEffect(() => {
        const q = query(
            collection(db, 'erros_suporte'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedRecords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecords(fetchedRecords);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching records:", error);
            toast.error("Erro ao carregar registros.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filter Records
    const filteredRecords = records.filter(record => {
        const term = searchTerm.toLowerCase();
        return (
            (record.code?.toLowerCase() || '').includes(term) ||
            (record.description?.toLowerCase() || '').includes(term) ||
            (record.location?.toLowerCase() || '').includes(term)
        );
    });

    // --- Actions ---

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const openNewRecordModal = async () => {
        setFormData({
            code: 'Gerando...',
            location: '',
            description: '',
            correction: '',
            notes: ''
        });
        setSelectedImages([]);
        setCurrentRecord(null);
        setIsFormModalOpen(true);

        // Generate Code immediately for UI feedback
        const newCode = await generateAutoCode();
        setFormData(prev => ({ ...prev, code: newCode }));
    };

    const openEditModal = (record) => {
        setCurrentRecord(record);
        setFormData({
            code: record.code,
            location: record.location || '',
            description: record.description || '',
            correction: record.correction || '',
            notes: record.notes || ''
        });

        // Load existing images
        if (record.imagens && record.imagens.length > 0) {
            setSelectedImages(record.imagens.map(img => ({
                ...img,
                isExisting: true
            })));
        } else {
            setSelectedImages([]);
        }

        setIsFormModalOpen(true);
    };

    const openViewModal = (record) => {
        setCurrentRecord(record);
        setIsViewModalOpen(true);
    };

    const generateAutoCode = async () => {
        try {
            const q = query(collection(db, 'erros_suporte'), orderBy('code', 'desc'), limit(1));
            const querySnapshot = await getDocs(q);

            let nextNum = 1;
            if (!querySnapshot.empty) {
                const lastCode = querySnapshot.docs[0].data().code;
                if (lastCode && lastCode.startsWith('ERR')) {
                    const numPart = lastCode.substring(3);
                    const parsed = parseInt(numPart, 10);
                    if (!isNaN(parsed)) nextNum = parsed + 1;
                }
            }
            return `ERR${String(nextNum).padStart(4, '0')}`;
        } catch (error) {
            console.error("Error generating code:", error);
            return `ERR${Date.now().toString().slice(-4)}`; // Fallback
        }
    };

    // --- Image Handling ---

    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const validFiles = [];
        let errorMsg = '';

        if (selectedImages.length + files.length > MAX_IMAGES) {
            toast.error(`Máximo de ${MAX_IMAGES} imagens permitidas.`);
            return;
        }

        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                errorMsg = 'Apenas imagens são permitidas.';
            } else if (file.size > MAX_IMAGE_SIZE) {
                errorMsg = 'Imagem muito grande (max 2MB).';
            } else {
                validFiles.push(file);
            }
        });

        if (errorMsg) {
            toast.error(errorMsg);
        }

        const newImages = validFiles.map(file => ({
            file,
            url: URL.createObjectURL(file), // Preview URL
            name: file.name,
            size: file.size,
            isExisting: false
        }));

        setSelectedImages(prev => [...prev, ...newImages]);
        e.target.value = ''; // Reset input
    };

    const removeImage = (index) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
    };

    const uploadImagesToStorage = async (recordId, imagesToUpload) => {
        const uploadedImages = [];

        for (const img of imagesToUpload) {
            if (img.isExisting) {
                uploadedImages.push(img); // Keep existing
                continue;
            }

            try {
                const ext = img.name.split('.').pop();
                const fileName = `suporte/${recordId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
                const storageRef = ref(storage, fileName);

                const snapshot = await uploadBytes(storageRef, img.file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                uploadedImages.push({
                    nome: img.name,
                    url: downloadURL,
                    caminho: fileName, // Important for deletion later
                    tamanho: img.size
                });
            } catch (error) {
                console.error(`Error uploading ${img.name}:`, error);
                toast.error(`Erro ao enviar imagem ${img.name}`);
            }
        }
        return uploadedImages;
    };

    const deleteImagesFromStorage = async (imagesToDelete) => {
        for (const img of imagesToDelete) {
            if (img.caminho) {
                try {
                    const storageRef = ref(storage, img.caminho);
                    await deleteObject(storageRef);
                } catch (error) {
                    console.error("Error deleting image from storage:", error);
                }
            }
        }
    };

    // --- CRUD ---

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            let recordId = currentRecord?.id;
            let finalCode = formData.code;

            if (!currentRecord) {
                // Determine ID and Code if new
                // Forcing code check again to avoid duplicates if multiple users create at same time would be ideal, 
                // but relying on initial generation for simplicity now as per legacy.
                const docRef = await addDoc(collection(db, 'erros_suporte'), {
                    // Temporary data to reserve ID
                    createdAt: new Date().toISOString(),
                    loading: true
                });
                recordId = docRef.id;
            }

            // Handle Images
            // 1. Identify removed images (if editing)
            if (currentRecord && currentRecord.imagens) {
                const removedImages = currentRecord.imagens.filter(oldImg =>
                    !selectedImages.some(newImg => newImg.url === oldImg.url)
                );
                if (removedImages.length > 0) {
                    await deleteImagesFromStorage(removedImages);
                }
            }

            // 2. Upload new images
            const finalImages = await uploadImagesToStorage(recordId, selectedImages);

            const recordData = {
                code: finalCode,
                location: formData.location,
                description: formData.description,
                correction: formData.correction,
                notes: formData.notes,
                imagens: finalImages,
                updatedAt: new Date().toISOString(),
                userId: auth.currentUser?.uid || 'unknown'
            };

            if (!currentRecord) {
                // Update the new doc with actual data
                recordData.createdAt = new Date().toISOString(); // Ensure creation time
                await updateDoc(doc(db, 'erros_suporte', recordId), recordData);
                toast.success("Registro criado com sucesso!");
            } else {
                await updateDoc(doc(db, 'erros_suporte', recordId), recordData);
                toast.success("Registro atualizado com sucesso!");
            }

            setIsFormModalOpen(false);
        } catch (error) {
            console.error("Error saving record:", error);
            toast.error("Erro ao salvar registro: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (record) => {
        const result = await Swal.fire({
            title: 'Tem certeza?',
            text: "Você não poderá reverter isso!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, excluir!',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                // Delete images first
                if (record.imagens && record.imagens.length > 0) {
                    await deleteImagesFromStorage(record.imagens);
                }

                await deleteDoc(doc(db, 'erros_suporte', record.id));
                toast.success("Registro excluído.");
                if (isViewModalOpen) setIsViewModalOpen(false);
            } catch (error) {
                console.error("Error deleting:", error);
                toast.error("Erro ao excluir registro.");
            }
        }
    };

    // --- Render Helpers ---

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('pt-BR');
    };

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-orange-500" />
                        Registro de Erros
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Gerenciamento e rastreamento de erros operacionais
                    </p>
                </div>

                <button
                    onClick={openNewRecordModal}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-sm w-full md:w-auto justify-center"
                >
                    <Plus size={20} />
                    Novo Registro
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar por código, local ou descrição..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
            ) : filteredRecords.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-gray-100 rounded-full">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Nenhum registro encontrado</h3>
                    <p className="text-gray-500 mt-1 max-w-sm mx-auto">
                        {searchTerm
                            ? `Não encontramos resultados para "${searchTerm}"`
                            : "Nenhum erro registrado ainda. Clique em 'Novo Registro' para começar."}
                    </p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                                        <th className="px-6 py-4 w-24">Código</th>
                                        <th className="px-6 py-4 w-48">Local</th>
                                        <th className="px-6 py-4">Descrição do Erro</th>
                                        <th className="px-6 py-4">Correção</th>
                                        <th className="px-6 py-4 text-right w-32">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredRecords.map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    {record.code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                                                {record.location || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <div className="line-clamp-2 max-w-md" title={record.description}>
                                                    {record.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <div className="line-clamp-2 max-w-md" title={record.correction}>
                                                    {record.correction}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openViewModal(record)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Visualizar"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(record)}
                                                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(record)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden grid gap-4">
                        {filteredRecords.map((record) => (
                            <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        {record.code}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openViewModal(record)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={() => openEditModal(record)}
                                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(record)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs text-gray-400 uppercase font-semibold">Local</span>
                                        <p className="text-sm font-medium text-gray-800">{record.location || 'Não informado'}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 uppercase font-semibold">Descrição</span>
                                        <p className="text-sm text-gray-600 line-clamp-2">{record.description}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 uppercase font-semibold">Correção</span>
                                        <p className="text-sm text-gray-600 line-clamp-2">{record.correction || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Form Modal (Add/Edit) */}
            {isFormModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                {currentRecord ? <Edit className="text-blue-600" size={24} /> : <Plus className="text-blue-600" size={24} />}
                                {currentRecord ? 'Editar Registro' : 'Novo Registro'}
                            </h2>
                            <button
                                onClick={() => setIsFormModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                                    <input
                                        type="text"
                                        className={`w-full p-2.5 border rounded-lg font-mono focus:outline-none ${currentRecord
                                            ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                                            : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'
                                            }`}
                                        value={formData.code}
                                        onChange={(e) => !currentRecord && setFormData({ ...formData, code: e.target.value })}
                                        readOnly={!!currentRecord}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        {currentRecord ? 'Gerado automaticamente' : 'Gerado automaticamente (editável)'}
                                    </p>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Local / Módulo</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Página de Login, Estoque, etc."
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Erro</label>
                                <textarea
                                    required
                                    rows="3"
                                    placeholder="Descreva o erro detalhadamente..."
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Correção Aplicada</label>
                                <textarea
                                    rows="2"
                                    placeholder="O que foi feito para corrigir? (Opcional)"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                    value={formData.correction}
                                    onChange={(e) => setFormData({ ...formData, correction: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                                <input
                                    type="text"
                                    placeholder="Notas adicionais..."
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Evidências (Imagens)</label>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                                    {selectedImages.map((img, index) => (
                                        <div key={index} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                            <img
                                                src={img.url}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {selectedImages.length < MAX_IMAGES && (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-square flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors text-gray-400 hover:text-gray-600"
                                        >
                                            <Upload size={24} className="mb-2" />
                                            <span className="text-xs font-medium">Add Imagem</span>
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageSelect}
                                />
                                <p className="text-xs text-gray-400">
                                    Máx: {MAX_IMAGES} imagens (2MB cada)
                                </p>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsFormModalOpen(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    disabled={saving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <Loader size={18} className="animate-spin" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    {saving ? 'Salvando...' : 'Salvar Registro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && currentRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Detalhes do Registro</h2>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono mt-1 inline-block">
                                    {currentRecord.code}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsViewModalOpen(false);
                                        openEditModal(currentRecord);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-blue-600"
                                    title="Editar"
                                >
                                    <Edit size={20} />
                                </button>
                                <button
                                    onClick={() => handleDelete(currentRecord)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-red-600"
                                    title="Excluir"
                                >
                                    <Trash2 size={20} />
                                </button>
                                <button
                                    onClick={() => setIsViewModalOpen(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Local</label>
                                    <p className="text-gray-900 font-medium">{currentRecord.location || 'Não informado'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Data de Criação</label>
                                    <p className="text-gray-900">{formatDate(currentRecord.createdAt)}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Descrição</label>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                                    {currentRecord.description}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Correção</label>
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                                    {currentRecord.correction || 'Nenhuma correção registrada.'}
                                </div>
                            </div>

                            {currentRecord.notes && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Observações</label>
                                    <p className="text-gray-600 text-sm">{currentRecord.notes}</p>
                                </div>
                            )}

                            {currentRecord.imagens && currentRecord.imagens.length > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Evidências</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {currentRecord.imagens.map((img, idx) => (
                                            <div
                                                key={idx}
                                                className="cursor-pointer rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-blue-500 transition-all aspect-video group relative"
                                                onClick={() => {
                                                    setExpandedImage(img.url);
                                                    setIsImageModalOpen(true);
                                                }}
                                            >
                                                <img src={img.url} alt={img.nome} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Image Expansion Modal */}
            {isImageModalOpen && expandedImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
                    onClick={() => setIsImageModalOpen(false)}
                >
                    <button
                        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors bg-white/10 p-2 rounded-full"
                        onClick={() => setIsImageModalOpen(false)}
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={expandedImage}
                        alt="Expanded"
                        className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
}
