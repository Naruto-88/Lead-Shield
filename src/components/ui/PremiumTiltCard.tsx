import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate, HTMLMotionProps } from 'framer-motion';

export interface PremiumTiltCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  interactive?: boolean;
}

const PremiumTiltCard = React.forwardRef<HTMLDivElement, PremiumTiltCardProps>(
  ({ children, className = '', interactive = true, ...rest }, ref) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isLarge, setIsLarge] = useState(false);

    const mergedRef = (node: HTMLDivElement) => {
      // @ts-ignore
      cardRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    useEffect(() => {
      if (!cardRef.current) return;
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          // If the card is larger than a typical widget, disable 3D tilt to prevent perspective clipping and runaway UI
          if (width > 650 || height > 500) {
            setIsLarge(true);
          } else {
            setIsLarge(false);
          }
        }
      });
      observer.observe(cardRef.current);
      return () => observer.disconnect();
    }, []);

    // Auto-detect if this is a popup, modal, or nested scroll area that shouldn't be 3D
    const isPopup = /(absolute|fixed|z-50|max-h-|overflow-y-auto|text-\[10px\])/.test(className);
    const shouldTilt = interactive && !isPopup && !isLarge;

    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseX = useMotionValue(-1000);
    const mouseY = useMotionValue(-1000);

    const springConfig = { damping: 22, stiffness: 180 };
    
    // Max rotation reduced to 3 degrees to prevent fields from "flying away" on hover
    const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [3, -3]), springConfig);
    const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-3, 3]), springConfig);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current || !shouldTilt) return;
      const rect = cardRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      const mouseXRaw = e.clientX - rect.left;
      const mouseYRaw = e.clientY - rect.top;
      
      const xPct = (mouseXRaw / width) - 0.5;
      const yPct = (mouseYRaw / height) - 0.5;
      
      x.set(xPct);
      y.set(yPct);
      mouseX.set(mouseXRaw);
      mouseY.set(mouseYRaw);
    };

    const handleMouseLeave = () => {
      if (!shouldTilt) return;
      x.set(0);
      y.set(0);
      mouseX.set(-1000);
      mouseY.set(-1000);
    };

    // 1. Layout classes apply to the perspective wrapper
    const layoutRegex = /(?:^|\s)((?:(?:sm|md|lg|xl|2xl):)?(?:col-span-\d+|row-span-\d+|w-[^\s]+|h-[^\s]+|m[trblxy]?-[^\s]+|absolute|fixed|relative|top-[^\s]+|bottom-[^\s]+|left-[^\s]+|right-[^\s]+|z-[^\s]+|inset-[^\s]+))(?=\s|$)/g;
    const layoutClasses = (className.match(layoutRegex) || []).join(' ');
    let remaining = className.replace(layoutRegex, ' ');

    // 2. Flex/Grid classes apply to the inner 3D content wrapper to format children correctly
    const flexRegex = /(?:^|\s)((?:(?:sm|md|lg|xl|2xl):)?(?:flex|flex-col|flex-row|justify-[^\s]+|items-[^\s]+|gap-[^\s]+|space-[^\s]+|grid|grid-cols-[^\s]+))(?=\s|$)/g;
    const flexClasses = (remaining.match(flexRegex) || []).join(' ');

    // 3. Aesthetic classes (padding, borders, bg, rounded) apply to the Glass Card
    const cardClasses = remaining.replace(flexRegex, ' ').replace(/\s+/g, ' ').trim();

    return (
      <div style={{ perspective: "2000px" }} className={`relative w-full h-full ${layoutClasses}`}>
        <motion.div
          ref={mergedRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            rotateX: shouldTilt ? rotateX : 0,
            rotateY: shouldTilt ? rotateY : 0,
            transformStyle: "preserve-3d",
            "--mouse-x": useMotionTemplate`${mouseX}px`,
            "--mouse-y": useMotionTemplate`${mouseY}px`,
          } as any}
          className={`glass-card premium-border-glow relative w-full h-full transition-all duration-300 ${cardClasses}`}
          {...rest}
        >
          <div className="glass-shine-overlay absolute inset-0 pointer-events-none z-0 rounded-[inherit]" />
          
          {/* Disable 3D translateZ if it's a popup to prevent layout/scroll breaking */}
          <div className={`relative z-10 w-full h-full ${shouldTilt ? 'premium-3d-content' : ''} ${flexClasses}`}>
            {children}
          </div>
        </motion.div>
      </div>
    );
  }
);

PremiumTiltCard.displayName = 'PremiumTiltCard';
export default PremiumTiltCard;
