import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          window.clearInterval(interval);
          return 100;
        }
        return Math.min(p + Math.random() * 15 + 3, 100);
      });
    }, 200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const timeout = window.setTimeout(onComplete, 500);
      return () => window.clearTimeout(timeout);
    }
  }, [progress, onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.5 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.02 + 0.005,
      offset: Math.random() * Math.PI * 2
    }));
    let time = 0;
    let animId = 0;

    const animate = () => {
      time += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((star) => {
        const twinkle = Math.sin(time * star.speed + star.offset) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.opacity * twinkle})`;
        ctx.fill();
        if (star.size > 1.8) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200,220,255,${star.opacity * twinkle * 0.15})`;
          ctx.fill();
        }
      });
      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #0d1025 30%, #111830 60%, #0a0f1e 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <motion.div className="relative z-10 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <h1 className="text-5xl font-bold tracking-tight select-none">
          <span style={{ color: '#E74C3C' }}>Portal</span>
          <span style={{ color: '#FFFFFF' }}> Launcher</span>
        </h1>
        <motion.p className="text-sm text-white/40 mt-3 tracking-widest uppercase" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          Made by Portalrolls
        </motion.p>
      </motion.div>
      <motion.div className="relative z-10 w-72 mt-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: 'linear-gradient(90deg, #E74C3C, #EC7063, #E74C3C)', backgroundSize: '200% 100%' }}
            animate={{ width: `${progress}%`, backgroundPosition: ['0% 0%', '200% 0%'] }}
            transition={{ width: { duration: 0.2 }, backgroundPosition: { repeat: Infinity, duration: 2 } }}
          />
          <motion.div className="absolute inset-y-0 left-0 rounded-full blur-sm" style={{ background: '#E74C3C', opacity: 0.5 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.2 }} />
        </div>
        <p className="text-center text-xs text-white/30 mt-2">Loading... {Math.round(progress)}%</p>
      </motion.div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(231,76,60,0.15) 0%, transparent 70%)' }} />
    </motion.div>
  );
}
