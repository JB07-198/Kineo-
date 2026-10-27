import React, { useRef, useEffect } from 'react';
import { useKineoStore } from '../../store/useKineoStore';

export const Viewport2D: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { document } = useKineoStore();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ajustement de la taille du canvas
        const updateSize = () => {
            canvas.width = canvas.parentElement?.clientWidth || 800;
            canvas.height = canvas.parentElement?.clientHeight || 600;
        };
        updateSize();

        const width = canvas.width;
        const height = canvas.height;
        const originX = width / 2;
        const originY = height / 2;

        // Nettoyage de la zone de dessin
        ctx.clearRect(0, 0, width, height);

        // Dessin des axes X (rouge) et Y (vert)
        ctx.lineWidth = 2;

        // Axe X
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + 60, originY);
        ctx.stroke();

        // Axe Y
        ctx.beginPath();
        ctx.strokeStyle = '#22c55e';
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX, originY - 60);
        ctx.stroke();

        // Origine O (Bâti)
        ctx.beginPath();
        ctx.arc(originX, originY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Dessin des ancres du modèle JSON v3.0
        document.anchors.forEach((anchor) => {
            const posX = originX + anchor.position.x * 50;
            const posY = originY - anchor.position.y * 50;

            ctx.beginPath();
            ctx.arc(posX, posY, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#6366f1';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [document]);

    return (
        <div className="w-full h-full relative overflow-hidden bg-slate-950 flex items-center justify-center">
            <canvas ref={canvasRef} className="block w-full h-full" />
        </div>
    );
};