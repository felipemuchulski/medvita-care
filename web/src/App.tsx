import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import LoginPage from './features/auth/pages/LoginPage'
import ChangePasswordPage from './features/auth/pages/ChangePasswordPage'
import ProtectedRoute from './features/auth/routes/ProtectedRoute'
import PublicOnlyRoute from './features/auth/routes/PublicOnlyRoute'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import ModulePage from './pages/ModulePage'
import ProfessionalsPage from './features/professionals/pages/ProfessionalsPage'
import AppointmentsPage from './features/appointments/pages/AppointmentsPage'
const CalendarPage = lazy(() => import('./features/calendar/pages/CalendarPage'))
const MedicalRecordsPage = lazy(
  () => import('./features/medical-records/pages/MedicalRecordsPage'),
)
const EncounterPage = lazy(() => import('./features/medical-records/pages/EncounterPage'))
import PatientsPage from './features/patients/pages/PatientsPage'
import CreatePatientPage from './features/patients/pages/CreatePatientPage'
import EditPatientPage from './features/patients/pages/EditPatientPage'
import PatientDetailsPage from './features/patients/pages/PatientDetailsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route
          path="/login"
          element={<LoginPage />}
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            index
            element={<DashboardPage />}
          />
          <Route
            path="/pacientes"
            element={<PatientsPage />}
          />
          <Route
            path="/pacientes/novo"
            element={<CreatePatientPage />}
          />
          <Route
            path="/pacientes/:patientId"
            element={<PatientDetailsPage />}
          />
          <Route
            path="/pacientes/:patientId/editar"
            element={<EditPatientPage />}
          />
          <Route
            path="/agendamentos"
            element={<AppointmentsPage />}
          />
          <Route
            path="/agendamentos/novo"
            element={<AppointmentsPage />}
          />
          <Route
            path="/agendamentos/:appointmentId"
            element={<AppointmentsPage />}
          />
          <Route
            path="/agendamentos/:appointmentId/reagendar"
            element={<AppointmentsPage />}
          />
          <Route
            path="/calendario"
            element={
              <Suspense fallback={<p role="status">Carregando calendário...</p>}>
                <CalendarPage />
              </Suspense>
            }
          />
          <Route
            path="/profissionais"
            element={<ProfessionalsPage />}
          />
          <Route
            path="/profissionais/novo"
            element={<ProfessionalsPage />}
          />
          <Route
            path="/profissionais/:professionalId"
            element={<ProfessionalsPage />}
          />
          <Route
            path="/profissionais/:professionalId/editar"
            element={<ProfessionalsPage />}
          />
          <Route
            path="/prontuarios"
            element={
              <Suspense fallback={<p role="status">Carregando prontuários...</p>}>
                <MedicalRecordsPage />
              </Suspense>
            }
          />
          <Route
            path="/prontuarios/pacientes/:patientId"
            element={
              <Suspense fallback={<p role="status">Carregando histórico...</p>}>
                <MedicalRecordsPage />
              </Suspense>
            }
          />
          <Route
            path="/prontuarios/atendimentos/:encounterId"
            element={
              <Suspense fallback={<p role="status">Carregando atendimento...</p>}>
                <EncounterPage />
              </Suspense>
            }
          />
          <Route
            path="/exames"
            element={<ModulePage title="Exames" />}
          />
          <Route
            path="/clinicas"
            element={<ModulePage title="Clínicas" />}
          />
          <Route
            path="/usuarios"
            element={<ModulePage title="Usuários" />}
          />
          <Route
            path="/alterar-senha"
            element={<ChangePasswordPage />}
          />
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  )
}
