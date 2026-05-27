import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    LogOut, PlusCircle, Download, Search, PrinterIcon, 
    FileUp, ShieldCheck, ShieldOff, ArrowUp, ArrowDown, 
    Copy, Shield, Database, Barcode as BarcodeIcon, Filter, Sparkles,
    Trophy, Clock, Check, X, Camera, FileText, AlertCircle, RefreshCw, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, questsCollectionPath, printersCollectionPath } from '../services/firebase';

import StatusBadge from '../components/StatusBadge';
import ImportExcelModal from '../components/ImportExcelModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import GeminiCommandModal from '../components/GeminiCommandModal';
import { processCommandWithGemini } from '../services/gemini';

export default function DashboardScreen({ 
    currentUser, 
    isAdmin, 
    isGuest, 
    printers, 
    printersLoading, 
    activeQuest,
    activeQuestLoading,
    handleLogout, 
    handleImportFromExcel,
    showNotification,
    onOpenPrivacy
}) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'OK', 'BACKUP', 'ATTENTION'
    const [showImportModal, setShowImportModal] = useState(false);
    const [showFiltersMobile, setShowFiltersMobile] = useState(false);
    const [showDashboardScanner, setShowDashboardScanner] = useState(false);
    const [showGeminiModal, setShowGeminiModal] = useState(false);
    const [isProcessingGemini, setIsProcessingGemini] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'departamento', direction: 'asc' });

    // Estados da Quest de Contadores
    const [showQuestModal, setShowQuestModal] = useState(false);
    const [selectedPrinterForQuestCollect, setSelectedPrinterForQuestCollect] = useState(null);
    const [questCollectFile, setQuestCollectFile] = useState(null);
    const [questCollectPreview, setQuestCollectPreview] = useState('');
    const [questCollectPB, setQuestCollectPB] = useState('');
    const [questCollectColor, setQuestCollectColor] = useState('');
    const [questCollectTipo, setQuestCollectTipo] = useState('PB');
    const [isUploadingQuestCollect, setIsUploadingQuestCollect] = useState(false);
    const [isProcessingQuestOCR, setIsProcessingQuestOCR] = useState(false);
    const [questActiveTab, setQuestActiveTab] = useState('pending'); // 'pending' | 'collected'

    const usbPrinters = useMemo(() => {
        return printers.filter(p => (p.ip || '').toLowerCase() === 'usb');
    }, [printers]);

    const questStatusList = useMemo(() => {
        if (!activeQuest) return [];
        const questStart = new Date(activeQuest.startDate);
        return usbPrinters.map(p => {
            const hasBeenUpdatedThisQuest = p.dataContador && new Date(p.dataContador) >= questStart;
            const isCollected = hasBeenUpdatedThisQuest && p.contadorPB !== undefined && p.contadorPB !== null && p.contadorImageUrl;
            return {
                ...p,
                isCollected
            };
        });
    }, [usbPrinters, activeQuest]);

    const { pendingPrinters, collectedPrinters } = useMemo(() => {
        const pending = [];
        const collected = [];
        questStatusList.forEach(item => {
            if (item.isCollected) {
                collected.push(item);
            } else {
                pending.push(item);
            }
        });
        return { pendingPrinters: pending, collectedPrinters: collected };
    }, [questStatusList]);

    const calculateTimeRemaining = () => {
        if (!activeQuest) return '';
        const diff = new Date(activeQuest.endDate) - new Date();
        if (diff <= 0) return 'Expirado!';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d e ${hours}h restantes`;
    };

    const isQuestExpired = useMemo(() => {
        if (!activeQuest) return false;
        return new Date() > new Date(activeQuest.endDate);
    }, [activeQuest]);

    const handleStartQuest = async () => {
        if (!isAdmin) return;
        const confirmStart = window.confirm("Deseja iniciar uma nova Missão de Coleta de Contadores? O prazo limite será de 1 semana (7 dias).");
        if (!confirmStart) return;

        try {
            const now = new Date();
            const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
            const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const currentMonthYear = `${monthNames[now.getMonth()]}/${now.getFullYear()}`;

            const questData = {
                status: 'active',
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                month: currentMonthYear,
                createdAt: now.toISOString()
            };

            await addDoc(collection(db, questsCollectionPath), questData);
            showNotification(`Missão iniciada com sucesso! Você tem até ${endDate.toLocaleDateString()} para concluir.`, 'success');
            setShowQuestModal(true);
        } catch (error) {
            console.error("Erro ao iniciar quest:", error);
            showNotification("Erro ao iniciar nova missão.", "error");
        }
    };

    const handleFinishQuest = async () => {
        if (!isAdmin) return;
        const confirmFinish = window.confirm("Deseja encerrar esta Missão de Coleta de Contadores? Isso arquivará a missão atual para que você possa iniciar a próxima no mês seguinte. Certifique-se de já ter baixado o PDF e a planilha Simpress!");
        if (!confirmFinish) return;

        try {
            const questRef = doc(db, questsCollectionPath, activeQuest.id);
            await updateDoc(questRef, {
                status: 'completed',
                completedAt: new Date().toISOString()
            });
            setShowQuestModal(false);
            showNotification("Missão encerrada e arquivada com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao finalizar quest:", error);
            showNotification("Erro ao finalizar a missão.", "error");
        }
    };

    const handleSelectPrinterForQuest = (printer) => {
        setSelectedPrinterForQuestCollect(printer);
        setQuestCollectPB(printer.contadorPB !== undefined && printer.contadorPB !== null ? printer.contadorPB : (printer.contador || ''));
        setQuestCollectColor(printer.contadorColor || '');
        setQuestCollectTipo(printer.tipo || (String(printer.model || '').toLowerCase().includes('color') ? 'Color' : 'PB'));
        setQuestCollectFile(null);
        setQuestCollectPreview('');
    };

    const handleQuestOCR = async () => {
        if (!questCollectFile) {
            alert("Selecione uma imagem do contador antes.");
            return;
        }
        setIsProcessingQuestOCR(true);
        const apiKey = localStorage.getItem('mapa_jurua_gemini_key') || process.env.REACT_APP_GEMINI_API_KEY || '';
        if (!apiKey) {
            alert("A chave API do Gemini não foi configurada.");
            setIsProcessingQuestOCR(false);
            return;
        }
        
        try {
            const result = await processCommandWithGemini(apiKey, "Extrair os contadores de páginas P&B e Colorido desta folha de teste", questCollectFile, printers);
            
            if (result.error) {
                alert(result.error);
                return;
            }

            if (result.contadorPB !== undefined && result.contadorPB !== null) {
                setQuestCollectPB(result.contadorPB);
                showNotification("Contador P&B detectado por IA!", "success");
            }
            if (result.contadorColor !== undefined && result.contadorColor !== null) {
                setQuestCollectColor(result.contadorColor);
                setQuestCollectTipo('Color');
                showNotification("Contador Colorido detectado por IA!", "success");
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao rodar IA: " + error.message);
        } finally {
            setIsProcessingQuestOCR(false);
        }
    };

    const handleSaveQuestCollect = async () => {
        if (!selectedPrinterForQuestCollect) return;
        if (!questCollectPB) {
            alert("O Contador P&B é obrigatório.");
            return;
        }
        if (!questCollectFile && !selectedPrinterForQuestCollect.contadorImageUrl) {
            alert("Você precisa anexar uma foto do comprovante de contador.");
            return;
        }

        setIsUploadingQuestCollect(true);
        let imageUrl = selectedPrinterForQuestCollect.contadorImageUrl || '';

        try {
            if (questCollectFile) {
                const imageName = `${Date.now()}-quest-${questCollectFile.name.replace(/\s+/g, '_')}`;
                const imageRef = ref(storage, `printers_counters/${imageName}`);
                await uploadBytes(imageRef, questCollectFile);
                imageUrl = await getDownloadURL(imageRef);
            }

            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;

            const printerRef = doc(db, printersCollectionPath, selectedPrinterForQuestCollect.id);
            await updateDoc(printerRef, {
                contadorPB: Number(questCollectPB),
                contadorColor: questCollectTipo === 'Color' && questCollectColor ? Number(questCollectColor) : null,
                tipo: questCollectTipo,
                contadorImageUrl: imageUrl,
                dataContador: dateStr,
                contador: Number(questCollectPB), // retrocompatibilidade
                observacao: `Coletado via Quest. ` + (selectedPrinterForQuestCollect.observacao || '')
            });

            showNotification("Leitura do contador salva com sucesso!", "success");
            setSelectedPrinterForQuestCollect(null);
            setQuestCollectFile(null);
            setQuestCollectPreview('');
        } catch (error) {
            console.error("Erro ao salvar coleta de quest:", error);
            alert("Erro ao salvar: " + error.message);
        } finally {
            setIsUploadingQuestCollect(false);
        }
    };

    const handleExportSimpressExcel = () => {
        if (!activeQuest) return;
        const questStart = new Date(activeQuest.startDate);
        const questCompletedUSBs = usbPrinters.filter(p => p.dataContador && new Date(p.dataContador) >= questStart);
        
        if (questCompletedUSBs.length === 0) {
            showNotification('Nenhum contador coletado para exportar.', 'error');
            return;
        }
        
        const data = questCompletedUSBs.map(p => ({
            'Série': p.serial,
            'Contador PB': p.contadorPB !== undefined && p.contadorPB !== null ? p.contadorPB : (p.contador || 0),
            'Contador Color': p.tipo === 'Color' ? (p.contadorColor || 0) : 0
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Contadores_Simpress");
        XLSX.writeFile(wb, `Coleta_Contadores_Simpress_${activeQuest.month.replace('/', '_')}.xlsx`);
        showNotification('Planilha Simpress exportada com sucesso!', 'success');
    };

    const handleGeneratePDFComprovantes = async () => {
        if (!activeQuest) return;
        const questStart = new Date(activeQuest.startDate);
        const questCompletedUSBs = usbPrinters.filter(p => p.dataContador && new Date(p.dataContador) >= questStart && p.contadorImageUrl);
        
        if (questCompletedUSBs.length === 0) {
            showNotification('Nenhum comprovante com imagem coletado nesta quest.', 'error');
            return;
        }

        showNotification('Gerando PDF. Por favor, aguarde...', 'info', 10000);
        
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            const loadImageAsBase64 = (url) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = url;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        try {
                            const dataURL = canvas.toDataURL('image/jpeg', 0.85);
                            resolve(dataURL);
                        } catch (err) {
                            reject(err);
                        }
                    };
                    img.onerror = () => reject(new Error('Falha ao carregar imagem: ' + url));
                });
            };

            for (let i = 0; i < questCompletedUSBs.length; i++) {
                const printer = questCompletedUSBs[i];
                if (i > 0) pdf.addPage();
                
                pdf.setFillColor(0, 45, 111);
                pdf.rect(0, 0, pageWidth, 40, 'F');
                
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(22);
                pdf.setTextColor(255, 255, 255);
                pdf.text("Mapa Juruá - Comprovante", 15, 20);
                
                pdf.setFontSize(10);
                pdf.setTextColor(208, 0, 187);
                pdf.text("SIMPRESS OUTSOURCING PARTNER SUITE", 15, 30);
                
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(11);
                pdf.setTextColor(30, 41, 59);
                pdf.text("DETALHES DO ATIVO", 15, 55);
                pdf.line(15, 57, pageWidth - 15, 57);
                
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(10);
                pdf.text(`Número de Série: ${printer.serial}`, 15, 65);
                pdf.text(`Modelo: ${printer.model}`, 15, 71);
                pdf.text(`Localização: ${printer.location}`, 15, 77);
                pdf.text(`Departamento: ${printer.departamento || 'N/D'}`, 15, 83);
                
                pdf.setFont('helvetica', 'bold');
                pdf.text(`Contador P&B: ${printer.contadorPB !== undefined ? printer.contadorPB : (printer.contador || 0)}`, 110, 65);
                pdf.text(`Contador Color: ${printer.tipo === 'Color' ? (printer.contadorColor || 0) : 'N/D (Monocromática)'}`, 110, 71);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Tipo de Ativo: ${printer.tipo === 'Color' ? 'Colorida' : 'Monocromática P&B'}`, 110, 77);
                pdf.text(`Data da Leitura: ${printer.dataContador || ''}`, 110, 83);
                
                pdf.setFont('helvetica', 'bold');
                pdf.text("FOTO DO COMPROVANTE (LEITURA DO CONTADOR)", 15, 98);
                pdf.line(15, 100, pageWidth - 15, 100);
                
                try {
                    const imgData = await loadImageAsBase64(printer.contadorImageUrl);
                    const targetWidth = pageWidth - 30;
                    const targetHeight = pageHeight - 120;
                    pdf.addImage(imgData, 'JPEG', 15, 105, targetWidth, targetHeight, undefined, 'FAST');
                } catch (err) {
                    console.error("Erro CORS:", err);
                    pdf.setDrawColor(220, 38, 38);
                    pdf.setFillColor(254, 242, 242);
                    pdf.rect(15, 105, pageWidth - 30, 40, 'FD');
                    
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(220, 38, 38);
                    pdf.text("IMAGEM NÃO DISPONÍVEL NO COMPILADO", 20, 115);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(127, 29, 29);
                    pdf.text("A imagem não pôde ser baixada automaticamente no PDF devido a restrições de CORS.", 20, 122);
                    pdf.text("A foto original continua salva com segurança no banco de dados e pode ser baixada individualmente.", 20, 128);
                }
                
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(148, 163, 184);
                pdf.text(`Gerado em ${new Date().toLocaleString()} - Página ${i + 1} de ${questCompletedUSBs.length}`, 15, pageHeight - 10);
            }
            
            pdf.save(`Comprovantes_Contadores_Simpress_${activeQuest.month.replace('/', '_')}.pdf`);
            showNotification('PDF de comprovantes gerado e baixado com sucesso!', 'success');
        } catch (error) {
            console.error("Erro no PDF:", error);
            showNotification('Erro ao compilar comprovantes em PDF.', 'error');
        }
    };

    // Envia o comando e foto do usuário para o Gemini
    const handleProcessGeminiCommand = async (apiKey, commandText, imageFile) => {
        setIsProcessingGemini(true);
        try {
            const result = await processCommandWithGemini(apiKey, commandText, imageFile, printers);
            
            if (result.error) {
                showNotification(result.error, 'error', 5000);
                setIsProcessingGemini(false);
                return;
            }

            const serialToFind = (result.serial || '').toUpperCase();
            if (!serialToFind) {
                showNotification('A IA não conseguiu detectar nenhum número de série.', 'error');
                setIsProcessingGemini(false);
                return;
            }

            // Procura se a impressora existe na base de dados
            const existingPrinter = printers.find(p => (p.serial || '').toUpperCase() === serialToFind);
            
            // Dados estruturados que pré-preencherão o formulário
            const prefilledData = {
                serial: serialToFind,
                model: result.model || existingPrinter?.model || '',
                ip: result.ip || existingPrinter?.ip || '',
                location: result.location || existingPrinter?.location || '',
                departamento: result.departamento || existingPrinter?.departamento || '',
                status: result.status || existingPrinter?.status || 'Funcionando',
                observacao: result.observacao || existingPrinter?.observacao || '',
                swap: result.swap || null,
                contadorPB: result.contadorPB !== undefined && result.contadorPB !== null ? result.contadorPB : (existingPrinter?.contadorPB || existingPrinter?.contador || ''),
                contadorColor: result.contadorColor !== undefined && result.contadorColor !== null ? result.contadorColor : (existingPrinter?.contadorColor || '')
            };

            setShowGeminiModal(false);
            showNotification('Dados processados! Revise o formulário e clique em Salvar.', 'success', 5000);

            if (existingPrinter) {
                // Se existe, navega para Edição passando as novas sugestões de IA no state
                navigate(`/impressora/editar/${existingPrinter.id}`, { state: { prefilledData } });
            } else {
                // Se não existe, navega para Criação passando as novas sugestões no state
                navigate('/impressora/nova', { state: { prefilledData } });
            }

        } catch (error) {
            console.error(error);
            showNotification(error.message || 'Erro ao conectar com a inteligência artificial.', 'error');
        } finally {
            setIsProcessingGemini(false);
        }
    };



    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleCopy = (e, textToCopy, label) => {
        e.stopPropagation();
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy);
        showNotification(`${label} copiado!`, 'success', 2000);
    };

    const handleExport = () => {
        if (filteredPrinters.length === 0) {
            showNotification('Nenhuma impressora para exportar.', 'error');
            return;
        }
        const data = filteredPrinters.map(p => ({
            Serial: p.serial, 
            Modelo: p.model, 
            Departamento: p.departamento, 
            Local: p.location, 
            IP: p.ip, 
            Status: p.status,
            Contador_PB: p.contadorPB !== undefined && p.contadorPB !== null ? p.contadorPB : (p.contador || ''),
            Contador_Color: p.contadorColor || '',
            Tipo: p.tipo || 'PB',
            Data_Contador: p.dataContador || ''
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Impressoras");
        XLSX.writeFile(wb, "Relatorio_Mapa_Jurua.xlsx");
        showNotification('Relatório exportado com sucesso!', 'success');
    };

    // Lógica Unificada de Filtragem (Busca + Filtro de Banners)
    const filteredPrinters = useMemo(() => {
        return printers.filter(printer => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = (
                (printer.model || '').toLowerCase().includes(term) ||
                (printer.location || '').toLowerCase().includes(term) ||
                (printer.ip || '').toLowerCase().includes(term) ||
                (printer.serial || '').toLowerCase().includes(term) ||
                (printer.departamento || '').toLowerCase().includes(term)
            );

            let matchesStatus = true;
            if (statusFilter === 'OK') {
                matchesStatus = printer.status === 'Funcionando';
            } else if (statusFilter === 'BACKUP') {
                matchesStatus = printer.status === 'Backup';
            } else if (statusFilter === 'ATTENTION') {
                matchesStatus = printer.status === 'Defeito' || printer.status === 'Manutenção';
            }

            return matchesSearch && matchesStatus;
        });
    }, [printers, searchTerm, statusFilter]);

    const sortedPrinters = useMemo(() => {
        const sorted = [...filteredPrinters];
        sorted.sort((a, b) => {
            const key1 = sortConfig.key || 'departamento';
            const dir1 = sortConfig.direction;
            const key2 = key1 === 'serial' ? 'model' : 'serial';

            const valA1 = String(a[key1] || '').toLowerCase();
            const valB1 = String(b[key1] || '').toLowerCase();

            let comparison = 0;
            if (valA1 < valB1) comparison = -1;
            else if (valA1 > valB1) comparison = 1;

            if (comparison !== 0) {
                return dir1 === 'asc' ? comparison : -comparison;
            }

            const valA2 = String(a[key2] || '').toLowerCase();
            const valB2 = String(b[key2] || '').toLowerCase();
            if (valA2 < valB2) return -1;
            if (valA2 > valB2) return 1;
            return 0;
        });
        return sorted;
    }, [filteredPrinters, sortConfig]);

    return (
        <div className="min-h-screen bg-simpress-light font-sans flex flex-col justify-between transition-all duration-300">
            <div>
                {/* Header com o gradiente Simpress e Borda Magenta de Destaque */}
                <header className="bg-gradient-to-r from-simpress-blue to-simpress-dark text-white shadow-xl sticky top-0 z-30 border-b-[3px] border-simpress-magenta">
                    <div className="container mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/10">
                                <PrinterIcon size={28} className="text-white"/>
                            </div>
                            <div>
                                <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-1.5">
                                    Mapa Juruá
                                </h1>
                                <p className="text-[10px] text-simpress-gray font-bold tracking-widest uppercase">Simpress Partner Suite</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex flex-col items-end text-right">
                                <span className="text-xs font-bold text-white/90">{currentUser?.email || 'Convidado'}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    {isAdmin && <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-md text-[10px] font-extrabold flex items-center gap-0.5 border border-green-500/20"><ShieldCheck size={12}/> Admin</span>}
                                    {isGuest && <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-md text-[10px] font-extrabold flex items-center gap-0.5 border border-yellow-500/20"><ShieldOff size={12}/> Visitante</span>}
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleLogout} 
                                className="bg-simpress-magenta hover:bg-simpress-magenta/90 text-white font-extrabold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all duration-300 transform active:scale-95 shadow-md shadow-simpress-magenta/20 hover:shadow-lg hover:shadow-simpress-magenta/30"
                            >
                                <LogOut size={13}/> Sair
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="container mx-auto p-4 md:p-6 animate-fade-in">
                    
                    {/* Alerta de Missão/Quest de Contadores Ativa */}
                    {activeQuest && (
                        <div 
                            onClick={() => setShowQuestModal(true)}
                            className="mb-6 bg-gradient-to-r from-simpress-blue to-simpress-dark text-white p-5 rounded-[24px] shadow-xl border-l-[6px] border-amber-500 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 animate-fade-in"
                        >
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 text-amber-500 flex items-center justify-center">
                                    <Trophy size={24} className="text-amber-400 animate-bounce" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                                        Missão Ativa: Coleta de Contadores ({activeQuest.month})
                                    </h3>
                                    <p className="text-xs text-simpress-gray font-semibold">
                                        Colete e fotografe os contadores das impressoras USB. Progresso: <strong className="text-white">{collectedPrinters.length} de {usbPrinters.length} concluídas</strong>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                <div className="text-left md:text-right">
                                    <span className="text-[10px] text-simpress-gray font-bold uppercase tracking-wider block">Tempo Restante</span>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                                        isQuestExpired 
                                            ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                                            : 'bg-amber-500/20 border-amber-500/30 text-amber-300 animate-pulse'
                                    }`}>
                                        {isQuestExpired ? '⚠️ Expirou!' : calculateTimeRemaining()}
                                    </span>
                                </div>
                                <span className="bg-white/10 hover:bg-white/20 p-2 rounded-xl border border-white/10 transition-colors text-white font-extrabold text-xs flex items-center gap-1">
                                    Abrir Missão <ChevronRight size={14} />
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {/* Barra de Status Rápida - Ocultada por Padrão no Mobile */}
                    <div className={`${showFiltersMobile ? 'flex animate-fade-in' : 'hidden lg:flex'} flex-wrap gap-2 mb-5 select-none p-1.5 rounded-2xl bg-white border border-slate-200/60 shadow-sm max-w-max`}>
                        {/* TODOS */}
                        <div 
                            onClick={() => setStatusFilter('ALL')}
                            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all duration-300 transform active:scale-95 cursor-pointer font-bold tracking-tight text-xs ${
                                statusFilter === 'ALL' 
                                    ? 'bg-simpress-blue text-white border-simpress-blue/20 shadow-md shadow-simpress-blue/15' 
                                    : 'bg-slate-50/50 hover:bg-slate-100 text-slate-600 border-slate-100'
                            }`}
                        >
                            <Database size={14}/>
                            <span>Todos</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${statusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'}`}>
                                {printersLoading ? '-' : printers.length}
                            </span>
                        </div>
                        
                        {/* EM OPERAÇÃO */}
                        <div 
                            onClick={() => setStatusFilter('OK')}
                            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all duration-300 transform active:scale-95 cursor-pointer font-bold tracking-tight text-xs ${
                                statusFilter === 'OK' 
                                    ? 'bg-emerald-600 text-white border-emerald-600/20 shadow-md shadow-emerald-600/15' 
                                    : 'bg-emerald-50/20 hover:bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}
                        >
                            <ShieldCheck size={14}/>
                            <span>Funcionando</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${statusFilter === 'OK' ? 'bg-white/20 text-white' : 'bg-emerald-100/70 text-emerald-800'}`}>
                                {printersLoading ? '-' : printers.filter(p => p.status === 'Funcionando').length}
                            </span>
                        </div>
                        
                        {/* BACKUP */}
                        <div 
                            onClick={() => setStatusFilter('BACKUP')}
                            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all duration-300 transform active:scale-95 cursor-pointer font-bold tracking-tight text-xs ${
                                statusFilter === 'BACKUP' 
                                    ? 'bg-sky-600 text-white border-sky-600/20 shadow-md shadow-sky-600/15' 
                                    : 'bg-sky-50/20 hover:bg-sky-50 text-sky-700 border-sky-100'
                            }`}
                        >
                            <PrinterIcon size={14}/>
                            <span>Backup</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${statusFilter === 'BACKUP' ? 'bg-white/20 text-white' : 'bg-sky-100/70 text-sky-800'}`}>
                                {printersLoading ? '-' : printers.filter(p => p.status === 'Backup').length}
                            </span>
                        </div>
                        
                        {/* ATENÇÃO */}
                        <div 
                            onClick={() => setStatusFilter('ATTENTION')}
                            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all duration-300 transform active:scale-95 cursor-pointer font-bold tracking-tight text-xs ${
                                statusFilter === 'ATTENTION' 
                                    ? 'bg-rose-600 text-white border-rose-600/20 shadow-md shadow-rose-600/15' 
                                    : 'bg-rose-50/20 hover:bg-rose-50 text-rose-700 border-rose-100'
                            }`}
                        >
                            <ShieldOff size={14}/>
                            <span>Atenção</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${statusFilter === 'ATTENTION' ? 'bg-white/20 text-white' : 'bg-rose-100/70 text-rose-800'}`}>
                                {printersLoading ? '-' : printers.filter(p => p.status === 'Defeito' || p.status === 'Manutenção').length}
                            </span>
                        </div>
                    </div>
                    {/* Tabela & Controles */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
                        
                        {/* Toolbar Premium - Barra de pesquisa no topo e ações flexíveis */}
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col gap-3">
                            
                            {/* Linha Superior: Barra de Pesquisa e Filtros "De Cara" (Sempre Visível) */}
                            <div className="flex items-center gap-2 w-full">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                    <input 
                                        type="text" 
                                        placeholder="Buscar impressora por modelo, série, IP ou local..." 
                                        value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)} 
                                        className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-simpress-blue/20 focus:border-simpress-blue outline-none text-slate-700 transition-all duration-300 text-sm bg-white"
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setShowDashboardScanner(true)}
                                    className="bg-simpress-blue text-white p-3 rounded-xl hover:bg-simpress-blue/95 transition-all duration-300 flex items-center justify-center shadow-md shadow-simpress-blue/10 transform hover:scale-[1.02] active:scale-[0.98]"
                                    title="Escanear Código de Barras"
                                >
                                    <BarcodeIcon size={18}/>
                                </button>
                                {/* Botão de Filtro de Status para Mobile (Substitui Toggle de Ações) */}
                                <button 
                                    type="button"
                                    onClick={() => setShowFiltersMobile(!showFiltersMobile)}
                                    className={`lg:hidden p-3 rounded-xl border transition-all duration-300 flex items-center justify-center transform active:scale-95 ${
                                        showFiltersMobile 
                                            ? 'bg-simpress-magenta text-white border-simpress-magenta/20 shadow-md shadow-simpress-magenta/15' 
                                            : 'bg-white border-slate-200 text-slate-600 shadow-sm'
                                    }`}
                                    title="Filtrar por Status"
                                >
                                    <Filter size={18}/>
                                </button>
                            </div>

                            {/* Botões de Ação (Sempre Visíveis em Todas as Telas!) */}
                            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto transition-all duration-300">
                                        <button 
                                            onClick={activeQuest ? () => setShowQuestModal(true) : handleStartQuest}
                                            className={`w-full sm:w-auto font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md transform hover:scale-[1.01] text-xs ${
                                                activeQuest 
                                                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-orange-600/10 hover:shadow-orange-500/25 animate-pulse-soft border border-orange-500/20'
                                                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm'
                                            }`}
                                            title={activeQuest ? "Visualizar Progresso da Missão" : "Iniciar Missão Mensal de Coleta USB"}
                                        >
                                            <Trophy size={14} className={activeQuest ? "text-yellow-300" : "text-amber-500"} />
                                            <span>
                                                {activeQuest 
                                                    ? `Quest: ${collectedPrinters.length}/${usbPrinters.length}` 
                                                    : 'Iniciar Coleta USB'}
                                            </span>
                                        </button>
                                        <button 
                                            onClick={() => navigate('/impressora/nova')} 
                                            className="w-full sm:w-auto bg-simpress-magenta hover:bg-simpress-magenta/90 text-white font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md shadow-simpress-magenta/10 hover:shadow-simpress-magenta/25 transform hover:scale-[1.01] text-xs"
                                        >
                                            <PlusCircle size={15}/> Adicionar Impressora
                                        </button>
                                        <button 
                                            onClick={() => setShowGeminiModal(true)} 
                                            className="w-full sm:w-auto bg-violet-600 hover:bg-violet-750 text-white font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md shadow-violet-600/10 transform hover:scale-[1.01] text-xs"
                                            title="Digitar ou tirar fotos e dar comandos de IA"
                                        >
                                            <Sparkles size={15} className="text-white animate-pulse" /> Comando IA
                                        </button>
                                        <button 
                                            onClick={() => setShowImportModal(true)} 
                                            className="w-full sm:w-auto bg-simpress-blue hover:bg-simpress-blue/90 text-white font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md shadow-simpress-blue/10 transform hover:scale-[1.01] text-xs"
                                        >
                                            <FileUp size={15}/> Importar Planilha
                                        </button>
                                <button 
                                    onClick={handleExport} 
                                    className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm transform hover:scale-[1.01] text-xs"
                                >
                                    <Download size={15}/> Exportar Excel
                                </button>
                            </div>
                        </div>

                        {/* Scanner Modal */}
                        <BarcodeScannerModal 
                            isOpen={showDashboardScanner} 
                            onClose={() => setShowDashboardScanner(false)} 
                            onScan={(textLido) => {
                                setSearchTerm(textLido);
                                showNotification(`Filtro aplicado para o código: ${textLido}`, 'success');
                            }} 
                        />

                        {/* Gemini Command Modal */}
                        <GeminiCommandModal 
                            isOpen={showGeminiModal}
                            onClose={() => setShowGeminiModal(false)}
                            onProcess={handleProcessGeminiCommand}
                            isProcessing={isProcessingGemini}
                        />

                        {/* Tabela de Inventário */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        {/* 1. SÉRIE */}
                                        <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100/60 transition-colors" onClick={() => handleSort('serial')}>
                                            <div className={`flex items-center text-left text-xs font-extrabold uppercase tracking-wider transition-colors ${sortConfig.key === 'serial' ? 'text-simpress-magenta' : 'text-slate-500'}`}>
                                                Nº de Série
                                                {sortConfig.key === 'serial' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-simpress-magenta"/> : <ArrowDown size={14} className="ml-1 text-simpress-magenta"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                            </div>
                                        </th>
                                        {/* 2. IP */}
                                        <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100/60 transition-colors" onClick={() => handleSort('ip')}>
                                            <div className={`flex items-center text-left text-xs font-extrabold uppercase tracking-wider transition-colors ${sortConfig.key === 'ip' ? 'text-simpress-magenta' : 'text-slate-500'}`}>
                                                Endereço IP
                                                {sortConfig.key === 'ip' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-simpress-magenta"/> : <ArrowDown size={14} className="ml-1 text-simpress-magenta"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                            </div>
                                        </th>
                                        {/* 3. MODELO */}
                                        <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100/60 transition-colors" onClick={() => handleSort('model')}>
                                            <div className={`flex items-center text-left text-xs font-extrabold uppercase tracking-wider transition-colors ${sortConfig.key === 'model' ? 'text-simpress-magenta' : 'text-slate-500'}`}>
                                                Modelo
                                                {sortConfig.key === 'model' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-simpress-magenta"/> : <ArrowDown size={14} className="ml-1 text-simpress-magenta"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                            </div>
                                        </th>
                                        {/* 4. DEPARTAMENTO */}
                                        <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100/60 transition-colors" onClick={() => handleSort('departamento')}>
                                            <div className={`flex items-center text-left text-xs font-extrabold uppercase tracking-wider transition-colors ${sortConfig.key === 'departamento' ? 'text-simpress-magenta' : 'text-slate-500'}`}>
                                                Departamento
                                                {sortConfig.key === 'departamento' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-simpress-magenta"/> : <ArrowDown size={14} className="ml-1 text-simpress-magenta"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                            </div>
                                        </th>
                                        {/* 5. LOCAL */}
                                        <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100/60 transition-colors" onClick={() => handleSort('location')}>
                                            <div className={`flex items-center text-left text-xs font-extrabold uppercase tracking-wider transition-colors ${sortConfig.key === 'location' ? 'text-simpress-magenta' : 'text-slate-500'}`}>
                                                Local / Sala
                                                {sortConfig.key === 'location' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-simpress-magenta"/> : <ArrowDown size={14} className="ml-1 text-simpress-magenta"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                            </div>
                                        </th>
                                        {/* 6. STATUS */}
                                        <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100/60 transition-colors" onClick={() => handleSort('status')}>
                                            <div className={`flex items-center text-left text-xs font-extrabold uppercase tracking-wider transition-colors ${sortConfig.key === 'status' ? 'text-simpress-magenta' : 'text-slate-500'}`}>
                                                Status
                                                {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-simpress-magenta"/> : <ArrowDown size={14} className="ml-1 text-simpress-magenta"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {printersLoading ? (
                                        <tr>
                                            <td colSpan="6" className="p-12 text-center text-slate-500 font-semibold bg-slate-50/20">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <div className="w-8 h-8 border-4 border-simpress-blue border-t-transparent rounded-full animate-spin"></div>
                                                    Carregando dados patrimoniais...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredPrinters.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="p-12 text-center text-slate-400 font-medium">
                                                Nenhum ativo corresponde à busca atual.
                                            </td>
                                        </tr>
                                    ) : sortedPrinters.map(p => (
                                        <tr 
                                            key={p.id} 
                                            onClick={() => navigate(`/impressora/editar/${p.id}`)} 
                                            className="hover:bg-slate-50/80 cursor-pointer transition-all duration-300 border-b border-slate-100 hover:translate-x-[2px]"
                                        >
                                            {/* 1. SÉRIE */}
                                            <td className="px-6 py-4 font-bold text-slate-800">
                                                <div className="flex items-center justify-between gap-2 group">
                                                    <span>{p.serial}</span>
                                                    <button 
                                                        onClick={(e) => handleCopy(e, p.serial, 'Nº de Série')} 
                                                        className="text-slate-300 hover:text-simpress-blue transition-colors p-1.5 rounded-lg hover:bg-slate-100 opacity-0 group-hover:opacity-100" 
                                                        title="Copiar Série"
                                                    >
                                                        <Copy size={14}/>
                                                    </button>
                                                </div>
                                            </td>
                                            {/* 2. IP */}
                                            <td className="px-6 py-4 text-slate-600 font-semibold">
                                                <div className="flex items-center justify-between gap-2 group">
                                                    <span>{p.ip}</span>
                                                    <button 
                                                        onClick={(e) => handleCopy(e, p.ip, 'IP')} 
                                                        className="text-slate-300 hover:text-simpress-blue transition-colors p-1.5 rounded-lg hover:bg-slate-100 opacity-0 group-hover:opacity-100" 
                                                        title="Copiar IP"
                                                    >
                                                        <Copy size={14}/>
                                                    </button>
                                                </div>
                                            </td>
                                            {/* 3. MODELO */}
                                            <td className="px-6 py-4 text-slate-600 font-bold">{p.model}</td>
                                            {/* 4. DEPARTAMENTO */}
                                            <td className="px-6 py-4 text-slate-600 font-semibold">{p.departamento}</td>
                                            {/* 5. LOCAL */}
                                            <td className="px-6 py-4 text-slate-600 font-semibold">{p.location}</td>
                                            {/* 6. STATUS */}
                                            <td className="px-6 py-4">
                                                <StatusBadge status={p.status}/>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>

            {isAdmin && (
                <ImportExcelModal 
                    isOpen={showImportModal} 
                    onClose={() => setShowImportModal(false)} 
                    onImport={(file) => {
                        handleImportFromExcel(file);
                        setShowImportModal(false);
                    }} 
                />
            )}

            {/* Modal de Quest de Contadores */}
            {showQuestModal && activeQuest && (
                <div className="fixed inset-0 bg-simpress-dark/85 backdrop-blur-sm flex flex-col items-center justify-start p-4 z-[9998] overflow-y-auto pt-6">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden animate-scale-in my-4">
                        
                        {/* Header da Quest */}
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white relative">
                            <button 
                                onClick={() => { setShowQuestModal(false); setSelectedPrinterForQuestCollect(null); }}
                                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <div className="flex items-center gap-2 mb-1">
                                <Trophy className="text-yellow-300 animate-bounce" size={26} />
                                <h3 className="text-xl font-black tracking-tight">Missão: Coleta de Contadores ({activeQuest.month})</h3>
                            </div>
                            <p className="text-[10px] text-orange-100 font-extrabold uppercase tracking-widest">Coleta Mensal USB &middot; Limite de 1 semana</p>
                        </div>

                        {/* Conteúdo do Modal */}
                        {selectedPrinterForQuestCollect ? (
                            /* TELA 1: Formulário de Coleta Rápida */
                            <div className="p-6 space-y-5">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <button 
                                        onClick={() => { setSelectedPrinterForQuestCollect(null); setQuestCollectFile(null); setQuestCollectPreview(''); }}
                                        className="text-xs text-slate-500 hover:text-simpress-blue font-bold flex items-center gap-1"
                                    >
                                        <span>⬅️</span> Voltar para a Lista
                                    </button>
                                    <span className="text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                                        Coleta Rápida
                                    </span>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                                    <h4 className="font-black text-slate-800 text-sm">{selectedPrinterForQuestCollect.model}</h4>
                                    <p className="text-xs text-slate-500 mt-1 font-semibold">
                                        Série: <strong className="text-slate-700 font-bold">{selectedPrinterForQuestCollect.serial}</strong> &middot; Local: <strong className="text-slate-700 font-bold">{selectedPrinterForQuestCollect.location} ({selectedPrinterForQuestCollect.departamento || 'N/D'})</strong>
                                    </p>
                                </div>

                                {/* Upload de Comprovante */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider pl-1">
                                        Foto do Comprovante (Folha de Contadores)
                                    </label>
                                    
                                    {questCollectPreview || selectedPrinterForQuestCollect.contadorImageUrl ? (
                                        <div className="relative border border-slate-200/60 p-3 rounded-2xl flex flex-col items-center bg-slate-50">
                                            {questCollectPreview && (
                                                <button 
                                                    onClick={() => { setQuestCollectFile(null); setQuestCollectPreview(''); }}
                                                    className="absolute top-2 right-2 bg-slate-800 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                            <img 
                                                src={questCollectPreview || selectedPrinterForQuestCollect.contadorImageUrl} 
                                                alt="Comprovante" 
                                                className="h-36 w-auto object-contain rounded-xl border border-slate-200" 
                                            />
                                        </div>
                                    ) : null}

                                    {!questCollectPreview && (
                                        <label className="border-2 border-dashed border-slate-200 hover:border-amber-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 bg-slate-50/50 hover:bg-slate-50">
                                            <Camera size={26} className="text-slate-400" />
                                            <span className="text-xs text-slate-600 font-bold">Tirar Foto ou Anexar Imagem</span>
                                            <span className="text-[10px] text-slate-400 font-semibold">Câmera abre automaticamente no celular</span>
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                capture="environment"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setQuestCollectFile(file);
                                                        setQuestCollectPreview(URL.createObjectURL(file));
                                                    }
                                                }} 
                                                className="hidden" 
                                            />
                                        </label>
                                    )}

                                    {questCollectFile && (
                                        <button
                                            onClick={handleQuestOCR}
                                            disabled={isProcessingQuestOCR}
                                            className="w-full bg-violet-600 hover:bg-violet-750 text-white py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-colors"
                                        >
                                            {isProcessingQuestOCR ? (
                                                <>
                                                    <RefreshCw className="animate-spin" size={13} />
                                                    <span>IA Processando Comprovante...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={13} />
                                                    <span>✨ Autopreencher com IA (OCR)</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Campos de Contador */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider pl-1">Tipo</label>
                                        <select 
                                            value={questCollectTipo} 
                                            onChange={e => {
                                                setQuestCollectTipo(e.target.value);
                                                if (e.target.value === 'PB') setQuestCollectColor('');
                                            }}
                                            className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-bold bg-white text-slate-700"
                                        >
                                            <option value="PB">P&B (Mono)</option>
                                            <option value="Color">Colorida</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider pl-1">Contador P&B</label>
                                        <input 
                                            type="number"
                                            value={questCollectPB}
                                            onChange={e => setQuestCollectPB(e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-bold bg-white text-slate-700"
                                            placeholder="Valor PB"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider pl-1">Contador Color</label>
                                        <input 
                                            type="number"
                                            value={questCollectTipo === 'PB' ? '' : questCollectColor}
                                            onChange={e => setQuestCollectColor(e.target.value)}
                                            disabled={questCollectTipo === 'PB'}
                                            className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-bold bg-white text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                                            placeholder={questCollectTipo === 'PB' ? "Desativado" : "Valor Color"}
                                        />
                                    </div>
                                </div>

                                {/* Botões de Ação */}
                                <div className="flex gap-3 pt-4 border-t border-slate-100">
                                    <button 
                                        onClick={() => { setSelectedPrinterForQuestCollect(null); setQuestCollectFile(null); setQuestCollectPreview(''); }}
                                        disabled={isUploadingQuestCollect}
                                        className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-extrabold transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={handleSaveQuestCollect}
                                        disabled={isUploadingQuestCollect}
                                        className="w-1/2 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 transition-all transform active:scale-95"
                                    >
                                        {isUploadingQuestCollect ? (
                                            <>
                                                <RefreshCw className="animate-spin" size={14} />
                                                <span>Salvando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check size={14} />
                                                <span>Confirmar Coleta</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* TELA 2: Painel de Progresso e Checklist */
                            <div className="p-6 space-y-6">
                                {/* Alertas e Cronômetro */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                                    <div className="flex items-center gap-2 text-orange-800">
                                        <Clock size={16} className="text-orange-600 flex-shrink-0" />
                                        <span className="text-xs font-bold">Prazo Limite da Coleta:</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-extrabold px-3 py-1 rounded-lg border ${
                                            isQuestExpired 
                                                ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                                                : 'bg-orange-100 border-orange-200 text-orange-800'
                                        }`}>
                                            {isQuestExpired ? '⚠️ Quest Expirada!' : calculateTimeRemaining()}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold">
                                            Fim: {new Date(activeQuest.endDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Alerta se Expirado */}
                                {isQuestExpired && (
                                    <div className="p-4 bg-rose-50 text-rose-800 rounded-2xl border border-rose-200/50 flex items-start gap-2.5 text-xs font-semibold animate-pulse-soft">
                                        <AlertCircle className="text-rose-600 mt-0.5 flex-shrink-0" size={16} />
                                        <span>
                                            <strong>Limite de 1 semana atingido!</strong> A missão expirou. Você ainda pode gerar os relatórios compilados com o que foi coletado até agora, mas deve concluir a missão para liberar o painel.
                                        </span>
                                    </div>
                                )}

                                {/* Barra de Progresso Visual */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-bold">Progresso da Coleta USB</span>
                                        <span className="text-slate-800 font-extrabold">
                                            {collectedPrinters.length} de {usbPrinters.length} concluídas ({usbPrinters.length > 0 ? Math.round((collectedPrinters.length / usbPrinters.length) * 100) : 0}%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200/30">
                                        <div 
                                            className="bg-gradient-to-r from-amber-500 to-orange-600 h-full rounded-full transition-all duration-500" 
                                            style={{ width: `${usbPrinters.length > 0 ? (collectedPrinters.length / usbPrinters.length) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Tabs de Filtro */}
                                <div className="flex border-b border-slate-100 pb-0.5">
                                    <button 
                                        onClick={() => setQuestActiveTab('pending')}
                                        className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                                            questActiveTab === 'pending'
                                                ? 'border-orange-600 text-orange-600 font-black'
                                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        <span>🔴 Faltam</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${questActiveTab === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {pendingPrinters.length}
                                        </span>
                                    </button>
                                    <button 
                                        onClick={() => setQuestActiveTab('collected')}
                                        className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                                            questActiveTab === 'collected'
                                                ? 'border-orange-600 text-orange-600 font-black'
                                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        <span>🟢 Coletados</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${questActiveTab === 'collected' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {collectedPrinters.length}
                                        </span>
                                    </button>
                                </div>

                                {/* Listas de Impressoras */}
                                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {questActiveTab === 'pending' ? (
                                        pendingPrinters.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center gap-1 bg-slate-50 rounded-2xl border border-dashed">
                                                <span>🎉</span> Excelente! Todos os contadores USB já foram coletados!
                                            </div>
                                        ) : (
                                            pendingPrinters.map(p => (
                                                <div 
                                                    key={p.id} 
                                                    className="p-3 bg-slate-50 border border-slate-200/50 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-100/50 transition-colors"
                                                >
                                                    <div className="min-w-0 flex-grow">
                                                        <h5 className="text-xs font-black text-slate-800 truncate">{p.model}</h5>
                                                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">
                                                            Série: <strong className="text-slate-700">{p.serial}</strong> &middot; Local: <strong className="text-slate-700">{p.location}</strong>
                                                        </p>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleSelectPrinterForQuest(p)}
                                                        disabled={isQuestExpired}
                                                        className={`bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-1.5 px-3 rounded-lg text-[10px] flex items-center gap-1 transition-all transform active:scale-95 ${isQuestExpired ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        📸 Coletar
                                                    </button>
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        collectedPrinters.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed">
                                                Nenhum contador coletado nesta quest ainda.
                                            </div>
                                        ) : (
                                            collectedPrinters.map(p => (
                                                <div 
                                                    key={p.id} 
                                                    className="p-3 bg-emerald-50/20 border border-emerald-100 rounded-2xl flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 flex-grow">
                                                        {p.contadorImageUrl && (
                                                            <a href={p.contadorImageUrl} target="_blank" rel="noreferrer" className="flex-shrink-0">
                                                                <img 
                                                                    src={p.contadorImageUrl} 
                                                                    alt="Comprovante" 
                                                                    className="w-9 h-9 object-cover rounded-lg border border-emerald-200" 
                                                                />
                                                            </a>
                                                        )}
                                                        <div className="min-w-0 flex-grow">
                                                            <h5 className="text-xs font-black text-slate-800 truncate">{p.model}</h5>
                                                            <p className="text-[10px] text-slate-500 font-semibold truncate">
                                                                Série: <strong className="text-slate-700">{p.serial}</strong> &middot; Local: <strong className="text-slate-700">{p.location}</strong>
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                                                                    P&B: {p.contadorPB !== undefined && p.contadorPB !== null ? p.contadorPB : (p.contador || 0)}
                                                                </span>
                                                                {p.tipo === 'Color' && p.contadorColor !== undefined && p.contadorColor !== null && (
                                                                    <span className="text-[9px] bg-sky-100 text-sky-800 font-extrabold px-1.5 py-0.5 rounded">
                                                                        Color: {p.contadorColor}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleSelectPrinterForQuest(p)}
                                                        disabled={isQuestExpired}
                                                        className={`bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-1.5 px-3 rounded-lg text-[10px] border border-slate-200 transition-all transform active:scale-95 ${isQuestExpired ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        ✏️ Ajustar
                                                    </button>
                                                </div>
                                            ))
                                        )
                                    )}
                                </div>

                                {/* Exportações e Encerramento */}
                                <div className="border-t border-slate-100 pt-5 space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <button 
                                            onClick={handleExportSimpressExcel}
                                            className="w-full sm:w-1/2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-xs"
                                        >
                                            <FileText size={14} className="text-emerald-600" />
                                            <span>Gerar Planilha Simpress</span>
                                        </button>
                                        <button 
                                            onClick={handleGeneratePDFComprovantes}
                                            className="w-full sm:w-1/2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-xs"
                                        >
                                            <FileText size={14} className="text-rose-500" />
                                            <span>Compilar Fotos (PDF)</span>
                                        </button>
                                    </div>

                                    {isAdmin && (
                                        <button 
                                            onClick={handleFinishQuest}
                                            className="w-full bg-simpress-magenta hover:bg-simpress-magenta/90 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-simpress-magenta/15 transition-all transform active:scale-95 animate-pulse-soft"
                                        >
                                            <Trophy size={14} />
                                            <span>Concluir e Encerrar Missão Mensal</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="text-center py-6 text-slate-400 text-xs flex flex-col items-center gap-2 bg-white border-t border-slate-100 mt-10">
                <p>&copy; {new Date().getFullYear()} Feito por <strong>CHIKU</strong> &middot; Simpress Suite</p>
                <button 
                    onClick={onOpenPrivacy}
                    className="text-simpress-blue hover:text-simpress-magenta transition-colors flex items-center gap-1 font-bold"
                >
                    <Shield size={13}/> Termos de Privacidade & Conformidade LGPD
                </button>
            </footer>

            {/* Floating Action Button (FAB) for AI Command on Mobile */}
            {isAdmin && (
                <button
                    type="button"
                    onClick={() => setShowGeminiModal(true)}
                    className="lg:hidden fixed bottom-6 right-6 z-40 bg-gradient-to-r from-violet-600 to-indigo-600 text-white w-14 h-14 rounded-full shadow-2xl shadow-violet-600/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 border border-violet-500/20 animate-pulse-soft hover:shadow-violet-600/60"
                    title="Comando IA"
                >
                    <Sparkles className="text-white" size={24} />
                </button>
            )}
        </div>
    );
}
