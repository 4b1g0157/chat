from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    rsa_public_key = db.Column(db.Text, nullable=False)
    encrypted_rsa_private_key = db.Column(db.Text, nullable=False)  # JSON string containing ciphertext, IV, salt
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'rsa_public_key': self.rsa_public_key,
            'created_at': self.created_at.isoformat()
        }

# 💡 新增好友關係資料表模型
class Friendship(db.Model):
    __tablename__ = 'friendships'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    timestamp = db.Column(db.Integer, default=0)

    # 建立關聯，方便未來若需要反向查詢
    user = db.relationship('User', foreign_keys=[user_id], backref='friendships')
    friend = db.relationship('User', foreign_keys=[friend_id], backref='friend_of')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'friend_id': self.friend_id,
            'timestamp': self.timestamp
        }

class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    message_type = db.Column(db.String(20), default='text')
    ciphertext = db.Column(db.Text, nullable=False)
    file_name = db.Column(db.String(255), nullable=True)

    aes_iv = db.Column(db.String(100), nullable=False)
    encrypted_key_sender = db.Column(db.Text, nullable=False)
    encrypted_key_receiver = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.Integer, nullable=False)
    
    # 💡 已讀狀態欄位（預設為 False 未讀）
    is_read = db.Column(db.Boolean, default=False)

    # Relationships
    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_messages')
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref='received_messages')

    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'receiver_id': self.receiver_id,
            'message_type': self.message_type,
            'ciphertext': self.ciphertext,
            'file_name': self.file_name,
            'aes_iv': self.aes_iv,
            'encrypted_key_sender': self.encrypted_key_sender,
            'encrypted_key_receiver': self.encrypted_key_receiver,
            'timestamp': self.timestamp,
            'is_read': self.is_read  # 💡 確保封裝成字典時包含已讀狀態
        }