'use client';

import { useEffect, useRef } from 'react';

export function IPTVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 600;
    const height = 600;
    canvas.width = width;
    canvas.height = height;

    const centerX = width / 2;
    const centerY = height / 2;

    // Pillars (5 concentric circles)
    const pillars = [
      { radius: 80, opacity: 0.08 },
      { radius: 120, opacity: 0.1 },
      { radius: 160, opacity: 0.12 },
      { radius: 200, opacity: 0.14 },
      { radius: 240, opacity: 0.16 },
    ];

    // Central glow gradient
    const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 120);
    glowGradient.addColorStop(0, 'rgba(0, 255, 195, 0.2)');
    glowGradient.addColorStop(1, 'rgba(0, 255, 195, 0)');

    // Data points (350+ total)
    const dataPoints: Array<{ x: number; y: number; pillar: number }> = [];
    const totalDataPoints = 350; // 350+ data points
    const pointsPerPillar = Math.floor(totalDataPoints / 5);
    
    pillars.forEach((pillar, pillarIndex) => {
      const pointsForThisPillar = pillarIndex === 4 
        ? totalDataPoints - (pointsPerPillar * 4) // Last pillar gets remainder
        : pointsPerPillar;
      
      for (let i = 0; i < pointsForThisPillar; i++) {
        const angle = (Math.PI * 2 * i) / pointsForThisPillar + (pillarIndex * 0.3);
        const distance = pillar.radius + (Math.random() - 0.5) * 20;
        dataPoints.push({
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          pillar: pillarIndex,
        });
      }
    });

    let animationFrame = 0;
    let revealedPoints = 0;
    const totalPoints = dataPoints.length;
    const delay = 500; // 500ms delay before start
    let startTime: number | null = null;

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      if (!ctx) {
        requestAnimationFrame(animate);
        return;
      }
      const elapsed = timestamp - startTime;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw central glow
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
      ctx.fill();

      // Draw pillars (concentric circles)
      pillars.forEach((pillar) => {
        ctx.strokeStyle = `rgba(0, 255, 195, ${pillar.opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pillar.radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Progressive reveal of data points
      if (elapsed > delay) {
        revealedPoints = Math.min(
          totalPoints,
          Math.floor(((elapsed - delay) / 16) * 1) // 1 point per frame after delay
        );
      }

      // Draw data points
      for (let i = 0; i < revealedPoints; i++) {
        const point = dataPoints[i];
        ctx.fillStyle = 'rgba(0, 255, 195, 0.6)';
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0, 255, 195, 0.6)';
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;

      // Draw sparse connections (1 line per 20 points)
      if (revealedPoints > 20) {
        ctx.strokeStyle = 'rgba(0, 255, 195, 0.04)';
        ctx.lineWidth = 0.5;
        
        for (let i = 0; i < revealedPoints; i += 20) {
          const point = dataPoints[i];
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
      }

      if (revealedPoints < totalPoints || animationFrame % 60 === 0) {
        requestAnimationFrame(animate);
      }
      animationFrame++;
    }

    requestAnimationFrame(animate);

    return () => {
      startTime = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full max-w-[600px] max-h-[600px]"
      style={{ width: '100%', height: '100%' }}
      aria-label="Visualisation IPT - 5 piliers et 350+ points de données"
    />
  );
}








