import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import CardComponent from './CardComponent';

// ListComponent ahora recibe 'allBoardLists' como una prop
function ListComponent({ list, onDeleteList, fetchBoardData, allBoardLists }) { // <--- CAMBIO AQUÍ: Añadir allBoardLists
    const [cards, setCards] = useState([]);
    const [newCardTitle, setNewCardTitle] = useState('');
    const [loadingCards, setLoadingCards] = useState(true);
    const [errorCards, setErrorCards] = useState(null);

    const fetchCards = useCallback(async () => {
        setLoadingCards(true);
        setErrorCards(null);
        try {
            const response = await axios.get(`http://localhost:5000/lists/${list.id}/cards`);
            setCards(response.data);
        } catch (err) {
            console.error('Error al cargar tarjetas de la lista:', err.response?.data || err.message);
            setErrorCards('Error al cargar tarjetas.');
            toast.error('No se pudieron cargar las tarjetas de la lista.');
        } finally {
            setLoadingCards(false);
        }
    }, [list.id]);

    useEffect(() => {
        fetchCards();
    }, [fetchCards]);

    const handleCreateCard = async (e) => {
        e.preventDefault();
        if (!newCardTitle.trim()) {
            toast.error('El título de la tarjeta no puede estar vacío.');
            return;
        }
        try {
            await axios.post(`http://localhost:5000/lists/${list.id}/cards`, {
                title: newCardTitle
            });
            toast.success('Tarjeta creada con éxito!');
            setNewCardTitle('');
            fetchCards(); // Volver a cargar las tarjetas
        } catch (err) {
            console.error('Error al crear tarjeta:', err.response?.data || err.message);
            toast.error(err.response?.data?.msg || 'Error al crear la tarjeta.');
        }
    };

    const handleDeleteCard = async (cardId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta tarjeta?')) {
            try {
                await axios.delete(`http://localhost:5000/cards/${cardId}`);
                toast.success('Tarjeta eliminada con éxito!');
                fetchCards(); // Volver a cargar las tarjetas
            } catch (err) {
                console.error('Error al eliminar tarjeta:', err.response?.data || err.message);
                toast.error(err.response?.data?.msg || 'Error al eliminar la tarjeta.');
            }
        }
    };

    // Función para mover una tarjeta (se pasará a CardComponent)
    const handleMoveCard = async (cardId, new_list_id) => {
        if (cardId === null || new_list_id === null) return;
        try {
            await axios.put(`http://localhost:5000/cards/${cardId}/move`, {
                new_list_id: new_list_id
                // new_order se podría añadir aquí, pero para simplificar, el backend la pone al final
            });
            toast.success('Tarjeta movida con éxito!');
            // Al mover una tarjeta, necesitamos recargar todas las listas del tablero
            // para que la tarjeta desaparezca de la lista anterior y aparezca en la nueva.
            fetchBoardData(); // Recargar datos completos del tablero (listas y sus tarjetas)
        } catch (err) {
            console.error('Error al mover tarjeta:', err.response?.data || err.message);
            toast.error(err.response?.data?.msg || 'Error al mover la tarjeta.');
        }
    };


    return (
        <div className="list-container">
            <div className="list-header">
                <h3>{list.title}</h3>
                <button onClick={() => onDeleteList(list.id)} className="delete-button-small">X</button>
            </div>
            <div className="cards-list">
                {loadingCards ? (
                    <p>Cargando tarjetas...</p>
                ) : errorCards ? (
                    <p>{errorCards}</p>
                ) : cards.length === 0 ? (
                    <p className="no-cards-message">No hay tarjetas aquí.</p>
                ) : (
                    cards.map(card => (
                        <CardComponent
                            key={card.id}
                            card={card}
                            onDeleteCard={handleDeleteCard}
                            onMoveCard={handleMoveCard}
                            allLists={allBoardLists} // <--- CAMBIO CLAVE AQUÍ: Usar allBoardLists
                        />
                    ))
                )}
            </div>
            <form onSubmit={handleCreateCard} className="create-card-form">
                <input
                    type="text"
                    placeholder="Añadir nueva tarjeta..."
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    required
                />
                <button type="submit">+</button>
            </form>
        </div>
    );
}

export default ListComponent;
