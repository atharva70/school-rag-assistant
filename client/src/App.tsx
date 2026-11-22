import { Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "./components/AppLayout"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { useAuth } from "./context/useAuth"
import { roleHomePath } from "./lib/roles"
import { AdminDashboard } from "./pages/AdminDashboard"
import { LoginPage } from "./pages/LoginPage"
import { StudentChat } from "./pages/StudentChat"
import { TeacherDashboard } from "./pages/TeacherDashboard"

function RoleRedirect() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to={roleHomePath(user.role)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={["TEACHER"]}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <StudentChat />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="/" element={<RoleRedirect />} />
      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  )
}
