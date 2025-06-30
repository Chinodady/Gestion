import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function DashboardPage() {
    const { isAuthenticated, logout, user } = useAuth(); // Obtener el objeto de usuario del contexto
    const navigate = useNavigate();
    const [boards, setBoards] = useState([]);
    const [newBoardTitle, setNewBoardTitle] = useState('');
    const [newBoardDescription, setNewBoardDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Estados para los filtros ---
    const [filterTitle, setFilterTitle] = useState('');
    const [filterBoardId, setFilterBoardId] = useState(''); // ID del tablero seleccionado en el filtro
    const [filterDueDateStart, setFilterDueDateStart] = useState('');
    const [filterDueDateEnd, setFilterDueDateEnd] = useState('');
    // Nuevos estados para los filtros por usuario/estado
    const [showOnlyMyCreatedCards, setShowOnlyMyCreatedCards] = useState(false);
    const [showOnlyAssignedCards, setShowOnlyAssignedCards] = useState(false);

    const [filteredCards, setFilteredCards] = useState([]);
    const [loadingFilteredCards, setLoadingFilteredCards] = useState(false);
    const [showFilteredResults, setShowFilteredResults] = useState(false);


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
    }, [isAuthenticated, logout]);

    useEffect(() => {
        fetchBoards();
    }, [fetchBoards]);

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
            fetchBoards();
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
                fetchBoards();
            } catch (err) {
                console.error('Error al eliminar tablero:', err.response?.data || err.message);
                toast.error(err.response?.data?.msg || 'Error al eliminar el tablero.');
            }
        }
    };

    // --- Función para aplicar filtros y obtener tarjetas ---
    const handleFilterCards = useCallback(async (e) => {
        e.preventDefault();
        setLoadingFilteredCards(true);
        setFilteredCards([]);
        setShowFilteredResults(true);

        try {
            const params = {};
            if (filterTitle.trim()) params.title_contains = filterTitle.trim();
            if (filterBoardId) params.board_id = filterBoardId;

            if (showOnlyMyCreatedCards && user && user.id) {
                params.creator_id = user.id;
            }
            if (showOnlyAssignedCards && user && user.id) {
                params.user_id = user.id;
            }

            if (filterDueDateStart) params.due_date_start = filterDueDateStart + 'T00:00:00';
            if (filterDueDateEnd) params.due_date_end = filterDueDateEnd + 'T23:59:59';

            const response = await axios.get('http://localhost:5000/cards/filter', { params });
            setFilteredCards(response.data);
            if (response.data.length === 0) {
                toast.info('No se encontraron tarjetas con esos criterios de filtro.');
            }
        } catch (err) {
            console.error('Error al filtrar tarjetas:', err.response?.data || err.message);
            toast.error(err.response?.data?.msg || 'Error al filtrar tarjetas.');
            setFilteredCards([]);
        } finally {
            setLoadingFilteredCards(false);
        }
    }, [filterTitle, filterBoardId, showOnlyMyCreatedCards, showOnlyAssignedCards, user, filterDueDateStart, filterDueDateEnd]);


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

    // Aquí está el cambio clave: envolver el contenido dentro del dashboard-container
    // con un fragmento <>...</> si hay problemas de elementos adyacentes.
    // Esto es útil si los bloques if (loading) o if (error) no están manejando el return global.
    // Sin embargo, en tu código, if (loading) y if (error) ya devuelven un único div.
    // Por lo tanto, el error `Adjacent JSX elements` sugiere un problema en el bloque 'return' final.

    // Vamos a asegurar que todo el contenido dentro del return esté envuelto en un único elemento.
    // El div.dashboard-container ya es el elemento raíz que se devuelve, así que el problema
    // debe ser un cierre de etiqueta mal colocado o un elemento inesperado antes del final.

    // Dada la línea del error (305:4) que apunta al div de cierre del dashboard-container,
    // significa que el contenido *dentro* de ese div no está bien formado.
    // Parece que hay un div de cierre extra o un elemento sin abrir antes del final.

    // Por favor, verifica la línea 304. Debería ser el cierre del div "boards-grid".
    // Después de ese div, tienes la sección de filtros, y luego la de resultados.
    // Todo esto *debe* estar dentro del div.dashboard-container.

    // Para solucionar el error: La manera más segura es envolver explícitamente todo el contenido
    // que va dentro del `dashboard-container` en un Fragmento, aunque no siempre es necesario
    // si la estructura ya es un único nodo raíz.
    // Probablemente haya un div de cierre extra o un elemento suelto.

    // Revisa la línea 304 en tu editor. Asegúrate de que no haya un div de cierre extra.
    // La estructura esperada es:
    // <div className="dashboard-container">
    //    <div className="dashboard-header">...</div>
    //    <div className="create-board-form">...</div>
    //    <div className="boards-grid">...</div>
    //    <div className="filter-cards-section">...</div>
    //    {showFilteredResults && (...)}
    // </div>

    // Si todo está anidado correctamente, este error puede ser por un carácter invisible o un copy-paste truncado.
    // Probaremos a envolver el contenido del return final en un fragmento para ver si fuerza la compilación.
    return (
        <div className="dashboard-container">
            {/* Contenido principal del dashboard */}
            <> {/* <-- Fragmento JSX para envolver múltiples elementos adyacentes si los hubiera */}
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

                {/* --- SECCIÓN DE FILTROS --- */}
                <div className="filter-cards-section">
                    <h3>Filtrar Tarjetas</h3>
                    <form onSubmit={handleFilterCards} className="filter-form">
                        <input
                            type="text"
                            placeholder="Título de la tarjeta..."
                            value={filterTitle}
                            onChange={(e) => setFilterTitle(e.target.value)}
                        />
                        {/* Selector de tablero por nombre */}
                        <select
                            value={filterBoardId}
                            onChange={(e) => setFilterBoardId(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">Filtrar por Tablero</option>
                            {boards.map(board => (
                                <option key={board.id} value={board.id}>
                                    {board.title}
                                </option>
                            ))}
                        </select>

                        {/* Filtros por usuario/estado */}
                        <div className="filter-checkbox-group">
                            <label className="filter-label">
                                <input
                                    type="checkbox"
                                    checked={showOnlyMyCreatedCards}
                                    onChange={(e) => setShowOnlyMyCreatedCards(e.target.checked)}
                                />
                                Mis tarjetas (creadas por mí)
                            </label>
                            <label className="filter-label">
                                <input
                                    type="checkbox"
                                    checked={showOnlyAssignedCards}
                                    onChange={(e) => setShowOnlyAssignedCards(e.target.checked)}
                                />
                                Asignadas a mí
                            </label>
                        </div>


                        <label className="filter-label">Vence desde:</label>
                        <input
                            type="date"
                            value={filterDueDateStart}
                            onChange={(e) => setFilterDueDateStart(e.target.value)}
                        />
                        <label className="filter-label">Vence hasta:</label>
                        <input
                            type="date"
                            value={filterDueDateEnd}
                            onChange={(e) => setFilterDueDateEnd(e.target.value)}
                        />
                        <button type="submit">Aplicar Filtros</button>
                    </form>
                </div>

                {/* --- RESULTADOS DE FILTRO --- */}
                {showFilteredResults && (
                    <div className="filtered-cards-results">
                        <h3>Resultados de Búsqueda ({filteredCards.length})</h3>
                        {loadingFilteredCards ? (
                            <p>Cargando tarjetas filtradas...</p>
                        ) : filteredCards.length === 0 ? (
                            <p>No se encontraron tarjetas que coincidan con los criterios de filtro.</p>
                        ) : (
                            <div className="cards-grid-filtered">
                                {filteredCards.map(card => (
                                    <div key={card.id} className="board-card card-filtered-item">
                                        <Link to={`/card/${card.id}`}>
                                            <h4>{card.title}</h4>
                                            <p className="card-description">{card.description}</p>
                                            {card.due_date && <p className="card-due-date">Vence: {new Date(card.due_date).toLocaleDateString()}</p>}
                                            {/* Mostrar usuarios asignados */}
                                            {card.assigned_users && card.assigned_users.length > 0 && (
                                                <p className="assigned-users-summary">Asignado a: {card.assigned_users.map(u => u.username).join(', ')}</p>
                                            )}
                                            {/* Opcional: Mostrar a qué tablero/lista pertenece la tarjeta */}
                                            <p className="card-location-summary">
                                                En tablero: {boards.find(b => b.id === card.board_id)?.title || 'N/A'}
                                                {/* No tenemos el nombre de la lista directamente, necesitaríamos más lógica */}
                                            </p>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </> {/* <-- Cierre del fragmento JSX */}
        </div>
    );
}

export default DashboardPage;
