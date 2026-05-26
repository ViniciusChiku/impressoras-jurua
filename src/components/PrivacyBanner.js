import React, { useState, useEffect } from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export default function PrivacyBanner({ onOpenPrivacyPolicy }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('mapa_jurua_privacy_consent');
        if (!consent) {
            setVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('mapa_jurua_privacy_consent', 'accepted');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-simpress-dark/95 backdrop-blur-md border-t border-simpress-blue/40 text-slate-100 p-4 md:p-6 z-[999] shadow-2xl animate-fade-in">
            <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="text-simpress-magenta mt-1 flex-shrink-0" size={24} />
                    <div className="text-sm">
                        <p className="font-bold text-slate-200">Respeito à sua privacidade e conformidade com a LGPD</p>
                        <p className="text-slate-400 mt-0.5 text-xs font-semibold leading-relaxed">
                            O painel **Mapa Juruá** utiliza cookies de sessão e armazenamento local exclusivamente para manter seu login ativo. Não tratamos dados pessoais de terceiros, em total alinhamento com os princípios de minimização e segurança da LGPD.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto justify-end flex-shrink-0">
                    <button 
                        onClick={onOpenPrivacyPolicy}
                        className="px-4 py-2 text-xs font-bold bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 rounded-xl transition-all duration-300 flex items-center gap-1.5"
                    >
                        <Info size={14} /> Entenda Mais
                    </button>
                    <button 
                        onClick={handleAccept}
                        className="px-5 py-2 text-xs font-extrabold bg-simpress-magenta hover:bg-simpress-magenta/90 text-white rounded-xl transition-all duration-300 shadow-md shadow-simpress-magenta/20"
                    >
                        Aceitar e Continuar
                    </button>
                </div>
            </div>
        </div>
    );
}
