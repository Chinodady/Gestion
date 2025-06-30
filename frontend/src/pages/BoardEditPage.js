import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';

function BoardEditPage() {
    const { boardId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, logout } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Redirigir si no está autenticado
    useEffect(() => {
        if (!isAuthenticated) {
            toast.warn('Necesitas iniciar sesión para acceder a esta página.');
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // Función para cargar los detalles del tablero
    const fetchBoardDetails = useCallback(async () => {
        if (!isAuthenticated || !boardId) return;
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`http://localhost:5000/boards/${boardId}`);
            setTitle(response.data.title);
            setDescription(response.data.description || ''); // Asegura que la descripción no sea null
        } catch (err) {
            console.error('Error al cargar los detalles del tablero:', err.response?.data || err.message);
            setError('Error al cargar los detalles del tablero.');
            toast.error('No se pudieron cargar los detalles del tablero.');
            if (err.response && (err.response.status === 401 || err.response.status === 403 || err.response.status === 404)) {
                navigate('/dashboard'); // Redirigir si no hay acceso o el tablero no existe
            }
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, boardId, navigate]);

    useEffect(() => {
        fetchBoardDetails();
    }, [fetchBoardDetails]);

    // Función para manejar la actualización del tablero
    const handleUpdateBoard = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('El título del tablero no puede estar vacío.');
            return;
        }
        try {
            await axios.put(`http://localhost:5000/boards/${boardId}`, {
                title: title,
                description: description
            });
            toast.success('Tablero actualizado con éxito!');
            navigate(`/board/${boardId}`); // Volver a la vista del tablero
        } catch (err) {
            console.error('Error al actualizar tablero:', err.response?.data || err.message);
            toast.error(err.response?.data?.msg || 'Error al actualizar el tablero.');
        }
    };

    if (loading) {
        return (
            <div className="form-container">
                <h2>Cargando Tablero...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="form-container">
                <h2>{error}</h2>
                <Link to={`/board/${boardId}`} className="back-link">Volver al Tablero</Link>
            </div>
        );
    }

    return (
        <div className="form-container">
            <h2>Editar Tablero</h2>
            <form onSubmit={handleUpdateBoard}>
                <input
                    type="text"
                    placeholder="Título del tablero"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
                <textarea
                    placeholder="Descripción (opcional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                ></textarea>
                <button type="submit">Guardar Cambios</button>
            </form>
            <p>
                <Link to={`/board/${boardId}`}>Volver al Tablero</Link>
            </p>
            <p>
                <Link to="/dashboard">Volver al Dashboard</Link>
            </p>
        </div>
    );
}

export default BoardEditPage;
