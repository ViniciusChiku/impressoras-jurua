import React from 'react';
import { Camera, Copy, Sparkles } from 'lucide-react';

export default function Field({ label, icon: Icon, onCopy, onScan, isSuggested, children }) {
    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5">
                    <label className="block text-sm font-medium text-slate-700">{label}</label>
                    {isSuggested && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200/50 animate-pulse">
                            <Sparkles size={8} className="fill-violet-700" /> IA
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {onScan && (
                        <button 
                            type="button" 
                            onClick={onScan} 
                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                            title="Escanear Código de Barras"
                        >
                            <Camera size={14}/> Escanear
                        </button>
                    )}
                    {onCopy && (
                        <button 
                            type="button" 
                            onClick={onCopy} 
                            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"
                            title={`Copiar ${label}`}
                        >
                            <Copy size={14}/> Copiar
                        </button>
                    )}
                </div>
            </div>
            <div className="relative">
                {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>}
                {React.cloneElement(children, { className: `${children.props.className || ''} ${Icon ? 'pl-10' : ''}` })}
            </div>
        </div>
    );
}

