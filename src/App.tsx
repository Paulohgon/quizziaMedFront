import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth'
import { Layout } from './components/Layout'
import { AnsweredPage } from './pages/AnsweredPage'
import { AuthPage } from './pages/AuthPage'
import { ExamsPage } from './pages/ExamsPage'
import { NotebookPage } from './pages/NotebookPage'
import { ProvaPage } from './pages/ProvaPage'
import { SimuladoPage } from './pages/SimuladoPage'
import { StatsPage } from './pages/StatsPage'
import { StudyPage } from './pages/StudyPage'

export default function App() {
  return (
    <Routes>
      <Route path="entrar" element={<AuthPage mode="login" />} />
      <Route path="cadastro" element={<AuthPage mode="register" />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/estudar" replace />} />
        <Route path="estudar" element={<StudyPage key="unanswered" status="unanswered" />} />
        <Route path="revisao" element={<StudyPage key="review" status="review" />} />
        <Route path="refazer" element={<StudyPage key="wrong" status="wrong" />} />
        <Route path="caderno" element={<NotebookPage />} />
        <Route path="respondidas" element={<AnsweredPage />} />
        <Route path="desempenho" element={<StatsPage />} />
        <Route path="provas" element={<ExamsPage />} />
        <Route path="simulado" element={<SimuladoPage />} />
        <Route path="prova/:examId" element={<ProvaPage />} />
        <Route path="*" element={<Navigate to="/estudar" replace />} />
      </Route>
    </Routes>
  )
}
