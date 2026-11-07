import React, { useState, useEffect, useRef } from 'react';

export default function DesktopPet({ securityStatus }) {
    const [message, setMessage] = useState('🐾 E2EE 資安小幫手');
    const [isWalking, setIsWalking] = useState(true);
    const [position, setPosition] = useState({ x: window.innerWidth - 120, y: window.innerHeight - 150 });
    const [direction, setDirection] = useState(1);

    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (securityStatus === 'secure') {
            setMessage('🔒 加密保護中');
        } else if (securityStatus === 'decrypt_error') {
            setMessage('⚠️ 解密異常');
        } else {
            setMessage('✨ 準備就緒');
        }
    }, [securityStatus]);

    useEffect(() => {
        if (!isWalking || isDragging) return;

        const moveInterval = setInterval(() => {
            setPosition(prev => {
                let newX = prev.x + (Math.random() * 20 - 10);
                let newY = prev.y + (Math.random() * 16 - 8);

                const maxX = window.innerWidth - 80;
                const maxY = window.innerHeight - 100;

                if (newX < 20) { newX = 20; setDirection(1); }
                if (newX > maxX) { newX = maxX; setDirection(-1); }
                if (newY < 20) { newY = 20; }
                if (newY > maxY) { newY = maxY; }

                return { x: newX, y: newY };
            });
        }, 2500);

        return () => clearInterval(moveInterval);
    }, [isWalking, isDragging]);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setIsWalking(false);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;

            let newX = e.clientX - dragOffset.current.x;
            let newY = e.clientY - dragOffset.current.y;

            const maxX = window.innerWidth - 80;
            const maxY = window.innerHeight - 100;

            if (newX < 10) newX = 10;
            if (newX > maxX) newX = maxX;
            if (newY < 10) newY = 10;
            if (newY > maxY) newY = maxY;

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                setTimeout(() => setIsWalking(true), 2000);
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div 
            onMouseDown={handleMouseDown}
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                transition: isDragging ? 'none' : 'left 2s ease-in-out, top 2s ease-in-out'
            }}
            title="按住滑鼠左鍵可以拖曳桌寵喔！"
        >
            <div style={{
                background: 'rgba(30, 41, 59, 0.9)',
                backdropFilter: 'blur(8px)',
                color: '#f8fafc',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '11px',
                marginBottom: '6px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
            }}>
                {message}
            </div>

            <div 
                style={{
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: `scaleX(${direction === 1 ? 1 : -1}) translateY(${isWalking && !isDragging ? '-4px' : '0px'})`,
                    animation: isWalking && !isDragging ? 'bouncePet 1.5s infinite ease-in-out' : 'none',
                    filter: 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.4))'
                }}
            >
                {/* 💡 直接讀取 public 資料夾底下的圖片，免去 import 煩惱 */}
                <img 
                    src="/pet.jpg" 
                    alt="Desktop Pet" 
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none'
                    }} 
                />
            </div>

            <style>{`
                @keyframes bouncePet {
                    0%, 100% { transform: scaleX(${direction === 1 ? 1 : -1}) translateY(0px); }
                    50% { transform: scaleX(${direction === 1 ? 1 : -1}) translateY(-6px); }
                }
            `}</style>
        </div>
    );
}