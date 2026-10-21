
function App() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-xl bg-primary-dark p-6 text-white">
          <h1 className="text-2xl font-bold">
            Medvita Care
          </h1>
          <p className="mt-2 text-blue-100">
            Sistema de gestão para clínicas oftalmológicas
          </p>
        </header>

        <main className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {['Pacientes', 'Agendamentos', 'Calendário'].map(
            (item) => (
              <div
                key={item}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              >
                <h2 className="text-lg font-semibold text-primary-dark">
                  {item}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Módulo em desenvolvimento
                </p>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  )
}

export default App
