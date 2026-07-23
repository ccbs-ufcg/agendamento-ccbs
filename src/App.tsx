import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  Calendar as CalendarIcon, 
  User, 
  CheckCircle, 
  Trash2, 
  CalendarCheck,
  AlertCircle,
  X,
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
  Search,
  Copy,
  HelpCircle
} from 'lucide-react';

// Importações oficiais da SDK do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// ==========================================
// 1. CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  projectId: "gen-lang-client-0405590990",
  appId: "1:507764642698:web:856fe24c5779424c04ee73",
  apiKey: "AIzaSyDb3NCltHYiQjKPpfA615mnvcQ418ir6mA",
  authDomain: "gen-lang-client-0405590990.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-14d70056-6152-4443-af0a-c8856441a23e",
  storageBucket: "gen-lang-client-0405590990.firebasestorage.app",
  messagingSenderId: "507764642698",
};

// Inicialização dos serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const appId = 'ccbs-agendamento-final';

// ==========================================
// 2. CONSTANTES E CONFIGURAÇÕES DO SISTEMA
// ==========================================
const AUDITORIOS = ['AUDITÓRIO', 'SALA DE REUNIÃO', 'SALA 01'];
const HORARIOS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', 
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
];
const MASTER_PASSWORD = 'adminCCBS2026';

// Caminhos das imagens de logotipo
const UFCG_LOGO = 'logo-ufcg.png'; 

export default function App() {
  // --- ESTADOS DE AUTENTICAÇÃO E DADOS ---
  const [user, setUser] = useState<any>(null);
  const [reservas, setReservas] = useState<any[]>([]);
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);

  // --- ESTADOS DOS MODAIS DE INTERFACE ---
  const [showCancelModal, setShowCancelModal] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState<any>(null);
  const [showAdminUnlock, setShowAdminUnlock] = useState(false);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false); 

  // --- ESTADOS DE FORMULÁRIOS E SEGURANÇA ---
  const [cancelPassword, setCancelPassword] = useState('');
  const [adminUnlockPassword, setAdminUnlockPassword] = useState('');
  const [reprintId, setReprintId] = useState('');
  const [reprintPassword, setReprintPassword] = useState('');

  // --- ESTADOS DE CONTROLE DE INTERFACE ---
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [loadingSecondCopy, setLoadingSecondCopy] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayReservas, setSelectedDayReservas] = useState<{date: string, items: any[]} | null>(null);

  // REFERÊNCIA HTML: Usada para capturar o elemento do Termo e gerar o PDF
  const termoRef = useRef<HTMLDivElement>(null);

  // ESTADO DO FORMULÁRIO DE NOVO AGENDAMENTO
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

  // ==========================================
  // 3. EFEITOS (AUTENTICAÇÃO E FIRESTORE)
  // ==========================================

  // Efeito 1: Autenticação inicial no Firebase
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

  // Efeito 2: Escuta em tempo real da coleção de agendamentos no Firestore
  useEffect(() => {
    if (!user || !db) return;
    const reservasRef = collection(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs');
    
    const unsubscribe = onSnapshot(reservasRef, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordena por data e hora de início
      setReservas(lista.sort((a: any, b: any) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio)));
    }, (error) => {
      console.error("Erro ao sincronizar Firestore:", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  // ==========================================
  // 4. FUNÇÕES DE SUPORTE E MANIPULAÇÃO
  // ==========================================

  // Exibe alertas temporários (Toast)
  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Atualiza os campos do formulário de criação
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Validação de dias úteis
    if (name === 'data') {
      const d = new Date(value + 'T12:00:00');
      if (d.getDay() === 0 || d.getDay() === 6) {
        showToast('Agendamentos apenas para dias úteis (Seg a Sex)!', 'error');
        return;
      }
    }
    
    // Bloqueio temporário da Sala de Reunião
    if (name === 'auditorio' && value === 'SALA DE REUNIÃO') {
      showToast('A Sala de Reunião está temporariamente indisponível!', 'error');
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Submissão do novo agendamento
  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.auditorio === 'SALA DE REUNIÃO') {
      showToast('A Sala de Reunião está temporariamente indisponível.', 'error');
      return;
    }

    if (!formData.data || !formData.nomeEvento || !formData.requisitante || !formData.cpf || !formData.email || !formData.telefone || !formData.senha) {
      showToast('Preencha todos os campos obrigatórios!', 'error');
      return;
    }

    // Validação de choque de horários no mesmo local
    const conflito = reservas.find(r => 
      r.auditorio === formData.auditorio && 
      r.data === formData.data && 
      ((formData.horaInicio >= r.horaInicio && formData.horaInicio < r.horaFim) ||
       (formData.horaFim > r.horaInicio && formData.horaFim <= r.horaFim))
    );

    if (conflito) {
      showToast('Este horário já está ocupado por outro evento!', 'error');
      return;
    }

    // Criação do ID único (Protocolo)
    const id = Math.random().toString(36).substr(2, 9).toUpperCase();
    const novaReserva = { 
      ...formData, 
      id, 
      dataCriacao: new Date().toLocaleString('pt-BR') 
    };

    try {
      if (!db) {
        showToast('Banco de dados indisponível.', 'error');
        return;
      }
      const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', id);
      await setDoc(docRef, novaReserva);
      
      setShowReceipt(novaReserva);
      showToast('Sucesso! Reserva realizada.');
      
      // Limpa o formulário
      setFormData({ 
        auditorio: AUDITORIOS[0], data: '', horaInicio: '07:00', horaFim: '08:00', 
        nomeEvento: '', requisitante: '', cpf: '', email: '', telefone: '', setor: '', senha: '' 
      });
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar agendamento no banco de dados.', 'error');
    }
  };

  // Cancelamento de agendamento mediante senha
  const confirmCancelation = async () => {
    if (!showCancelModal) return;

    const inputSenha = cancelPassword.trim();
    const senhaReserva = showCancelModal.senha ? showCancelModal.senha.trim() : '';

    if (inputSenha === senhaReserva || inputSenha === MASTER_PASSWORD) {
      try {
        if (!db) {
          showToast('Banco de dados indisponível.', 'error');
          return;
        }
        
        const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', showCancelModal.id);
        await deleteDoc(docRef);
        
        showToast('Agendamento removido com sucesso!', 'info');
        setShowCancelModal(null);
        setCancelPassword('');
        setSelectedDayReservas(null);
      } catch (e) { 
        console.error("Erro ao deletar agendamento:", e);
        showToast('Erro ao remover o agendamento.', 'error'); 
      }
    } else {
      showToast('Senha incorreta!', 'error');
    }
  };

  // Ativação do Modo Administrador
  const handleAdminUnlock = () => {
    if (adminUnlockPassword.trim() === MASTER_PASSWORD) {
      setIsAdminMode(true);
      setShowAdminUnlock(false);
      setAdminUnlockPassword('');
      showToast('Modo Administrador Ativado', 'success');
    } else {
      showToast('Senha Mestra incorreta', 'error');
    }
  };

  // Busca de 2ª Via do Termo por Protocolo e Senha
  const handleFetchSecondCopy = async () => {
    if (!reprintId || !reprintPassword) {
      showToast('Insira o Protocolo e a Senha!', 'error');
      return;
    }
    setLoadingSecondCopy(true);
    try {
      const idBuscado = reprintId.toUpperCase().trim();
      const senhaBuscada = reprintPassword.trim();

      // Busca na memória local
      let dadosReserva = reservas.find(r => r.id === idBuscado);

      // Se não estiver na memória, busca diretamente no Firestore
      if (!dadosReserva && db) {
        const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', idBuscado);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          dadosReserva = docSnap.data();
        }
      }

      if (dadosReserva) {
        if (senhaBuscada === dadosReserva.senha || senhaBuscada === MASTER_PASSWORD) {
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
      console.error("Erro ao buscar termo:", err);
      showToast('Erro ao buscar dados no servidor.', 'error');
    } finally {
      setLoadingSecondCopy(false);
    }
  };

  // ==========================================
  // 5. FUNÇÃO CORRIGIDA DE GERAÇÃO DO PDF
  // ==========================================
  const handleDownloadPDF = async () => {
    const elemento = termoRef.current;
    if (!elemento) {
      showToast('Erro: Elemento do termo não encontrado.', 'error');
      return;
    }
    
    setGeneratingPDF(true);

    // Salva as dimensões originais do elemento HTML
    const originalWidth = elemento.style.width;
    const originalMaxWidth = elemento.style.maxWidth;

    try {
      // 1. Ajusta temporariamente a largura para garantir proporção
      elemento.style.width = '750px';
      elemento.style.maxWidth = '750px';

      // Aguarda 250ms para a re-renderização da tela
      await new Promise((resolve) => setTimeout(resolve, 250));

      // 2. Captura o elemento usando html2canvas com parâmetros de estabilidade
      const canvas = await html2canvas(elemento, { 
        scale: 2,                  // Duplica a resolução gráfica
        backgroundColor: '#ffffff', // Garante fundo branco sólido
        useCORS: true,             // Tenta carregar imagens externas via CORS
        allowTaint: true,          // Permite inclusão de SVGs e recursos locais
        scrollX: 0,
        scrollY: -window.scrollY,  // Elimina o deslocamento causado pelo scroll da página
        logging: false
      });
      
      // Restaura o tamanho original na tela
      elemento.style.width = originalWidth;
      elemento.style.maxWidth = originalMaxWidth;

      // 3. Exporta para formato de imagem PNG (evita erros de conversão do JPEG)
      const imgData = canvas.toDataURL('image/png');

      // 4. Cria o documento PDF no formato A4 (210mm x 297mm)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();   // 210 mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

      // Calcula a altura proporcional para não distorcer o conteúdo
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const finalHeight = imgHeight > pageHeight ? pageHeight : imgHeight;

      // Adiciona a imagem ao PDF e inicia o download
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, finalHeight, undefined, 'FAST');
      pdf.save(`Termo_${showReceipt?.id || 'Agendamento'}.pdf`);

      showToast('PDF descarregado com sucesso!', 'success');
    } catch (err: any) {
      console.error("Erro detalhado ao gerar o PDF:", err);
      
      // Restaura o estilo do elemento em caso de falha
      elemento.style.width = originalWidth;
      elemento.style.maxWidth = originalMaxWidth;
      
      showToast('Erro ao processar o arquivo PDF.', 'error');
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Cores indicativas por local
  const obterCorLocal = (local: string) => {
    if (local === 'AUDITÓRIO') return 'bg-blue-600';
    if (local === 'SALA DE REUNIÃO') return 'bg-cyan-500';
    if (local === 'SALA 01') return 'bg-emerald-600';
    return 'bg-slate-600';
  };

  // Copia o código de protocolo para a área de transferência
  const copiarParaTransferencia = (texto: string) => {
    navigator.clipboard.writeText(texto);
    showToast('Código de protocolo copiado! 📋');
  };

  // Renderizador das células do Calendário
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
              <div 
                key={idx} 
                className={`text-[8px] md:text-[9px] truncate px-1 rounded font-bold text-white uppercase ${obterCorLocal(r.auditorio)}`} 
                title={r.nomeEvento}
              >
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

  // ==========================================
  // 6. ESTRUTURA VISUAL (JSX)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-12 flex flex-col print:bg-white print:p-0">
      
      {/* NOTIFICAÇÃO TOAST */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-6 py-3 rounded-2xl shadow-2xl text-white font-bold text-xs uppercase tracking-wider animate-bounce ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
          {toast.message}
        </div>
      )}

      {/* CABEÇALHO */}
      <header className="bg-blue-700 text-white shadow-xl sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1 rounded-xl flex items-center justify-center" style={{ width: '44px', height: '44px' }}>
              <img src={UFCG_LOGO} alt="Logo UFCG" className="h-10 object-contain" />
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
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 print:hidden flex-1">
        
        {/* COLUNA DA ESQUERDA: FORMULÁRIO DE AGENDAMENTO */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden sticky top-24">
            
            <div className="bg-blue-800 p-6 flex items-center justify-between">
              <h2 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-blue-300" /> Novo Agendamento
              </h2>
              <button 
                type="button"
                onClick={() => setShowHelpModal(true)} 
                className="bg-white/10 p-2 rounded-lg text-white hover:bg-white/20 transition-all cursor-pointer" 
                title="Abrir Central de Ajuda"
              >
                <HelpCircle className="w-5 h-5 text-white" />
              </button>
            </div>
            
            <form onSubmit={handleBooking} className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Local & Data</label>
                
                <select name="auditorio" value={formData.auditorio} onChange={handleChange} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold uppercase text-xs focus:border-blue-600 outline-none transition-all">
                  {AUDITORIOS.map(a => {
                    const isIndisponivel = a === 'SALA DE REUNIÃO';
                    return (
                      <option key={a} value={a} disabled={isIndisponivel} className={isIndisponivel ? 'text-red-400 italic' : ''}>
                        {isIndisponivel ? `${a} (INDISPONÍVEL)` : a}
                      </option>
                    );
                  })}
                </select>
                
                <input type="date" name="data" value={formData.data} onChange={handleChange} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 font-bold" />
                
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

                <div className="bg-blue-900/5 p-4 rounded-2xl border-2 border-blue-100 mt-4">
                  <div className="flex items-center gap-2 mb-2 text-blue-900">
                    <Lock className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Segurança</span>
                  </div>
                  <input type="password" name="senha" value={formData.senha} onChange={handleChange} placeholder="Senha p/ Cancelamento e Termo" className="w-full p-3 bg-white border border-blue-200 rounded-xl text-center font-bold tracking-widest text-blue-900 outline-none focus:border-blue-600" />
                </div>
              </div>

              <button type="submit" className="w-full py-5 mt-2 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
                <CheckCircle className="w-4 h-4" /> Confirmar Agendamento
              </button>
            </form>
          </div>
        </div>

        {/* COLUNA DA DIREITA: CALENDÁRIO E EVENTOS */}
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
            
            <div className="p-4 bg-slate-50 flex flex-wrap gap-6 justify-center border-t border-slate-100">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auditório</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-cyan-500 rounded-sm"></div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sala de Reunião</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-600 rounded-sm"></div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sala 01</span></div>
            </div>
          </div>

          {/* PAINEL DE DETALHES DO DIA SELECIONADO */}
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
                         <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${obterCorLocal(res.auditorio)}`}>{res.auditorio}</span>
                         <span className="text-[10px] font-bold text-blue-300 uppercase">{res.horaInicio} - {res.horaFim}</span>
                       </div>
                       
                       <button onClick={() => setShowCancelModal(res)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all" title="Cancelar este agendamento">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                     <h5 className="text-lg font-black uppercase tracking-tight text-white mb-1">{res.nomeEvento}</h5>
                     <div className="flex items-center gap-2 text-xs text-slate-300 mb-2">
                       <User className="w-3 h-3" /> {res.requisitante} <span className="opacity-50">({res.setor})</span>
                     </div>
                     
                     <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mb-3 bg-white/5 px-2.5 py-1.5 rounded-xl w-fit border border-white/5">
                       <span>Protocolo: <span className="text-blue-400 select-all font-mono uppercase tracking-wide">{res.id}</span></span>
                       <button 
                         onClick={() => copiarParaTransferencia(res.id)} 
                         className="p-1 hover:bg-white/10 text-slate-300 hover:text-white rounded transition-all active:scale-90"
                         title="Copiar Protocolo"
                       >
                         <Copy className="w-3 h-3" />
                       </button>
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

      {/* ==========================================
          MODAIS AUXILIARES
         ========================================== */}

      {/* MODAL 1: REMOVER AGENDAMENTO (CANCELAMENTO) */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[130] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black uppercase mb-1">Segurança</h3>
            <p className="text-slate-500 text-xs mb-6">
              Insira a senha do utilizador ou a senha mestra para cancelar o evento <strong className="text-slate-800">"{showCancelModal.nomeEvento}"</strong>.
            </p>
            
            <div className="space-y-3 text-left mb-6">
              <input 
                type="password" 
                value={cancelPassword} 
                onChange={(e) => setCancelPassword(e.target.value)} 
                className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-black tracking-widest focus:border-red-500 outline-none text-center"
                placeholder="••••••••" 
              />
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={confirmCancelation} 
                className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-red-700 shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Remover Definitivamente
              </button>
              <button 
                onClick={() => { setShowCancelModal(null); setCancelPassword(''); }} 
                className="py-2 text-slate-400 font-bold uppercase text-[9px] hover:text-slate-600"
              >
                Manter Reserva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BUSCA DA 2ª VIA DO TERMO */}
      {showReprintModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[140] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl text-center relative">
            <button 
              onClick={() => { setShowReprintModal(false); setReprintId(''); setReprintPassword(''); }}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
              <Search className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-black uppercase text-slate-800 mb-1">Segunda Via do Termo</h3>
            <p className="text-slate-500 text-xs mb-6">
              Insira os dados do agendamento para recuperar o seu documento.
            </p>

            <div className="space-y-4 text-left mb-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Código de Protocolo (ID)</label>
                <input 
                  type="text" 
                  value={reprintId} 
                  onChange={(e) => setReprintId(e.target.value)} 
                  placeholder="EX: A1B2C3D4E" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold uppercase text-center focus:border-blue-600 outline-none text-sm tracking-wider"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Senha do Utilizador</label>
                <input 
                  type="password" 
                  value={reprintPassword} 
                  onChange={(e) => setReprintPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-center focus:border-blue-600 outline-none text-sm tracking-widest"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleFetchSecondCopy} 
                disabled={loadingSecondCopy}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loadingSecondCopy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {loadingSecondCopy ? 'A procurar...' : 'Buscar e Gerar Termo'}
              </button>

              <button 
                onClick={() => { setShowReprintModal(false); setReprintId(''); setReprintPassword(''); }} 
                className="py-2 text-slate-400 font-bold uppercase text-[10px] hover:text-slate-600 transition-all"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VISUALIZAÇÃO E IMPRESSÃO DO TERMO (PDF) */}
      {showReceipt && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative my-8 print:shadow-none print:p-0 print:m-0">
            
            {/* Barra de Ações Superior */}
            <div className="flex justify-between items-center mb-6 print:hidden">
              <button 
                onClick={() => setShowReceipt(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
                  className="bg-blue-600 text-white font-bold text-xs uppercase px-5 py-2.5 rounded-xl shadow hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  {generatingPDF ? 'A Gerar PDF...' : 'Baixar PDF'}
                </button>
              </div>
            </div>

            {/* TERMO DE AGENDAMENTO (ELEMENTO CAPTURADO PELO HTML2CANVAS) */}
            <div ref={termoRef} className="p-8 bg-white border border-slate-200 rounded-2xl text-slate-800 space-y-6 print:border-none print:p-0">
              
              {/* Cabeçalho do Termo */}
              <div className="flex items-center justify-between border-b pb-4 border-slate-200">
                <div>
                  <h2 className="text-lg font-black text-blue-900 uppercase">Termo de Agendamento</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase">CCBS / UFCG - Campina Grande</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 block uppercase">Protocolo</span>
                  <span className="text-sm font-mono font-black text-blue-600">{showReceipt.id}</span>
                </div>
              </div>

              {/* Dados do Agendamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="font-bold text-slate-400 text-[10px] uppercase">Evento</p>
                  <p className="font-black text-slate-800 text-sm">{showReceipt.nomeEvento}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 text-[10px] uppercase">Local Reservado</p>
                  <p className="font-bold text-blue-700">{showReceipt.auditorio}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 text-[10px] uppercase">Data e Horário</p>
                  <p className="font-bold">{showReceipt.data ? showReceipt.data.split('-').reverse().join('/') : ''} ({showReceipt.horaInicio} às {showReceipt.horaFim})</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 text-[10px] uppercase">Responsável</p>
                  <p className="font-bold">{showReceipt.requisitante}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 text-[10px] uppercase">CPF / Setor</p>
                  <p>{showReceipt.cpf} - {showReceipt.setor}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-400 text-[10px] uppercase">Contato</p>
                  <p>{showReceipt.email} | {showReceipt.telefone}</p>
                </div>
              </div>

              {/* Normas de Uso */}
              <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 space-y-1.5">
                <p className="font-bold uppercase text-slate-700 mb-1">Normas de Utilização:</p>
                <p>• O responsável declara-se ciente de que é responsável pela conservação dos equipamentos e estrutura durante o evento.</p>
                <p>• Em caso de cancelamento, utilizar a chave de segurança cadastrada diretamente na plataforma.</p>
                <p className="pt-2 text-[9px] text-slate-400">Emissão realizada em: {showReceipt.dataCriacao || new Date().toLocaleString('pt-BR')}</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: DESBLOQUEIO DE MODO ADMIN */}
      {showAdminUnlock && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[140] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
              <Shield className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black uppercase mb-1">Modo Administrador</h3>
            <p className="text-slate-500 text-xs mb-6">Insira a Senha Mestra para visualizar dados sigilosos e de contato.</p>
            
            <input 
              type="password" 
              value={adminUnlockPassword} 
              onChange={(e) => setAdminUnlockPassword(e.target.value)} 
              placeholder="Senha Mestra" 
              className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-black text-center focus:border-amber-500 outline-none mb-4"
            />

            <div className="flex flex-col gap-2">
              <button 
                onClick={handleAdminUnlock} 
                className="w-full py-4 bg-amber-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-amber-700 transition-all cursor-pointer"
              >
                Acessar Dados
              </button>
              <button 
                onClick={() => { setShowAdminUnlock(false); setAdminUnlockPassword(''); }} 
                className="py-2 text-slate-400 font-bold uppercase text-[9px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CENTRAL DE AJUDA */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[140] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl text-left relative">
            <button 
              onClick={() => setShowHelpModal(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-3 rounded-2xl text-blue-700">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase text-slate-800">Central de Ajuda</h3>
                <p className="text-xs text-slate-400 font-bold">Sistema de Reservas CCBS</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed mb-6">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 mb-1">Como emitir a 2ª via do termo?</p>
                <p>Clique no botão <strong>"2ª Via do Termo"</strong> no cabeçalho superior, introduza o código do protocolo recebido no agendamento e a sua senha.</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 mb-1">Como cancelar um agendamento?</p>
                <p>Selecione o dia do evento no calendário, clique no ícone da lixeira ao lado do agendamento e confirme com a sua senha.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowHelpModal(false)} 
              className="w-full py-3.5 bg-slate-800 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-all text-center cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
