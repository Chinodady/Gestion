import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null); // Crea el contexto

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Información del usuario autenticado
    const [token, setToken] = useState(localStorage.getItem('token') || null); // Token JWT
    const navigate = useNavigate();

    // Configurar axios para incluir el token en cada petición si existe
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Opcional: Decodificar el token aquí para obtener info del user si no se hace en el backend
            // Por ahora, el backend solo devuelve el ID del usuario en get_jwt_identity()
            // Podríamos añadir una ruta /auth/me para obtener los datos del usuario logueado
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    // Función de registro
    const register = useCallback(async (username, email, password) => {
        try {
            const response = await axios.post('http://localhost:5000/auth/register', { username, email, password });
            toast.success(response.data.msg || 'Registro exitoso');
            navigate('/login'); // Redirigir a login después del registro
            return true;
        } catch (error) {
            console.error('Register error:', error.response?.data || error.message);
            toast.error(error.response?.data?.msg || 'Error en el registro');
            return false;
        }
    }, [navigate]);

    // Función de login
    const login = useCallback(async (username, password) => {
        try {
            const response = await axios.post('http://localhost:5000/auth/login', { username, password });
            const newToken = response.data.access_token;
            setToken(newToken);
            localStorage.setItem('token', newToken); // Guardar el token en el almacenamiento local
            // Aquí podríamos hacer una petición a /auth/me para obtener datos del usuario
            // Por simplicidad, el user ID viene del token en el backend.
            // Podríamos decodificar el token aquí para obtener el ID, pero lo dejaremos para cuando lo necesitemos explícitamente.
            setUser({ username }); // Temporalmente solo guardamos el username
            toast.success('Inicio de sesión exitoso');
            navigate('/dashboard'); // Redirigir al dashboard después del login
            return true;
        } catch (error) {
            console.error('Login error:', error.response?.data || error.message);
            toast.error(error.response?.data?.msg || 'Credenciales inválidas');
            return false;
        }
    }, [navigate]);

    // Función de logout
    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token'); // Limpiar el token
        delete axios.defaults.headers.common['Authorization'];
        toast.info('Sesión cerrada');
        navigate('/login'); // Redirigir a login
    }, [navigate]);

    // El valor que el contexto proporcionará a los componentes hijos
    const value = {
        user,
        token,
        isAuthenticated: !!token, // Verdadero si hay un token
        register,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Hook personalizado para consumir el contexto de autenticación fácilmente
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};