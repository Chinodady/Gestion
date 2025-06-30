import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import ListComponent from '../components/ListComponent';

function BoardPage() {
    const { boardId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, logout } = useAuth();
    const [board, setBoard] = useState(null);
    const [lists, setLists] = useState([]);
    const [newListName, setNewListName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            toast.warn('Necesitas iniciar sesión para ver los tableros.');
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    const fetchBoardData = useCallback(async () => {
        if (!isAuthenticated || !boardId) return;
        setLoading(true);
        setError(null);
        try {
            const boardRes = await axios.get(`http://localhost:5000/boards/${boardId}`);
            setBoard(boardRes.data);

            const listsRes = await axios.get(`http://localhost:5000/boards/${boardId}/lists`);
            setLists(listsRes.data);

        } catch (err) {
            console.error('Error al cargar datos del tablero:', err.response?.data || err.message);
            setError('Error al cargar datos del tablero.');
            toast.error('No se pudieron cargar los datos del tablero.');
            if (err.response && (err.response.status === 401 || err.response.status === 403 || err.response.status === 404)) {
                navigate('/dashboard');
            }
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, boardId, navigate]);

    useEffect(() => {
        fetchBoardData();
    }, [fetchBoardData]);

    const handleCreateList = async (e) => {
        e.preventDefault();
        if (!newListName.trim()) {
            toast.error('El título de la lista no puede estar vacío.');
            return;
        }
        try {
            const response = await axios.post(`http://localhost:5000/boards/${boardId}/lists`, {
                title: newListName
            });
            toast.success('Lista creada con éxito!');
            setNewListName('');
            fetchBoardData();
        } catch (err) {
            console.error('Error al crear lista:', err.response?.data || err.message);
            toast.error(err.response?.data?.msg || 'Error al crear la lista.');
        }
    };

    const handleDeleteList = async (listId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta lista? Todas las tarjetas dentro también se eliminarán.')) {
            try {
                await axios.delete(`http://localhost:5000/lists/${listId}`);
                toast.success('Lista eliminada con éxito!');
                fetchBoardData();
            } catch (err) {
                console.error('Error al eliminar lista:', err.response?.data || err.message);
                toast.error(err.response?.data?.msg || 'Error al eliminar la lista.');
            }
        }
    };

    if (loading) {
        return (
            <div className="board-page-container">
                <h2>Cargando Tablero...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="board-page-container">
                <h2>{error}</h2>
                <Link to="/dashboard" className="back-link">Volver al Dashboard</Link>
            </div>
        );
    }

    if (!board) {
        return (
            <div className="board-page-container">
                <h2>Tablero no encontrado.</h2>
                <Link to="/dashboard" className="back-link">Volver al Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="board-page-container">
            <div className="board-header">
                <h2>{board.title}</h2>
                <p>{board.description}</p>
                <Link to="/dashboard" className="back-link">Volver al Dashboard</Link>
                <button onClick={logout} className="logout-button">Cerrar Sesión</button>
            </div>

            <div className="create-list-form">
                <h3>Añadir Nueva Lista</h3>
                <form onSubmit={handleCreateList}>
                    <input
                        type="text"
                        placeholder="Título de la lista"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        required
                    />
                    <button type="submit">Añadir Lista</button>
                </form>
            </div>

            <div className="lists-container">
                {lists.length === 0 ? (
                    <p>No hay listas en este tablero. ¡Añade una!</p>
                ) : (
                    lists.map(list => (
                        <ListComponent
                            key={list.id}
                            list={list}
                            onDeleteList={handleDeleteList}
                            fetchBoardData={fetchBoardData}
                            allBoardLists={lists} // Corrected line! No more JS comments inside JSX.
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default BoardPage;
