import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta

# Para el hashing de contraseñas
from werkzeug.security import generate_password_hash, check_password_hash

# Para la autenticación JWT
from flask_jwt_extended import create_access_token, jwt_required, JWTManager, get_jwt_identity

# Necesario para las consultas OR y AND
from sqlalchemy import or_, and_


# Opcional: Cargar variables de entorno si aún tienes el archivo .env para SECRET_KEY
# from dotenv import load_dotenv
# load_dotenv() # Descomenta si usas .env para SECRET_KEY y JWT_SECRET_KEY

app = Flask(__name__)
CORS(app)

# Configuración de la base de datos (SQLite)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Clave Secreta para Flask y JWT. ¡CAMBIA ESTO EN PRODUCCIÓN!
# Puedes obtenerla de un .env o asignarla directamente aquí para desarrollo
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'tu_super_secreto_para_flask_y_jwt')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'otra_super_secreta_para_jwt') # Clave específica para JWT
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1) # Los tokens expiran en 1 hora

jwt = JWTManager(app)
db = SQLAlchemy(app)

# =========================================================
# Definición de Modelos de Base de Datos
# =========================================================

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relaciones
    boards = db.relationship('Board', backref='owner', lazy=True)
    created_cards = db.relationship('Card', backref='creator', lazy=True)
    comments = db.relationship('Comment', backref='commenter', lazy=True)
    assigned_cards = db.relationship('CardAssignment', backref='user', lazy=True)


    def __repr__(self):
        return f'<User {self.username}>'

    # Métodos para manejo de contraseñas
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Board(db.Model):
    __tablename__ = 'boards'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relaciones
    lists = db.relationship('List', backref='board', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Board {self.title}>'

class List(db.Model):
    __tablename__ = 'lists'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    board_id = db.Column(db.Integer, db.ForeignKey('boards.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0) # Para el orden de las listas
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relaciones
    cards = db.relationship('Card', backref='list', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<List {self.title}>'

class Card(db.Model):
    __tablename__ = 'cards'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    list_id = db.Column(db.Integer, db.ForeignKey('lists.id'), nullable=False)
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    due_date = db.Column(db.DateTime, nullable=True)
    order = db.Column(db.Integer, nullable=False, default=0) # Para el orden de las tarjetas
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    comments = db.relationship('Comment', backref='card', lazy=True, cascade="all, delete-orphan")
    assignments = db.relationship('CardAssignment', backref='card', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Card {self.title}>'

class Comment(db.Model):
    __tablename__ = 'comments'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    card_id = db.Column(db.Integer, db.ForeignKey('cards.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Comment {self.id}>'

class CardAssignment(db.Model):
    __tablename__ = 'card_assignments'
    id = db.Column(db.Integer, primary_key=True) # Un ID primario para esta tabla de unión
    card_id = db.Column(db.Integer, db.ForeignKey('cards.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('card_id', 'user_id', name='_card_user_uc'),) # Asegura que una tarjeta no se asigne dos veces al mismo usuario

    def __repr__(self):
        return f'<CardAssignment Card:{self.card_id} User:{self.user_id}>'


# =========================================================
# Rutas de Autenticación
# =========================================================

@app.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"msg": "Username, email, and password are required"}), 400

    # Verificar si el usuario o email ya existen
    if User.query.filter_by(username=username).first():
        return jsonify({"msg": "Username already exists"}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email already registered"}), 409

    new_user = User(username=username, email=email)
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    return jsonify({"msg": "User registered successfully", "user_id": new_user.id}), 201

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"msg": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    if user and user.check_password(password):
        access_token = create_access_token(identity=str(user.id)) # Convertir user.id a string
        return jsonify(access_token=access_token), 200
    else:
        return jsonify({"msg": "Bad username or password"}), 401

# Ruta de ejemplo protegida por JWT (solo para pruebas, puedes borrarla después)
@app.route('/protected', methods=['GET'])
@jwt_required()
def protected():
    current_user_id = get_jwt_identity()
    return jsonify(logged_in_as=current_user_id), 200

# =========================================================
# Rutas de Usuarios
# =========================================================

@app.route('/users/search', methods=['GET'])
@jwt_required()
def search_users():
    current_user_id = get_jwt_identity()
    query = request.args.get('q', '') # Obtener el término de búsqueda

    if not query or len(query) < 2:
        return jsonify([]), 200 # Devolver array vacío si la query es muy corta

    # Buscar usuarios por username o email, excluyendo al usuario actual (opcional)
    users = User.query.filter(
        (User.username.ilike(f'%{query}%')) | (User.email.ilike(f'%{query}%'))
    ).filter(User.id != int(current_user_id)).all() # Excluir al usuario que está haciendo la búsqueda

    users_data = []
    for user in users:
        users_data.append({
            "id": user.id,
            "username": user.username,
            "email": user.email
        })
    return jsonify(users_data), 200


# =========================================================
# Rutas de Gestión de Tableros (Boards)
# =========================================================

@app.route('/boards', methods=['POST'])
@jwt_required()
def create_board():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    title = data.get('title')
    description = data.get('description')

    if not title:
        return jsonify({"msg": "Title is required for the board"}), 400

    new_board = Board(title=title, description=description, owner_id=current_user_id)
    db.session.add(new_board)
    db.session.commit()

    return jsonify({
        "msg": "Board created successfully",
        "board": {
            "id": new_board.id,
            "title": new_board.title,
            "description": new_board.description,
            "owner_id": new_board.owner_id,
            "created_at": new_board.created_at.isoformat()
        }
    }), 201

@app.route('/boards', methods=['GET'])
@jwt_required()
def get_user_boards():
    current_user_id = get_jwt_identity()
    boards = Board.query.filter_by(owner_id=current_user_id).all()

    boards_data = []
    for board in boards:
        boards_data.append({
            "id": board.id,
            "title": board.title,
            "description": board.description,
            "owner_id": board.owner_id,
            "created_at": board.created_at.isoformat()
        })
    return jsonify(boards_data), 200

@app.route('/boards/<int:board_id>', methods=['GET'])
@jwt_required()
def get_single_board(board_id):
    current_user_id = get_jwt_identity()
    board = Board.query.filter_by(id=board_id, owner_id=current_user_id).first()

    if not board:
        return jsonify({"msg": "Board not found or you don't have permission"}), 404

    return jsonify({
        "id": board.id,
        "title": board.title,
        "description": board.description,
        "owner_id": board.owner_id,
        "created_at": board.created_at.isoformat()
    }), 200

@app.route('/boards/<int:board_id>', methods=['PUT'])
@jwt_required()
def update_board(board_id):
    current_user_id = get_jwt_identity()
    board = Board.query.filter_by(id=board_id, owner_id=current_user_id).first()

    if not board:
        return jsonify({"msg": "Board not found or you don't have permission"}), 404

    data = request.get_json()
    title = data.get('title', board.title) # Permite actualizar solo el título
    description = data.get('description', board.description) # Permite actualizar solo la descripción

    if not title: # El título sigue siendo obligatorio
        return jsonify({"msg": "Title cannot be empty"}), 400

    board.title = title
    board.description = description
    db.session.commit()

    return jsonify({
        "msg": "Board updated successfully",
        "board": {
            "id": board.id,
            "title": board.title,
            "description": board.description,
            "owner_id": board.owner_id,
            "created_at": board.created_at.isoformat()
        }
    }), 200

@app.route('/boards/<int:board_id>', methods=['DELETE'])
@jwt_required()
def delete_board(board_id):
    current_user_id = get_jwt_identity()
    board = Board.query.filter_by(id=board_id, owner_id=current_user_id).first()

    if not board:
        return jsonify({"msg": "Board not found or you don't have permission"}), 404

    db.session.delete(board)
    db.session.commit()

    return jsonify({"msg": "Board deleted successfully"}), 200


# =========================================================
# Rutas de Gestión de Listas (Lists)
# =========================================================

@app.route('/boards/<int:board_id>/lists', methods=['POST'])
@jwt_required()
def create_list(board_id):
    current_user_id = get_jwt_identity()
    board = Board.query.filter_by(id=board_id, owner_id=current_user_id).first()

    if not board:
        return jsonify({"msg": "Board not found or you don't have permission"}), 404

    data = request.get_json()
    title = data.get('title')
    order = data.get('order') # Opcional: permitir definir el orden inicial

    if not title:
        return jsonify({"msg": "Title is required for the list"}), 400

    # Si no se proporciona un orden, ponla al final
    if order is None:
        max_order = db.session.query(db.func.max(List.order)).filter_by(board_id=board_id).scalar()
        order = (max_order if max_order is not None else -1) + 1 # Asegura que sea el último

    new_list = List(title=title, board_id=board.id, order=order)
    db.session.add(new_list)
    db.session.commit()

    return jsonify({
        "msg": "List created successfully",
        "list": {
            "id": new_list.id,
            "title": new_list.title,
            "board_id": new_list.board_id,
            "order": new_list.order,
            "created_at": new_list.created_at.isoformat()
        }
    }), 201

@app.route('/boards/<int:board_id>/lists', methods=['GET'])
@jwt_required()
def get_board_lists(board_id):
    current_user_id = get_jwt_identity()
    board = Board.query.filter_by(id=board_id, owner_id=current_user_id).first()

    if not board:
        return jsonify({"msg": "Board not found or you don't have permission"}), 404

    # Obtener las listas ordenadas por el campo 'order'
    lists = List.query.filter_by(board_id=board_id).order_by(List.order).all()

    lists_data = []
    for lst in lists:
        lists_data.append({
            "id": lst.id,
            "title": lst.title,
            "board_id": lst.board_id,
            "order": lst.order,
            "created_at": lst.created_at.isoformat()
        })
    return jsonify(lists_data), 200

@app.route('/lists/<int:list_id>', methods=['PUT'])
@jwt_required()
def update_list(list_id):
    current_user_id = get_jwt_identity()
    # Verificar que la lista exista y que el usuario sea el dueño del tablero al que pertenece
    lst = List.query.get(list_id)
    if not lst:
        return jsonify({"msg": "List not found"}), 404

    board = Board.query.filter_by(id=lst.board_id, owner_id=current_user_id).first()
    if not board:
        return jsonify({"msg": "List not found or you don't have permission"}), 404

    data = request.get_json()
    title = data.get('title', lst.title)
    order = data.get('order', lst.order)

    if not title: # El título de la lista sigue siendo obligatorio
        return jsonify({"msg": "Title cannot be empty"}), 400

    lst.title = title
    lst.order = order
    db.session.commit()

    return jsonify({
        "msg": "List updated successfully",
        "list": {
            "id": lst.id,
            "title": lst.title,
            "board_id": lst.board_id,
            "order": lst.order,
            "created_at": lst.created_at.isoformat()
        }
    }), 200

@app.route('/lists/<int:list_id>', methods=['DELETE'])
@jwt_required()
def delete_list(list_id):
    current_user_id = get_jwt_identity()
    # Verificar que la lista exista y que el usuario sea el dueño del tablero al que pertenece
    lst = List.query.get(list_id)
    if not lst:
        return jsonify({"msg": "List not found"}), 404

    board = Board.query.filter_by(id=lst.board_id, owner_id=current_user_id).first()
    if not board:
        return jsonify({"msg": "List not found or you don't have permission"}), 404

    db.session.delete(lst)
    db.session.commit()

    return jsonify({"msg": "List deleted successfully"}), 200


# =========================================================
# Rutas de Gestión de Tarjetas (Cards)
# =========================================================

# Función auxiliar para verificar permisos de tarjeta
def check_card_permission(card_id, current_user_id):
    card = Card.query.get(card_id)
    if not card:
        return None, jsonify({"msg": "Card not found"}), 404

    lst = List.query.get(card.list_id)
    if not lst:
        return None, jsonify({"msg": "Internal error: List for card not found"}), 500

    board = Board.query.get(lst.board_id)
    if not board:
        return None, jsonify({"msg": "Internal error: Board for list not found"}), 500

    # Permiso: el usuario es propietario del tablero O la tarjeta está asignada a él
    is_board_owner = (str(board.owner_id) == current_user_id)
    is_assigned_to_card = CardAssignment.query.filter_by(card_id=card_id, user_id=current_user_id).first() is not None

    if not (is_board_owner or is_assigned_to_card):
        return None, jsonify({"msg": "You do not have permission to access/modify this card."}), 403
    
    return card, None, None # Devuelve la tarjeta si hay permiso


@app.route('/lists/<int:list_id>/cards', methods=['POST'])
@jwt_required()
def create_card(list_id):
    current_user_id = get_jwt_identity()
    lst = List.query.get(list_id)

    if not lst:
        return jsonify({"msg": "List not found"}), 404

    # Verificar que el usuario tenga permiso sobre el tablero de la lista (solo el dueño puede crear tarjetas)
    board = Board.query.filter_by(id=lst.board_id, owner_id=current_user_id).first()
    if not board:
        return jsonify({"msg": "List not found or you don't have permission to create cards here"}), 403 # 403 Forbidden

    data = request.get_json()
    title = data.get('title')
    description = data.get('description')
    due_date_str = data.get('due_date')
    order = data.get('order')

    if not title:
        return jsonify({"msg": "Title is required for the card"}), 400

    due_date = None
    if due_date_str:
        try:
            # Esperamos formato ISO 8601 (ej. "2025-12-31T23:59:59")
            due_date = datetime.fromisoformat(due_date_str)
        except ValueError:
            return jsonify({"msg": "Invalid due_date format. Use ISO 8601 (YYYY-MM-DDTHH:MM:SS)"}), 400

    # Si no se proporciona un orden, ponla al final de la lista
    if order is None:
        max_order = db.session.query(db.func.max(Card.order)).filter_by(list_id=list_id).scalar()
        order = (max_order if max_order is not None else -1) + 1

    new_card = Card(
        title=title,
        description=description,
        list_id=list_id,
        creator_id=int(current_user_id), # Asegurarse de que creator_id sea int
        due_date=due_date,
        order=order
    )
    db.session.add(new_card)
    db.session.commit()

    return jsonify({
        "msg": "Card created successfully",
        "card": {
            "id": new_card.id,
            "title": new_card.title,
            "description": new_card.description,
            "list_id": new_card.list_id,
            "creator_id": new_card.creator_id,
            "due_date": new_card.due_date.isoformat() if new_card.due_date else None,
            "order": new_card.order,
            "created_at": new_card.created_at.isoformat()
        }
    }), 201

@app.route('/lists/<int:list_id>/cards', methods=['GET'])
@jwt_required()
def get_list_cards(list_id):
    current_user_id = get_jwt_identity()
    lst = List.query.get(list_id)

    if not lst:
        return jsonify({"msg": "List not found"}), 404

    # Verificar permiso sobre el tablero
    board = Board.query.filter_by(id=lst.board_id, owner_id=current_user_id).first()
    if not board:
        return jsonify({"msg": "List not found or you don't have permission to its board"}), 403

    cards = Card.query.filter_by(list_id=list_id).order_by(Card.order).all()

    cards_data = []
    for card in cards:
        cards_data.append({
            "id": card.id,
            "title": card.title,
            "description": card.description,
            "list_id": card.list_id,
            "creator_id": card.creator_id,
            "due_date": card.due_date.isoformat() if card.due_date else None,
            "order": card.order,
            "created_at": card.created_at.isoformat(),
            "updated_at": card.updated_at.isoformat()
        })
    return jsonify(cards_data), 200

@app.route('/cards/<int:card_id>', methods=['GET'])
@jwt_required()
def get_single_card(card_id):
    current_user_id = get_jwt_identity()
    card, error_response, status_code = check_card_permission(card_id, current_user_id)
    if error_response:
        return error_response, status_code

    return jsonify({
        "id": card.id,
        "title": card.title,
        "description": card.description,
        "list_id": card.list_id,
        "creator_id": card.creator_id,
        "due_date": card.due_date.isoformat() if card.due_date else None,
        "order": card.order,
        "created_at": card.created_at.isoformat(),
        "updated_at": card.updated_at.isoformat()
    }), 200

@app.route('/cards/<int:card_id>', methods=['PUT'])
@jwt_required()
def update_card(card_id):
    current_user_id = get_jwt_identity()
    card, error_response, status_code = check_card_permission(card_id, current_user_id)
    if error_response:
        return error_response, status_code

    data = request.get_json()
    title = data.get('title', card.title)
    description = data.get('description', card.description)
    due_date_str = data.get('due_date')
    order = data.get('order', card.order)

    if not title:
        return jsonify({"msg": "Title cannot be empty"}), 400

    if due_date_str:
        try:
            if due_date_str.lower() == 'null':
                due_date = None
            else:
                due_date = datetime.fromisoformat(due_date_str)
        except ValueError:
            return jsonify({"msg": "Invalid due_date format. Use ISO 8601 (YYYY-MM-DDTHH:MM:SS) or 'null'"}), 400
    else:
        due_date = card.due_date

    card.title = title
    card.description = description
    card.due_date = due_date
    card.order = order
    db.session.commit()

    return jsonify({
        "msg": "Card updated successfully",
        "card": {
            "id": card.id,
            "title": card.title,
            "description": card.description,
            "list_id": card.list_id,
            "creator_id": card.creator_id,
            "due_date": card.due_date.isoformat() if card.due_date else None,
            "order": card.order,
            "created_at": card.created_at.isoformat(),
            "updated_at": card.updated_at.isoformat()
        }
    }), 200

@app.route('/cards/<int:card_id>/move', methods=['PUT'])
@jwt_required()
def move_card(card_id):
    current_user_id = get_jwt_identity()
    card, error_response, status_code = check_card_permission(card_id, current_user_id)
    if error_response:
        return error_response, status_code

    data = request.get_json()
    new_list_id = data.get('new_list_id')
    new_order = data.get('new_order')

    if not new_list_id:
        return jsonify({"msg": "new_list_id is required"}), 400

    target_list = List.query.get(new_list_id)
    if not target_list:
        return jsonify({"msg": "Target list not found"}), 404

    # Verificar permiso sobre el tablero de destino: el usuario debe ser dueño del tablero destino
    # o la tarjeta ya debe estar asignada a él Y el tablero destino debe ser el mismo que el origen.
    # La lógica actual restringe mover solo dentro de tableros del mismo propietario.
    # Para permitir mover a tableros donde el usuario está asignado, la lógica sería más compleja.
    # Por simplicidad, se mantiene que el destino sea un tablero donde el usuario tiene control (dueño).
    target_board = Board.query.filter_by(id=target_list.board_id, owner_id=current_user_id).first()
    if not target_board: # Si el usuario NO es el dueño del tablero de destino
        # Y tampoco es dueño del tablero original, entonces no tiene permiso
        # para mover la tarjeta A OTRA LISTA si la lista destino está en un tablero diferente al suyo
        # o si no es dueño del tablero destino.
        # Por ahora, solo el dueño del tablero original puede moverla entre sus propias listas.
        source_list = List.query.get(card.list_id)
        source_board = Board.query.get(source_list.board_id)
        
        # Si no es el dueño del tablero de destino Y la tarjeta NO es del tablero original del usuario
        if str(source_board.owner_id) != current_user_id:
             return jsonify({"msg": "You do not have permission to move this card to this target list."}), 403


    # Si la tarjeta se mueve dentro del mismo tablero (del cual el usuario tiene permiso)
    # o a una lista en un tablero al que el usuario tiene acceso (como dueño)
    # La restricción de 'same board owner' es para evitar que se mueva a un tablero arbitrario de otro usuario
    # si el usuario actual solo está asignado a la tarjeta.
    # El `check_card_permission` ya asegura que el usuario puede al menos ver/modificar la tarjeta.

    card.list_id = new_list_id
    if new_order is not None:
        card.order = new_order
    else:
        max_order = db.session.query(db.func.max(Card.order)).filter_by(list_id=new_list_id).scalar()
        card.order = (max_order if max_order is not None else -1) + 1

    db.session.commit()

    return jsonify({
        "msg": "Card moved successfully",
        "card": {
            "id": card.id,
            "title": card.title,
            "list_id": card.list_id,
            "order": card.order
        }
    }), 200

@app.route('/cards/<int:card_id>', methods=['DELETE'])
@jwt_required()
def delete_card(card_id):
    current_user_id = get_jwt_identity()
    card, error_response, status_code = check_card_permission(card_id, current_user_id)
    if error_response:
        return error_response, status_code

    db.session.delete(card)
    db.session.commit()

    return jsonify({"msg": "Card deleted successfully"}), 200

# =========================================================
# Rutas para Asignaciones y Comentarios
# =========================================================

# --- Rutas para Asignaciones de Tarjetas ---
@app.route('/cards/<int:card_id>/assign', methods=['POST'])
@jwt_required()
def assign_user_to_card(card_id):
    current_user_id = get_jwt_identity()
    card, error_response, status_code = check_card_permission(card_id, current_user_id)
    if error_response:
        return error_response, status_code

    data = request.get_json()
    user_to_assign_id = data.get('user_id')

    if not user_to_assign_id:
        return jsonify({"msg": "User ID to assign is required"}), 400

    user_to_assign = User.query.get(user_to_assign_id)
    if not user_to_assign:
        return jsonify({"msg": "User to assign not found"}), 404

    existing_assignment = CardAssignment.query.filter_by(card_id=card_id, user_id=user_to_assign_id).first()
    if existing_assignment:
        return jsonify({"msg": "User already assigned to this card"}), 409

    new_assignment = CardAssignment(card_id=card_id, user_id=user_to_assign_id)
    db.session.add(new_assignment)
    db.session.commit()

    return jsonify({
        "msg": "User assigned to card successfully",
        "assignment": {
            "id": new_assignment.id,
            "card_id": new_assignment.card_id,
            "user_id": new_assignment.user_id,
            "assigned_at": new_assignment.assigned_at.isoformat()
        }
    }), 201

@app.route('/cards/<int:card_id>/unassign', methods=['DELETE'])
@jwt_required()
def unassign_user_from_card(card_id):
    current_user_id = get_jwt_identity()
    card, error_response, status_code = check_card_permission(card_id, current_user_id)
    if error_response:
        return error_response, status_code

    data = request.get_json()
    user_to_unassign_id = data.get('user_id')

    if not user_to_unassign_id:
        return jsonify({"msg": "User ID to unassign is required"}), 400

    assignment = CardAssignment.query.filter_by(card_id=card_id, user_id=user_to_unassign_id).first()
    if not assignment:
        return jsonify({"msg": "Assignment not found"}), 404

    db.session.delete(assignment)
    db.session.commit()

    return jsonify({"msg": "User unassigned from card successfully"}), 200

@app.route('/cards/<int:card_id>/assignments', methods=['GET'])
@jwt_required()
def get_card_assignments(card_id):
    current_user_id = get_jwt_identity()
    card, error_response, status_code = check_card_permission(card_id, current_user_id)
    if error_response:
        return error_response, status_code

    assignments = CardAssignment.query.filter_by(card_id=card_id).all()
    assigned_users_data = []
    for assignment in assignments:
        user = User.query.get(assignment.user_id)
        if user:
            assigned_users_data.append({
                "assignment_id": assignment.id,
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "assigned_at": assignment.assigned_at.isoformat()
            })
    return jsonify(assigned_users_data), 200


# --- Rutas para Comentarios ---
@app.route('/cards/<int:card_id>/comments', methods=['POST'])
@jwt_required()
def add_comment_to_card(card_id):
    current_user_id = get_jwt_identity()
    card, error_response, status_code = check_card_permission(card_id, current_user_id)
    if error_response:
        return error_response, status_code

    data = request.get_json()
    content = data.get('content')

    if not content:
        return jsonify({"msg": "Comment content cannot be empty"}), 400

    new_comment = Comment(content=content, card_id=card_id, user_id=int(current_user_id)) # Asegurarse de que user_id sea int
    db.session.add(new_comment)
    db.session.commit()

    return jsonify({
        "msg": "Comment added successfully",
        "comment": {
            "id": new_comment.id,
            "content": new_comment.content,
            "card_id": new_comment.card_id,
            "user_id": new_comment.user_id,
            "created_at": new_comment.created_at.isoformat()
        }
    }), 201

@app.route('/cards/<int:card_id>/comments', methods=['GET'])
@jwt_required()
def get_card_comments(card_id):
    current_user_id = get_jwt_identity()
    card, error_response, status_code = check_card_permission(card_id, current_user_id)
    if error_response:
        return error_response, status_code

    comments = Comment.query.filter_by(card_id=card_id).order_by(Comment.created_at.asc()).all()
    comments_data = []
    for comment in comments:
        commenter = User.query.get(comment.user_id)
        comments_data.append({
            "id": comment.id,
            "content": comment.content,
            "card_id": comment.card_id,
            "user_id": comment.user_id,
            "username": commenter.username if commenter else "Unknown",
            "created_at": comment.created_at.isoformat()
        })
    return jsonify(comments_data), 200

@app.route('/comments/<int:comment_id>', methods=['PUT'])
@jwt_required()
def update_comment(comment_id):
    current_user_id = get_jwt_identity()
    comment = Comment.query.get(comment_id)

    if not comment:
        return jsonify({"msg": "Comment not found"}), 404

    # Para editar/eliminar comentario, debe ser el propio creador del comentario
    if str(comment.user_id) != current_user_id:
        return jsonify({"msg": "You do not have permission to update this comment"}), 403

    data = request.get_json()
    content = data.get('content', comment.content)

    if not content:
        return jsonify({"msg": "Comment content cannot be empty"}), 400

    comment.content = content
    db.session.commit()

    return jsonify({
        "msg": "Comment updated successfully",
        "comment": {
            "id": comment.id,
            "content": comment.content,
            "card_id": comment.card_id,
            "user_id": comment.user_id,
            "created_at": comment.created_at.isoformat()
        }
    }), 200

@app.route('/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    current_user_id = get_jwt_identity()
    comment = Comment.query.get(comment_id)

    if not comment:
        return jsonify({"msg": "Comment not found"}), 404

    # Para editar/eliminar comentario, debe ser el propio creador del comentario
    if str(comment.user_id) != current_user_id:
        return jsonify({"msg": "You do not have permission to delete this comment"}), 403

    db.session.delete(comment)
    db.session.commit()

    return jsonify({"msg": "Comment deleted successfully"}), 200

# =========================================================
# Rutas de Filtrado de Tarjetas
# =========================================================

@app.route('/cards/filter', methods=['GET'])
@jwt_required()
def filter_cards():
    current_user_id = int(get_jwt_identity()) # Convertir a int

    # Obtener los parámetros de consulta de la URL
    user_id_filter = request.args.get('user_id', type=int) # Para tarjetas asignadas a este user_id
    creator_id_filter = request.args.get('creator_id', type=int) # Para tarjetas creadas por este user_id
    due_date_start_str = request.args.get('due_date_start')
    due_date_end_str = request.args.get('due_date_end')
    board_id_filter = request.args.get('board_id', type=int)
    list_id_filter = request.args.get('list_id', type=int)
    title_contains = request.args.get('title_contains')

    # --- Lógica principal de acceso: el usuario es propietario del tablero O la tarjeta está asignada a él ---
    # Esta es la base de las tarjetas que el usuario tiene permitido ver/filtrar.
    access_condition = or_(
        Board.owner_id == current_user_id,
        Card.id.in_(db.session.query(CardAssignment.card_id).filter(CardAssignment.user_id == current_user_id))
    )
    
    # Consulta base: todas las tarjetas a las que el usuario tiene acceso
    query = db.session.query(Card).join(List).join(Board).outerjoin(CardAssignment).filter(access_condition)


    # Aplicar filtros adicionales basados en los parámetros
    if user_id_filter:
        query = query.filter(CardAssignment.user_id == user_id_filter)
    
    if creator_id_filter:
        query = query.filter(Card.creator_id == creator_id_filter)

    if due_date_start_str:
        try:
            due_date_start = datetime.fromisoformat(due_date_start_str)
            query = query.filter(Card.due_date >= due_date_start)
        except ValueError:
            return jsonify({"msg": "Invalid due_date_start format. Use ISO 8601 (YYYY-MM-DDTHH:MM:SS)"}), 400

    if due_date_end_str:
        try:
            due_date_end = datetime.fromisoformat(due_date_end_str)
            query = query.filter(Card.due_date <= due_date_end)
        except ValueError:
            return jsonify({"msg": "Invalid due_date_end format. Use ISO 8601 (YYYY-MM-DDTHH:MM:SS)"}), 400

    if board_id_filter:
        query = query.filter(Board.id == board_id_filter)

    if list_id_filter:
        query = query.filter(List.id == list_id_filter)

    if title_contains:
        query = query.filter(Card.title.ilike(f'%{title_contains}%'))

    # Ordenar y asegurar unicidad de resultados
    cards = query.order_by(List.order, Card.order).distinct().all()

    cards_data = []
    for card in cards:
        assigned_users = []
        for assignment in card.assignments:
            user = User.query.get(assignment.user_id)
            if user:
                assigned_users.append({
                    "user_id": user.id,
                    "username": user.username,
                    "email": user.email
                })
        
        cards_data.append({
            "id": card.id,
            "title": card.title,
            "description": card.description,
            "list_id": card.list_id,
            "creator_id": card.creator_id,
            "due_date": card.due_date.isoformat() if card.due_date else None,
            "order": card.order,
            "created_at": card.created_at.isoformat(),
            "updated_at": card.updated_at.isoformat(),
            "assigned_users": assigned_users,
            "board_id": card.list.board_id # Aseguramos que board_id esté aquí
        })

    return jsonify(cards_data), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
