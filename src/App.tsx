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

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

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
  const [user, setUser] = useState<any>(null);
  const [reservas, setReservas] = useState<any[]>([]);
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);

  const [showCancelModal, setShowCancelModal] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState<any>(null);
  const [showAdminUnlock, setShowAdminUnlock] = useState(false);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false); 
  const [showProcessModal, setShowProcessModal] = useState(false);

  const [cancelPassword, setCancelPassword] = useState('');
  const [adminUnlockPassword, setAdminUnlockPassword] = useState('');
  const [reprintId, setReprintId] = useState('');
  const [reprintPassword, setReprintPassword] = useState('');

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

  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [loadingSecondCopy, setLoadingSecondCopy] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayReservas, setSelectedDayReservas] = useState<{date: string, items: any[]} | null>(null);

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

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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

  useEffect(() => {
    if (selectedDayReservas) {
      const atualizadas = reservas.filter(r => r.data === selectedDayReservas.date);
      setSelectedDayReservas({ date: selectedDayReservas.date, items: atualizadas });
    }
  }, [reservas]);

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
      showToast('Não é possível realizar solicitações de agendamento no fim de semana.', 'error');
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
      await set
