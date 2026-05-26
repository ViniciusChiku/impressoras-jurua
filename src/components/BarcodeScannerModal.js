import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { XCircle, CheckCircle } from 'lucide-react';

export default function BarcodeScannerModal({ isOpen, onClose, onScan }) {
    const [textoLido, setTextoLido] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setTextoLido(""); // Limpa a memória quando você abre a câmera de novo
            return;
        }

        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 100 } },
            /* verbose= */ false
        );

        scanner.render(
            (decodedText) => {
                // Quando ele lê, ele mostra na tela e manda pro formulário
                setTextoLido(decodedText); 
                onScan(decodedText);
            },
            (errorMessage) => {
                // Ignora errinhos normais de foco/câmera
            }
        );

        return () => {
            scanner.clear().catch((error) => {
                console.warn("Erro ao limpar scanner:", error);
            });
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-[9999] p-4">
            <div className="bg-white p-4 rounded-xl shadow-xl w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-2 right-2 text-slate-400 hover:text-[#da292e] z-10 transition-colors">
                    <XCircle size={28} />
                </button>
                <h3 className="text-lg font-bold text-slate-800 mb-4 text-center mt-2">Leitor de Código de Barras</h3>
                
                {/* Se ele JÁ LEU um texto, esconde a câmera e mostra o sucesso */}
                {textoLido ? (
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="bg-green-100 text-green-800 p-4 rounded-lg w-full text-center mb-4 border border-green-300">
                            <p className="text-sm uppercase font-semibold text-green-600 mb-1">Código Capturado:</p>
                            <p className="text-2xl font-bold">{textoLido}</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="w-full bg-[#2a68eb] hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
                        >
                            <CheckCircle size={20} className="mr-2" />
                            Confirmar e Fechar
                        </button>
                    </div>
                ) : (
                    /* Se NÃO LEU AINDA, mostra a câmera normal */
                    <>
                        <div id="reader" className="w-full rounded-lg overflow-hidden border-2 border-[#2a68eb]"></div>
                        <p className="text-sm text-slate-500 mt-4 text-center">
                            Aponte a câmera para a etiqueta de código de barras.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
