## ADDED Requirements

### Requirement: Group Creation and Membership Management
The Flask API SHALL expose a POST endpoint `/api/groups` allowing authenticated users to create a chat group by specifying a name and a list of member usernames. The server SHALL store the group and verify that all specified member usernames exist. The Flask API SHALL expose a GET endpoint `/api/groups` that returns all groups the currently authenticated user belongs to.

#### Scenario: Successful Group Creation
- **WHEN** user Alice sends a POST request to `/api/groups` with group name "Study Group" and member list ["bob", "charlie"]
- **THEN** the server creates the group, associates Alice, Bob, and Charlie as members, and returns a success status with the group details.

### Requirement: Sender-Side Group Hybrid Encryption
When sending a message to a group, the sender's React client SHALL fetch the RSA Public Keys of all group members. The client SHALL generate a single random 256-bit AES symmetric key and an initialization vector (IV) to encrypt the message plaintext. The client SHALL encrypt this symmetric key *N* times using the RSA Public Key of each member in the group (including the sender). The client SHALL transmit the encrypted ciphertext, IV, and the dictionary of encrypted keys via Socket.IO.

#### Scenario: Sending an E2EE Message to a Group
- **WHEN** Alice sends "Meeting at 3 PM" to the group "Study Group"
- **THEN** Alice's client encrypts the text with AES-GCM-256, encrypts the AES key using RSA for Alice, Bob, and Charlie, and sends the payload to the server.

### Requirement: Recipient-Side Group Decryption
Upon receiving a group message socket event or retrieving history, the recipient's React client SHALL search the payload for the encrypted key associated with their own user ID. The client SHALL decrypt this key using their locally cached RSA Private Key and use it to decrypt the message ciphertext.

#### Scenario: Recipient Decrypts Group Message
- **WHEN** Bob receives the group message payload from Alice in room "group_1"
- **THEN** Bob's client finds his encrypted key in the dictionary, decrypts it using his RSA private key, decrypts the ciphertext, and displays "Meeting at 3 PM" in the chat interface.
