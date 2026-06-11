import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash

from models import db, User, Message

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super-secret-key-change-this-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///e2ee_chat.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'jwt-secret-key-change-this-in-production'

# Enable CORS for all domains (especially React Vite dev server)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize plugins
db.init_app(app)
jwt = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Create database tables
with app.app_context():
    db.create_all()

# --- REST API: AUTHENTICATION & KEY MANAGEMENT ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing request body'}), 400
        
    username = data.get('username')
    password = data.get('password') or data.get('password_hash') # Support password or pre-hashed password
    rsa_public_key = data.get('rsa_public_key')
    encrypted_rsa_private_key = data.get('encrypted_rsa_private_key')
    
    if not all([username, password, rsa_public_key, encrypted_rsa_private_key]):
        return jsonify({'error': 'Missing required fields'}), 400
        
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
        
    hashed_password = generate_password_hash(password)
    user = User(
        username=username,
        password_hash=hashed_password,
        rsa_public_key=rsa_public_key,
        encrypted_rsa_private_key=encrypted_rsa_private_key
    )
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing request body'}), 400
        
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Missing username or password'}), 400
        
    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid username or password'}), 401
        
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'rsa_public_key': user.rsa_public_key
        },
        'encrypted_rsa_private_key': user.encrypted_rsa_private_key
    }), 200

@app.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user_id = int(get_jwt_identity())
    users = User.query.filter(User.id != current_user_id).all()
    return jsonify([u.to_dict() for u in users]), 200

@app.route('/api/users/<username>/public-key', methods=['GET'])
@jwt_required()
def get_user_public_key(username):
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'rsa_public_key': user.rsa_public_key}), 200

@app.route('/api/messages/<int:other_user_id>', methods=['GET'])
@jwt_required()
def get_messages(other_user_id):
    current_user_id = int(get_jwt_identity())
    # Query all messages exchanged between current user and other user
    messages = Message.query.filter(
        ((Message.sender_id == current_user_id) & (Message.receiver_id == other_user_id)) |
        ((Message.sender_id == other_user_id) & (Message.receiver_id == current_user_id))
    ).order_by(Message.timestamp.asc()).all()
    
    return jsonify([m.to_dict() for m in messages]), 200

# --- SOCKET.IO: REAL-TIME COMMUNICATION ---

@socketio.on('connect')
def handle_connect():
    print("Socket client connected")

@socketio.on('disconnect')
def handle_disconnect():
    print("Socket client disconnected")

@socketio.on('join')
def handle_join(data):
    user_id = data.get('user_id')
    if user_id:
        room_name = f"user_{user_id}"
        join_room(room_name)
        print(f"User {user_id} joined room {room_name}")
        emit('join_success', {'room': room_name})

@socketio.on('leave')
def handle_leave(data):
    user_id = data.get('user_id')
    if user_id:
        room_name = f"user_{user_id}"
        leave_room(room_name)
        print(f"User {user_id} left room {room_name}")

@socketio.on('send_message')
def handle_send_message(data):
    # Expect data to have: sender_id, receiver_id, ciphertext, aes_iv, encrypted_key_sender, encrypted_key_receiver
    sender_id = data.get('sender_id')
    receiver_id = data.get('receiver_id')
    ciphertext = data.get('ciphertext')
    aes_iv = data.get('aes_iv')
    encrypted_key_sender = data.get('encrypted_key_sender')
    encrypted_key_receiver = data.get('encrypted_key_receiver')
    
    if not all([sender_id, receiver_id, ciphertext, aes_iv, encrypted_key_sender, encrypted_key_receiver]):
        emit('error', {'message': 'Missing data in send_message'})
        return
        
    try:
        # Save to SQLite Database
        msg = Message(
            sender_id=sender_id,
            receiver_id=receiver_id,
            ciphertext=ciphertext,
            aes_iv=aes_iv,
            encrypted_key_sender=encrypted_key_sender,
            encrypted_key_receiver=encrypted_key_receiver
        )
        db.session.add(msg)
        db.session.commit()
        
        message_dict = msg.to_dict()
        
        # Forward to receiver's private room
        emit('receive_message', message_dict, to=f"user_{receiver_id}")
        
        # Echo back to sender's private room for UI sync
        emit('message_sent', message_dict, to=f"user_{sender_id}")
        
    except Exception as e:
        print(f"Error sending message: {e}")
        emit('error', {'message': 'Database or server error when sending message'})

if __name__ == '__main__':
    socketio.run(app, port=5000, debug=True)
