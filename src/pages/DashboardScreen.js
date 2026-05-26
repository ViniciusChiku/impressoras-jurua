import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    LogOut, PlusCircle, Download, Search, PrinterIcon, 
    FileUp, ShieldCheck, ShieldOff, ArrowUp, ArrowDown, 
    Copy, Shield, Database, Barcode as BarcodeIcon, Filter, Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

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
                contador: result.contador !== undefined && result.contador !== null ? result.contador : (existingPrinter?.contador || '')
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
            Contador: p.contador || '',
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
                                {isAdmin && (
                                    <>
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
                                    </>
                                )}
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
