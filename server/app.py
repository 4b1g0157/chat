import eventlet
eventlet.monkey_patch()
import os
import time

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, decode_token
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, Message, Friendship

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-key-change-this-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///e2ee_chat.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-this-in-production')

CORS(app, resources={r"/*": {"origins": "*"}})

db.init_app(app)
jwt = JWTManager(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', logger=True, engineio_logger=True)

with app.app_context():
    db.create_all()

# --- REST API: AUTHENTICATION & KEY MANAGEMENT ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing request body'}), 400
        
    username = data.get('username')
    password = data.get('password') or data.get('password_hash')
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

@app.route('/api/friends', methods=['GET'])
@jwt_required()
def get_friends():
    current_user_id = int(get_jwt_identity())
    friendships = Friendship.query.filter_by(user_id=current_user_id).all()
    friend_ids = [f.friend_id for f in friendships]
    
    friends = User.query.filter(User.id.in_(friend_ids)).all() if friend_ids else []
    return jsonify([u.to_dict() for u in friends]), 200

@app.route('/api/friends/add', methods=['POST'])
@jwt_required()
def add_friend():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or not data.get('username'):
        return jsonify({'error': '請輸入使用者名稱'}), 400
        
    target_username = data.get('username').strip()
    target_user = User.query.filter_by(username=target_username).first()
    
    if not target_user:
        return jsonify({'error': '找不到該使用者'}), 404
        
    if target_user.id == current_user_id:
        return jsonify({'error': '不能將自己加為好友'}), 400
        
    existing_friendship = Friendship.query.filter_by(user_id=current_user_id, friend_id=target_user.id).first()
    if existing_friendship:
        return jsonify({'error': '該使用者已經在您的好友列表中'}), 400

    try:
        friendship = Friendship(user_id=current_user_id, friend_id=target_user.id, timestamp=int(time.time()))
        db.session.add(friendship)
        db.session.commit()
        return jsonify({'message': '加好友成功', 'friend': target_user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': '加好友失敗'}), 500

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
    messages = Message.query.filter(
        ((Message.sender_id == current_user_id) & (Message.receiver_id == other_user_id)) |
        ((Message.sender_id == other_user_id) & (Message.receiver_id == current_user_id))
    ).order_by(Message.timestamp.asc()).all()
    
    return jsonify([m.to_dict() for m in messages]), 200

# --- Socket.IO: 連線與權限驗證 ---

@socketio.on('connect')
def handle_connect(auth):
    token = auth.get('token') if auth else None
    if not token:
        token = request.args.get('token')
        
    if not token:
        print("Socket 連線失敗: 未提供 Auth Token")
        return False  
        
    try:
        decoded = decode_token(token)
        user_id = decoded['sub']
        
        from flask import session
        session['socket_user_id'] = user_id
        
        join_room(f"user_{user_id}")
        print(f"User {user_id} 成功建立 Socket 連線並加入個人房間 user_{user_id}")
    except Exception as e:
        print(f"Socket Token 驗證失敗: {e}")
        return False

@socketio.on('join')
def handle_join(data):
    room = data.get('room')
    if room:
        join_room(room)
        print(f"Socket Client 加入房間: {room}")

@socketio.on('send_message')
def handle_send_message(data):
    from flask import session
    sender_id = session.get('socket_user_id')
    if not sender_id:
        emit('error', {'message': '尚未通過驗證'})
        return

    recipient_id = data.get('recipient_id') or data.get('receiver_id')
    message_type = data.get('message_type', 'text')
    file_name = data.get('file_name')
    
    ciphertext = data.get('ciphertext')
    aes_iv = data.get('aes_iv')
    encrypted_key_sender = data.get('encrypted_key_sender')
    encrypted_key_receiver = data.get('encrypted_key_receiver')
    
    if not all([recipient_id, ciphertext, aes_iv, encrypted_key_sender, encrypted_key_receiver]):
        emit('error', {'message': '缺少必要參數或加密欄位'})
        return
        
    try:
        msg = Message(
            sender_id=int(sender_id),
            receiver_id=int(recipient_id),
            message_type=message_type,
            ciphertext=ciphertext,
            file_name=file_name,
            aes_iv=aes_iv,
            encrypted_key_sender=encrypted_key_sender,
            encrypted_key_receiver=encrypted_key_receiver,
            timestamp=int(time.time())
        )
        db.session.add(msg)
        db.session.commit()
        
        payload = msg.to_dict()
        
        socketio.emit('receive_message', payload, room=f"user_{recipient_id}")
        socketio.emit('receive_message', payload, room=f"user_{sender_id}")
    except Exception as e:
        db.session.rollback()
        print(f"發送訊息發生錯誤: {e}")
        emit('error', {'message': '資料庫儲存失敗'})

@socketio.on('mark_read')
def handle_mark_read(data):
    from flask import session
    user_id = session.get('socket_user_id')
    sender_id = data.get('sender_id')
    
    if not user_id or not sender_id:
        return
        
    try:
        unread_msgs = Message.query.filter_by(
            sender_id=int(sender_id),
            receiver_id=int(user_id),
            is_read=False
        ).all()
        
        if unread_msgs:
            for msg in unread_msgs:
                msg.is_read = True
            db.session.commit()
            
            socketio.emit('messages_read', {'reader_id': int(user_id)}, room=f"user_{sender_id}")
    except Exception as e:
        db.session.rollback()
        print(f"標記已讀失敗: {e}")

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)