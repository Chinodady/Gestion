import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function DashboardPage() {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const [boards, setBoards] = useState([]);
    const [newBoardTitle, setNewBoardTitle] = useState('');
    const [newBoardDescription, setNewBoardDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Redirigir si no está autenticado
    useEffect(() => {
        if (!isAuthenticated) {
            toast.warn('Necesitas iniciar sesión para acceder al Dashboard.');
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // Función para cargar los tableros del usuario
    const fetchBoards = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:5000/boards');
            if (Array.isArray(response.data)) {
                setBoards(response.data);
            } else if (response.data && typeof response.data === 'object' && response.data.msg) {
                setBoards([]);
                toast.info(response.data.msg);
            } else {
                setBoards([]);
                console.warn("API /boards returned unexpected data:", response.data);
                toast.error('Formato de datos de tableros inesperado.');
            }
        } catch (err) {
            console.error('Error al cargar tableros:', err.response?.data || err.message);
            setError('Error al cargar tableros.');
            toast.error('No se pudieron cargar los tableros.');
            if (err.response && err.response.status === 401) {
                logout();
            }
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, logout]); // Añade 'toast' aquí si lo usas dentro del useCallback

    useEffect(() => {
        fetchBoards();
    }, [fetchBoards]);

    // ==========================================================
    // === ¡¡¡LAS FUNCIONES handleCreateBoard y handleDeleteBoard VAN AQUÍ!!! ===
    // ==========================================================

    // Función para crear un nuevo tablero
    const handleCreateBoard = async (e) => {
        e.preventDefault();
        if (!newBoardTitle.trim()) {
            toast.error('El título del tablero no puede estar vacío.');
            return;
        }
        try {
            await axios.post('http://localhost:5000/boards', {
                title: newBoardTitle,
                description: newBoardDescription
            });
            toast.success('Tablero creado con éxito!');
            setNewBoardTitle('');
            setNewBoardDescription('');
            fetchBoards(); // Volver a cargar la lista de tableros
        } catch (err) {
            console.error('Error al crear tablero:', err.response?.data || err.message);
            toast.error(err.response?.data?.msg || 'Error al crear el tablero.');
        }
    };

    // Función para eliminar un tablero
    const handleDeleteBoard = async (boardId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este tablero? Todas las listas y tarjetas también se eliminarán.')) {
            try {
                await axios.delete(`http://localhost:5000/boards/${boardId}`);
                toast.success('Tablero eliminado con éxito!');
                fetchBoards(); // Volver a cargar la lista de tableros
            } catch (err) {
                console.error('Error al eliminar tablero:', err.response?.data || err.message);
                toast.error(err.response?.data?.msg || 'Error al eliminar el tablero.');
            }
        }
    };

    // ==========================================================
    // === FIN DE LAS FUNCIONES ===
    // ==========================================================


    if (loading) {
        return (
            <div className="dashboard-container">
                <h2>Cargando Tableros...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container">
                <h2>{error}</h2>
                <button onClick={logout} className="logout-button">Cerrar Sesión</button>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h2>Mis Tableros</h2>
                <button onClick={logout} className="logout-button">Cerrar Sesión</button>
            </div>

            <div className="create-board-form">
                <h3>Crear Nuevo Tablero</h3>
                <form onSubmit={handleCreateBoard}>
                    <input
                        type="text"
                        placeholder="Título del tablero"
                        value={newBoardTitle}
                        onChange={(e) => setNewBoardTitle(e.target.value)}
                        required
                    />
                    <textarea
                        placeholder="Descripción (opcional)"
                        value={newBoardDescription}
                        onChange={(e) => setNewBoardDescription(e.target.value)}
                    ></textarea>
                    <button type="submit">Crear Tablero</button>
                </form>
            </div>

            <div className="boards-grid">
                {boards.length === 0 ? (
                    <p>No tienes tableros. ¡Crea uno para empezar!</p>
                ) : (
                    boards.map(board => (
                        <div key={board.id} className="board-card">
                            <Link to={`/board/${board.id}`}>
                                <h3>{board.title}</h3>
                                <p>{board.description}</p>
                            </Link>
                            <div className="board-actions">
                                <button onClick={() => navigate(`/board/${board.id}/edit`)} className="edit-button">Editar</button>
                                <button onClick={() => handleDeleteBoard(board.id)} className="delete-button">Eliminar</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default DashboardPage;
