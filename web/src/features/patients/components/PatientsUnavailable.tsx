import { useClinic } from '../../../hooks/use-clinic'

export default function PatientsUnavailable() {
  const { memberships, isLoading, error } = useClinic()

  return (
    <div className="rounded-xl border border-border bg-white px-5 py-12 text-center shadow-sm">
      <h1 className="text-xl font-semibold">Pacientes indisponíveis</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm text-text-secondary">
        {isLoading
          ? 'Carregando as clínicas autorizadas...'
          : error
            ? error
            : memberships.length > 1
              ? 'Selecione uma clínica no menu lateral para acessar os pacientes.'
              : 'Seu usuário não possui vínculo ativo com uma clínica. O administrador global não recebe acesso automático a dados de pacientes.'}
      </p>
    </div>
  )
}
