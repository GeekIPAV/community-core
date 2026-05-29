import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const pt = {
  common: {
    save: "Guardar", cancel: "Cancelar", delete: "Apagar", edit: "Editar",
    add: "Adicionar", remove: "Remover", confirm: "Confirmar", close: "Fechar",
    loading: "A carregar…", search: "Pesquisar", filter: "Filtrar",
    columns: "Colunas", actions: "Ações", yes: "Sim", no: "Não",
    signOut: "Sair", language: "Idioma",
  },
  nav: {
    community: "Comunidade",
    participantsMgmt: "Gestão de Participantes",
    actionsMgmt: "Gestão de Ações",
    admin: "Administração",
    publicPortal: "Portal Público",
    results: "Resultados",
    myProfile: "O Meu Perfil",
    participants: "Participantes",
    families: "Famílias",
    projects: "Projetos",
    duplicates: "Duplicados",
    actions: "Ações",
    userTypes: "Tipos de Utilizador",
  },
  participants: {
    title: "Participantes", name: "Nome", email: "Email", phone: "Telefone",
    birthdate: "Data de Nascimento", gender: "Género", city: "Cidade",
    nationality: "Nacionalidade", religion: "Religião", status: "Estado",
    addParticipant: "Adicionar participante",
  },
  families: {
    title: "Famílias", members: "Membros", addMember: "Adicionar membro",
    removeFromFamily: "Remover da família", deleteUser: "Apagar utilizador",
  },
  results: {
    title: "Resultados e Impacto",
    subtitle: "Uma visão agregada e anónima do alcance da nossa comunidade.",
    summary: "Resumo",
    charts: "Gráficos",
    newMetric: "Nova métrica",
    newChart: "Novo gráfico",
    configure: "Configurar",
    moveUp: "Mover para cima",
    moveDown: "Mover para baixo",
    emptyMetricsAdmin: "Sem métricas. Adiciona a primeira.",
    emptyMetrics: "Sem métricas.",
    emptyChartsAdmin: "Sem gráficos. Adiciona o primeiro.",
    emptyCharts: "Sem gráficos.",
    loadError: "Não foi possível carregar as estatísticas.",
    dataLoadError: "Não foi possível carregar os dados.",
    noData: "Sem dados",
  },
  header: { personalArea: "Área pessoal", signIn: "Entrar", brand: "Meeru" },
};

const en = {
  common: {
    save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit",
    add: "Add", remove: "Remove", confirm: "Confirm", close: "Close",
    loading: "Loading…", search: "Search", filter: "Filter",
    columns: "Columns", actions: "Actions", yes: "Yes", no: "No",
    signOut: "Sign out", language: "Language",
  },
  nav: {
    community: "Community",
    participantsMgmt: "Participants Management",
    actionsMgmt: "Actions Management",
    admin: "Administration",
    publicPortal: "Public Portal",
    results: "Results",
    myProfile: "My Profile",
    participants: "Participants",
    families: "Families",
    projects: "Projects",
    duplicates: "Duplicates",
    actions: "Actions",
    userTypes: "User Types",
  },
  participants: {
    title: "Participants", name: "Name", email: "Email", phone: "Phone",
    birthdate: "Date of Birth", gender: "Gender", city: "City",
    nationality: "Nationality", religion: "Religion", status: "Status",
    addParticipant: "Add participant",
  },
  families: {
    title: "Families", members: "Members", addMember: "Add member",
    removeFromFamily: "Remove from family", deleteUser: "Delete user",
  },
  results: {
    title: "Results & Impact",
    subtitle: "An aggregated, anonymous view of our community's reach.",
    summary: "Summary",
    charts: "Charts",
    newMetric: "New metric",
    newChart: "New chart",
    configure: "Configure",
    moveUp: "Move up",
    moveDown: "Move down",
    emptyMetricsAdmin: "No metrics yet. Add the first.",
    emptyMetrics: "No metrics.",
    emptyChartsAdmin: "No charts yet. Add the first.",
    emptyCharts: "No charts.",
    loadError: "Could not load statistics.",
    dataLoadError: "Could not load data.",
    noData: "No data",
  },
  header: { personalArea: "Personal area", signIn: "Sign in", brand: "Meeru" },
};

const ar = {
  common: {
    save: "حفظ", cancel: "إلغاء", delete: "حذف", edit: "تعديل",
    add: "إضافة", remove: "إزالة", confirm: "تأكيد", close: "إغلاق",
    loading: "جارٍ التحميل…", search: "بحث", filter: "تصفية",
    columns: "الأعمدة", actions: "إجراءات", yes: "نعم", no: "لا",
    signOut: "تسجيل الخروج", language: "اللغة",
  },
  nav: {
    community: "المجتمع",
    participantsMgmt: "إدارة المشاركين",
    actionsMgmt: "إدارة الأنشطة",
    admin: "الإدارة",
    publicPortal: "البوابة العامة",
    results: "النتائج",
    myProfile: "ملفي الشخصي",
    participants: "المشاركون",
    families: "العائلات",
    projects: "المشاريع",
    duplicates: "المكررات",
    actions: "الأنشطة",
    userTypes: "أنواع المستخدمين",
  },
  participants: {
    title: "المشاركون", name: "الاسم", email: "البريد الإلكتروني", phone: "الهاتف",
    birthdate: "تاريخ الميلاد", gender: "الجنس", city: "المدينة",
    nationality: "الجنسية", religion: "الديانة", status: "الحالة",
    addParticipant: "إضافة مشارك",
  },
  families: {
    title: "العائلات", members: "الأعضاء", addMember: "إضافة عضو",
    removeFromFamily: "إزالة من العائلة", deleteUser: "حذف المستخدم",
  },
  results: {
    title: "النتائج والأثر",
    subtitle: "نظرة مجمّعة ومجهولة الهوية على امتداد مجتمعنا.",
    summary: "ملخص",
    charts: "الرسوم البيانية",
    newMetric: "مقياس جديد",
    newChart: "رسم بياني جديد",
    configure: "إعداد",
    moveUp: "نقل لأعلى",
    moveDown: "نقل لأسفل",
    emptyMetricsAdmin: "لا توجد مقاييس. أضف الأول.",
    emptyMetrics: "لا توجد مقاييس.",
    emptyChartsAdmin: "لا توجد رسوم. أضف الأول.",
    emptyCharts: "لا توجد رسوم.",
    loadError: "تعذّر تحميل الإحصائيات.",
    dataLoadError: "تعذّر تحميل البيانات.",
    noData: "لا توجد بيانات",
  },
  header: { personalArea: "المنطقة الشخصية", signIn: "تسجيل الدخول", brand: "ميرو" },
};

export const LANGUAGES = [
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
] as const;

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        pt: { translation: pt },
        en: { translation: en },
        ar: { translation: ar },
      },
      fallbackLng: "pt",
      supportedLngs: ["pt", "en", "ar"],
      interpolation: { escapeValue: false },
      detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
    });
}

function applyDir(lng: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
}
applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

export default i18n;

export function useDir(): "rtl" | "ltr" {
  const { i18n } = useTranslation();
  const [dir, setDir] = useState<"rtl" | "ltr">(
    (i18n.dir?.(i18n.language) as "rtl" | "ltr") ?? "ltr",
  );
  useEffect(() => {
    const update = (lng: string) => setDir(lng === "ar" ? "rtl" : "ltr");
    update(i18n.language);
    i18n.on("languageChanged", update);
    return () => {
      i18n.off("languageChanged", update);
    };
  }, [i18n]);
  return dir;
}