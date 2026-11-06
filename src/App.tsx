import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import emailjs from '@emailjs/browser';
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
  HelpCircle,
  QrCode,
  Clock,
  Check,
  Plus,
  FileCheck
} from 'lucide-react';

// Importações oficiais do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

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
// 2. CONSTANTES E CONFIGURAÇÕES DO EMAILJS
// ==========================================
const EMAILJS_SERVICE_ID = 'service_ccbs123';
const EMAILJS_TEMPLATE_ID = 'template_bap0q9f';
const EMAILJS_PUBLIC_KEY = 'GDyWQHi7TP21axsVa';
const EMAIL_BIBLIOTECA = 'biblioteca.ccbs@setor.ufcg.edu.br';

const AUDITORIOS = ['AUDITÓRIO', 'SALA DE REUNIÃO', 'SALA 01'];
const HORARIOS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', 
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
];
const MASTER_PASSWORD = 'adminCCBS2026';
const UFCG_LOGO = 'logo-ufcg.png'; 
const CCBS_LOGO = 'logo-ccbs.png';

// Função para formatar datas por extenso no documento formal
function formatarDataExtenso(dataCriacao: string) {
  if (!dataCriacao) return new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const [dataParte] = dataCriacao.split(',');
  const partes = dataParte.split('/');
  if (partes.length < 3) return dataCriacao;
  const [dia, mes, ano] = partes.map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function App() {
  // --- ESTADOS DE AUTENTICAÇÃO E DADOS ---
  const [user, setUser] = useState<any>(null);
  const [reservas, setReservas] = useState<any[]>([]);
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);

  // --- ESTADOS DOS MODAIS ---
  const [showCancelModal, setShowCancelModal] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState<any>(null);
  const [showAdminUnlock, setShowAdminUnlock] = useState(false);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false); 
  const [showProcessModal, setShowProcessModal] = useState(false);

  // --- ESTADOS DOS FORMULÁRIOS ---
  const [cancelPassword, setCancelPassword] = useState('');
  const [adminUnlockPassword, setAdminUnlockPassword] = useState('');
  const [reprintId, setReprintId] = useState('');
  const [reprintPassword, setReprintPassword] = useState('');

  // --- FORMULÁRIO DE AGENDAMENTO POR PROCESSO (ITEM 3) ---
  const [processFormData, setProcessFormData] = useState({
    nomeEvento: '',
    processoSEI: '',
    auditorio: 'SALA DE REUNIÃO',
    requisitante: '',
    cpf: '',
    email: '',
    telefone: '',
    setor: '',
    adminPassword: ''
  });

  const [regrasPeriodo, setRegrasPeriodo] = useState<any[]>([
    { id: 1, diaSemana: '4', horaInicio: '13:00', horaFim: '16:00', dataInicio: '', dataFim: '' }
  ]);

  // --- CONTROLO DE INTERFACE ---
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [loadingSecondCopy, setLoadingSecondCopy] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayReservas, setSelectedDayReservas] = useState<{date: string, items: any[]} | null>(null);

  const termoRef = useRef<HTMLDivElement>(null);

  // DADOS DO NOVO AGENDAMENTO
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

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ==========================================
  // 3. EFEITOS (AUTENTICAÇÃO E FIRESTORE)
  // ==========================================
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

  // Escuta em tempo real da coleção de reservas no Firestore
  useEffect(() => {
    if (!user || !db) return;
    const reservasRef = collection(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs');
    
    const unsubscribe = onSnapshot(reservasRef, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReservas(lista.sort((a: any, b: any) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio)));
    }, (error) => {
      console.error("Erro ao sincronizar Firestore:", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  // Sincroniza visualização do dia selecionado em tempo real
  useEffect(() => {
    if (selectedDayReservas) {
      const atualizadas = reservas.filter(r => r.data === selectedDayReservas.date);
      setSelectedDayReservas({ date: selectedDayReservas.date, items: atualizadas });
    }
  }, [reservas]);

  // ==========================================
  // 4. FUNÇÕES DE SUPORTE E ENVIO DE E-MAIL
  // ==========================================
  const enviarEmailLembrete = async (dadosReserva: any) => {
    try {
      const templateParams = {
        to_name: dadosReserva.requisitante,
        to_email: dadosReserva.email,
        reply_to: dadosReserva.email,
        nome_evento: dadosReserva.nomeEvento,
        auditorio: dadosReserva.auditorio,
        data_evento: dadosReserva.data.split('-').reverse().join('/'),
        hora_inicio: dadosReserva.horaInicio,
        hora_fim: dadosReserva.horaFim,
        protocolo: dadosReserva.id
      };

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      // ITEM 2: Envia cópia para o e-mail da biblioteca caso o local seja "SALA DE REUNIÃO"
      if (dadosReserva.auditorio === 'SALA DE REUNIÃO') {
        const templateParamsBiblioteca = {
          ...templateParams,
          to_name: 'Biblioteca CCBS',
          to_email: EMAIL_BIBLIOTECA,
          nome_evento: `[CÓPIA] ${dadosReserva.nomeEvento}`
        };
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          templateParamsBiblioteca,
          EMAILJS_PUBLIC_KEY
        );
      }
    } catch (error) {
      console.error('Falha no envio via EmailJS:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'data') {
      const d = new Date(value + 'T12:00:00');
      if (d.getDay() === 0 || d.getDay() === 6) {
        showToast('Agendamentos válidos apenas para dias úteis (Seg a Sex)!', 'error');
        setFormData(prev => ({ ...prev, data: '' }));
        return;
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    const diaHoje = new Date().getDay();
    if (diaHoje === 0 || diaHoje === 6) {
      showToast('Não é possível realizar solicitações de agendamento no fim de semana (Sábado e Domingo).', 'error');
      return;
    }

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
      showToast('Este horário já está reservado para outro evento!', 'error');
      return;
    }

    const id = Math.random().toString(36).substr(2, 9).toUpperCase();
    const novaReserva = { 
      ...formData, 
      id, 
      status: 'Aguardando Confirmação',
      dataCriacao: new Date().toLocaleString('pt-BR') 
    };

    try {
      if (!db) {
        showToast('Banco de dados indisponível.', 'error');
        return;
      }
      const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', id);
      await setDoc(docRef, novaReserva);
      
      enviarEmailLembrete(novaReserva);

      setShowReceipt(novaReserva);
      showToast('Sucesso! Reserva efetuada.');
      
      setFormData({ 
        auditorio: AUDITORIOS[0], data: '', horaInicio: '07:00', horaFim: '08:00', 
        nomeEvento: '', requisitante: '', cpf: '', email: '', telefone: '', setor: '', senha: '' 
      });
    } catch (e) {
      console.error(e);
      showToast('Erro ao guardar o agendamento no servidor.', 'error');
    }
  };

  // ==========================================
  // FUNÇÕES PARA AGENDAMENTO POR PROCESSO (ITEM 3)
  // ==========================================
  const handleAddRegra = () => {
    setRegrasPeriodo(prev => [
      ...prev,
      { id: Date.now(), diaSemana: '4', horaInicio: '13:00', horaFim: '16:00', dataInicio: '', dataFim: '' }
    ]);
  };

  const handleRemoveRegra = (id: number) => {
    if (regrasPeriodo.length === 1) {
      showToast('Defina ao menos uma regra de período.', 'error');
      return;
    }
    setRegrasPeriodo(prev => prev.filter(r => r.id !== id));
  };

  const handleRegraChange = (id: number, field: string, value: string) => {
    setRegrasPeriodo(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleProcessBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Item 3e: Validação da senha de administrador
    if (processFormData.adminPassword !== MASTER_PASSWORD) {
      showToast('Senha de administrador incorreta!', 'error');
      return;
    }

    if (!processFormData.nomeEvento || !processFormData.processoSEI || !processFormData.requisitante) {
      showToast('Preencha os dados do evento e número do processo SEI.', 'error');
      return;
    }

    let agendamentosGerados: any[] = [];
    let conflitosDetectados = 0;

    // Item 3c & 3d: Geração dos dias do período com base no critério selecionado
    for (const regra of regrasPeriodo) {
      if (!regra.dataInicio || !regra.dataFim) {
        showToast('Preencha as datas de início e fim em todas as regras de período!', 'error');
        return;
      }

      const dInicio = new Date(regra.dataInicio + 'T00:00:00');
      const dFim = new Date(regra.dataFim + 'T00:00:00');
      const targetDay = parseInt(regra.diaSemana, 10);

      let curr = new Date(dInicio);
      while (curr <= dFim) {
        if (curr.getDay() === targetDay) {
          const dateStr = curr.toISOString().split('T')[0];

          // Verifica se já existe agendamento que colida
          const conflito = reservas.find(r => 
            r.auditorio === processFormData.auditorio && 
            r.data === dateStr && 
            ((regra.horaInicio >= r.horaInicio && regra.horaInicio < r.horaFim) ||
             (regra.horaFim > r.horaInicio && regra.horaFim <= r.horaFim))
          );

          if (!conflito) {
            const id = Math.random().toString(36).substr(2, 9).toUpperCase();
            agendamentosGerados.push({
              id,
              auditorio: processFormData.auditorio,
              data: dateStr,
              horaInicio: regra.horaInicio,
              horaFim: regra.horaFim,
              nomeEvento: `${processFormData.nomeEvento} (Proc. SEI: ${processFormData.processoSEI})`,
              processoSEI: processFormData.processoSEI,
              requisitante: processFormData.requisitante,
              cpf: processFormData.cpf || 'SEI/UFCG',
              email: processFormData.email,
              telefone: processFormData.telefone,
              setor: processFormData.setor,
              senha: MASTER_PASSWORD,
              status: 'Confirmado',
              dataCriacao: new Date().toLocaleString('pt-BR')
            });
          } else {
            conflitosDetectados++;
          }
        }
        curr.setDate(curr.getDate() + 1);
      }
    }

    if (agendamentosGerados.length === 0) {
      showToast('Nenhum agendamento pôde ser gerado. Verifique conflitos ou intervalo de datas.', 'error');
      return;
    }

    try {
      if (!db) return;

      for (const res of agendamentosGerados) {
        const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', res.id);
        await setDoc(docRef, res);
        enviarEmailLembrete(res);
      }

      showToast(`${agendamentosGerados.length} agendamento(s) por processo gerado(s) com sucesso! ${conflitosDetectados > 0 ? `(${conflitosDetectados} ignorados por conflito)` : ''}`, 'success');
      setShowProcessModal(false);
      
      // Reset
      setProcessFormData({
        nomeEvento: '',
        processoSEI: '',
        auditorio: 'SALA DE REUNIÃO',
        requisitante: '',
        cpf: '',
        email: '',
        telefone: '',
        setor: '',
        adminPassword: ''
      });
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar agendamentos recorrentes.', 'error');
    }
  };

  const handleAlternarStatus = async (reservaId: string, statusAtual: string) => {
    if (!isAdminMode) {
      showToast('Apenas administradores podem alterar o status.', 'error');
      return;
    }

    const novoStatus = statusAtual === 'Confirmado' ? 'Aguardando Confirmação' : 'Confirmado';

    try {
      if (!db) return;
      const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', reservaId);
      await updateDoc(docRef, { status: novoStatus });
      showToast(`Status alterado para: ${novoStatus}`, 'success');
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      showToast('Erro ao atualizar o status no servidor.', 'error');
    }
  };

  const confirmCancelation = async () => {
    if (!showCancelModal) return;

    const inputSenha = cancelPassword.trim();
    const senhaReserva = showCancelModal.senha ? String(showCancelModal.senha).trim() : '';

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
        console.error("Erro ao cancelar agendamento:", e);
        showToast('Erro ao remover o agendamento.', 'error'); 
      }
    } else {
      showToast('Senha incorreta!', 'error');
    }
  };

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

  const handleFetchSecondCopy = async () => {
    if (!reprintId || !reprintPassword) {
      showToast('Insira o Protocolo e a Senha!', 'error');
      return;
    }

    setLoadingSecondCopy(true);

    try {
      const idBuscado = reprintId.trim().toUpperCase();
      const senhaBuscada = reprintPassword.trim();

      let dadosReserva = reservas.find(
        r => r.id && String(r.id).trim().toUpperCase() === idBuscado
      );

      if (!dadosReserva && db) {
        const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', idBuscado);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          dadosReserva = { id: docSnap.id, ...docSnap.data() };
        }
      }

      if (dadosReserva) {
        const senhaCadastrada = String(dadosReserva.senha || '').trim();

        if (senhaBuscada === senhaCadastrada || senhaBuscada === MASTER_PASSWORD) {
          setShowReceipt(dadosReserva);
          setShowReprintModal(false);
          setReprintId('');
          setReprintPassword('');
          showToast('Termo localizado com sucesso!', 'success');
        } else {
          showToast('Senha incorreta para este protocolo!', 'error');
        }
      } else {
        showToast('Protocolo não encontrado no sistema.', 'error');
      }
    } catch (err) {
      console.error("Erro ao buscar 2ª via:", err);
      showToast('Erro ao comunicar com o servidor.', 'error');
    } finally {
      setLoadingSecondCopy(false);
    }
  };

  const handleDownloadPDF = async () => {
    const elemento = termoRef.current;
    if (!elemento) {
      showToast('Erro: Elemento visual do termo não encontrado.', 'error');
      return;
    }
    
    setGeneratingPDF(true);
    const originalWidth = elemento.style.width;
    const originalMaxWidth = elemento.style.maxWidth;

    try {
      elemento.style.width = '800px';
      elemento.style.maxWidth = '800px';

      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(elemento, { 
        scale: 1.5, 
        backgroundColor: '#ffffff', 
        useCORS: true,
        allowTaint: false,
        logging: false
      });
      
      elemento.style.width = originalWidth;
      elemento.style.maxWidth = originalMaxWidth;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true 
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL('image/jpeg', 0.75);

      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      pdf.save(`Termo_${showReceipt?.id || 'CCBS'}.pdf`);
      showToast('PDF descarregado com sucesso!', 'success');
    } catch (err: any) {
      console.error("Erro na conversão para PDF:", err);
      elemento.style.width = originalWidth;
      elemento.style.maxWidth = originalMaxWidth;
      showToast('Erro ao gerar o arquivo PDF.', 'error');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const obterCorLocal = (local: string) => {
    if (local === 'AUDITÓRIO') return 'bg-blue-600';
    if (local === 'SALA DE REUNIÃO') return 'bg-cyan-500';
    if (local === 'SALA 01') return 'bg-emerald-600';
    return 'bg-slate-600';
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

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-12 flex flex-col print:bg-white print:p-0">
      
      {/* NOTIFICAÇÃO (TOAST) */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-6 py-3 rounded-2xl shadow-2xl text-white font-bold text-xs uppercase tracking-wider animate-bounce print:hidden ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
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
          
          <div className="flex items-center gap-3">
            {/* ITEM 3: Botão Agendamento por Processo posicionado conforme a imagem do usuário */}
            <button 
              onClick={() => setShowProcessModal(true)}
              className="bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-black text-[11px] uppercase px-4 py-2 rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileCheck className="w-4 h-4" /> Agendamento por processo
            </button>

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
        
        {/* FORMULÁRIO DE NOVO AGENDAMENTO */}
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
                
                {/* ITEM 1: Sala de Reunião totalmente liberada */}
                <select name="auditorio" value={formData.auditorio} onChange={handleChange} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold uppercase text-xs focus:border-blue-600 outline-none transition-all">
                  {AUDITORIOS.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
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
                    <span className="text-[10px] font-black uppercase tracking-widest">Chave de Segurança</span>
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
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{reservas.length} Eventos Registados</p>
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

          {/* DETALHES DO DIA SELECIONADO */}
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
                     <Lock className="w-3 h-3" /> Ver Contatos / Admin
                   </button>
                 ) : (
                   <button onClick={() => setIsAdminMode(false)} className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-all bg-emerald-400/10 px-3 py-1.5 rounded-full">
                     <Unlock className="w-3 h-3" /> Modo Admin Ativo
                   </button>
                 )}
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {selectedDayReservas.items.map(res => {
                   const statusReserva = res.status || 'Aguardando Confirmação';
                   const isConfirmado = statusReserva === 'Confirmado';

                   return (
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
                       <p className="text-xs text-slate-300 font-bold mb-3">Resp: {res.requisitante}</p>

                       {res.processoSEI && (
                         <div className="text-[10px] bg-slate-800 text-blue-300 px-2 py-1 rounded font-mono mb-2 inline-block">
                           SEI: {res.processoSEI}
                         </div>
                       )}

                       {isAdminMode && (
                         <div className="pt-3 border-t border-white/10 mt-3 space-y-1 text-xs text-slate-300">
                           <p><strong>CPF:</strong> {res.cpf}</p>
                           <p><strong>E-mail:</strong> {res.email}</p>
                           <p><strong>Tel:</strong> {res.telefone}</p>
                           <p><strong>Setor:</strong> {res.setor}</p>
                           
                           <button 
                             onClick={() => handleAlternarStatus(res.id, statusReserva)}
                             className={`mt-2 w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isConfirmado ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'}`}
                           >
                             Status: {statusReserva} (Clique p/ alternar)
                           </button>
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
            </div>
          )}
        </div>
      </main>

      {/* ========================================== */}
      {/* MODAL ITEM 3: AGENDAMENTO POR PROCESSO    */}
      {/* ========================================== */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="bg-blue-800 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-emerald-400" />
                <h3 className="font-black text-lg uppercase tracking-tight">Agendamento por Processo</h3>
              </div>
              <button onClick={() => setShowProcessModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleProcessBookingSubmit} className="p-6 overflow-y-auto space-y-5">
              
              {/* Item 3a: Nome do Evento e Item 3b: Número do Processo SEI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase">Nome do Evento *</label>
                  <input 
                    type="text" 
                    value={processFormData.nomeEvento} 
                    onChange={e => setProcessFormData({...processFormData, nomeEvento: e.target.value})} 
                    placeholder="Ex: Reunião do Colegiado" 
                    required 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase">Número do Processo SEI *</label>
                  <input 
                    type="text" 
                    value={processFormData.processoSEI} 
                    onChange={e => setProcessFormData({...processFormData, processoSEI: e.target.value})} 
                    placeholder="Ex: 23096.000000/2026-00" 
                    required 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase">Ambiente *</label>
                  <select 
                    value={processFormData.auditorio} 
                    onChange={e => setProcessFormData({...processFormData, auditorio: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
                  >
                    {AUDITORIOS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase">Responsável *</label>
                  <input 
                    type="text" 
                    value={processFormData.requisitante} 
                    onChange={e => setProcessFormData({...processFormData, requisitante: e.target.value})} 
                    placeholder="Nome do Solicitante" 
                    required 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue
