import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import { format } from 'date-fns';
import UserSearchInput from '../components/UserSearchInput'; // Lo crearemos ahora

function CardDetailsPage() {
    const { cardId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, logout, user: currentUser } = useAuth(); // Obtener el usuario actual
    const [card, setCard] = useState(null);
    const [comments, setComments] = useState([]);
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [newCommentContent, setNewCommentContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State para la edición de tarjeta
    const [isEditingCard, setIsEditingCard] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editDueDate, setEditDueDate] = useState('');

    // Redirigir si no está autenticado
    useEffect(() => {
        if (!isAuthenticated) {
            toast.warn('Necesitas iniciar sesión para ver los detalles de las tarjetas.');
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // Función para cargar los detalles de la tarjeta, comentarios y asignaciones
    const fetchCardData = useCallback(async () => {
        if (!isAuthenticated || !cardId) return;
        setLoading(true);
        setError(null);
        try {
            const cardRes = await axios.get(`http://localhost:5000/cards/${cardId}`);
            setCard(cardRes.data);
            setEditTitle(cardRes.data.title);
            setEditDescription(cardRes.data.description || '');
            setEditDueDate(cardRes.data.due_date ? format(new Date(cardRes.data.due_date), 'yyyy-MM-dd') : ''); // Formato para input type="date"

            const commentsRes = await axios.get(`http://localhost:5000/cards/${cardId}/comments`);
            setComments(commentsRes.data);

            const assignmentsRes = await axios.get(`http://localhost:5000/cards/${cardId}/assignments`);
            setAssignedUsers(assignmentsRes.data);

        } catch (err) {
            console.error('Error al cargar detalles de la tarjeta:', err.response?.data || err.message);
            setError('Error al cargar los detalles de la tarjeta.');
            toast.error('No se pudieron cargar los detalles de la tarjeta.');
            if (err.response && (err.response.status === 401 || err.response.status === 403 || err.response.status === 404)) {
                navigate(-1); // Volver a la página anterior o al dashboard
            }
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, cardId, navigate]);

    useEffect(() => {
        fetchCardData();
    }, [fetchCardData]);

    // Manejar la actualización de la tarjeta
    const handleUpdateCard = async (e) => {
        e.preventDefault();
        if (!editTitle.trim()) {
            toast.error('El título de la tarjeta no puede estar vacío.');
            return;
        }
        try {
            const updatedCardData = {
                title: editTitle,
                description: editDescription,
                due_date: editDueDate ? new Date(editDueDate).toISOString().split('.')[0] + 'Z' : 'null' // Asegurar formato ISO o 'null'
            };
            await axios.put(`http://localhost:5000/cards/${cardId}`, updatedCardData);
            toast.success('Tarjeta actualizada con éxito!');
            setIsEditingCard(false);
            fetchCardData(); // Recargar datos de la tarjeta
        } catch (err) {
            console.error('Error al actualizar tarjeta:', err.response?.data || err.message);
            toast.error(err.response?.data?.msg || 'Error al actualizar la tarjeta.');
        }
    };

    // Manejar añadir comentario
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newCommentContent.trim()) {
            toast.error('El comentario no puede estar vacío.');
            return;
        }
        try {
            await axios.post(`http://localhost:5000/cards/${cardId}/comments`, {
                content: newCommentContent
            });
            toast.success('Comentario añadido con éxito!');
            setNewCommentContent('');
            fetchCardData(); // Recargar comentarios
        } catch (err) {
            console.error('Error al añadir comentario:', err.response?.data || err.message);
            toast.error(err.response?.data?.msg || 'Error al añadir el comentario.');
        }
    };

    // Manejar eliminar comentario
    const handleDeleteComment = async (commentId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
            try {
                await axios.delete(`http://localhost:5000/comments/${commentId}`, {
                    data: { user_id: currentUser.id } // Backend necesita saber quién es para borrar (aunque ya lo hace por JWT)
                });
                toast.success('Comentario eliminado con éxito!');
                fetchCardData(); // Recargar comentarios
            } catch (err) {
                console.error('Error al eliminar comentario:', err.response?.data || err.message);
                toast.error(err.response?.data?.msg || 'Error al eliminar el comentario.');
            }
        }
    };


    // Manejar asignación de usuario
    const handleAssignUser = async (userIdToAssign) => {
        if (!userIdToAssign) return;
        try {
            await axios.post(`http://localhost:5000/cards/${cardId}/assign`, {
                user_id: userIdToAssign
            });
            toast.success('Usuario asignado a la tarjeta!');
            fetchCardData(); // Recargar asignaciones
        } catch (err) {
            console.error('Error al asignar usuario:', err.response?.data || err.message);
            toast.error(err.response?.data?.msg || 'Error al asignar usuario.');
        }
    };

    // Manejar desasignación de usuario
    const handleUnassignUser = async (userIdToUnassign) => {
        if (window.confirm('¿Estás seguro de que quieres desasignar a este usuario de la tarjeta?')) {
            try {
                await axios.delete(`http://localhost:5000/cards/${cardId}/unassign`, {
                    data: { user_id: userIdToUnassign } // DELETE con body para especificar user_id
                });
                toast.success('Usuario desasignado de la tarjeta!');
                fetchCardData(); // Recargar asignaciones
            } catch (err) {
                console.error('Error al desasignar usuario:', err.response?.data || err.message);
                toast.error(err.response?.data?.msg || 'Error al desasignar usuario.');
            }
        }
    };

    if (loading) {
        return (
            <div className="card-details-container">
                <h2>Cargando Detalles de Tarjeta...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card-details-container">
                <h2>{error}</h2>
                <button onClick={() => navigate(-1)} className="back-button">Volver</button>
            </div>
        );
    }

    if (!card) {
        return (
            <div className="card-details-container">
                <h2>Tarjeta no encontrada.</h2>
                <button onClick={() => navigate(-1)} className="back-button">Volver</button>
            </div>
        );
    }

    return (
        <div className="card-details-container">
            <div className="card-details-header">
                <h2>{card.title}</h2>
                <button onClick={() => navigate(-1)} className="back-button">Volver</button>
            </div>

            {!isEditingCard ? (
                <div className="card-info-section">
                    <p className="card-details-description">
                        <strong>Descripción:</strong> {card.description || 'Sin descripción'}
                    </p>
                    <p className="card-details-due-date">
                        <strong>Fecha de Vencimiento:</strong> {card.due_date ? format(new Date(card.due_date), 'dd/MM/yyyy HH:mm') : 'No establecida'}
                    </p>
                    <button onClick={() => setIsEditingCard(true)} className="edit-button">Editar Tarjeta</button>
                </div>
            ) : (
                <div className="edit-card-form">
                    <h3>Editar Tarjeta</h3>
                    <form onSubmit={handleUpdateCard}>
                        <input
                            type="text"
                            placeholder="Título"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            required
                        />
                        <textarea
                            placeholder="Descripción"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                        ></textarea>
                        <input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                        />
                        <button type="submit">Guardar Cambios</button>
                        <button type="button" onClick={() => { setIsEditingCard(false); fetchCardData(); }}>Cancelar</button>
                    </form>
                </div>
            )}


            <div className="card-section">
                <h3>Asignados ({assignedUsers.length})</h3>
                <div className="assigned-users-list">
                    {assignedUsers.length === 0 ? (
                        <p>Nadie asignado aún.</p>
                    ) : (
                        assignedUsers.map(assignedUser => (
                            <div key={assignedUser.user_id} className="assigned-user-item">
                                <span>{assignedUser.username} ({assignedUser.email})</span>
                                <button onClick={() => handleUnassignUser(assignedUser.user_id)} className="unassign-button">X</button>
                            </div>
                        ))
                    )}
                </div>
                <UserSearchInput onAssignUser={handleAssignUser} existingAssignedUsers={assignedUsers} />
            </div>

            <div className="card-section">
                <h3>Comentarios ({comments.length})</h3>
                <div className="comments-list">
                    {comments.length === 0 ? (
                        <p>No hay comentarios.</p>
                    ) : (
                        comments.map(comment => (
                            <div key={comment.id} className="comment-item">
                                <p><strong>{comment.username}:</strong> {comment.content}</p>
                                <small>{format(new Date(comment.created_at), 'dd/MM/yyyy HH:mm')}</small>
                                {/* Mostrar botón de eliminar si el usuario actual es el autor del comentario */}
                                {currentUser && currentUser.username === comment.username && (
                                    <button onClick={() => handleDeleteComment(comment.id)} className="delete-comment-button">Eliminar</button>
                                )}
                            </div>
                        ))
                    )}
                </div>
                <form onSubmit={handleAddComment} className="add-comment-form">
                    <textarea
                        placeholder="Escribe un comentario..."
                        value={newCommentContent}
                        onChange={(e) => setNewCommentContent(e.target.value)}
                        rows="3"
                        required
                    ></textarea>
                    <button type="submit">Añadir Comentario</button>
                </form>
            </div>
        </div>
    );
}

export default CardDetailsPage;
