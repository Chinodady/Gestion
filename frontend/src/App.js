import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage'; // Importa BoardPage
import BoardEditPage from './pages/BoardEditPage'; // Lo crearemos para editar tableros
import CardDetailsPage from './pages/CardDetailsPage'; // Lo crearemos para detalles de tarjetas
import { AuthProvider, useAuth } from './context/AuthContext'; // Importa useAuth para usarlo en PrivateRoute

// Componente auxiliar para proteger rutas
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth(); // Asumiendo que AuthContext podría tener un estado de carga
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
      // toast.warn('Necesitas iniciar sesión para acceder a esta página.'); // Ya lo hace DashboardPage/BoardPage
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return <div>Cargando autenticación...</div>; // O un spinner
  }

  return isAuthenticated ? children : null; // Si no está autenticado, redirige y no renderiza nada
};

function AppContent() {
  // Si necesitas lógica que dependa de useAuth, puedes usarla aquí
  // const { isAuthenticated } = useAuth(); // Ya lo estamos haciendo en PrivateRoute

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<LoginPage />} /> {/* Redirige a login por defecto */}

      {/* Rutas Protegidas */}
      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/board/:boardId" element={<PrivateRoute><BoardPage /></PrivateRoute>} />
      <Route path="/board/:boardId/edit" element={<PrivateRoute><BoardEditPage /></PrivateRoute>} /> {/* Para editar un tablero */}
      <Route path="/card/:cardId" element={<PrivateRoute><CardDetailsPage /></PrivateRoute>} /> {/* Para ver detalles de una tarjeta */}
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;