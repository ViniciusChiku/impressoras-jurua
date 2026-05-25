import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    signInAnonymously 
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc,
    writeBatch,
    query,
    where,
    getDocs,
    getDoc   
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import * as XLSX from 'xlsx';

import { 
    LogOut, PlusCircle, Download, Trash2, Search, PrinterIcon, 
    AlertCircle, CheckCircle, XCircle, FileUp, RotateCw, 
    ShieldCheck, ShieldOff, Building, Network, Users, 
    ArrowUp, ArrowDown, Barcode, Copy, Camera
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const appId = process.env.REACT_APP_FIREBASE_APP_ID || 'printer-manager-app';
const ADMIN_EMAIL = 'vini.chiku123@gmail.com'; 

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const storage = getStorage(fbApp);

const printersCollectionPath = `artifacts/${appId}/public/data/printers`;

// --- COMPONENTES AUXILIARES ---

const Notification = ({ message, type, onDismiss }) => {
    if (!message) return null;
    const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
    const Icon = type === 'error' ? XCircle : type === 'success' ? CheckCircle : AlertCircle;

    return (
        <div className={`fixed top-5 right-5 ${bgColor} text-white p-4 rounded-lg shadow-lg flex items-center z-50 animate-bounce`}>
            <Icon size={24} className="mr-3" />
            <span>{message}</span>
            {onDismiss && (
                <button onClick={onDismiss} className="ml-4 text-xl font-bold">&times;</button>
            )}
        </div>
    );
};

const StatusBadge = ({ status }) => {
    let bgColorClass = 'bg-gray-100';
    let textColorClass = 'text-gray-800';

    switch (status) {
        case 'Funcionando':
            bgColorClass = 'bg-green-100';
            textColorClass = 'text-green-800';
            break;
        case 'Defeito':
            bgColorClass = 'bg-red-100';
            textColorClass = 'text-red-800';
            break;
        case 'Manutenção':
            bgColorClass = 'bg-yellow-100';
            textColorClass = 'text-yellow-800';
            break;
        case 'Backup':
            bgColorClass = 'bg-blue-100';
            textColorClass = 'text-blue-800';
            break;
            case 'Aguardando retirada':
            bgColorClass = 'bg-purple-100';
            textColorClass = 'text-purple-800';
            break;
        default:
            break;
    }

    return (
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${bgColorClass} ${textColorClass}`}>
            {status || 'N/D'}
        </span>
    );
};

// --- APP PRINCIPAL ---

export default function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

function AppContent() {
    const navigate = useNavigate(); 
    const [currentUser, setCurrentUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isGuest, setIsGuest] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [printers, setPrinters] = useState([]);
    const [printersLoading, setPrintersLoading] = useState(true);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [showImportModal, setShowImportModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDashboardScanner, setShowDashboardScanner] = useState(false);
    const [filterDepartamento] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'departamento', direction: 'asc' });
    const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
};

    // Monitoramento da Auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                setIsAdmin(user.email === ADMIN_EMAIL);
                setIsGuest(user.isAnonymous);
            } else {
                setCurrentUser(null);
                setIsAdmin(false);
                setIsGuest(false);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Busca das impressoras
    useEffect(() => {
        if (!currentUser && !isGuest) return;
        setPrintersLoading(true);
        const printersCollectionRef = collection(db, printersCollectionPath);
        const unsubscribe = onSnapshot(printersCollectionRef, (snapshot) => {
            const printersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPrinters(printersData);
            setPrintersLoading(false);
        }, (error) => {
            console.error("Erro Firestore:", error);
            showNotification(`Erro ao carregar dados. Verifique permissões.`, 'error');
            setPrintersLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, isGuest]);

    const showNotification = (message, type = 'info', duration = 3000) => {
        setNotification({ message, type });
        setTimeout(() => setNotification({ message: '', type: '' }), duration);
    };

    const handleAdminLogin = async (email, password) => {
        setAuthLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showNotification('Login de administrador realizado com sucesso!', 'success');
            navigate('/');
        } catch (error) {
            showNotification('Falha no login. Verifique as credenciais.', 'error');
            setAuthLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setAuthLoading(true);
        try {
            await signInAnonymously(auth);
            showNotification('Entrando como convidado...', 'success');
            navigate('/');
        } catch (error) {
            showNotification('Erro ao entrar como convidado.', 'error');
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    // Lógica Unificada de Filtragem e Ordenação
    const filteredPrinters = useMemo(() => {
        const filtered = printers.filter(printer => {
            const term = searchTerm.toLowerCase();
            const dept = filterDepartamento.toLowerCase();
            const matchesSearch = 
                (printer.model || '').toLowerCase().includes(term) ||
                (printer.location || '').toLowerCase().includes(term) ||
                (printer.ip || '').toLowerCase().includes(term) ||
                (printer.serial || '').toLowerCase().includes(term) ||
                (printer.departamento || '').toLowerCase().includes(term);
            const matchesDept = filterDepartamento ? (printer.departamento || '').toLowerCase() === dept : true;
            return matchesSearch && matchesDept;
        });

        const sorted = [...filtered];
        sorted.sort((a, b) => {
            let key1 = sortConfig.key || 'departamento';
            let dir1 = sortConfig.direction;
            let key2 = key1 === 'serial' ? 'model' : 'serial';

            const valA1 = String(a[key1] || '').toLowerCase();
            const valB1 = String(b[key1] || '').toLowerCase();

            let comparison = 0;
            if (valA1 < valB1) comparison = -1;
            else if (valA1 > valB1) comparison = 1;

            if (comparison !== 0) return dir1 === 'asc' ? comparison : -comparison;

            const valA2 = String(a[key2] || '').toLowerCase();
            const valB2 = String(b[key2] || '').toLowerCase();
            if (valA2 < valB2) return -1;
            if (valA2 > valB2) return 1;
            return 0;
        });
        return sorted;
    }, [printers, searchTerm, filterDepartamento, sortConfig]);


    // CRUD - Save (Add/Update)
    const handleSavePrinter = async (printerData, printerIdToUpdate = null) => {
        if (!isAdmin) return false;
        
        // Verificação de serial
        if (printerData.serial) {
             const serialParaVerificar = printerData.serial;
             const q = query(collection(db, printersCollectionPath), where("serial", "==", serialParaVerificar));
             try {
                 const querySnapshot = await getDocs(q);
                 let isDuplicate = false;
                 if (!querySnapshot.empty) {
                     if (printerIdToUpdate) {
                         querySnapshot.forEach(docFound => {
                             if (docFound.id !== printerIdToUpdate) isDuplicate = true;
                         });
                     } else {
                         isDuplicate = true;
                     }
                 }
                 if (isDuplicate) {
                     showNotification('Erro: Número de série já cadastrado.', 'error');
                     return false;
                 }
             } catch (error) {
                 console.error(error);
                 return false;
             }
        }

        try {
            if (printerIdToUpdate) {
                await updateDoc(doc(db, printersCollectionPath, printerIdToUpdate), printerData);
                showNotification('Impressora atualizada!', 'success');
            } else {
                await addDoc(collection(db, printersCollectionPath), printerData);
                showNotification('Impressora cadastrada!', 'success');
            }
            return true;
        } catch (error) {
            showNotification('Erro ao salvar.', 'error');
            return false;
        }
    };

    const handleDeletePrinter = async (printerId) => {
        if (!isAdmin) return;
        const printer = printers.find(p => p.id === printerId);
        
        try {
            if (printer?.contadorImageUrl) {
                try {
                    await deleteObject(ref(storage, printer.contadorImageUrl));
                } catch (e) { console.warn("Imagem não encontrada no storage ou já deletada."); }
            }
            await deleteDoc(doc(db, printersCollectionPath, printerId));
            showNotification('Impressora removida.', 'success');
        } catch (error) {
            showNotification('Erro ao excluir.', 'error');
        }
    };

    const handleExport = () => {
        const data = filteredPrinters.map(p => ({
            Serial: p.serial, Modelo: p.model, Departamento: p.departamento, Local: p.location, IP: p.ip, Status: p.status
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Impressoras");
        XLSX.writeFile(wb, "Relatorio_Mapa_Jurua.xlsx");
        showNotification('Relatório baixado!', 'success');
    };

    const handleCopy = (e, textToCopy, label) => {
        e.stopPropagation();
        navigator.clipboard.writeText(textToCopy);
        showNotification(`${label} copiado!`, 'success', 2000);
    };

    const handleImportFromExcel = async (file) => {
        if (!isAdmin || !file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                
                if (jsonData.length < 2) { showNotification('Arquivo inválido.', 'error'); return; }
                
                const header = jsonData[0].map(h => String(h).trim().toLowerCase());
                const idx = {
                    model: header.indexOf('modelo'),
                    local: header.indexOf('local'),
                    ip: header.indexOf('ip'),
                    serial: header.indexOf('serial'),
                    dept: header.indexOf('departamento')
                };

                if (idx.model === -1 || idx.local === -1 || idx.ip === -1) {
                    showNotification('Cabeçalho inválido. Requer: Modelo, Local, IP.', 'error');
                    return;
                }

                const toImport = jsonData.slice(1).map(row => {
                    const format = (val, type) => {
                        const str = String(val || '').trim();
                        if (type === 'serial') return str.toUpperCase();
                        if (type === 'cap') return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
                        return str;
                    };
                    
                    return {
                        model: format(row[idx.model]),
                        location: format(row[idx.local], 'cap'),
                        ip: format(row[idx.ip]),
                        serial: idx.serial > -1 ? format(row[idx.serial], 'serial') : '',
                        departamento: idx.dept > -1 ? format(row[idx.dept], 'cap') : ''
                    };
                }).filter(p => p.model && p.location && p.ip);

                if (toImport.length === 0) return;

                const batch = writeBatch(db);
                toImport.forEach(p => batch.set(doc(collection(db, printersCollectionPath)), p));
                await batch.commit();
                showNotification(`${toImport.length} impressoras importadas!`, 'success');
                setShowImportModal(false);
            } catch (err) {
                showNotification('Erro na importação.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };
    const sortedPrinters = [...filteredPrinters].sort((a, b) => {
    const valorA = (a[sortConfig.key] || '').toString().toLowerCase();
    const valorB = (b[sortConfig.key] || '').toString().toLowerCase();
    
    if (valorA < valorB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valorA > valorB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
    });
    if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-100"><RotateCw className="animate-spin text-blue-600" size={48}/></div>;

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            <Notification message={notification.message} type={notification.type} onDismiss={() => setNotification({message:'', type:''})}/>
            
            <Routes>
                <Route path="/login" element={currentUser ? <Navigate to="/"/> : <LoginScreen onAdminLogin={handleAdminLogin} onGuestLogin={handleGuestLogin}/>} />
                
                <Route path="/" element={
                    !currentUser ? <Navigate to="/login"/> : (
                        <>
                            <header className="bg-blue-600 text-white p-4 shadow-lg sticky top-0 z-30">
                                <div className="container mx-auto flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <PrinterIcon size={32}/>
                                        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Mapa Juruá</h1>
                                    </div>
                                    <div className="flex flex-col items-center sm:items-end text-right">
                                        <span className="text-xs sm:text-sm">{currentUser.email || 'Convidado'}</span>
                                        <div className="flex items-center mt-1">
                                            {isAdmin && <ShieldCheck size={18} className="mr-1 text-green-300"/>}
                                            {isGuest && <ShieldOff size={18} className="mr-1 text-yellow-300"/>}
                                            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-700 text-white font-semibold py-1 px-2 rounded text-xs flex items-center"><LogOut size={14} className="mr-1"/> Sair</button>
                                        </div>
                                    </div>
                                </div>
                            </header>

                            <main className="container mx-auto p-4 md:p-6">
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Toolbar */}
                                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">                                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => navigate('/impressora/nova')} className="w-full md:w-auto bg-transparent hover:bg-green-500 text-green-600 font-semibold hover:text-white py-2 px-4 border border-green-500 hover:border-transparent rounded-lg flex items-center justify-center transition-all">
                                                        <PlusCircle size={18} className="mr-2"/> Adicionar Impressora
                                                    </button>
                                                    <button onClick={() => setShowImportModal(true)} className="w-full md:w-auto bg-blue-500 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center transition-all">
                                                        <FileUp size={18} className="mr-2"/> Importar Excel
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={handleExport} className="w-full md:w-auto bg-teal-500 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center transition-all">
                                                <Download size={18} className="mr-2"/> Exportar Excel
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                            <div className="relative w-full md:w-64">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar impressora..." 
                                                    value={searchTerm} 
                                                    onChange={e => setSearchTerm(e.target.value)} 
                                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2a68eb] outline-none text-slate-700"
                                                />
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => setShowDashboardScanner(true)}
                                                className="bg-[#2a68eb] text-white p-2.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center shadow-sm"
                                                title="Pesquisar por Código de Barras"
                                            >
                                                <Camera size={20}/>
                                            </button>
                                        </div>
                                    </div>
                                            {/* Modal do Leitor para a Pesquisa */}
                                            <BarcodeScannerModal 
                                                isOpen={showDashboardScanner} 
                                                onClose={() => setShowDashboardScanner(false)} 
                                                onScan={(textLido) => {
                                                    setSearchTerm(textLido); // Joga o código direto na barra de pesquisa!
                                                }} 
                                            />
                                    {/* Tabela */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    {/* 1. SÉRIE */}
                                                    <th className="px-6 py-3 cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('serial')}>
                                                        <div className={`flex items-center text-left text-xs font-semibold uppercase tracking-wider transition-colors ${sortConfig.key === 'serial' ? 'text-blue-600' : 'text-slate-500'}`}>
                                                            Nº de Série
                                                            {sortConfig.key === 'serial' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600"/> : <ArrowDown size={14} className="ml-1 text-blue-600"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                                        </div>
                                                    </th>
                                                    {/* 2. IP */}
                                                    <th className="px-6 py-3 cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('ip')}>
                                                        <div className={`flex items-center text-left text-xs font-semibold uppercase tracking-wider transition-colors ${sortConfig.key === 'ip' ? 'text-blue-600' : 'text-slate-500'}`}>
                                                            IP / USB
                                                            {sortConfig.key === 'ip' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600"/> : <ArrowDown size={14} className="ml-1 text-blue-600"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                                        </div>
                                                    </th>
                                                    {/* 3. MODELO */}
                                                    <th className="px-6 py-3 cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('model')}>
                                                        <div className={`flex items-center text-left text-xs font-semibold uppercase tracking-wider transition-colors ${sortConfig.key === 'model' ? 'text-blue-600' : 'text-slate-500'}`}>
                                                            Modelo
                                                            {sortConfig.key === 'model' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600"/> : <ArrowDown size={14} className="ml-1 text-blue-600"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                                        </div>
                                                    </th>
                                                    {/* 4. DEPARTAMENTO */}
                                                    <th className="px-6 py-3 cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('departamento')}>
                                                        <div className={`flex items-center text-left text-xs font-semibold uppercase tracking-wider transition-colors ${sortConfig.key === 'departamento' ? 'text-blue-600' : 'text-slate-500'}`}>
                                                            Departamento
                                                            {sortConfig.key === 'departamento' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600"/> : <ArrowDown size={14} className="ml-1 text-blue-600"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                                        </div>
                                                    </th>
                                                    {/* 5. LOCAL */}
                                                    <th className="px-6 py-3 cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('location')}>
                                                        <div className={`flex items-center text-left text-xs font-semibold uppercase tracking-wider transition-colors ${sortConfig.key === 'location' ? 'text-blue-600' : 'text-slate-500'}`}>
                                                            Local
                                                            {sortConfig.key === 'location' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600"/> : <ArrowDown size={14} className="ml-1 text-blue-600"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                                        </div>
                                                    </th>
                                                    {/* 6. STATUS */}
                                                    <th className="px-6 py-3 cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                                                        <div className={`flex items-center text-left text-xs font-semibold uppercase tracking-wider transition-colors ${sortConfig.key === 'status' ? 'text-blue-600' : 'text-slate-500'}`}>
                                                            Status
                                                            {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600"/> : <ArrowDown size={14} className="ml-1 text-blue-600"/>) : <ArrowUp size={14} className="ml-1 text-transparent group-hover:text-slate-300"/>}
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {printersLoading ? (
                                                    <tr><td colSpan="6" className="p-12 text-center"><RotateCw className="animate-spin mx-auto text-blue-500 mb-2"/> Carregando...</td></tr>
                                                ) : filteredPrinters.length === 0 ? (
                                                    <tr><td colSpan="6" className="p-12 text-center text-slate-400">Nenhuma impressora encontrada.</td></tr>
                                                ) : sortedPrinters.map(p => (
                                                    <tr 
                                                        key={p.id} 
                                                        onClick={() => navigate(`/impressora/editar/${p.id}`)} 
                                                        className="bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors border-b border-slate-200 group"
                                                    >
                                                        {/* 1. SÉRIE */}
                                                        <td className="px-6 py-4 font-medium text-slate-900">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span>{p.serial}</span>
                                                                <button onClick={(e) => handleCopy(e, p.serial, 'Nº de Série')} className="text-slate-300 hover:text-blue-600 transition-colors p-1 rounded-md flex-shrink-0" title="Copiar Série"><Copy size={16}/></button>
                                                            </div>
                                                        </td>
                                                        {/* 2. IP (Movido para cá!) */}
                                                        <td className="px-6 py-4 text-slate-600">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span>{p.ip}</span>
                                                                <button onClick={(e) => handleCopy(e, p.ip, 'IP')} className="text-slate-300 hover:text-blue-600 transition-colors p-1 rounded-md flex-shrink-0" title="Copiar IP"><Copy size={16}/></button>
                                                            </div>
                                                        </td>
                                                        {/* 3. MODELO */}
                                                        <td className="px-6 py-4 text-slate-600">{p.model}</td>
                                                        {/* 4. DEPARTAMENTO */}
                                                        <td className="px-6 py-4 text-slate-600">{p.departamento}</td>
                                                        {/* 5. LOCAL */}
                                                        <td className="px-6 py-4 text-slate-600">{p.location}</td>
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
                            {isAdmin && <ImportExcelModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={handleImportFromExcel} />}
                            <footer className="text-center py-8 text-gray-500 text-sm">
                                <p>&copy; {new Date().getFullYear()} Feito por <strong>CHIKU</strong></p>
                            </footer>
                        </>
                    )
                } />

                <Route path="/impressora/nova" element={currentUser ? <PrinterFormScreen isAdmin={isAdmin} db={db} storage={storage} handleSavePrinterProp={handleSavePrinter} showNotification={showNotification} printersCollectionPath={printersCollectionPath} /> : <Navigate to="/login"/>} />
                <Route path="/impressora/editar/:idImpressora" element={currentUser ? <PrinterFormScreen isAdmin={isAdmin} db={db} storage={storage} handleSavePrinterProp={handleSavePrinter} handleDeletePrinterProp={handleDeletePrinter} showNotification={showNotification} printersCollectionPath={printersCollectionPath} /> : <Navigate to="/login"/>} />
            </Routes>
        </div>
    );
}

function PrinterFormScreen({ isAdmin, db, storage, handleSavePrinterProp, handleDeletePrinterProp, showNotification, printersCollectionPath }) {
    const navigate = useNavigate();
    const { idImpressora } = useParams();
    const isEditMode = !!idImpressora;

    const [isLoadingPrinterDetails, setIsLoadingPrinterDetails] = useState(isEditMode);
    const [isUploading, setIsUploading] = useState(false);
    const [showScanner, setShowScanner] = useState(false); // Controle da Câmera
    
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
    }, [isEditMode, idImpressora, db, printersCollectionPath, navigate, showNotification]);

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
                showNotification("Enviando imagem...", "info", 5000);
                await uploadBytes(imageRef, imageFile);
                imageUrlToSave = await getDownloadURL(imageRef);
                
                if (isEditMode && existingImageUrl && existingImageUrl !== imageUrlToSave) {
                    try { await deleteObject(ref(storage, existingImageUrl)); } catch (e) {}
                }
            } catch (error) {
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

    if (isLoadingPrinterDetails) return <div className="h-screen flex items-center justify-center bg-slate-100"><RotateCw className="animate-spin text-blue-600" size={48}/><p className="ml-4 text-xl text-gray-600">Carregando...</p></div>;

    const estiloCampo = "w-full p-3 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700 bg-white disabled:bg-slate-50 disabled:text-slate-400";

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 flex items-center justify-center">
            
            {/* Modal do Leitor de Código de Barras */}
            <BarcodeScannerModal 
                isOpen={showScanner} 
                onClose={() => setShowScanner(false)} 
                onScan={(textLido) => {
                    setSerial(textLido);
                }} 
            />

            <div className="w-full max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-10">
                
                <h2 className="text-xl md:text-2xl font-bold text-slate-700 text-center mb-8">
                    {isEditMode ? (isAdmin ? `Editar Impressora: ${serial || idImpressora}` : `Detalhes: ${serial || idImpressora}`) : 'Nova Impressora'}
                </h2>
                
                <form id="printer-form-id" onSubmit={handleSubmitFormulario} className="space-y-5">
                    
                    <Field 
                        label="Número de Série" 
                        icon={Barcode} 
                        onCopy={serial ? () => handleCopyField(serial, 'Nº de Série') : null}
                        onScan={isAdmin ? () => setShowScanner(true) : null}
                    >
                        <input disabled={!isAdmin} className={estiloCampo} value={serial} onChange={e => setSerial(e.target.value)} required placeholder="BRJ..."/>
                    </Field>
                    <Field 
                        label="Endereço IP" 
                        icon={Network}
                        onCopy={ip ? () => handleCopyField(ip, 'IP') : null}
                    >
                        <input disabled={!isAdmin} className={estiloCampo} value={ip} onChange={e => setIp(e.target.value)} required placeholder="192.168... ou USB"/>
                    </Field>
                    <Field label="Modelo da Impressora" icon={PrinterIcon}>
                        <input disabled={!isAdmin} className={estiloCampo} value={model} onChange={e => setModel(e.target.value)} required placeholder="HP LaserJet..."/>
                    </Field>

                    <Field label="Departamento" icon={Users}>
                        <input disabled={!isAdmin} className={estiloCampo} value={departamento} onChange={e => setDepartamento(e.target.value)} placeholder="TI, RH..."/>
                    </Field>

                    <Field label="Local" icon={Building}>
                        <input disabled={!isAdmin} className={estiloCampo} value={location} onChange={e => setLocation(e.target.value)} required placeholder="Sala 10..."/>
                    </Field>

                    <Field label="Status">
                        <select disabled={!isAdmin} className={estiloCampo} value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="Funcionando">Funcionando</option>
                            <option value="Defeito">Com Defeito</option>
                            <option value="Manutenção">Em Manutenção</option>
                            <option value="Backup">Backup</option>
                            <option value="Aguardando retirada">Aguardando retirada</option>
                        </select>
                    </Field>

                    <Field label="Observações">
                        <textarea disabled={!isAdmin} rows="3" className={`${estiloCampo} resize-y`} value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Adicione notas sobre a impressora, defeitos, manutenções, etc."/>
                    </Field>
                    
                    <div className="pt-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Imagem da Folha de Contadores</label>
                        <input 
                            disabled={!isAdmin} 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageFileChange} 
                            className={`block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-600 hover:file:bg-blue-200 cursor-pointer ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        
                        {(imagePreviewUrl || (isEditMode && existingImageUrl)) && (
                            <div className="mt-4 border p-4 rounded-lg flex flex-col items-center">
                                <a href={imagePreviewUrl || existingImageUrl} target="_blank" rel="noreferrer" title="Ver Tela Cheia">
                                    <img src={imagePreviewUrl || existingImageUrl} alt="Contador" className="h-40 w-auto object-contain rounded shadow-sm hover:opacity-90 transition-opacity"/>
                                </a>
                                {!imagePreviewUrl && existingImageUrl && (
                                    <div className="mt-2">
                                        <a href={existingImageUrl} download className="text-sm text-blue-600 hover:underline">Baixar Imagem</a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-10 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="w-full sm:w-auto">
                            {isAdmin && isEditMode && (
                                <button 
                                    type="button" 
                                    onClick={async () => { if (window.confirm('Tem certeza?')) { await handleDeletePrinterProp(idImpressora); navigate('/'); }}} 
                                    className="w-full sm:w-auto bg-[#da292e] hover:bg-red-700 text-white font-semibold py-2.5 px-6 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                                >
                                    <Trash2 size={18} className="mr-2"/> Excluir Impressora
                                </button>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <button 
                                type="button" 
                                onClick={() => navigate('/')} 
                                className="w-full sm:w-auto bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2.5 px-6 rounded-lg transition-colors"
                            >
                                {isAdmin ? 'Cancelar' : 'Voltar'}
                            </button>
                            {isAdmin && (
                                <button 
                                    type="submit" 
                                    disabled={isUploading} 
                                    className={`w-full sm:w-auto bg-[#2a68eb] hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors shadow-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isUploading ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ImportExcelModal({ isOpen, onClose, onImport }) {
    const [file, setFile] = useState(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Importar do Excel</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
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

const Field = ({ label, icon: Icon, onCopy, onScan, children }) => (
    <div className="w-full">
        <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-medium text-slate-700">{label}</label>
            <div className="flex gap-2">
                {onScan && (
                    <button 
                        type="button" 
                        onClick={onScan} 
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                        title="Escanear Código de Barras"
                    >
                        <Camera size={14}/> Escanear
                    </button>
                )}
                {onCopy && (
                    <button 
                        type="button" 
                        onClick={onCopy} 
                        className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"
                        title={`Copiar ${label}`}
                    >
                        <Copy size={14}/> Copiar
                    </button>
                )}
            </div>
        </div>
        <div className="relative">
            {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>}
            {React.cloneElement(children, { className: `${children.props.className} ${Icon ? 'pl-10' : ''}` })}
        </div>
    </div>
);

// Componente da Câmera FINAL E FUNCIONAL
// Componente da Câmera FINAL - O MESTRE DA TRANSFERÊNCIA
// Componente da Câmera - Passo a Passo
function BarcodeScannerModal({ isOpen, onClose, onScan }) {
    // Criamos um estado para o modal lembrar qual texto ele leu
    const [textoLido, setTextoLido] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setTextoLido(""); // Limpa a memória quando você abre a câmera de novo
            return;
        }

        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 100 } },
            false
        );

        scanner.render(
            (decodedText) => {
                // Quando ele lê, ele mostra na tela e manda pro formulário
                setTextoLido(decodedText); 
                onScan(decodedText);
            },
            (errorMessage) => {
                // Ignora errinhos normais de foco
            }
        );

        return () => {
            scanner.clear().catch(() => {});
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

function LoginScreen({ onAdminLogin, onGuestLogin }) {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');

    return (
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 to-indigo-900 p-4">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="bg-blue-100 text-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <PrinterIcon size={40}/>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800">Mapa Juruá</h2>
                </div>

                <form className="space-y-4" onSubmit={e => { e.preventDefault(); onAdminLogin(email, pass); }}>
                    <input type="email" placeholder="Email Admin" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required/>
                    <input type="password" placeholder="Senha" value={pass} onChange={e => setPass(e.target.value)} className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required/>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-200">Entrar como Admin</button>
                </form>

                <div className="relative flex items-center py-6">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-4 text-slate-400 text-sm">OU</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button onClick={onGuestLogin} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-all">Acesso Convidado</button>
            </div>
        </div>
    );
}

// Estilos globais e injeção do Tailwind via Link (Solução Mágica Visual)
const styles = `
.input-field {
    @apply w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700 disabled:bg-slate-50 disabled:text-slate-400;
}
`;
if (typeof document !== 'undefined') {
    // Carrega o Tailwind da internet direto no navegador
    if (!document.getElementById('tailwind-cdn')) {
        const script = document.createElement("script");
        script.id = 'tailwind-cdn';
        script.src = "https://cdn.tailwindcss.com";
        document.head.appendChild(script);
    }

    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}