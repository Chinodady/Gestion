import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

function UserSearchInput({ onAssignUser, existingAssignedUsers }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null); // Almacenará el objeto de usuario seleccionado
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // Referencia para detectar clics fuera del componente y cerrar el dropdown
    const wrapperRef = useRef(null);

    // Función para manejar clics fuera del componente
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                // Pequeño retraso para evitar cerrar el dropdown si el clic es en un resultado
                setTimeout(() => setShowDropdown(false), 100);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);


    const handleSearch = useCallback(async (e) => {
        const query = e.target.value;
        setSearchTerm(query);
        setSelectedUser(null); // Resetear el usuario seleccionado al cambiar el término de búsqueda

        if (query.trim().length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        setLoadingSearch(true);
        try {
            const response = await axios.get(`http://localhost:5000/users/search?q=${query.trim()}`);
            const filteredResults = response.data.filter(user =>
                // Filtrar usuarios que ya están asignados a la tarjeta
                !existingAssignedUsers.some(assigned => assigned.user_id === user.id)
            );
            setSearchResults(filteredResults);
            setShowDropdown(true); // Mostrar dropdown si hay resultados
        } catch (err) {
            console.error('Error al buscar usuarios:', err.response?.data || err.message);
            toast.error('Error al buscar usuarios.');
            setSearchResults([]);
            setShowDropdown(false);
        } finally {
            setLoadingSearch(false);
        }
    }, [existingAssignedUsers]);

    // Función para manejar la selección de un usuario del dropdown
    const handleSelectUserFromDropdown = (user) => {
        setSelectedUser(user); // Guardar el objeto de usuario completo
        setSearchTerm(user.username); // Poner el username en el input
        setSearchResults([]); // Limpiar resultados de búsqueda
        setShowDropdown(false); // Cerrar dropdown
    };

    // Función para manejar el clic en el botón "Asignar Usuario"
    const handleAssignClick = () => {
        if (selectedUser) {
            onAssignUser(selectedUser.id); // Llamar a la prop con el ID del usuario
            setSearchTerm('');
            setSearchResults([]);
            setSelectedUser(null);
            setShowDropdown(false);
            toast.success(`Usuario ${selectedUser.username} asignado.`);
        } else {
            toast.warn('Por favor, busca y selecciona un usuario para asignar.');
        }
    };

    return (
        <div className="user-search-assign-container" ref={wrapperRef}> {/* Añadir ref aquí */}
            <input
                type="text"
                placeholder="Buscar usuario por username/email..."
                value={searchTerm}
                onChange={handleSearch}
                onFocus={() => setShowDropdown(true)} // Mostrar dropdown al enfocar
                // onBlur ya no es necesario aquí para cerrar, lo maneja handleClickOutside
            />
            {loadingSearch && <p>Buscando...</p>}
            {showDropdown && searchResults.length > 0 && (
                <div className="user-search-dropdown-custom"> {/* CAMBIO: Usar div */}
                    {searchResults.map(user => (
                        <button
                            key={user.id}
                            className="dropdown-item" // Nuevo estilo
                            onMouseDown={(e) => e.preventDefault()} // Previene que el input pierda foco inmediatamente
                            onClick={() => handleSelectUserFromDropdown(user)} // Clic para seleccionar
                        >
                            {user.username} ({user.email})
                        </button>
                    ))}
                </div>
            )}
            {searchTerm.length >= 2 && !loadingSearch && searchResults.length === 0 && showDropdown && (
                 <p className="no-results-message">No se encontraron usuarios o ya están asignados.</p>
            )}

            <button onClick={handleAssignClick} className="assign-button" disabled={!selectedUser}> {/* Habilitar si selectedUser no es null */}
                Asignar Usuario
            </button>
        </div>
    );
}

export default UserSearchInput;
