import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

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