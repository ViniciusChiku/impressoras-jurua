import React from 'react';
import { XCircle, Shield, FileText, UserCheck, Key } from 'lucide-react';
import { ADMIN_EMAIL } from '../services/firebase';

export default function PrivacyPolicyModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-simpress-dark/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] overflow-y-auto">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-scale-in border border-slate-100">
                {/* Header */}
                <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex justify-between items-center z-10">
                    <div className="flex items-center gap-2 text-simpress-blue">
                        <Shield size={24} className="text-simpress-magenta" />
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Conformidade LGPD & Privacidade</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-simpress-magenta transition-colors">
                        <XCircle size={28} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 text-slate-600 text-sm leading-relaxed">
                    <p className="text-slate-500 font-semibold">
                        Em total observância à **Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018)**, este documento declara como o aplicativo **Mapa Juruá** trata dados de inventário de ativos corporativos da Simpress.
                    </p>

                    {/* Section 1 */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <FileText size={18} className="text-simpress-blue" />
                            1. Finalidade do Tratamento
                        </h3>
                        <p>
                            O **Mapa Juruá** é uma ferramenta de gestão patrimonial e suporte técnico, desenhada exclusivamente para inventariar e mapear a localização física e lógica (endereços de IP) dos ativos de hardware corporativos (impressoras).
                        </p>
                    </div>

                    {/* Section 2 */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Key size={18} className="text-simpress-blue" />
                            2. Minimização e Coleta de Dados
                        </h3>
                        <p className="mb-2">Os únicos dados coletados correspondem às especificações patrimoniais técnicas:</p>
                        <ul className="list-disc list-inside pl-2 space-y-1 font-medium text-slate-700">
                            <li><strong>Credenciais Administrativas:</strong> E-mail de autenticação no Firebase Auth.</li>
                            <li><strong>Ficha Técnica do Ativo:</strong> Modelo, IP, Nº de Série, Departamento, Sala Física e Foto da folha física de contadores do equipamento.</li>
                        </ul>
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-2xl border border-amber-200/50">
                            <strong>Diretriz LGPD:</strong> Em respeito ao princípio da minimização, este sistema não registra nem gerencia dados pessoais de clientes, fornecedores ou funcionários finais (como CPF, contatos pessoais ou perfis de navegação).
                        </p>
                    </div>

                    {/* Section 3 */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <UserCheck size={18} className="text-simpress-blue" />
                            3. Direitos dos Titulares de Dados (Artigo 18)
                        </h3>
                        <p className="mb-1">De acordo com a LGPD, o titular dos dados tratados (administrador) possui direito de requerer:</p>
                        <ul className="list-disc list-inside pl-2 space-y-1 font-medium text-slate-700">
                            <li>Confirmação da existência de tratamento dos seus dados de login.</li>
                            <li>Acesso aos dados e exclusão/correção dos registros cadastrados.</li>
                            <li>Eliminação dos dados pessoais tratados mediante consentimento prévio.</li>
                        </ul>
                    </div>

                    {/* Section 4 */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Shield size={18} className="text-simpress-blue" />
                            4. Segurança da Informação
                        </h3>
                        <p>
                            Todas as fichas de impressoras e imagens dos contadores de página são armazenadas na infraestrutura em nuvem segura da plataforma **Google Firebase (Firestore & Storage)**, possuindo restrições de permissões rígidas configuradas para blindar o banco de dados contra acessos não autorizados.
                        </p>
                    </div>

                    {/* Section 5 */}
                    <div className="space-y-2 pb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <UserCheck size={18} className="text-simpress-blue" />
                            5. DPO / Controlador de Dados
                        </h3>
                        <p>
                            Para exercer seus direitos de privacidade, retificar dados ou solicitar a deleção de informações da base de demonstração, entre em contato direto com o controlador:
                        </p>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-2 flex flex-col gap-1">
                            <p className="font-bold text-slate-800">Controlador: Vinícius Chiku</p>
                            <p className="font-bold text-simpress-blue">
                                E-mail: <a href={`mailto:${ADMIN_EMAIL}`} className="hover:underline hover:text-simpress-magenta transition-colors">{ADMIN_EMAIL}</a>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 bg-simpress-blue hover:bg-simpress-blue/95 text-white font-extrabold rounded-2xl transition-all duration-300 shadow-md shadow-simpress-blue/15 hover:shadow-lg hover:shadow-simpress-blue/25"
                    >
                        Entendido e Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
}
