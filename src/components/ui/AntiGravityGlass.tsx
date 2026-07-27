import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { registerGlassRef } from '../../lib/GlassStore';

interface AntiGravityGlassProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

const AntiGravityGlass: React.FC<AntiGravityGlassProps> = ({ 
  children, 
  className = '', 
  interactive = true 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Register DOM element to be tracked by WebGL Core
  useEffect(() => {
    const unregister = registerGlassRef(containerRef);
    return () => unregister();
  }, []);

  // Framer Motion Spring Physics for 3D perspective
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 400, damping: 30 });
  const springY = useSpring(y, { stiffness: 400, damping: 30 });
  const rotateX = useTransform(springY, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(springX, [-0.5, 0.5], ["-7deg", "7deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: interactive ? rotateX : 0,
        rotateY: interactive ? rotateY : 0,
        transformStyle: "preserve-3d",
      }}
      className={`relative z-10 p-6 rounded-2xl border border-white/10 ${className}`}
    >
      {/* 
        IMPORTANT: Background is completely transparent so the WebGL MeshTransmissionMaterial underneath shows through.
        We only render the content and internal UI elements.
      */}
      <div style={{ transform: "translateZ(30px)" }}>
        {children}
      </div>
    </motion.div>
  );
};

export default AntiGravityGlass;
