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
  Check
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

const AUDITORIOS = ['AUDITÓRIO', 'SALA DE REUNIÃO', 'SALA 01'];
const HORARIOS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', 
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
];
const MASTER_PASSWORD = 'adminCCBS2026';
const EMAIL_BIBLIOTECA = 'biblioteca.ccbs@setor.ufcg.edu.br';
const UFCG_LOGO = 'logo-ufcg.png'; 
const CCBS_LOGO = 'logo-ccbs.png';

// Critério padrão do "Agendamento por processo"
const criterioVazio = () => ({
  id: Math.random().toString(36).slice(2, 8),
  diaSemana: '4', // 1=Seg ... 5=Sex
  horaInicio: '13:00',
  horaFim: '16:00',
  dataInicio: '',
  dataFim: ''
});

// Data local (toISOString usa UTC e vira "amanhã" depois das 21h no Brasil)
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatarBR = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

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

  // --- AGENDAMENTO POR PROCESSO ---
  const [savingProcess, setSavingProcess] = useState(false);
  const [processData, setProcessData] = useState({
    auditorio: AUDITORIOS[0], nomeEvento: '', sei: '', adminSenha: ''
  });
  const [criterios, setCriterios] = useState([criterioVazio()]);

  // --- BLOQUEIOS POR PERÍODO (MANUTENÇÃO) ---
  const [bloqueios, setBloqueios] = useState<any[]>([]);
  const [novoBloqueio, setNovoBloqueio] = useState({
    auditorio: AUDITORIOS[1], dataInicio: '', dataFim: '', motivo: ''
  });
  const [enviandoEmails, setEnviandoEmails] = useState(false);

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

  // Exibe notificação (toast) e a remove após 4 segundos
  const showToast = (message: string, type: string = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ==========================================
  // 3. EFEITOS (AUTENTICAÇÃO, FIRESTORE E BLOQUEIOS)
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

  // Escuta em tempo real os períodos de bloqueio (manutenção)
  useEffect(() => {
    if (!user || !db) return;
    const ref = collection(db, 'artifacts', appId as string, 'public', 'data', 'bloqueios_ccbs');
    const unsubscribe = onSnapshot(ref, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setBloqueios(lista.sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)));
    }, (error) => console.error('Erro ao carregar bloqueios:', error));
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
  // 4. FUNÇÕES DE SUPORTE, BLOQUEIOS, E-MAIL E ADMIN
  // ==========================================

  // Retorna o bloqueio ativo para o ambiente/data, ou undefined
  const buscarBloqueio = (auditorio: string, data: string) =>
    bloqueios.find(b => b.auditorio === auditorio && data >= b.dataInicio && data <= b.dataFim);

  // Bloqueios que ainda não terminaram
  const bloqueiosVigentes = bloqueios.filter(b => b.dataFim >= hojeISO());

  // Reservas já existentes dentro do período bloqueado
  const afetadosPorBloqueio = (b: any) =>
    reservas.filter(r =>
      r.auditorio === b.auditorio && r.data >= b.dataInicio && r.data <= b.dataFim && r.data >= hojeISO()
    );

  const handleAdicionarBloqueio = async () => {
    if (!isAdminMode) return showToast('Apenas administradores podem criar bloqueios.', 'error');
    const { auditorio, dataInicio, dataFim, motivo } = novoBloqueio;
    if (!dataInicio || !dataFim) return showToast('Informe a data inicial e a final.', 'error');
    if (dataFim < dataInicio) return showToast('A data final não pode ser anterior à inicial.', 'error');
    if (!db) return;

    try {
      const id = Math.random().toString(36).slice(2, 11).toUpperCase();
      await setDoc(doc(db, 'artifacts', appId as string, 'public', 'data', 'bloqueios_ccbs', id), {
        id, auditorio, dataInicio, dataFim,
        motivo: motivo.trim() || 'Manutenção programada',
        criadoEm: new Date().toLocaleString('pt-BR')
      });
      setNovoBloqueio(prev => ({ ...prev, dataInicio: '', dataFim: '', motivo: '' }));
      showToast('Período de manutenção cadastrado!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar o bloqueio.', 'error');
    }
  };

  const handleRemoverBloqueio = async (id: string) => {
    if (!isAdminMode || !db) return;
    if (!window.confirm('Remover este período de manutenção e liberar o ambiente?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId as string, 'public', 'data', 'bloqueios_ccbs', id));
      showToast('Bloqueio removido.', 'info');
    } catch (e) {
      console.error(e);
      showToast('Erro ao remover o bloqueio.', 'error');
    }
  };

  const enviarEmailLembrete = async (dadosReserva: any) => {
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

    const destinos = [dadosReserva.email];
    if (dadosReserva.auditorio === 'SALA DE REUNIÃO') destinos.push(EMAIL_BIBLIOTECA);

    for (const destino of destinos) {
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { ...templateParams, to_email: destino }, EMAILJS_PUBLIC_KEY);
      } catch (error) {
        console.error(`Falha no envio para ${destino}:`, error);
      }
    }
  };

  const handleTransferirReserva = async (reserva: any, novoAuditorio: string) => {
    if (!isAdminMode) {
      showToast('Apenas administradores podem transferir reservas.', 'error');
      return;
    }

    const conflito = reservas.find(r => 
      r.id !== reserva.id &&
      r.auditorio === novoAuditorio &&
      r.data === reserva.data &&
      ((reserva.horaInicio >= r.horaInicio && reserva.horaInicio < r.horaFim) ||
       (reserva.horaFim > r.horaInicio && reserva.horaFim <= r.horaFim))
    );

    if (conflito) {
      showToast(`Conflito! O espaço ${novoAuditorio} já está ocupado neste horário.`, 'error');
      return;
    }

    const bloqueioDestino = buscarBloqueio(novoAuditorio, reserva.data);
    if (bloqueioDestino) {
      showToast(`${novoAuditorio} está em manutenção nesta data.`, 'error');
      return;
    }

    try {
      if (!db) return;
      const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', reserva.id);
      
      await updateDoc(docRef, { 
        auditorio: novoAuditorio,
        historicoTransferencia: `Transferido de ${reserva.auditorio} para ${novoAuditorio} em ${new Date().toLocaleDateString('pt-BR')}`
      });

      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_name: reserva.requisitante,
          to_email: reserva.email,
          reply_to: EMAIL_BIBLIOTECA,
          nome_evento: `${reserva.nomeEvento} (Remanejado)`,
          auditorio: novoAuditorio,
          data_evento: reserva.data.split('-').reverse().join('/'),
          hora_inicio: reserva.horaInicio,
          hora_fim: reserva.horaFim,
          protocolo: reserva.id
        }, EMAILJS_PUBLIC_KEY);
      } catch (e) {
        console.error("Erro ao enviar e-mail de transferência:", e);
      }

      showToast(`Reserva transferida para: ${novoAuditorio}`, 'success');
    } catch (error) {
      console.error('Erro ao transferir reserva:', error);
      showToast('Erro ao atualizar local no banco de dados.', 'error');
    }
  };

  const handleNotificarRemanejamento = async (b: any) => {
    const afetados = afetadosPorBloqueio(b);
    if (afetados.length === 0) {
      showToast('Nenhum agendamento afetado neste período.', 'info');
      return;
    }
    if (!window.confirm(`Enviar e-mail de aviso para ${afetados.length} requisitante(s)?`)) return;

    setEnviandoEmails(true);
    let sucessos = 0, falhas = 0;
    for (const reserva of afetados) {
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_name: reserva.requisitante,
          to_email: reserva.email,
          reply_to: EMAIL_BIBLIOTECA,
          nome_evento: reserva.nomeEvento,
          auditorio: reserva.auditorio,
          data_evento: formatarBR(reserva.data),
          hora_inicio: reserva.horaInicio,
          hora_fim: reserva.horaFim,
          protocolo: reserva.id,
          motivo_manutencao: b.motivo,
          previsao_retorno: formatarBR(b.dataFim)
        }, EMAILJS_PUBLIC_KEY);
        sucessos++;
      } catch { falhas++; }
    }
    setEnviandoEmails(false);
    showToast(`Notificações: ${sucessos} sucesso(s)${falhas ? `, ${falhas} falha(s)` : ''}`, 'success');
  };

  const handleGerarRelatorioManutencao = (b: any) => {
    const afetados = afetadosPorBloqueio(b);
    if (afetados.length === 0) {
      showToast('Nenhum agendamento afetado neste período.', 'info');
      return;
    }

    const docPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(14);
    docPdf.text('RELATÓRIO DE AGENDAMENTOS PARA REMANEJAMENTO', 105, 20, { align: 'center' });

    docPdf.setFontSize(10);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text('UNIVERSIDADE FEDERAL DE CAMPINA GRANDE - CCBS', 105, 26, { align: 'center' });
    docPdf.text(`Espaço: ${b.auditorio}`, 105, 31, { align: 'center' });
    docPdf.text(`Motivo: ${b.motivo}`, 105, 36, { align: 'center' });
    docPdf.text(`Período: ${formatarBR(b.dataInicio)} a ${formatarBR(b.dataFim)}`, 105, 41, { align: 'center' });

    docPdf.line(14, 46, 196, 46);

    let y = 54;
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('Data/Hora', 14, y);
    docPdf.text('Evento / Requisitante', 60, y);
    docPdf.text('Contato / Setor', 140, y);
    docPdf.line(14, y + 2, 196, y + 2);
    y += 8;

    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(9);

    afetados.forEach((item) => {
      if (y > 270) {
        docPdf.addPage();
        y = 20;
      }
      docPdf.setFont('helvetica', 'bold');
      docPdf.text(`${formatarBR(item.data)}`, 14, y);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(`${item.horaInicio} - ${item.horaFim}`, 14, y + 4);
      docPdf.text(`${item.nomeEvento || 'Sem Nome'}`, 60, y);
      docPdf.text(`Resp: ${item.requisitante}`, 60, y + 4);
      docPdf.text(`Tel: ${item.telefone || '-'}`, 140, y);
      docPdf.text(`Setor: ${item.setor || '-'}`, 140, y + 4);
      y += 12;
    });

    docPdf.save(`Relatorio_Remanejamento_${b.auditorio.replace(/\s/g, '')}_${hojeISO()}.pdf`);
    showToast('Relatório baixado com sucesso!', 'success');
  };

  // ==========================================
  // VALIDAÇÕES DO FORMULÁRIO E SUBMISSÃO
  // ==========================================
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'data') {
      const d = new Date(value + 'T12:00:00');
      if (d.getDay() === 0 || d.getDay() === 6) {
        showToast('Agendamentos válidos apenas para dias úteis (Seg a Sex)!', 'error');
        setFormData(prev => ({ ...prev, data: '' }));
        return;
      }
      const b = buscarBloqueio(formData.auditorio, value);
      if (b) {
        showToast(`${formData.auditorio} indisponível nesta data: ${b.motivo}`, 'error');
        setFormData(prev => ({ ...prev, data: '' }));
        return;
      }
    }

    if (name === 'auditorio' && formData.data) {
      const b = buscarBloqueio(value, formData.data);
      if (b) {
        showToast(`${value} está em manutenção na data selecionada (${b.motivo}).`, 'error');
        setFormData(prev => ({ ...prev, auditorio: value, data: '' }));
        return;
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    const diaHoje = new Date().getDay();
    if (diaHoje === 0 || diaHoje === 6) {
      showToast('Não é possível realizar solicitações no fim de semana.', 'error');
      return;
    }

    if (!formData.data || !formData.nomeEvento || !formData.requisitante || !formData.cpf || !formData.email || !formData.telefone || !formData.senha) {
      showToast('Preencha todos os campos obrigatórios!', 'error');
      return;
    }

    const bloqueioAtivo = buscarBloqueio(formData.auditorio, formData.data);
    if (bloqueioAtivo) {
      showToast(`${formData.auditorio} indisponível: ${bloqueioAtivo.motivo}`, 'error');
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
      if (!db) return;
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
      showToast('Erro ao guardar o agendamento.', 'error');
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
      showToast('Erro ao atualizar o status.', 'error');
    }
  };

  const confirmCancelation = async () => {
    if (!showCancelModal) return;

    const inputSenha = cancelPassword.trim();
    const senhaReserva = showCancelModal.senha ? String(showCancelModal.senha).trim() : '';

    if (inputSenha === senhaReserva || inputSenha === MASTER_PASSWORD) {
      try {
        if (!db) return;
        const docRef = doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', showCancelModal.id);
        await deleteDoc(docRef);
        
        showToast('Agendamento removido com sucesso!', 'info');
        setShowCancelModal(null);
        setCancelPassword('');
        setSelectedDayReservas(null);
      } catch (e) { 
        console.error("Erro ao cancelar agendamento:", e);
        showToast('Erro ao remover agendamento.', 'error'); 
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

      let dadosReserva = reservas.find(r => r.id && String(r.id).trim().toUpperCase() === idBuscado);

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
        showToast('Protocolo não encontrado.', 'error');
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
    if (!elemento) return;
    
    setGeneratingPDF(true);
    const originalWidth = elemento.style.width;
    const originalMaxWidth = elemento.style.maxWidth;

    try {
      elemento.style.width = '800px';
      elemento.style.maxWidth = '800px';
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(elemento, { 
        scale: 1.5, backgroundColor: '#ffffff', useCORS: true, allowTaint: false, logging: false
      });
      
      elemento.style.width = originalWidth;
      elemento.style.maxWidth = originalMaxWidth;

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
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

  const obterEstiloTag = (reserva: any) => {
    if (reserva.historicoTransferencia) return 'bg-purple-600 border border-purple-300 text-white font-black';
    if (reserva.auditorio === 'AUDITÓRIO') return 'bg-blue-600 text-white';
    if (reserva.auditorio === 'SALA DE REUNIÃO') return 'bg-cyan-500 text-white';
    if (reserva.auditorio === 'SALA 01') return 'bg-emerald-600 text-white';
    return 'bg-slate-600 text-white';
  };

  const copiarParaTransferencia = (texto: string) => {
    navigator.clipboard.writeText(texto);
    showToast('Código copiado! 📋');
  };

  // ==========================================
  // 5. AGENDAMENTO POR PROCESSO
  // ==========================================
  const gerarDatasCriterio = (c: any) => {
    if (!c.dataInicio || !c.dataFim || c.dataFim < c.dataInicio) return [];
    const out: string[] = [];
    const cur = new Date(c.dataInicio + 'T12:00:00');
    const fim = new Date(c.dataFim + 'T12:00:00');
    while (cur <= fim) {
      if (cur.getDay() === Number(c.diaSemana)) {
        out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  };

  const montarPreviaProcesso = () => {
    const lista: any[] = [];
    criterios.forEach(c => {
      if (c.horaFim <= c.horaInicio) return;
      gerarDatasCriterio(c).forEach(data => lista.push({ data, horaInicio: c.horaInicio, horaFim: c.horaFim }));
    });
    lista.sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));

    const resultado: any[] = [];

    lista.forEach(item => {
      const emManutencao = !!buscarBloqueio(processData.auditorio, item.data);

      const conflitoReserva =
        reservas.some(r => r.auditorio === processData.auditorio && r.data === item.data &&
          item.horaInicio < r.horaFim && item.horaFim > r.horaInicio) ||
        resultado.some(p => !p.conflito && p.data === item.data &&
          item.horaInicio < p.horaFim && item.horaFim > p.horaInicio);

      resultado.push({ 
        ...item, 
        conflito: conflitoReserva || emManutencao,
        motivoConflito: emManutencao ? 'Em Manutenção' : (conflitoReserva ? 'Horário Ocupado' : null)
      });
    });
    return resultado;
  };

  const atualizarCriterio = (id: string, campo: string, valor: string) => {
    setCriterios(prev => prev.map(c => (c.id === id ? { ...c, [campo]: valor } : c)));
  };

  const fecharModalProcesso = () => {
    setShowProcessModal(false);
    setProcessData({ auditorio: AUDITORIOS[0], nomeEvento: '', sei: '', adminSenha: '' });
    setCriterios([criterioVazio()]);
  };

  const handleSalvarProcesso = async () => {
    if (!processData.nomeEvento.trim() || !processData.sei.trim()) {
      showToast('Informe o nome do evento e o número do processo SEI!', 'error');
      return;
    }

    const validos = montarPreviaProcesso().filter(p => !p.conflito);
    if (validos.length === 0) {
      showToast('Nenhuma data válida para agendar. Verifique manutenção e conflitos.', 'error');
      return;
    }
    if (processData.adminSenha.trim() !== MASTER_PASSWORD) {
      showToast('Senha de administrador incorreta!', 'error');
      return;
    }
    if (!db) return;

    setSavingProcess(true);
    try {
      const agora = new Date().toLocaleString('pt-BR');
      const novas = validos.map(p => ({
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        auditorio: processData.auditorio,
        data: p.data,
        horaInicio: p.horaInicio,
        horaFim: p.horaFim,
        nomeEvento: processData.nomeEvento.trim(),
        requisitante: 'AGENDAMENTO POR PROCESSO',
        cpf: '-', email: '-', telefone: '-',
        setor: `SEI ${processData.sei.trim()}`,
        processoSei: processData.sei.trim(),
        senha: Math.random().toString(36).slice(2, 12),
        status: 'Confirmado',
        dataCriacao: agora
      }));

      await Promise.all(
        novas.map(r => setDoc(doc(db, 'artifacts', appId as string, 'public', 'data', 'reservas_ccbs', r.id), r))
      );

      if (processData.auditorio === 'SALA DE REUNIÃO') {
        try {
          await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_name: 'Biblioteca CCBS',
            to_email: EMAIL_BIBLIOTECA,
            reply_to: EMAIL_BIBLIOTECA,
            nome_evento: `${processData.nomeEvento.trim()} (Processo SEI ${processData.sei.trim()})`,
            auditorio: processData.auditorio,
            data_evento: novas.map(n => `${n.data.split('-').reverse().join('/')} ${n.horaInicio}-${n.horaFim}`).join(' | '),
            hora_inicio: 'conforme datas',
            hora_fim: 'listadas',
            protocolo: novas.map(n => n.id).join(', ')
          }, EMAILJS_PUBLIC_KEY);
        } catch (err) {
          console.error('Falha ao enviar cópia para biblioteca:', err);
        }
      }

      const ignorados = montarPreviaProcesso().length - validos.length;
      showToast(`${validos.length} agendamento(s) confirmado(s)${ignorados ? ` • ${ignorados} ignorado(s) por conflito/manutenção` : ''}`, 'success');
      fecharModalProcesso();
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar os agendamentos.', 'error');
    } finally {
      setSavingProcess(false);
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
      const isToday = hojeISO() === dateStr;
      const bloqueiosDia = bloqueios.filter(b => dateStr >= b.dataInicio && dateStr <= b.dataFim);

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
          {bloqueiosDia.length > 0 && (
            <span
              className="absolute top-1 right-1 text-[8px] font-black bg-amber-100 text-amber-800 px-1 rounded"
              title={bloqueiosDia.map(b => `${b.auditorio}: ${b.motivo}`).join('\n')}
            >
              🔒 {bloqueiosDia.length}
            </span>
          )}
          <div className="mt-1 space-y-1">
            {dayReservas.slice(0, 2).map((r, idx) => (
              <div 
                key={idx} 
                className={`text-[8px] md:text-[9px] truncate px-1 py-0.5 rounded font-bold uppercase flex items-center justify-between gap-1 ${obterEstiloTag(r)}`} 
                title={`${r.nomeEvento || r.requisitante}${r.historicoTransferencia ? ` (${r.historicoTransferencia})` : ''}`}
              >
                <span className="truncate">
                  {r.horaInicio} {r.nomeEvento || r.requisitante.split(' ')[0]}
                </span>
                {r.historicoTransferencia && (
                  <span className="bg-white/20 text-white text-[7px] px-0.5 rounded font-black shrink-0">
                    🔄
                  </span>
                )}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-white p-1 rounded-xl flex items-center justify-center" style={{ width: '44px', height: '44px' }}>
              <img src={UFCG_LOGO} alt="Logo UFCG" className="h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tighter">CCBS / UFCG</h1>
              <p className="text-blue-200 text-[10px] sm:text-[11px] uppercase font-black tracking-[0.2em]">CAMPINA GRANDE</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setShowProcessModal(true)}
              className="bg-blue-900 text-white border border-white/30 hover:bg-blue-950 font-black text-[10px] sm:text-[11px] uppercase px-3 sm:px-4 py-2 rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <CalendarCheck className="w-3.5 h-3.5" /> Agendamento por processo
            </button>
            <button 
              onClick={() => setShowReprintModal(true)}
              className="bg-white text-blue-700 hover:bg-blue-50 font-black text-[10px] sm:text-[11px] uppercase px-3 sm:px-4 py-2 rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" /> 2ª Via do Termo
            </button>
            {!isAdminMode ? (
              <button
                onClick={() => setShowAdminUnlock(true)}
                className="bg-blue-800 text-white hover:bg-blue-900 p-2 rounded-xl shadow transition-all cursor-pointer"
                title="Modo Administrador"
              >
                <Lock className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-600 px-3 py-1.5 rounded-xl text-xs font-black uppercase">
                <Unlock className="w-3.5 h-3.5" /> Admin
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 print:hidden flex-1">
        
        {/* FORMULÁRIO DE NOVO AGENDAMENTO */}
        <div className="lg:col-span-4 space-y-6">

          {/* PAINEL ADMIN: SUSPENDER AGENDAMENTOS POR PERÍODO */}
          {isAdminMode && (
            <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-[2rem] shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Suspender Agendamentos (Manutenção)</span>
              </div>

              <select
                value={novoBloqueio.auditorio}
                onChange={e => setNovoBloqueio(p => ({ ...p, auditorio: e.target.value }))}
                className="w-full p-3 bg-white border border-amber-200 rounded-xl font-bold text-xs uppercase outline-none"
              >
                {AUDITORIOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black uppercase text-amber-800 mb-1">De:</label>
                  <input type="date" value={novoBloqueio.dataInicio} min={hojeISO()}
                    onChange={e => setNovoBloqueio(p => ({ ...p, dataInicio: e.target.value }))}
                    className="w-full p-3 bg-white border border-amber-200 rounded-xl font-bold text-xs outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-amber-800 mb-1">Até:</label>
                  <input type="date" value={novoBloqueio.dataFim} min={novoBloqueio.dataInicio || hojeISO()}
                    onChange={e => setNovoBloqueio(p => ({ ...p, dataFim: e.target.value }))}
                    className="w-full p-3 bg-white border border-amber-200 rounded-xl font-bold text-xs outline-none" />
                </div>
              </div>

              <input type="text" value={novoBloqueio.motivo}
                onChange={e => setNovoBloqueio(p => ({ ...p, motivo: e.target.value }))}
                placeholder="Motivo (ex: Manutenção na climatização)"
                className="w-full p-3 bg-white border border-amber-200 rounded-xl font-medium text-xs outline-none" />

              <button type="button" onClick={handleAdicionarBloqueio}
                className="w-full py-2.5 bg-amber-600 text-white rounded-xl font-bold text-[10px] uppercase hover:bg-amber-700 transition-all cursor-pointer">
                Suspender Agendamentos no Período
              </button>

              {/* Lista de bloqueios vigentes */}
              {bloqueiosVigentes.length > 0 && (
                <div className="pt-2 border-t border-amber-200 space-y-2 max-h-64 overflow-y-auto">
                  {bloqueiosVigentes.map(b => (
                    <div key={b.id} className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-[11px] uppercase text-slate-800">{b.auditorio}</p>
                          <p className="text-[10px] font-bold text-amber-800">{formatarBR(b.dataInicio)} a {formatarBR(b.dataFim)}</p>
                          <p className="text-[10px] text-slate-500">{b.motivo}</p>
                          <p className="text-[10px] text-slate-400">{afetadosPorBloqueio(b).length} reserva(s) afetada(s)</p>
                        </div>
                        <button type="button" onClick={() => handleRemoverBloqueio(b.id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 cursor-pointer" title="Remover bloqueio">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" disabled={enviandoEmails} onClick={() => handleNotificarRemanejamento(b)}
                          className="flex-1 py-2 bg-blue-700 text-white font-bold rounded-lg text-[9px] uppercase hover:bg-blue-800 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50">
                          {enviandoEmails ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Notificar
                        </button>
                        <button type="button" onClick={() => handleGerarRelatorioManutencao(b)}
                          className="flex-1 py-2 bg-amber-800 text-white font-bold rounded-lg text-[9px] uppercase hover:bg-amber-900 flex items-center justify-center gap-1 cursor-pointer">
                          <FileText className="w-3 h-3" /> PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden sticky top-24">
            
            <div className="bg-blue-800 p-6 flex items-center justify-between">
              <h2 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-blue-300" /> Novo Agendamento
              </h2>
              <button 
                type="button"
                onClick={() => setShowHelpModal(true)} 
                className="bg-white/10 p-2 rounded-lg text-white hover:bg-white/20 transition-all cursor-pointer" 
                title="Central de Ajuda"
              >
                <HelpCircle className="w-5 h-5 text-white" />
              </button>
            </div>
            
            <form onSubmit={handleBooking} className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Local & Data</label>
                
                <select 
                  name="auditorio" 
                  value={formData.auditorio} 
                  onChange={handleChange} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold uppercase text-xs focus:border-blue-600 outline-none transition-all"
                >
                  {AUDITORIOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                {bloqueiosVigentes.filter(b => b.auditorio === formData.auditorio).map(b => (
                  <div key={b.id} className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold uppercase text-[10px] text-amber-700 tracking-wider">Indisponível para novos agendamentos</p>
                      <p className="mt-0.5">{b.motivo}</p>
                      <p className="mt-1 text-[11px] font-bold text-amber-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600 inline" />
                        {formatarBR(b.dataInicio)} a {formatarBR(b.dataFim)}
                      </p>
                    </div>
                  </div>
                ))}
                
                <input 
                  type="date" 
                  name="data" 
                  value={formData.data} 
                  onChange={handleChange} 
                  min={hojeISO()}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 font-bold text-xs" 
                />
                
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
                <input type="text" name="nomeEvento" value={formData.nomeEvento} onChange={handleChange} placeholder="Nome do Evento" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 font-bold text-xs" />

                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Responsável</label>
                <input type="text" name="requisitante" value={formData.requisitante} onChange={handleChange} placeholder="Nome Completo" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-xs" />
                
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="CPF" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-xs" />
                  <input type="text" name="telefone" value={formData.telefone} onChange={handleChange} placeholder="Telefone" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-xs" />
                </div>
                
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="E-mail" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-xs" />
                <input type="text" name="setor" value={formData.setor} onChange={handleChange} placeholder="Setor / Departamento" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-xs" />

                <div className="bg-blue-900/5 p-4 rounded-2xl border-2 border-blue-100 mt-4">
                  <div className="flex items-center gap-2 mb-2 text-blue-900">
                    <Lock className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Chave de Segurança</span>
                  </div>
                  <input type="password" name="senha" value={formData.senha} onChange={handleChange} placeholder="Senha p/ Cancelamento" className="w-full p-3 bg-white border border-blue-200 rounded-xl text-center font-bold tracking-widest text-blue-900 outline-none focus:border-blue-600 text-xs" />
                </div>
              </div>

              <button type="submit" className="w-full py-5 mt-2 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
                <CheckCircle className="w-4 h-4" /> Confirmar Agendamento
              </button>
            </form>
          </div>
        </div>

        {/* CALENDÁRIO & LISTAS */}
        <div className="lg:col-span-8 space-y-6">

          {/* LISTA DE AFETADOS NO PAINEL ADMIN PARA TRANSFERÊNCIA */}
          {isAdminMode && bloqueiosVigentes.some(b => afetadosPorBloqueio(b).length > 0) && (
            <div className="bg-white p-5 rounded-[2.5rem] border border-amber-200 shadow-xl space-y-3">
              <h4 className="text-xs font-black uppercase text-amber-900">Agendamentos Afetados por Manutenção</h4>
              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {bloqueiosVigentes.flatMap(b => afetadosPorBloqueio(b)).map(r => (
                  <div key={r.id} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-800 text-xs">
                        {formatarBR(r.data)} • {r.horaInicio} às {r.horaFim} •{' '}
                        <span className="text-amber-700">{r.auditorio}</span>
                      </p>
                      <p className="text-slate-700 font-bold text-[11px] mt-0.5">
                        {r.nomeEvento} <span className="font-normal text-slate-500">({r.requisitante})</span>
                      </p>
                      <p className="text-slate-500 text-[10px] mt-0.5">Setor: {r.setor || 'N/I'} | Tel: {r.telefone}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] font-black uppercase text-amber-800 mr-1 hidden sm:inline">Mover para:</span>
                      {AUDITORIOS.filter(a => a !== r.auditorio && !buscarBloqueio(a, r.data)).map(a => (
                        <button key={a} type="button" onClick={() => handleTransferirReserva(r, a)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-[10px] uppercase shadow-sm cursor-pointer">
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CALENDÁRIO MENSAL */}
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-blue-400" />
                <h2 className="font-black text-sm uppercase tracking-widest">
                  {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer">
                  Hoje
                </button>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center border-b border-slate-100 bg-slate-50 font-black text-[10px] text-slate-400 py-3 uppercase tracking-wider">
              <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
            </div>

            <div className="grid grid-cols-7">{renderCalendar()}</div>

            {/* LEGENDA DE CORES */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase text-slate-500">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Auditório</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Sala de Reunião</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Sala 01</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> Remanejado</div>
                <div className="flex items-center gap-1.5"><span className="text-[10px]">🔒</span> Manutenção</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: DETALHES DO DIA SELECIONADO */}
      {selectedDayReservas && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full shadow-2xl overflow-hidden animate-scale-up">
            <div className="bg-blue-800 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">
                  Reservas do Dia {selectedDayReservas.date.split('-').reverse().join('/')}
                </h3>
                <p className="text-blue-200 text-xs mt-0.5">{selectedDayReservas.items.length} agendamento(s) localizado(s)</p>
              </div>
              <button onClick={() => setSelectedDayReservas(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all cursor-pointer">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto space-y-3">
              {selectedDayReservas.items.map(r => (
                <div key={r.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${obterEstiloTag(r)}`}>
                      {r.auditorio}
                    </span>
                    {r.historicoTransferencia && (
                      <span className="flex items-center gap-1 bg-purple-100 text-purple-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-purple-200">
                        🔄 REMANEJADO
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{r.nomeEvento}</h4>
                    <p className="text-xs text-slate-500 font-bold">{r.horaInicio} às {r.horaFim} • Resp: {r.requisitante}</p>
                  </div>

                  {r.historicoTransferencia && (
                    <div className="p-2 bg-purple-50 rounded-xl border border-purple-100 text-[10px] text-purple-900 font-medium">
                      <p className="font-bold uppercase text-[9px] text-purple-700">Histórico de Alteração:</p>
                      <p>{r.historicoTransferencia}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className={`font-bold ${r.status === 'Confirmado' ? 'text-emerald-600' : 'text-amber-600'}`}>{r.status}</span>
                    <button onClick={() => setShowCancelModal(r)} className="text-red-600 font-bold hover:underline cursor-pointer">Cancelar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIGITAR SENHA DE CANCELAMENTO */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-black text-slate-800 text-sm uppercase">Confirmar Cancelamento</h3>
            <p className="text-xs text-slate-500 font-semibold">Digite a senha cadastrada para o protocolo {showCancelModal.id}:</p>
            <input type="password" value={cancelPassword} onChange={e => setCancelPassword(e.target.value)} placeholder="Senha de Segurança" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-center font-bold text-xs" />
            <div className="flex gap-2">
              <button onClick={() => setShowCancelModal(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold text-xs uppercase rounded-xl">Voltar</button>
              <button onClick={confirmCancelation} className="flex-1 py-3 bg-red-600 text-white font-bold text-xs uppercase rounded-xl">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DESBLOQUEAR MODO ADMIN */}
      {showAdminUnlock && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-black text-slate-800 text-sm uppercase">Painel do Administrador</h3>
            <input type="password" value={adminUnlockPassword} onChange={e => setAdminUnlockPassword(e.target.value)} placeholder="Senha Mestra" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-center font-bold text-xs" />
            <div className="flex gap-2">
              <button onClick={() => setShowAdminUnlock(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold text-xs uppercase rounded-xl">Cancelar</button>
              <button onClick={handleAdminUnlock} className="flex-1 py-3 bg-blue-700 text-white font-bold text-xs uppercase rounded-xl">Acessar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SEGUNDA VIA DO TERMO */}
      {showReprintModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-black text-slate-800 text-sm uppercase">2ª Via do Termo</h3>
            <input type="text" value={reprintId} onChange={e => setReprintId(e.target.value)} placeholder="Código do Protocolo" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs uppercase" />
            <input type="password" value={reprintPassword} onChange={e => setReprintPassword(e.target.value)} placeholder="Senha de Segurança" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs" />
            <div className="flex gap-2">
              <button onClick={() => setShowReprintModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold text-xs uppercase rounded-xl">Sair</button>
              <button onClick={handleFetchSecondCopy} disabled={loadingSecondCopy} className="flex-1 py-3 bg-blue-700 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1">
                {loadingSecondCopy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGENDAMENTO POR PROCESSO */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-2xl w-full p-6 shadow-2xl space-y-4 overflow-hidden">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-800 text-sm uppercase">Agendamento por Processo (SEI)</h3>
              <button onClick={fecharModalProcesso} className="p-2 bg-slate-100 rounded-xl"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              <select 
                value={processData.auditorio} 
                onChange={e => setProcessData(prev => ({ ...prev, auditorio: e.target.value }))}
                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs uppercase"
              >
                {AUDITORIOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              <input type="text" value={processData.nomeEvento} onChange={e => setProcessData(prev => ({ ...prev, nomeEvento: e.target.value }))} placeholder="Nome do Evento / Disciplina" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs" />
              <input type="text" value={processData.sei} onChange={e => setProcessData(prev => ({ ...prev, sei: e.target.value }))} placeholder="Número do Processo SEI" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs" />

              {criterios.map((c) => (
                <div key={c.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <select value={c.diaSemana} onChange={e => atualizarCriterio(c.id, 'diaSemana', e.target.value)} className="p-2 bg-white rounded-xl border text-xs font-bold">
                      <option value="1">Segunda</option><option value="2">Terça</option><option value="3">Quarta</option><option value="4">Quinta</option><option value="5">Sexta</option>
                    </select>
                    <input type="time" value={c.horaInicio} onChange={e => atualizarCriterio(c.id, 'horaInicio', e.target.value)} className="p-2 bg-white rounded-xl border text-xs font-bold" />
                    <input type="time" value={c.horaFim} onChange={e => atualizarCriterio(c.id, 'horaFim', e.target.value)} className="p-2 bg-white rounded-xl border text-xs font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={c.dataInicio} onChange={e => atualizarCriterio(c.id, 'dataInicio', e.target.value)} className="p-2 bg-white rounded-xl border text-xs font-bold" />
                    <input type="date" value={c.dataFim} onChange={e => atualizarCriterio(c.id, 'dataFim', e.target.value)} className="p-2 bg-white rounded-xl border text-xs font-bold" />
                  </div>
                </div>
              ))}

              <input type="password" value={processData.adminSenha} onChange={e => setProcessData(prev => ({ ...prev, adminSenha: e.target.value }))} placeholder="Senha Mestra do Admin" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-center font-bold text-xs" />
            </div>

            <div className="flex gap-2 border-t pt-3">
              <button onClick={fecharModalProcesso} className="flex-1 py-3 bg-slate-100 font-bold text-xs uppercase rounded-xl">Cancelar</button>
              <button onClick={handleSalvarProcesso} disabled={savingProcess} className="flex-1 py-3 bg-blue-700 text-white font-bold text-xs uppercase rounded-xl flex justify-center items-center gap-1">
                {savingProcess ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Lote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TERMO IMPRESSO DE RESERVA */}
      {showReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-xl w-full p-6 shadow-2xl overflow-hidden space-y-4">
            <div ref={termoRef} className="p-6 bg-white space-y-4 text-slate-800">
              <div className="text-center border-b pb-4">
                <h2 className="font-black text-base uppercase">Comprovante de Agendamento</h2>
                <p className="text-xs text-slate-500 font-bold">CCBS / UFCG • Protocolo: {showReceipt.id}</p>
              </div>

              <div className="space-y-2 text-xs font-semibold">
                <p><strong>Evento:</strong> {showReceipt.nomeEvento}</p>
                <p><strong>Local:</strong> {showReceipt.auditorio}</p>
                <p><strong>Data:</strong> {showReceipt.data.split('-').reverse().join('/')} ({showReceipt.horaInicio} - {showReceipt.horaFim})</p>
                <p><strong>Requisitante:</strong> {showReceipt.requisitante} (CPF: {showReceipt.cpf})</p>
                <p><strong>Contato:</strong> {showReceipt.email} | Tel: {showReceipt.telefone}</p>
                <p><strong>Setor:</strong> {showReceipt.setor || 'N/I'}</p>
              </div>

              <div className="text-center pt-4 border-t text-[10px] text-slate-400 font-bold uppercase">
                Emitido em {formatarDataExtenso(showReceipt.dataCriacao)}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowReceipt(null)} className="flex-1 py-3 bg-slate-100 font-bold text-xs uppercase rounded-xl">Fechar</button>
              <button onClick={handleDownloadPDF} disabled={generatingPDF} className="flex-1 py-3 bg-blue-700 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1">
                {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Baixar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
