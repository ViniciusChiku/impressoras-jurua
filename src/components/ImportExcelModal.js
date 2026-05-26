import React, { useState } from 'react';
import { XCircle } from 'lucide-react';

export default function ImportExcelModal({ isOpen, onClose, onImport }) {
    const [file, setFile] = useState(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Importar do Excel</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <XCircle size={24} />
                    </button>
                </div>
                
                <div className="mb-6">
                    <p className="text-sm text-slate-600 mb-4">
                        O arquivo Excel deve conter as colunas: <strong>Modelo, Local, IP, Serial, Departamento</strong> na primeira linha.
                    </p>
                    <input 
                        type="file" 
                        accept=".xlsx, .xls"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={() => onImport(file)}
                        disabled={!file}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        Importar Dados
                    </button>
                </div>
            </div>
        </div>
    );
}
