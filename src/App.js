import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    signInAnonymously 
} from 'firebase/auth';
import { 
    collection, 
    onSnapshot, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc,
    writeBatch,
    query,
    where,
    getDocs   
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import * as XLSX from 'xlsx';
import { RotateCw } from 'lucide-react';

// Importações de Serviços e Configurações
import { auth, db, storage, ADMIN_EMAIL, printersCollectionPath } from './services/firebase';

// Importações de Componentes
import Notification from './components/Notification';
import PrivacyBanner from './components/PrivacyBanner';
import PrivacyPolicyModal from './components/PrivacyPolicyModal';

// Importações de Páginas
import LoginScreen from './pages/LoginScreen';
import DashboardScreen from './pages/DashboardScreen';
import PrinterFormScreen from './pages/PrinterFormScreen';

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
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

    // Monitoramento de Autenticação Firebase
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

    // Sincronização do Banco de Dados Firestore
    useEffect(() => {
        if (!currentUser && !isGuest) return;
        setPrintersLoading(true);
        const printersCollectionRef = collection(db, printersCollectionPath);
        const unsubscribe = onSnapshot(printersCollectionRef, (snapshot) => {
            const printersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPrinters(printersData);
            setPrintersLoading(false);
        }, (error) => {
            console.error("Erro Firestore Listener:", error);
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
            showNotification('Login de administrador realizado!', 'success');
            navigate('/');
        } catch (error) {
            console.error("Erro de login admin:", error);
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
            console.error("Erro de login convidado:", error);
            showNotification('Erro ao entrar como convidado.', 'error');
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        showNotification('Sessão encerrada com sucesso.', 'info');
        navigate('/login');
    };

    // CRUD - Criar ou Atualizar Impressora
    const handleSavePrinter = async (printerData, printerIdToUpdate = null) => {
        if (!isAdmin) {
            showNotification('Apenas administradores podem modificar dados.', 'error');
            return false;
        }
        
        // Destrutura o swap para evitar salvá-lo no documento principal
        const { swap, ...cleanedPrinterData } = printerData;

        // Validação de número de série duplicado
        if (cleanedPrinterData.serial) {
            const serialParaVerificar = cleanedPrinterData.serial;
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
                    showNotification('Erro: Número de série já cadastrado no sistema.', 'error');
                    return false;
                }
            } catch (error) {
                console.error("Erro na verificação de serial:", error);
                showNotification('Erro ao verificar número de série.', 'error');
                return false;
            }
        }

        try {
            if (printerIdToUpdate) {
                await updateDoc(doc(db, printersCollectionPath, printerIdToUpdate), cleanedPrinterData);
                showNotification('Impressora atualizada com sucesso!', 'success');
            } else {
                await addDoc(collection(db, printersCollectionPath), cleanedPrinterData);
                showNotification('Impressora cadastrada com sucesso!', 'success');
            }

            // Executa a troca bidirecional caso exista dados de swap da IA
            if (swap && swap.outgoingSerial) {
                const outgoingPrinter = printers.find(
                    p => String(p.serial).trim().toUpperCase() === String(swap.outgoingSerial).trim().toUpperCase()
                );
                if (outgoingPrinter) {
                    const outgoingRef = doc(db, printersCollectionPath, outgoingPrinter.id);
                    await updateDoc(outgoingRef, {
                        status: swap.status || 'Backup',
                        location: swap.location || 'Estoque de Manutenção',
                        departamento: swap.departamento || 'Manutenção',
                        ip: swap.ip || 'USB',
                        observacao: swap.observacao || `Substituída automaticamente pelo ativo ${cleanedPrinterData.serial}.`
                    });
                    showNotification(`Troca Concluída! Impressora antiga (${swap.outgoingSerial}) movida para ${swap.location || 'Estoque'}.`, 'success', 5000);
                }
            }

            return true;
        } catch (error) {
            console.error("Erro ao salvar:", error);
            showNotification('Erro ao salvar impressora.', 'error');
            return false;
        }
    };

    // CRUD - Excluir Impressora
    const handleDeletePrinter = async (printerId) => {
        if (!isAdmin) {
            showNotification('Acesso negado. Apenas administradores.', 'error');
            return;
        }
        const printer = printers.find(p => p.id === printerId);
        
        try {
            if (printer?.contadorImageUrl) {
                try {
                    const imgRef = ref(storage, printer.contadorImageUrl);
                    await deleteObject(imgRef);
                } catch (e) { 
                    console.warn("Imagem não encontrada no storage ou já removida."); 
                }
            }
            await deleteDoc(doc(db, printersCollectionPath, printerId));
            showNotification('Impressora removida com sucesso.', 'success');
        } catch (error) {
            console.error("Erro ao deletar:", error);
            showNotification('Erro ao excluir impressora.', 'error');
        }
    };

    // Importação de Impressoras via Planilha Excel
    const handleImportFromExcel = async (file) => {
        if (!isAdmin) {
            showNotification('Erro: Permissão de administrador requerida.', 'error');
            return;
        }
        if (!file) {
            showNotification('Selecione um arquivo de planilha para importar.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                
                if (jsonData.length < 2) { 
                    showNotification('Arquivo vazio ou inválido.', 'error'); 
                    return; 
                }
                
                const header = jsonData[0].map(h => String(h).trim().toLowerCase());
                const idx = {
                    model: header.indexOf('modelo'),
                    local: header.indexOf('local'),
                    ip: header.indexOf('ip'),
                    serial: header.indexOf('serial'),
                    dept: header.indexOf('departamento')
                };

                if (idx.model === -1 || idx.local === -1 || idx.ip === -1) {
                    showNotification('Cabeçalho inválido. Requer colunas: Modelo, Local, IP.', 'error');
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
                        departamento: idx.dept > -1 ? format(row[idx.dept], 'cap') : '',
                        status: 'Funcionando'
                    };
                }).filter(p => p.model && p.location && p.ip);

                if (toImport.length === 0) {
                    showNotification('Nenhuma impressora válida para importar.', 'error');
                    return;
                }

                const batch = writeBatch(db);
                toImport.forEach(p => {
                    const newDocRef = doc(collection(db, printersCollectionPath));
                    batch.set(newDocRef, p);
                });
                await batch.commit();
                showNotification(`${toImport.length} impressoras importadas com sucesso!`, 'success');
            } catch (err) {
                console.error("Erro na importação:", err);
                showNotification('Erro ao importar planilha. Verifique o formato.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    if (authLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <RotateCw className="animate-spin text-blue-600" size={48}/>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Notificações no Topo da Tela */}
            <Notification 
                message={notification.message} 
                type={notification.type} 
                onDismiss={() => setNotification({ message: '', type: '' })}
            />
            
            {/* Configuração de Rotas */}
            <Routes>
                <Route 
                    path="/login" 
                    element={
                        currentUser 
                            ? <Navigate to="/"/> 
                            : <LoginScreen 
                                onAdminLogin={handleAdminLogin} 
                                onGuestLogin={handleGuestLogin}
                                onOpenPrivacy={() => setShowPrivacyModal(true)}
                              />
                    } 
                />
                
                <Route 
                    path="/" 
                    element={
                        !currentUser 
                            ? <Navigate to="/login"/> 
                            : <DashboardScreen 
                                currentUser={currentUser}
                                isAdmin={isAdmin}
                                isGuest={isGuest}
                                printers={printers}
                                printersLoading={printersLoading}
                                handleLogout={handleLogout}
                                handleImportFromExcel={handleImportFromExcel}
                                showNotification={showNotification}
                                onOpenPrivacy={() => setShowPrivacyModal(true)}
                              />
                    } 
                />

                <Route 
                    path="/impressora/nova" 
                    element={
                        currentUser 
                            ? <PrinterFormScreen 
                                isAdmin={isAdmin} 
                                handleSavePrinterProp={handleSavePrinter}
                                showNotification={showNotification}
                              /> 
                            : <Navigate to="/login"/>
                    } 
                />

                <Route 
                    path="/impressora/editar/:idImpressora" 
                    element={
                        currentUser 
                            ? <PrinterFormScreen 
                                isAdmin={isAdmin} 
                                handleSavePrinterProp={handleSavePrinter}
                                handleDeletePrinterProp={handleDeletePrinter}
                                showNotification={showNotification}
                              /> 
                            : <Navigate to="/login"/>
                    } 
                />
            </Routes>

            {/* Banner LGPD no rodapé para novas visitas */}
            <PrivacyBanner onOpenPrivacyPolicy={() => setShowPrivacyModal(true)} />

            {/* Modal de Política de Privacidade & DPO */}
            <PrivacyPolicyModal 
                isOpen={showPrivacyModal} 
                onClose={() => setShowPrivacyModal(false)} 
            />
        </div>
    );
}