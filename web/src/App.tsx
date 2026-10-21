import { Route, Routes } from 'react-router'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import ModulePage from './pages/ModulePage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/pacientes" element={<ModulePage title="Pacientes" />} />
        <Route path="/agendamentos" element={<ModulePage title="Agendamentos" />} />
        <Route path="/calendario" element={<ModulePage title="Calendário" />} />
        <Route path="/profissionais" element={<ModulePage title="Profissionais" />} />
        <Route path="/prontuarios" element={<ModulePage title="Prontuários" />} />
        <Route path="/exames" element={<ModulePage title="Exames" />} />
        <Route path="/clinicas" element={<ModulePage title="Clínicas" />} />
        <Route path="/usuarios" element={<ModulePage title="Usuários" />} />
      </Route>
    </Routes>
  )
}
