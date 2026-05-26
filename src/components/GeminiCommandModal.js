import React, { useState, useEffect } from 'react';
import { XCircle, Sparkles, Camera, Mic } from 'lucide-react';

export default function GeminiCommandModal({ isOpen, onClose, onProcess, isProcessing }) {
    const [apiKey, setApiKey] = useState('');
    const [commandText, setCommandText] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        const savedKey = localStorage.getItem('mapa_jurua_gemini_key') || process.env.REACT_APP_GEMINI_API_KEY || '';
        setApiKey(savedKey);

        const originalOverflow = document.body.style.overflow;
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.body.style.overflow = originalOverflow || 'unset';
        };
    }, [isOpen]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // Reconhecimento de Voz Nativo do Navegador (Web Speech API)
    const handleToggleSpeech = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("O reconhecimento de voz não é suportado no seu navegador atual. Use o Google Chrome.");
            return;
        }

        if (isListening) {
            setIsListening(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event) => {
            const speechToText = event.results[0][0].transcript;
            setCommandText(prev => prev ? `${prev} ${speechToText}` : speechToText);
            setIsListening(false);
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const handleSend = () => {
        if (!apiKey.trim()) {
            alert("Erro: A chave de API do Gemini não foi configurada no arquivo .env nos bastidores.");
            return;
        }
        if (!commandText.trim() && !selectedImage) {
            alert("Por favor, fale/digite uma instrução ou anexe uma foto da impressora.");
            return;
        }
        onProcess(apiKey.trim(), commandText, selectedImage);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-simpress-dark/85 backdrop-blur-sm flex flex-col items-center justify-start md:justify-center p-4 z-[9999] overflow-y-auto pt-6 md:pt-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-scale-in mt-2 md:mt-0">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-simpress-blue to-simpress-dark p-6 text-white relative">
                    <button 
                        onClick={onClose} 
                        disabled={isProcessing}
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                    >
                        <XCircle size={26} />
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="text-simpress-magenta animate-pulse" size={24} />
                        <h3 className="text-xl font-black tracking-tight">Comando Inteligente IA</h3>
                    </div>
                    <p className="text-xs text-simpress-gray font-bold uppercase tracking-wider">Powered by Google Gemini</p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">

                    {/* Foto da Impressora / Etiqueta */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider pl-1">
                            Foto da Impressora ou Etiqueta
                        </label>
                        
                        {imagePreview ? (
                            <div className="relative border border-slate-200/60 p-3 rounded-2xl flex flex-col items-center bg-slate-50 animate-fade-in">
                                <button 
                                    onClick={() => { setSelectedImage(null); setImagePreview(''); }}
                                    className="absolute top-2 right-2 bg-slate-800 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                                >
                                    <XCircle size={16} />
                                </button>
                                <img src={imagePreview} alt="Etiqueta" className="h-32 w-auto object-contain rounded-xl border" />
                            </div>
                        ) : (
                            <label className="border-2 border-dashed border-slate-200 hover:border-simpress-blue rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 bg-slate-50/50 hover:bg-slate-50">
                                <Camera size={26} className="text-slate-400" />
                                <span className="text-xs text-slate-500 font-bold">Tirar Foto ou Anexar Imagem</span>
                                <span className="text-[10px] text-slate-400 font-bold">Aceita formatos comuns de foto</span>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment"
                                    onChange={handleImageChange} 
                                    className="hidden" 
                                />
                            </label>
                        )}
                    </div>

                    {/* Campo de Comando Rápido */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider pl-1 flex justify-between items-center">
                            <span>Instrução Técnica</span>
                            {isListening && <span className="text-simpress-magenta animate-pulse text-[10px]">Ouvindo...</span>}
                        </label>
                        <div className="relative">
                            <textarea 
                                rows="3"
                                placeholder="Fale ou digite: Ex: 'Mover impressora para o Financeiro sala 2' ou 'Substituir ADM por este backup'." 
                                value={commandText} 
                                onChange={e => setCommandText(e.target.value)} 
                                className="input-field pr-10 resize-none min-h-[90px]"
                                disabled={isProcessing}
                            />
                            <button 
                                type="button"
                                onClick={handleToggleSpeech}
                                disabled={isProcessing}
                                className={`absolute right-3.5 bottom-3.5 p-2 rounded-xl transition-all duration-300 ${
                                    isListening 
                                        ? 'bg-simpress-magenta text-white shadow-md shadow-simpress-magenta/25 animate-pulse' 
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                                title="Falar Instrução por Voz"
                            >
                                <Mic size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Botão de Envio */}
                    <button 
                        onClick={handleSend}
                        disabled={isProcessing}
                        className={`w-full py-4 mt-2 rounded-2xl font-extrabold text-sm text-white transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-95 ${
                            isProcessing 
                                ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                                : 'bg-simpress-magenta hover:bg-simpress-magenta/95 shadow-lg shadow-simpress-magenta/25'
                        }`}
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>IA Analisando Ativo...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                <span>Processar Ficha por IA</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
