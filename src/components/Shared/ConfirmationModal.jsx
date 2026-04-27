import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirmar Ação',
    message = 'Esta ação não pode ser desfeita.',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    icon: Icon = AlertTriangle,
    variant = 'danger' // 'danger' | 'info' | 'warning'
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: 'bg-red-500 hover:bg-red-600',
        info: 'bg-blue-600 hover:bg-blue-700',
        warning: 'bg-yellow-500 hover:bg-yellow-600',
    };

    const iconColors = {
        danger: 'text-red-500',
        info: 'text-blue-500',
        warning: 'text-yellow-500',
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8 text-center">
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-6 ${iconColors[variant]}`}>
                        <Icon size={48} />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {title}
                    </h3>

                    <p className="text-gray-500 mb-8 leading-relaxed whitespace-pre-line">
                        {message}
                    </p>

                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center">
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-3 px-6 rounded-xl text-white font-bold transition-all transform active:scale-95 shadow-md ${variantStyles[variant]}`}
                        >
                            {confirmText}
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-6 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-all transform active:scale-95"
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
