import React from 'react';
import { XCircle, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function Notification({ message, type, onDismiss }) {
    if (!message) return null;
    
    // Configurações de cores premium com fundo escuro translúcido e bordas sutis
    const isError = type === 'error';
    const isSuccess = type === 'success';
    
    let borderClass = 'border-blue-500/20';
    let iconColorClass = 'text-blue-400';
    let textColorClass = 'text-slate-100';
    const Icon = isError ? XCircle : isSuccess ? CheckCircle : AlertCircle;

    if (isError) {
        borderClass = 'border-rose-500/20';
        iconColorClass = 'text-rose-400';
    } else if (isSuccess) {
        borderClass = 'border-emerald-500/20';
        iconColorClass = 'text-emerald-400';
    }

    return (
        <div className={`fixed top-5 right-5 bg-slate-900/95 backdrop-blur-md border ${borderClass} ${textColorClass} py-3.5 px-5 rounded-2xl shadow-2xl flex items-center z-50 animate-bounce gap-3 max-w-sm`}>
            <Icon size={20} className={`${iconColorClass} flex-shrink-0`} />
            <span className="text-xs font-bold leading-relaxed">{message}</span>
            {onDismiss && (
                <button 
                    onClick={onDismiss} 
                    className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 flex-shrink-0"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
