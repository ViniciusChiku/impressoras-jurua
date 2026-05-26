import React, { useState } from 'react';
import { PrinterIcon, ShieldCheck } from 'lucide-react';

export default function LoginScreen({ onAdminLogin, onGuestLogin, onOpenPrivacy }) {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onAdminLogin(email, pass);
    };

    return (
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#001233] via-[#002D6F] to-[#001944] p-4 font-sans relative overflow-hidden">
            {/* Esferas de Brilho de Fundo (Efeito Premium Glow) */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-simpress-magenta/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-simpress-blue/30 rounded-full blur-[150px] pointer-events-none"></div>

            <div className="bg-white/95 backdrop-blur-md p-8 md:p-10 rounded-[32px] shadow-2xl w-full max-w-md relative z-10 border border-white/20 animate-scale-in">
                
                {/* Cabeçalho do Card */}
                <div className="text-center mb-8">
                    <div className="bg-simpress-blue text-white w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-simpress-blue/20 animate-pulse-soft">
                        <PrinterIcon size={38} className="text-white"/>
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Mapa Juruá</h2>
                    <p className="text-slate-400 text-sm mt-1.5 font-medium">Outsourcing & Gestão de Impressoras</p>
                </div>

                {/* Formulário */}
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">E-mail do Administrador</label>
                        <input 
                            type="email" 
                            placeholder="exemplo@gmail.com" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="input-field"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Senha de Acesso</label>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            value={pass} 
                            onChange={e => setPass(e.target.value)} 
                            className="input-field"
                            required
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        className="w-full mt-2 bg-simpress-blue hover:bg-simpress-blue/95 text-white font-extrabold py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-simpress-blue/25 hover:shadow-simpress-blue/40 transform hover:scale-[1.01] active:scale-[0.99] text-sm flex items-center justify-center gap-2"
                    >
                        Entrar como Administrador
                    </button>
                </form>

                {/* Divisor */}
                <div className="relative flex items-center py-6">
                    <div className="flex-grow border-t border-slate-100"></div>
                    <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase tracking-wider">ou acesse como</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                </div>

                {/* Acesso Convidado */}
                <button 
                    onClick={onGuestLogin} 
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-4 rounded-2xl transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] text-sm"
                >
                    Acesso Visitante (Leitura)
                </button>

                {/* Termos LGPD */}
                <div className="mt-8 text-center flex flex-col items-center gap-1.5 border-t border-slate-100 pt-4">
                    <button 
                        type="button"
                        onClick={onOpenPrivacy}
                        className="text-xs text-simpress-blue hover:text-simpress-magenta transition-colors flex items-center justify-center gap-1 font-bold tracking-tight"
                    >
                        <ShieldCheck size={15} /> Declaração de Privacidade & LGPD
                    </button>
                </div>
            </div>
            
            {/* Branding Rodapé de Fundo */}
            <div className="absolute bottom-4 text-center text-white/40 text-xs z-10 w-full pointer-events-none font-medium">
                Inspirado na Identidade Visual Simpress
            </div>
        </div>
    );
}
