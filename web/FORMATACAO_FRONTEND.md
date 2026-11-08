# Padronização React/TSX — 07/11/2026

- Prettier instalado como dependência de desenvolvimento em `/web`.
- Configuração: `.prettierrc.json`, largura de referência 90, indentação de dois espaços, sem ponto e vírgula, aspas simples, trailingComma all e singleAttributePerLine true.
- `.prettierignore` exclui dependências, build, coverage e lockfile.
- Comandos: `npm run format` e `npm run format:check`, executados em `/web`. Ambos abrangem somente `src/**/*.tsx`.
- Nenhuma extração de componentes ou alteração estrutural nesta tarefa. Código local preexistente preservado.
- Comparação antes/depois do AST do JavaScript gerado pelo TypeScript para os 32 arquivos: equivalente, normalizando parênteses e a divisão de strings adjacentes nos filhos JSX. Conteúdo dos textos, espaços renderizados e classes preservados.
- Prettier check, ESLint, TypeScript (`tsc -b`, integrado ao build), build e git diff --check aprovados.
- `npm test` executado: nenhum arquivo de teste encontrado, saída 1. Os testes haviam sido removidos em tarefas anteriores; nenhum teste foi recriado nesta refatoração.
- Build conserva aviso de chunk principal acima de 500 kB, preexistente à formatação. Não houve mudança de carregamento ou divisão de módulos nesta tarefa.
- Alterações desta tarefa exclusivamente em `/web`; nenhuma modificação em `/api`.

## Arquivos TSX formatados

- `src/App.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/contexts/AuthProvider.tsx`
- `src/contexts/ClinicProvider.tsx`
- `src/features/appointments/components/AppointmentForm.tsx`
- `src/features/appointments/components/AppointmentStatusBadge.tsx`
- `src/features/appointments/components/CancelAppointmentDialog.tsx`
- `src/features/appointments/components/Selectors.tsx`
- `src/features/appointments/pages/AppointmentsPage.tsx`
- `src/features/auth/pages/ChangePasswordPage.tsx`
- `src/features/auth/pages/LoginPage.tsx`
- `src/features/auth/routes/ProtectedRoute.tsx`
- `src/features/auth/routes/PublicOnlyRoute.tsx`
- `src/features/calendar/components/CalendarEventContent.tsx`
- `src/features/calendar/components/CalendarToolbar.tsx`
- `src/features/calendar/components/FullCalendarView.tsx`
- `src/features/calendar/pages/CalendarPage.tsx`
- `src/features/patients/components/PatientForm.tsx`
- `src/features/patients/components/PatientStatusBadge.tsx`
- `src/features/patients/pages/CreatePatientPage.tsx`
- `src/features/patients/pages/EditPatientPage.tsx`
- `src/features/patients/pages/PatientDetailsPage.tsx`
- `src/features/patients/pages/PatientsPage.tsx`
- `src/features/professionals/components/ProfessionalForm.tsx`
- `src/features/professionals/components/ProfessionalsList.tsx`
- `src/features/professionals/pages/ProfessionalsPage.tsx`
- `src/main.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/ModulePage.tsx`

Também verificado, sem necessidade de alteração: `src/features/patients/components/PatientsUnavailable.tsx`.
