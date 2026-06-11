## ADDED Requirements

### Requirement: Sender-Side Hybrid Encryption
When a user sends a message, the React client SHALL automatically generate a random 256-bit AES symmetric key and a unique initialization vector (IV). The client SHALL encrypt the message plaintext using AES-GCM-256 with this symmetric key and IV. The client SHALL encrypt the symmetric key with the recipient's RSA Public Key (RSA-OAEP) to produce the encrypted key for the recipient. The client SHALL also encrypt the symmetric key with the sender's own RSA Public Key to produce the encrypted key for the sender.

#### Scenario: Message Encryption Before Sending
- **WHEN** Alice types "Hello Bob" and clicks send to Bob
- **THEN** the React client generates an AES key and IV, encrypts "Hello Bob" using AES-GCM-256, encrypts the AES key with Bob's RSA Public Key and Alice's RSA Public Key, and produces the complete message payload package.

### Requirement: Server Message Storage and Forwarding
The Flask-SocketIO server SHALL receive the encrypted message payload `{ recipient_id, ciphertext, aes_iv, encrypted_key_recipient, encrypted_key_sender }`. The server SHALL store this encrypted payload in the database. The server SHALL forward the package to the recipient via an active Socket.IO connection.

#### Scenario: Server Receives and Forwards Encrypted Message
- **WHEN** the Flask-SocketIO server receives the encrypted message package from Alice
- **THEN** the server inserts the encrypted message records into the Database without decrypting them, and broadcasts the payload to Bob's socket channel.

### Requirement: Receiver-Side Message Decryption
Upon receiving an encrypted message package via Socket.IO, the recipient's React client SHALL extract the `encrypted_key_recipient` and decrypt it using the in-memory RSA Private Key. The client SHALL then use the decrypted AES key and the received `aes_iv` to decrypt the `ciphertext` using AES-GCM-256 to display the plaintext message.

#### Scenario: Message Decryption Upon Receipt
- **WHEN** Bob receives the encrypted message package from Alice
- **THEN** Bob's React client decrypts the AES key using Bob's private key, decrypts the ciphertext using the AES key and IV, and displays the plaintext message "Hello Bob" in the chat window.
