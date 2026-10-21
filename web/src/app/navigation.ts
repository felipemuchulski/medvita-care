
import {
  LayoutDashboard,
  UsersRound,
  CalendarClock,
  CalendarDays,
  Stethoscope,
  FileText,
  Eye,
  Building2,
  UserCog,
} from 'lucide-react'

export const navigationItems = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Pacientes',
    path: '/pacientes',
    icon: UsersRound,
  },
  {
    label: 'Agendamentos',
    path: '/agendamentos',
    icon: CalendarClock,
  },
  {
    label: 'Calendário',
    path: '/calendario',
    icon: CalendarDays,
  },
  {
    label: 'Profissionais',
    path: '/profissionais',
    icon: Stethoscope,
  },
  {
    label: 'Prontuários',
    path: '/prontuarios',
    icon: FileText,
  },
  {
    label: 'Exames',
    path: '/exames',
    icon: Eye,
  },
  {
    label: 'Clínicas',
    path: '/clinicas',
    icon: Building2,
  },
  {
    label: 'Usuários',
    path: '/usuarios',
    icon: UserCog,
  },
]
