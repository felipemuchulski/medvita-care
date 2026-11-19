import { useRouteError } from 'react-router'

export default function RouteErrorPage() {
  const error = useRouteError()
  const moduleFailed =
    error instanceof Error &&
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk .+ failed/i.test(
      error.message,
    )

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section
        role="alert"
        className="w-full max-w-lg space-y-4 rounded-xl bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-900">
          {moduleFailed
            ? 'Não foi possível carregar esta página'
            : 'Ocorreu um erro ao abrir esta página'}
        </h1>
        <p className="text-slate-600">
          {moduleFailed
            ? 'O sistema pode ter sido atualizado ou a conexão foi interrompida. Verifique sua conexão e recarregue a página para tentar novamente.'
            : 'Recarregue a página para tentar novamente. Se o problema continuar, entre em contato com o suporte.'}
        </p>
        <button
          type="button"
          className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
          onClick={() => window.location.reload()}
        >
          Recarregar página
        </button>
      </section>
    </main>
  )
}
