import React from 'react';

export default function SecurityVisualizer({ activeStep, visualData }) {
    const steps = [
        {
            num: 'Step 1',
            title: '1. 對稱金鑰產生 (AES-256 Key Gen)',
            desc: '前端動態產生隨機 256 位元的對稱加密金鑰 (AES Key) 與初始化向量 (IV)。',
            fieldKey: 'aesKey'
        },
        {
            num: 'Step 2',
            title: '2. 非對稱加密金鑰 (RSA-OAEP Encrypt)',
            desc: '使用收件者的 RSA 公鑰加密剛剛產生的 AES 金鑰，確保只有收件者能解開。',
            fieldKey: 'encryptedKey'
        },
        {
            num: 'Step 3',
            title: '3. 訊息明文加密 (AES-GCM-256 Encrypt)',
            desc: '使用 AES 對稱金鑰將聊天明文加密為密文 (Ciphertext)。',
            fieldKey: 'ciphertext'
        },
        {
            num: 'Step 4',
            title: '4. 即時轉發與儲存 (Socket & DB Transfer)',
            desc: '將「密文」與「加密後的 AES 金鑰」傳送給 Flask 伺服器進行轉發。資料庫中僅儲存密文。',
            fieldKey: 'transfer'
        },
        {
            num: 'Step 5',
            title: '5. 金鑰還原解密 (RSA-OAEP Decrypt)',
            desc: '收件者收到封包後，使用本地瀏覽器記憶體中的 RSA 私鑰解密出原始的 AES 金鑰。',
            fieldKey: 'decryptedKey'
        },
        {
            num: 'Step 6',
            title: '6. 聊天密文還原 (AES-GCM-256 Decrypt)',
            desc: '收件者使用還原的 AES 金鑰與 IV 解密密文，還原出可讀的聊天明文。',
            fieldKey: 'plaintext'
        }
    ];

    return (
        <div className="visualizer-drawer">
            <div className="visualizer-drawer-header">
                🛡️ E2EE 密碼學視覺化面板
            </div>
            <div className="visualizer-drawer-body">
                {visualData ? (
                    <>
                        {/* Live Cryptographic Inspector */}
                        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)' }}>
                            <h4 style={{ margin: '0 0 8px 0', color: '#6366f1', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                                🔍 即時密碼學參數檢視
                            </h4>
                            
                            <div className="crypto-val-box">
                                <span className="crypto-title">明文內容 (Plaintext)</span>
                                <div className="crypto-value" style={{ color: '#4ade80' }}>
                                    {visualData.plaintext || '(無)'}
                                </div>
                            </div>

                            <div className="crypto-val-box">
                                <span className="crypto-title">對稱金鑰 (AES-256 Key Hex)</span>
                                <div className="crypto-value">
                                    {visualData.aesKeyHex || '正在生成...'}
                                </div>
                            </div>

                            <div className="crypto-val-box">
                                <span className="crypto-title">初始化向量 (IV Hex)</span>
                                <div className="crypto-value">
                                    {visualData.aesIvHex || '正在生成...'}
                                </div>
                            </div>

                            <div className="crypto-val-box">
                                <span className="crypto-title">加密後的對稱金鑰 (RSA Encrypted AES Key)</span>
                                <div className="crypto-value" style={{ fontSize: '10px', color: '#f59e0b' }}>
                                    {visualData.encryptedKeyReceiverBase64 || '等待 RSA 加密...'}
                                </div>
                            </div>

                            <div className="crypto-val-box">
                                <span className="crypto-title">訊息密文 (Ciphertext Base64)</span>
                                <div className="crypto-value" style={{ fontSize: '10px', color: '#a855f7' }}>
                                    {visualData.ciphertextBase64 || '等待 AES 加密...'}
                                </div>
                            </div>
                        </div>

                        {/* Interactive Steps Visual Flow */}
                        <div className="visual-flow">
                            <h4 style={{ alignSelf: 'flex-start', margin: '0 0 4px 0', fontSize: '14px', color: '#818cf8' }}>
                                ⚙️ 加解密流水線步驟
                            </h4>
                            {steps.map((step, idx) => {
                                const isStepActive = activeStep === idx;
                                return (
                                    <React.Fragment key={idx}>
                                        <div className={`flow-step ${isStepActive ? 'active' : ''}`}>
                                            <div className="flow-step-num">{step.num}</div>
                                            <div className="flow-step-title">{step.title}</div>
                                            <div className="flow-step-desc">{step.desc}</div>
                                        </div>
                                        {idx < steps.length - 1 && (
                                            <div className="flow-arrow">▼</div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="no-visual-data">
                        <div>
                            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔒</div>
                            請選擇聯絡人並發送或接收一條訊息，
                            即可在此動態觀察端對端（E2EE）加密傳輸的所有技術細節。
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
