import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Building, 
  CheckCircle, 
  Trash2, 
  CalendarCheck,
  AlertCircle,
  X,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  Printer,
  FileText,
  Lock,
  Unlock,
  Mail,
  Phone,
  Shield,
  Github,
  CreditCard,
  QrCode,
  Search
} from 'lucide-react';

// Importações do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  projectId: "gen-lang-client-0405590990",
  appId: "1:507764642698:web:856fe24c5779424c04ee73",
  apiKey: "AIzaSyDb3NCltHYiQjKPpfA615mnvcQ418ir6mA",
  authDomain: "gen-lang-client-0405590990.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-14d70056-6152-4443-af0a-c8856441a23e",
  storageBucket: "gen-lang-client-0405590990.firebasestorage.app",
  messagingSenderId: "507764642698",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const appId = 'ccbs-agendamento-final';

// --- CONSTANTES ---
const AUDITORIOS = ['AUDITÓRIO', 'SALA DE REUNIÃO'];
const HORARIOS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', 
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
];
const MASTER_PASSWORD = 'adminCCBS2026';

// LOGOS ATUALIZADAS (Links estáveis e diretos)
const UFCG_LOGO = 'https://raw.githubusercontent.com/ccbs-ufcg/agendamento-ccbs/main/public/logo-ufcg.png'; 
const CCBS_LOGO = 'https://raw.githubusercontent.com/ccbs-ufcg/agendamento-ccbs/main/public/logo-ccbs.png';

function formatarDataExtenso(dataCriacao: string) {
  const [dataParte] = dataCriacao.split(',');
  const [dia, mes, ano] = dataParte.split('/').map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [reservas, setReservas] = useState<any[]>([]);
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState<any>(null);
  const [showAdminUnlock, setShowAdminUnlock] = useState(false);
  const [cancelPassword, setCancelPassword] = useState('');
  const [adminUnlockPassword, setAdminUnlockPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayReservas, setSelectedDayReservas] = useState<{date: string, items: any[]} | null>(null);

  // Estados para Segunda Via
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [reprintId, setReprintId] = useState('');
  const [reprintPassword, setReprintPassword] = useState('');
  const [loadingSecondCopy, setLoadingSecondCopy] = useState(false);

  // REFERÊNCIA PARA CAPTURA DO PDF (ESSENCIAL!)
  const termoRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    auditorio: AUDITORIOS[0],
    data: '',
    horaInicio: '07:00',
    horaFim: '08:00',
    nomeEvento: '',
    requisitante: '',
    cpf: '',
    email: '',
    telefone: '',
    setor: '',
    senha: ''
  });

  // 1. Inicialização e Autenticação
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof (window as any).__initial_auth_token !== 'undefined' && (window as any).__initial_auth_token) {
          await signInWithCustomToken(auth, (window as any).__initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erro na autenticação:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if(u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Escuta em Tempo Real do Banco de Dados
  useEffect(() => {
    if (!user || !db) return;
    const reservasRef = collection(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs');
    
    const unsubscribe = onSnapshot(reservasRef, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReservas(lista.sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio)));
    }, (error) => {
      console.error("Erro ao sincronizar Firestore:", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const generateAISuggestions = async () => {
    if (!formData.requisitante || !formData.setor) {
      showToast('Preencha o requisitante e o setor para obter sugestões ✨', 'error');
      return;
    }
    setLoadingAI(true);
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requisitante: formData.requisitante, setor: formData.setor })
      });
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      const data = await response.json();
      setAiSuggestions(data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao conectar com a IA.', 'error');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'data') {
      const d = new Date(value + 'T12:00:00');
      if (d.getDay() === 0 || d.getDay() === 6) {
        showToast('Agendamentos apenas para dias úteis (Seg a Sex)!', 'error');
        return;
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.data || !formData.nomeEvento || !formData.requisitante || !formData.cpf || !formData.email || !formData.telefone || !formData.senha) {
      showToast('Preencha todos os campos obrigatórios!', 'error');
      return;
    }

    const conflito = reservas.find(r => 
      r.auditorio === formData.auditorio && 
      r.data === formData.data && 
      ((formData.horaInicio >= r.horaInicio && formData.horaInicio < r.horaFim) ||
       (formData.horaFim > r.horaInicio && formData.horaFim <= r.horaFim))
    );

    if (conflito) {
      showToast('Este horário já está ocupado!', 'error');
      return;
    }

    const id = Math.random().toString(36).substr(2, 9).toUpperCase();
    const novaReserva = { 
      ...formData, 
      id, 
      dataCriacao: new Date().toLocaleString('pt-BR') 
    };

    try {
      if (!db) {
        showToast('Banco de dados não configurado.', 'error');
        return;
      }
      const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', id);
      await setDoc(docRef, novaReserva);
      
      setShowReceipt(novaReserva);
      showToast('Sucesso! Reserva guardada.');
      setFormData({ 
        auditorio: AUDITORIOS[0], data: '', horaInicio: '07:00', horaFim: '08:00', 
        nomeEvento: '', requisitante: '', cpf: '', email: '', telefone: '', setor: '', senha: '' 
      });
      setAiSuggestions(null);
    } catch (e) {
      console.error(e);
      showToast('Erro ao comunicar com o servidor.', 'error');
    }
  };

  const confirmCancelation = async () => {
    if (cancelPassword === showCancelModal.senha || cancelPassword === MASTER_PASSWORD) {
      try {
        if (!db) {
          showToast('Banco de dados não configurado.', 'error');
          return;
        }
        const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', showCancelModal.id);
        await deleteDoc(docRef);
        
        showToast('Agendamento removido com sucesso!', 'info');
        setShowCancelModal(null);
        setCancelPassword('');
        setSelectedDayReservas(null);
      } catch (e) { 
        showToast('Erro ao remover.', 'error'); 
      }
    } else {
      showToast('Senha incorreta!', 'error');
    }
  };

  const handleAdminUnlock = () => {
    if (adminUnlockPassword === MASTER_PASSWORD) {
      setIsAdminMode(true);
      setShowAdminUnlock(false);
      setAdminUnlockPassword('');
      showToast('Modo Administrador Ativado', 'success');
    } else {
      showToast('Senha Mestra incorreta', 'error');
    }
  };

  // Buscar Segunda Via
  const handleFetchSecondCopy = async () => {
    if (!reprintId || !reprintPassword) {
      showToast('Insira o Protocolo e a Senha!', 'error');
      return;
    }
    setLoadingSecondCopy(true);
    try {
      const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', reprintId.toUpperCase().trim());
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const dadosReserva = docSnap.data();
        if (reprintPassword === dadosReserva.senha || reprintPassword === MASTER_PASSWORD) {
          setShowReceipt(dadosReserva);
          setShowReprintModal(false);
          setReprintId('');
          setReprintPassword('');
          showToast('Termo localizado com sucesso!');
        } else {
          showToast('Senha incorreta!', 'error');
        }
      } else {
        showToast('Protocolo não encontrado.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao buscar dados.', 'error');
    } verify {
      setLoadingSecondCopy(false);
    }
  };

  // FUNÇÃO DO PDF TOTALMENTE IMUNE A ERROS OKLCH E TRAVAMENTOS
  const handleDownloadPDF = async () => {
    const elemento = termoRef.current;
    if (!elemento) {
      showToast('Erro: Elemento do termo não carregado.', 'error');
      return;
    }
    
    setGeneratingPDF(true);
    
    try {
      // Pequeno tempo para sincronia do DOM do React
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(elemento, { 
        scale: 2, 
        backgroundColor: '#ffffff', 
        useCORS: true,
        allowTaint: true,
        ignoreElements: (el) => {
          // Ignora elementos com classes problemáticas se houver necessidade
          return false;
        }
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Termo_${showReceipt.id}.pdf`);
      showToast('PDF gerado com sucesso!');
    } catch (err: any) {
      console.error("Erro na geração do PDF:", err);
      showToast('Erro ao processar PDF. Tentando fallback...', 'error');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 md:h-24 bg-slate-50/50 border border-slate-50"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayReservas = reservas.filter(r => r.data === dateStr);
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push(
        <div 
          key={d} 
          onClick={() => dayReservas.length > 0 && setSelectedDayReservas({ date: dateStr, items: dayReservas })}
          className={`h-16 md:h-24 border border-slate-100 p-1 md:p-2 cursor-pointer transition-all hover:bg-blue-50 relative
            ${dayReservas.length > 0 ? 'bg-blue-50/40' : 'bg-white'}
            ${isToday ? 'ring-2 ring-blue-600 ring-inset' : ''}
          `}
        >
          <span className={`text-xs font-black ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{d}</span>
          <div className="mt-1 space-y-1">
            {dayReservas.slice(0, 2).map((r, idx) => (
              <div key={idx} className={`text-[8px] md:text-[9px] truncate px-1 rounded font-bold text-white uppercase
                ${r.auditorio === 'AUDITÓRIO' ? 'bg-blue-600' : 'bg-cyan-500'}`} title={r.nomeEvento}>
                {r.horaInicio} {r.nomeEvento || r.requisitante.split(' ')[0]}
              </div>
            ))}
            {dayReservas.length > 2 && <div className="text-[8px] text-slate-400 font-bold text-center">+{dayReservas.length - 2}</div>}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-12 flex flex-col print:bg-white print:p-0">
      
      {/* CABEÇALHO */}
      <header className="bg-blue-700 text-white shadow-xl sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1 rounded-xl">
              {/* Fallback de cor para prevenir falha oklch caso herde estilo */}
              <img src={UFCG_LOGO} alt="Logo UFCG" className="h-10 object-contain bg-white" crossOrigin="anonymous" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter">CCBS / UFCG</h1>
              <p className="text-blue-200 text-[11px] uppercase font-black tracking-[0.2em]">CAMPINA GRANDE</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowReprintModal(true)}
              className="bg-white text-blue-700 hover:bg-blue-50 font-black text-[11px] uppercase px-4 py-2 rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" /> 2ª Via do Termo
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black bg-blue-800/50 px-3 py-1 rounded-full border border-blue-500/30">NUVEM ATIVA</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 print:hidden flex-1">
        
        {/* FORMULÁRIO DE AGENDAMENTO */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden sticky top-24">
            <div className="bg-blue-800 p-6 flex items-center justify-between">
              <h2 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-blue-300" /> Novo Agendamento
              </h2>
              <button onClick={generateAISuggestions} disabled={loadingAI} className="bg-white/10 p-2 rounded-lg text-white hover:bg-white/20 transition-all" title="Pedir Sugestões à IA">
                {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-yellow-300" />}
              </button>
            </div>
            
            <form onSubmit={handleBooking} className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Local & Data</label>
                <select name="auditorio" value={formData.auditorio} onChange={handleChange} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold uppercase text-xs focus:border-blue-600 outline-none transition-all">
                  {AUDITORIOS.map(a => <option key={a}>{a}</option>)}
                </select>
                <input type="date" name="data" value={formData.data} onChange={handleChange} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600" />
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Início</label>
                    <select name="horaInicio" value={formData.horaInicio} onChange={handleChange} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs uppercase">
                      {HORARIOS.slice(0, -1).map(h => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Fim</label>
                    <select name="horaFim" value={formData.horaFim} onChange={handleChange} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs uppercase">
                      {HORARIOS.map(h => <option key={h} disabled={h <= formData.horaInicio}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Evento</label>
                <input type="text" name="nomeEvento" value={formData.nomeEvento} onChange={handleChange} placeholder="Nome do Evento" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 font-bold" />

                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Responsável</label>
                <input type="text" name="requisitante" value={formData.requisitante} onChange={handleChange} placeholder="Nome Completo" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600" />
                
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="CPF" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-sm" />
                  <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} placeholder="Telefone" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-sm" />
                </div>
                
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="E-mail" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-sm" />
                <input type="text" name="setor" value={formData.setor} onChange={handleChange} placeholder="Setor / Departamento" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600" />
                
                {aiSuggestions && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl animate-in zoom-in duration-300 mt-2">
                    <div className="flex items-center gap-2 text-yellow-700 font-black text-[10px] uppercase mb-1">
                      <Sparkles className="w-3 h-3" /> Sugestão da Inteligência Artificial
                    </div>
                    <p className="text-xs font-bold text-slate-800 mb-2">"{aiSuggestions.titulo}"</p>
                    <div className="flex flex-wrap gap-1">
                      {aiSuggestions.sugestoes.map((s: string, i: number) => (
                        <span key={i} className="text-[9px] bg-white border border-yellow-200 px-2 py-0.5 rounded-full text-yellow-800">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-blue-900/5 p-4 rounded-2xl border-2 border-blue-100 mt-4">
                  <div className="flex items-center gap-2 mb-2 text-blue-900">
                    <Lock className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Segurança</span>
                  </div>
                  <input type="password" name="senha" value={formData.senha} onChange={handleChange} placeholder="Senha p/ Cancelamento" className="w-full p-3 bg-white border border-blue-200 rounded-xl text-center font-bold tracking-widest text-blue-900 outline-none focus:border-blue-600" />
                </div>
              </div>

              <button type="submit" className="w-full py-5 mt-2 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95">
                <CheckCircle className="w-4 h-4" /> Confirmar Agendamento
              </button>
            </form>
          </div>
        </div>

        {/* CALENDÁRIO */}
        <div className="lg:col-span-8 space-y-6 relative">
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter capitalize">
                    {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate)}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{reservas.length} Eventos Ativos</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-white rounded-xl border border-slate-200 shadow-sm transition-all"><ChevronLeft /></button>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-white rounded-xl border border-slate-200 shadow-sm transition-all"><ChevronRight /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-100">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7">{renderCalendar()}</div>
            
            <div className="p-4 bg-slate-50 flex gap-6 justify-center border-t border-slate-100">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auditório</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-cyan-500 rounded-sm"></div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sala de Reunião</span></div>
            </div>
          </div>

          {/* DETALHES DO DIA */}
          {selectedDayReservas && (
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl animate-in slide-in-from-right duration-500 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
               <button onClick={() => setSelectedDayReservas(null)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-all"><X /></button>
               
               <div className="flex justify-between items-center mb-6">
                 <h4 className="text-2xl font-black uppercase flex items-center gap-3">
                   <Info className="w-6 h-6 text-blue-400" /> {selectedDayReservas.date.split('-').reverse().join('/')}
                 </h4>
                 
                 {!isAdminMode ? (
                   <button onClick={() => setShowAdminUnlock(true)} className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-white transition-all bg-white/5 px-3 py-1.5 rounded-full">
                     <Lock className="w-3 h-3" /> Ver Contatos
                   </button>
                 ) : (
                   <button onClick={() => setIsAdminMode(false)} className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-all bg-emerald-400/10 px-3 py-1.5 rounded-full">
                     <Unlock className="w-3 h-3" /> Modo Admin Ativo
                   </button>
                 )}
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {selectedDayReservas.items.map(res => (
                   <div key={res.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl relative group hover:bg-white/10 transition-all">
                     <div className="flex justify-between items-start mb-3">
                       <div className="flex items-center gap-2">
                         <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${res.auditorio === 'AUDITÓRIO' ? 'bg-blue-600' : 'bg-cyan-500'}`}>{res.auditorio}</span>
                         <span className="text-[10px] font-bold text-blue-300 uppercase">{res.horaInicio} - {res.horaFim}</span>
                       </div>
                       <button onClick={() => setShowCancelModal(res)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all" title="Cancelar este agendamento">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                     <h5 className="text-lg font-black uppercase tracking-tight text-white mb-1">{res.nomeEvento}</h5>
                     <div className="flex items-center gap-2 text-xs text-slate-300 mb-3">
                       <User className="w-3 h-3" /> {res.requisitante} <span className="opacity-50">({res.setor})</span>
                     </div>
                     <div className="pt-3 border-t border-white/10">
                       {isAdminMode ? (
                         <div className="space-y-1">
                           <p className="text-[10px] text-slate-400 flex items-center gap-2"><CreditCard className="w-3 h-3" /> CPF: {res.cpf}</p>
                           <p className="text-[10px] text-slate-400 flex items-center gap-2"><Mail className="w-3 h-3" /> {res.email}</p>
                           <p className="text-[10px] text-slate-400 flex items-center gap-2"><Phone className="w-3 h-3" /> {res.telefone}</p>
                         </div>
                       ) : (
                         <div className="flex items-center gap-2 text-[10px] text-slate-500 italic">
                           <Lock className="w-3 h-3" /> Contatos Ocultos
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      </main>

      {/* RODAPÉ */}
      <footer className="mt-auto border-t border-slate-200 bg-white print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Desenvolvido por: <span className="text-blue-600">Renato de Freitas Souza</span> | © 2026 Copyright
          </p>
          <a href="https://github.com/renatofreitas-create/agendamento.ccbs.git" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-400 hover:text-slate-800 transition-all text-xs font-bold bg-slate-100 px-3 py-2 rounded-lg">
            <Github className="w-4 h-4" /> Repositório Oficial
          </a>
        </div>
      </footer>

      {/* MODAL: SEGUNDA VIA */}
      {showReprintModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[130] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black uppercase mb-1">Segunda Via do Termo</h3>
            <p className="text-slate-500 text-xs mb-6">Insira os dados do agendamento para recuperar o seu documento.</p>
            
            <div className="space-y-3 text-left mb-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Código de Protocolo (ID)</label>
                <input 
                  type="text" 
                  value={reprintId} 
                  onChange={(e) => setReprintId(e.target.value)} 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold uppercase focus:border-blue-500 outline-none text-center"
                  placeholder="EX: A1B2C3D4E" 
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Senha do Utilizador</label>
                <input 
                  type="password" 
                  value={reprintPassword} 
                  onChange={(e) => setReprintPassword(e.target.value)} 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-black tracking-widest focus:border-blue-500 outline-none text-center"
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={handleFetchSecondCopy} 
                disabled={loadingSecondCopy}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loadingSecondCopy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {loadingSecondCopy ? 'Buscando...' : 'Buscar e Gerar Termo'}
              </button>
              <button onClick={() => { setShowReprintModal(false); setReprintId(''); setReprintPassword(''); }} className="py-2 text-slate-400 font-bold uppercase text-[9px] hover:text-slate-600">
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TERMO DE RESPONSABILIDADE (MODIFICADO COM ESTILO ISOLADO ANTI-OKLCH) */}
      {showReceipt && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-none md:rounded-[2rem] w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
            
            <div className="bg-yellow-100 border-b-2 border-yellow-300 p-4 text-center">
              <p className="text-yellow-800 text-sm font-bold flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5" /> 
                Atenção: Baixe este termo em PDF, assine digitalmente via GOV.BR (http://assinador.iti.br/) e envie para: reservaccbs@gmail.com
              </p>
            </div>

            {/* ELEMENTO COM ESTILOS INLINE DE COR STANDARD PARA EVITAR OKLCH DO TAILWIND v4 */}
            <div 
              className="p-10 space-y-8" 
              ref={termoRef} 
              style={{ backgroundColor: '#ffffff', color: '#000000' }}
            >
              <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
                 <img src={UFCG_LOGO} alt="UFCG" className="h-14 w-14 object-contain bg-white" crossOrigin="anonymous" />
                 <div className="text-center flex-1 px-4">
                   <h2 className="text-[14px] font-bold uppercase tracking-tight text-black leading-tight" style={{ color: '#000000' }}>
                     UNIVERSIDADE FEDERAL DE CAMPINA GRANDE - UFCG
                   </h2>
                   <h3 className="text-[14px] font-bold text-black uppercase leading-normal" style={{ color: '#000000' }}>
                     CENTRO DE CIÊNCIAS BIOLÓGICAS E DA SAÚDE - CCBS
                   </h3>
                   <p className="text-[14px] font-black mt-2 uppercase tracking-wide text-black" style={{ color: '#000000' }}>
                     TERMO DE RESPONSABILIDADE PARA UTILIZAÇÃO DE ESPAÇO
                   </p>
                 </div>
                 <img src={CCBS_LOGO} alt="CCBS" className="w-[2cm] h-auto object-contain bg-white" crossOrigin="anonymous" />
              </div>

              <div className="text-xs space-y-4 text-black leading-relaxed" style={{ color: '#000000' }}>
                <p>
                  Eu, <strong>{showReceipt.requisitante}</strong>, CPF nº <strong>{showReceipt.cpf}</strong>, 
                  E-mail: <strong>{showReceipt.email}</strong> e contato: <strong>{showReceipt.telefone}</strong>, 
                  servidor(a) vinculado(a) à unidade <strong>{showReceipt.setor || 'Não informado'}</strong>, 
                  na condição de responsável pelo evento <strong>"{showReceipt.nomeEvento}"</strong>, a ser 
                  realizado no <strong>{showReceipt.auditorio}</strong> do Centro de Ciências Biológicas e da Saúde (CCBS/UFCG), 
                  no dia <strong>{showReceipt.data.split('-').reverse().join('/')}</strong>, das <strong>{showReceipt.horaInicio}</strong> às <strong>{showReceipt.horaFim} h</strong>, 
                  assumo integral responsabilidade pela utilização do referido espaço durante o período autorizado.
                </p>

                <p className="font-bold pt-2">Declaro estar ciente e de acordo com as seguintes condições:</p>

                <div className="space-y-3" style={{ color: '#000000' }}>
                  <p><strong>CLÁUSULA PRIMEIRA - DA CONSERVAÇÃO DO PATRIMÔNIO:</strong> Comprometo-me a zelar pela conservação das instalações, mobiliários, equipamentos e demais bens patrimoniais existentes no {showReceipt.auditorio} do CCBS, responsabilizando-me por danos decorrentes de uso inadequado, negligência, imprudência ou imperícia dos participantes do evento sob minha responsabilidade.</p>
                  <p><strong>CLÁUSULA SEGUNDA - DA UTILIZAÇÃO DO ESPAÇO:</strong> Comprometo-me a utilizar o espaço exclusivamente para a finalidade previamente informada e autorizada pela Direção do CCBS, observando as normas institucionais vigentes e as orientações da Administração do Centro.</p>
                  <p><strong>CLÁUSULA TERCEIRA - DA ORGANIZAÇÃO E LIMPEZA:</strong> Ao término do evento, comprometo-me a entregar o espaço em condições adequadas de organização, conservação e limpeza, preservando a disposição original do mobiliário e dos equipamentos disponibilizados.</p>
                  <p><strong>CLÁUSULA QUARTA - DOS EQUIPAMENTOS E RECURSOS:</strong> Declaro ter recebido, em perfeito estado de funcionamento, os equipamentos eventualmente disponibilizados para o evento, responsabilizando-me por sua correta utilização e devolução nas mesmas condições iniciais. Ao término do evento comprometo-me a desligar as luzes e aparelhos de ar-condicionado e de informática.</p>
                  <p><strong>CLÁUSULA QUINTA - DA SEGURANÇA:</strong> Comprometo-me a respeitar a capacidade máxima do local, bem como a não realizar atividades que possam colocar em risco a integridade física dos participantes ou do patrimônio público.</p>
                  <div>
                    <strong>CLÁUSULA SEXTA - DAS VEDAÇÕES:</strong> É vedado:
                    <ul className="list-none pl-4 mt-1 space-y-1">
                      <li>I - Utilizar o espaço para finalidade diversa da autorizada;</li>
                      <li>II - Promover atividades que contrariem as normas institucionais da UFCG;</li>
                      <li>III - Fixar materiais em paredes, portas, janelas, mobiliários ou equipamentos de forma que causem danos ao patrimônio;</li>
                      <li>IV - Alterar instalações elétricas, de rede, sonorização ou quaisquer outros sistemas sem autorização prévia da Administração do CCBS.</li>
                    </ul>
                  </div>
                  <p><strong>CLÁUSULA SÉTIMA - DAS RESPONSABILIDADES:</strong> O descumprimento das dispositions deste Termo poderá implicar a suspensão de futuras autorizações de uso, sem prejuízo da apuração de responsabilidades administrativas, civis e legais cabíveis, bem como da obrigação de ressarcimento ao erário em caso de dano ao patrimônio público.</p>
                </div>

                <p className="pt-4 text-center">Por estar de acordo com as condições acima estabelecidas, firmo o presente Termo de Responsabilidade.</p>

                <div className="text-center pt-6 space-y-8">
                  <p>Campina Grande/PB, {formatarDataExtenso(showReceipt.dataCriacao)}</p>
                  <div className="w-1/2 mx-auto pt-2 mt-12" style={{ borderTop: '1px solid #000000' }}>
                    <p className="font-bold uppercase text-xs">RESPONSÁVEL PELO EVENTO: {showReceipt.requisitante}</p>
                    <p className="text-xs">Assinatura Digital GOV.BR</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 flex justify-between items-center opacity-50" style={{ borderTop: '1px solid #e2e8f0' }}>
                <div className="flex gap-2 items-center">
                  <QrCode className="w-8 h-8 text-black" />
                  <div style={{ color: '#000000' }}>
                    <p className="text-[8px] font-black uppercase">Protocolo Eletrônico: #{showReceipt.id}</p>
                    <p className="text-[8px] font-bold">Emitido em: {showReceipt.dataCriacao}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 flex gap-4 border-t border-slate-200">
              <button
                onClick={handleDownloadPDF}
                disabled={generatingPDF}
                className="flex-1 py-4 bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-2 hover:bg-blue-800 transition-all uppercase tracking-widest text-xs disabled:opacity-50 cursor-pointer"
              >
                {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                {generatingPDF ? 'Gerando PDF...' : 'Baixar Termo PDF'}
              </button>
              <button onClick={() => setShowReceipt(null)} className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 font-black rounded-xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs cursor-pointer">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DESBLOQUEIO ADMIN */}
      {showAdminUnlock && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[120] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-[2rem] p-8 max-w-xs w-full shadow-2xl text-center">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-800">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black uppercase mb-2">Acesso Restrito</h3>
            <p className="text-slate-500 text-xs mb-6">Insira a Senha Mestra para visualizar os contatos dos responsáveis.</p>
            <input type="password" value={adminUnlockPassword} onChange={(e) => setAdminUnlockPassword(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-center text-lg font-black tracking-widest mb-4 focus:border-blue-500 outline-none" placeholder="Senha Mestra" autoFocus />
            <div className="flex flex-col gap-2">
              <button onClick={handleAdminUnlock} className="w-full py-3 bg-slate-800 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-black transition-all">Desbloquear Dados</button>
              <button onClick={() => setShowAdminUnlock(false)} className="py-2 text-slate-400 font-bold uppercase text-[9px] hover:text-slate-600">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CANCELAMENTO */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[110] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-[3rem] p-10 max-w-xs w-full shadow-2xl text-center">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black uppercase mb-2">Segurança</h3>
            <p className="text-slate-500 text-xs mb-6">Insira a senha do utilizador ou a senha mestra para cancelar o evento <span className="font-bold text-slate-800 uppercase">"{showCancelModal.nomeEvento}"</span>.</p>
            <input type="password" value={cancelPassword} onChange={(e) => setCancelPassword(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-xl font-black tracking-widest mb-6 focus:border-red-500 outline-none" placeholder="Senha" autoFocus />
            <div className="flex flex-col gap-3">
              <button onClick={confirmCancelation} className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all">Remover Definitivamente</button>
              <button onClick={() => { setShowCancelModal(null); setCancelPassword(''); }} className="py-2 text-slate-400 font-bold uppercase text-[9px] hover:text-slate-600">Manter Reserva</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICAÇÕES */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] px-8 py-4 rounded-full shadow-2xl animate-in slide-in-from-bottom duration-300 font-black text-xs uppercase tracking-widest ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
