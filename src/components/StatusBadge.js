import React from 'react';

export default function StatusBadge({ status }) {
    let styleClasses = 'bg-slate-50 text-slate-600 border border-slate-200/60';

    switch (status) {
        case 'Funcionando':
            styleClasses = 'bg-emerald-50 text-emerald-700 border border-emerald-200/50';
            break;
        case 'Defeito':
            styleClasses = 'bg-rose-50 text-rose-700 border border-rose-200/50';
            break;
        case 'Manutenção':
            styleClasses = 'bg-amber-50 text-amber-700 border border-amber-200/50';
            break;
        case 'Backup':
            styleClasses = 'bg-sky-50 text-sky-700 border border-sky-200/50';
            break;
        case 'Aguardando retirada':
            styleClasses = 'bg-purple-50 text-purple-700 border border-purple-200/50';
            break;
        default:
            break;
    }

    return (
        <span className={`px-2.5 py-1 inline-flex text-[11px] leading-4 font-bold rounded-lg ${styleClasses}`}>
            {status || 'N/D'}
        </span>
    );
}
