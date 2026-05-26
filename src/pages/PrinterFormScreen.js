import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { 
    Barcode, Network, Printer as PrinterIcon, Users, 
    Building, Trash2, RotateCw, AlertTriangle
} from 'lucide-react';

import { db, storage, printersCollectionPath } from '../services/firebase';
import Field from '../components/Field';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

// Função de Sanitização para Evitar Ataques XSS em Hrefs/Imagens
const sanitizeUrl = (url) => {
    if (!url) return '';
    const trimmed = url.trim();
    // eslint-disable-next-line no-script-url
    if (trimmed.toLowerCase().startsWith('javascript:')) {
        return 'about:blank';
    }
    if (/^(https?|blob):/i.test(trimmed)) {
        return trimmed;
    }
    return 'about:blank';
};

export default function PrinterFormScreen({ 
    isAdmin, 
    handleSavePrinterProp, 
    handleDeletePrinterProp, 
    showNotification 
}) {
    const navigate = useNavigate();
    const { idImpressora } = useParams();
    const isEditMode = !!idImpressora;

    const [isLoadingPrinterDetails, setIsLoadingPrinterDetails] = useState(isEditMode);
    const [isUploading, setIsUploading] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    
    // Form States
    const [model, setModel] = useState('');
    const [location, setLocation] = useState('');
    const [ip, setIp] = useState('');
    const [serial, setSerial] = useState('');
    const [departamento, setDepartamento] = useState('');
    const [status, setStatus] = useState('Funcionando');
    const [observacao, setObservacao] = useState('');

    // Image States
    const [imageFile, setImageFile] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [existingImageUrl, setExistingImageUrl] = useState('');

    useEffect(() => {
        const fetchPrinterData = async () => {
            if (isEditMode && idImpressora) {
                setIsLoadingPrinterDetails(true);
                const printerDocRef = doc(db, printersCollectionPath, idImpressora);
                try {
                    const docSnap = await getDoc(printerDocRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setModel(data.model || '');
                        setLocation(data.location || '');
                        setIp(data.ip || '');
                        setSerial(data.serial || '');
                        setDepartamento(data.departamento || '');
                        setStatus(data.status || 'Funcionando');
                        setObservacao(data.observacao || '');
                        setExistingImageUrl(data.contadorImageUrl || '');
                        setImageFile(null);
                        setImagePreviewUrl('');
                    } else {
                        showNotification('Impressora não encontrada.', 'error');
                        navigate('/');
                    }
                } catch (error) {
                    console.error("Erro ao buscar impressora:", error);
                    showNotification('Erro ao carregar dados.', 'error');
                    navigate('/');
                } finally {
                    setIsLoadingPrinterDetails(false);
                }
            } else {
                setModel(''); setLocation(''); setIp(''); setSerial(''); setDepartamento('');
                setStatus('Funcionando'); setObservacao('');
                setImageFile(null); setImagePreviewUrl(''); setExistingImageUrl('');
                setIsLoadingPrinterDetails(false);
            }
        };
        fetchPrinterData();
    }, [isEditMode, idImpressora, navigate, showNotification]);

    const handleImageFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreviewUrl(URL.createObjectURL(file));
            setExistingImageUrl('');
        } else {
            setImageFile(null);
            setImagePreviewUrl('');
        }
    };

    const handleCopyField = (text, labelName) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        showNotification(`${labelName} copiado!`, 'success', 2000);
    };

    const handleSubmitFormulario = async (e) => {
        e.preventDefault();
        
        const modelTrimmed = model.trim();
        const locationTrimmed = location.trim();
        const ipTrimmed = ip.trim();
        const serialTrimmed = serial.trim();
        const departamentoTrimmed = departamento.trim();

        if (!modelTrimmed || !locationTrimmed || !ipTrimmed) {
            showNotification("Modelo, Local e IP são obrigatórios.", 'error');
            return;
        }

        const isUSB = ipTrimmed.toLowerCase() === 'usb';
        const isValidIPFormat = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ipTrimmed);
        if (!isUSB && !isValidIPFormat) {
            showNotification("IP inválido. Use formato IP ou 'USB'.", 'error');
            return;
        }

        setIsUploading(true);
        let imageUrlToSave = existingImageUrl || '';

        if (imageFile) {
            const imageName = `${Date.now()}-${imageFile.name.replace(/\s+/g, '_')}`;
            const imageRef = ref(storage, `printers_counters/${imageName}`);
            try {
                showNotification("Enviando imagem do contador...", "info", 5000);
                await uploadBytes(imageRef, imageFile);
                imageUrlToSave = await getDownloadURL(imageRef);
                
                if (isEditMode && existingImageUrl && existingImageUrl !== imageUrlToSave) {
                    try { 
                        const oldRef = ref(storage, existingImageUrl);
                        await deleteObject(oldRef); 
                    } catch (e) {
                        console.warn("Imagem antiga não encontrada ou já removida.");
                    }
                }
            } catch (error) {
                console.error("Erro upload:", error);
                showNotification("Erro no upload da imagem.", 'error');
                setIsUploading(false);
                return;
            }
        }

        const dataToSave = {
            model: modelTrimmed,
            location: locationTrimmed ? locationTrimmed.charAt(0).toUpperCase() + locationTrimmed.slice(1).toLowerCase() : '',
            ip: ipTrimmed,
            serial: serialTrimmed.toUpperCase(),
            departamento: departamentoTrimmed ? departamentoTrimmed.charAt(0).toUpperCase() + departamentoTrimmed.slice(1).toLowerCase() : '',
            status: status,
            observacao: observacao.trim(),
            contadorImageUrl: imageUrlToSave
        };

        const success = await handleSavePrinterProp(dataToSave, isEditMode ? idImpressora : null);
        setIsUploading(false);
        if (success) navigate('/');
    };

    if (isLoadingPrinterDetails) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-100">
                <RotateCw className="animate-spin text-simpress-blue" size={48}/>
                <p className="ml-4 text-lg text-slate-600 font-semibold">Carregando detalhes do ativo...</p>
            </div>
        );
    }

    const estiloCampo = "input-field";
    const safeImageSrc = sanitizeUrl(imagePreviewUrl || existingImageUrl);

    return (
        <div className="min-h-screen bg-simpress-light p-4 md:p-8 flex items-center justify-center font-sans">
            
            {/* Modal do Leitor de Código de Barras */}
            <BarcodeScannerModal 
                isOpen={showScanner} 
                onClose={() => setShowScanner(false)} 
                onScan={(textLido) => {
                    setSerial(textLido);
                    showNotification("Número de série capturado com sucesso!", "success");
                }} 
            />

            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 md:p-10 animate-scale-in">
                
                <div className="flex flex-col items-center mb-8 border-b border-slate-100 pb-6">
                    <div className="bg-simpress-blue/10 text-simpress-blue p-3.5 rounded-2xl mb-3">
                        <PrinterIcon size={32}/>
                    </div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight text-center">
                        {isEditMode ? (isAdmin ? `Editar Impressora: ${serial}` : `Ficha Técnica do Ativo`) : 'Cadastrar Nova Impressora'}
                    </h2>
                    <p className="text-slate-400 text-xs mt-1.5 font-bold tracking-widest uppercase">Simpress Outsourcing Suite</p>
                </div>
                
                <form onSubmit={handleSubmitFormulario} className="space-y-5">
                    
                    <Field 
                        label="Número de Série" 
                        icon={Barcode} 
                        onCopy={serial ? () => handleCopyField(serial, 'Nº de Série') : null}
                        onScan={isAdmin ? () => setShowScanner(true) : null}
                    >
                        <input 
                            disabled={!isAdmin} 
                            className={estiloCampo} 
                            value={serial} 
                            onChange={e => setSerial(e.target.value)} 
                            required 
                            placeholder="Ex: BRJ12345 (Etiqueta patrimonial)"
                        />
                    </Field>

                    <Field 
                        label="Endereço IP / Porta" 
                        icon={Network}
                        onCopy={ip ? () => handleCopyField(ip, 'IP') : null}
                    >
                        <input 
                            disabled={!isAdmin} 
                            className={estiloCampo} 
                            value={ip} 
                            onChange={e => setIp(e.target.value)} 
                            required 
                            placeholder="Ex: 192.168.1.50 ou USB"
                        />
                    </Field>

                    <Field label="Modelo da Impressora" icon={PrinterIcon}>
                        <input 
                            disabled={!isAdmin} 
                            className={estiloCampo} 
                            value={model} 
                            onChange={e => setModel(e.target.value)} 
                            required 
                            placeholder="Ex: Samsung ProXpress M4070"
                        />
                    </Field>

                    <Field label="Departamento" icon={Users}>
                        <input 
                            disabled={!isAdmin} 
                            className={estiloCampo} 
                            value={departamento} 
                            onChange={e => setDepartamento(e.target.value)} 
                            placeholder="Ex: Controladoria"
                        />
                    </Field>

                    <Field label="Local / Sala Física" icon={Building}>
                        <input 
                            disabled={!isAdmin} 
                            className={estiloCampo} 
                            value={location} 
                            onChange={e => setLocation(e.target.value)} 
                            required 
                            placeholder="Ex: Bloco B, 3º Andar"
                        />
                    </Field>

                    <Field label="Status Operacional">
                        <select 
                            disabled={!isAdmin} 
                            className={estiloCampo} 
                            value={status} 
                            onChange={e => setStatus(e.target.value)}
                        >
                            <option value="Funcionando">Funcionando</option>
                            <option value="Defeito">Com Defeito</option>
                            <option value="Manutenção">Em Manutenção</option>
                            <option value="Backup">Backup</option>
                            <option value="Aguardando retirada">Aguardando retirada</option>
                        </select>
                    </Field>

                    {/* Observações com Alerta LGPD */}
                    <div className="w-full">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Observações Adicionais</label>
                        <textarea 
                            disabled={!isAdmin} 
                            rows="3" 
                            className={`${estiloCampo} resize-y min-h-[90px]`} 
                            value={observacao} 
                            onChange={e => setObservacao(e.target.value)} 
                            placeholder="Ex: Impressora configurada com duplex automático..."
                        />
                        {/* AVISO LGPD DE MINIMIZAÇÃO DE DADOS */}
                        <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200/50 flex items-start gap-2.5">
                            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600" />
                            <span>
                                <strong>Minimização de Dados (LGPD):</strong> Restrinja as observações ao escopo técnico e patrimonial. Não registre nomes próprios, CPFs, e-mails ou telefones pessoais de funcionários.
                            </span>
                        </div>
                    </div>
                    
                    {/* Imagem do Contador com Contorno Premium */}
                    <div className="pt-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Imagem da Folha de Contadores</label>
                        <input 
                            disabled={!isAdmin} 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageFileChange} 
                            className={`block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-simpress-blue/10 file:text-simpress-blue hover:file:bg-simpress-blue/20 cursor-pointer transition-all duration-300 ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        
                        {safeImageSrc && safeImageSrc !== 'about:blank' && (
                            <div className="mt-4 border border-slate-200/60 p-4 rounded-2xl flex flex-col items-center bg-slate-50">
                                <a href={safeImageSrc} target="_blank" rel="noreferrer" title="Visualizar Contador">
                                    <img 
                                        src={safeImageSrc} 
                                        alt="Contador de Impressões" 
                                        className="h-44 w-auto object-contain rounded-xl shadow-sm border border-slate-200 hover:opacity-90 transition-all duration-300"
                                    />
                                </a>
                                {!imagePreviewUrl && existingImageUrl && (
                                    <div className="mt-3">
                                        <a 
                                            href={safeImageSrc} 
                                            download 
                                            className="text-xs text-simpress-blue font-bold hover:underline"
                                        >
                                            Baixar Imagem Original
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Ações */}
                    <div className="mt-10 flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-slate-100">
                        <div className="w-full sm:w-auto">
                            {isAdmin && isEditMode && (
                                <button 
                                    type="button" 
                                    onClick={async () => { 
                                        if (window.confirm('Tem certeza que deseja excluir esta impressora? O registro e a foto correspondente serão deletados permanente do banco.')) { 
                                            await handleDeletePrinterProp(idImpressora); 
                                            navigate('/'); 
                                        } 
                                    }} 
                                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-extrabold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md shadow-red-600/10 hover:shadow-lg hover:shadow-red-600/20 transform active:scale-95 text-sm"
                                >
                                    <Trash2 size={16}/> Excluir Impressora
                                </button>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <button 
                                type="button" 
                                onClick={() => navigate('/')} 
                                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3 px-6 rounded-xl transition-all duration-300 transform active:scale-95 text-sm"
                            >
                                {isAdmin ? 'Cancelar' : 'Voltar'}
                            </button>
                            {isAdmin && (
                                <button 
                                    type="submit" 
                                    disabled={isUploading} 
                                    className={`w-full sm:w-auto bg-simpress-magenta hover:bg-simpress-magenta/95 text-white font-extrabold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-simpress-magenta/25 hover:shadow-simpress-magenta/40 transform active:scale-95 text-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isUploading ? 'Salvando...' : 'Confirmar e Salvar'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
