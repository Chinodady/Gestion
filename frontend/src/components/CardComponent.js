// src/components/CardComponent.js (Asegúrate de que este archivo exista y tenga este contenido)
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

function CardComponent({ card, onDeleteCard, onMoveCard, allLists }) {
    const [selectedListId, setSelectedListId] = useState(card.list_id);

    useEffect(() => {
        setSelectedListId(card.list_id);
    }, [card.list_id]);


    const handleMoveChange = (e) => {
        const newListId = parseInt(e.target.value);
        setSelectedListId(newListId);
        onMoveCard(card.id, newListId);
    };

    return (
        <div className="card-container">
            <div className="card-header">
                <h4>{card.title}</h4>
                <button onClick={() => onDeleteCard(card.id)} className="delete-button-small">X</button>
            </div>
            {card.description && <p className="card-description">{card.description}</p>}
            {card.due_date && <p className="card-due-date">Vence: {format(new Date(card.due_date), 'MMM dd, yyyy')}</p>}

            <div className="card-actions">
                <select value={selectedListId} onChange={handleMoveChange} className="move-card-select">
                    <option value="">Mover a...</option>
                    {allLists && allLists.map(list => (
                        <option key={list.id} value={list.id}>
                            {list.title}
                        </option>
                    ))}
                </select>
            </div>
            <Link to={`/card/${card.id}`} className="card-details-link">Ver detalles</Link>
        </div>
    );
}

export default CardComponent;