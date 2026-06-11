## ADDED Requirements

### Requirement: Security Visualizer Mode Toggle
The React client UI SHALL include a global toggle switch for "Security Visualizer / Developer Mode". When this toggle is enabled, additional cryptographic details and flows SHALL be displayed in the UI. When disabled, the app SHALL present a clean, standard consumer chat interface.

#### Scenario: Toggling Security Visualizer Mode
- **WHEN** the user toggles the "Security Visualizer" switch on
- **THEN** the UI dynamically displays cryptographic sidebars and step-by-step debug panels alongside each chat message.

### Requirement: Cryptographic Data Inspection Panel
For every message rendered in visualizer mode, the React client SHALL display a dedicated inspector panel containing:
1. The plaintext message content (only on the local client).
2. The generated 256-bit AES Key (as a Hex/Base64 string).
3. The AES Initialization Vector (IV).
4. The RSA-encrypted AES Key (as sent to/received from the server).
5. The resulting AES-GCM Ciphertext (as stored in the database).

#### Scenario: Inspecting Message Cryptography
- **WHEN** the user clicks "View Cryptography Details" on a message in the chat
- **THEN** an inspector card expands to show the generated AES Key, IV, RSA-encrypted AES Key, and Ciphertext values in Hexadecimal format.

### Requirement: Step-by-Step Flow Animation
The React client SHALL render an interactive flowchart visualization when a message is sent or received. This flowchart SHALL highlight each step of the cryptographic pipeline (e.g. key generation, RSA encryption, AES encryption, Socket transmission, RSA decryption, AES decryption) sequentially with micro-animations.

#### Scenario: Visualizing Message Send Sequence
- **WHEN** Alice sends a message in visualizer mode
- **THEN** the screen overlays a brief, non-blocking step-by-step flow diagram showing: "Key Generated -> RSA Key Encrypted -> AES Message Encrypted -> Sent" with visual transition highlights.
