## ADDED Requirements

### Requirement: Client-Side Key Generation and Secure Registration
During user registration, the React frontend client SHALL generate a 2048-bit RSA key pair. The client SHALL prompt the user for a security passphrase (which may be different from the login password). The client SHALL use PBKDF2 to derive a 256-bit Key Encrypting Key (KEK) from the passphrase. The client SHALL encrypt the RSA Private Key using AES-GCM-256 with the KEK. The client SHALL send the username, registration password, RSA Public Key (PEM format), and the encrypted RSA Private Key (with salt/IV) to the Flask API. The backend SHALL store these values in the database.

#### Scenario: Successful Registration with Key Generation
- **WHEN** the user inputs a username, login password, and passphrase, and clicks "Register"
- **THEN** the React client generates an RSA-2048 key pair, derives a KEK via PBKDF2 from the passphrase, encrypts the private key using AES-GCM, and sends the registration payload to the server. The server stores it in the database and returns a success status.

### Requirement: JWT Authentication and Private Key Decryption on Login
Upon successful login, the Flask API SHALL return a standard JWT access token along with the user's encrypted RSA Private Key. The React client SHALL store the JWT in session state. The React client SHALL prompt the user for their security passphrase, derive the KEK via PBKDF2, and decrypt the encrypted RSA Private Key. The decrypted RSA Private Key SHALL be stored strictly in-memory (React State) and never persisted in localStorage or cookies.

#### Scenario: Successful Login and Key Decryption
- **WHEN** the user logs in with valid credentials and inputs their security passphrase
- **THEN** the Flask API validates the credentials, returns a JWT and the encrypted RSA Private Key. The React client stores the JWT, derives the KEK from the passphrase, decrypts the RSA Private Key in-memory, and redirects the user to the chat interface.

### Requirement: Public Key Retrieval
The Flask API SHALL expose a JWT-protected endpoint `/api/users/<username>/public-key` that allows authenticated users to query the RSA Public Key of another user.

#### Scenario: Query Existing User Public Key
- **WHEN** an authenticated user requests the public key of user "bob"
- **THEN** the server returns the PEM-encoded RSA Public Key of user "bob".
