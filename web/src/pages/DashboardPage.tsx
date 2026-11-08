import { ArrowRight, CalendarClock, CalendarDays, UsersRound } from 'lucide-react'
import { Link } from 'react-router'

const shortcuts = [
  {
    title: 'Pacientes',
    description: 'Gerenciar cadastros e históricos.',
    path: '/pacientes',
    icon: UsersRound,
  },
  {
    title: 'Agendamentos',
    description: 'Cadastrar e consultar agendamentos.',
    path: '/agendamentos',
    icon: CalendarClock,
  },
  {
    title: 'Calendário',
    description: 'Visualizar a agenda de consultas.',
    path: '/calendario',
    icon: CalendarDays,
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Visão geral</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Acompanhe as principais atividades da clínica.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {shortcuts.map((item) => {
          const Icon = item.icon

          return (
            <article
              key={item.path}
              className="rounded-xl border border-border bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Icon size={24} />
              </div>

              <h2 className="text-lg font-semibold text-text-primary">{item.title}</h2>

              <p className="mt-2 text-sm text-text-secondary">{item.description}</p>

              <Link
                to={item.path}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Acessar
                <ArrowRight size={16} />
              </Link>
            </article>
          )
        })}
      </section>

      <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Próximos atendimentos
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Agenda dos profissionais da clínica.
            </p>
          </div>

          <Link
            to="/calendario"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
          >
            Ver calendário
          </Link>
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-border bg-background px-4 py-12 text-center">
          <CalendarDays
            size={36}
            className="mx-auto text-primary"
          />

          <p className="mt-4 font-medium text-text-primary">Agenda ainda não integrada</p>

          <p className="mt-2 text-sm text-text-secondary">
            Os próximos atendimentos serão exibidos aqui após a integração com a API.
          </p>
        </div>
      </section>
    </div>
  )
}
