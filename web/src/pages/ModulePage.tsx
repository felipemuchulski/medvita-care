interface ModulePageProps {
  title: string
}

export default function ModulePage({ title }: ModulePageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Módulo em desenvolvimento.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-white px-4 py-16 text-center">
        <p className="font-medium text-text-primary">Em breve</p>
        <p className="mt-2 text-sm text-text-secondary">
          Este módulo será implementado nas próximas etapas.
        </p>
      </div>
    </div>
  )
}
