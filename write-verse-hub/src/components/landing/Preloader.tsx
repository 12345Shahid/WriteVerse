/* ===========================================================
   Preloader Component (Ported)
   =========================================================== */

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface PreloaderProps {
  onComplete: () => void;
}

const LOADING_DURATION = 2;

const Preloader = ({ onComplete }: PreloaderProps) => {
  const preloaderRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.from(logoRef.current, {
        opacity: 0, y: 30, filter: 'blur(10px)', duration: 0.8, ease: 'power3.out',
      });
      
      tl.to(progressBarRef.current, {
        width: '100%', duration: LOADING_DURATION, ease: 'power2.out',
        onUpdate: function() {
          const progress = Math.round(this.progress() * 100);
          setPercent(progress);
        },
      });
      
      tl.to(preloaderRef.current, {
        opacity: 0, scale: 0.95, filter: 'blur(10px)', duration: 0.8, ease: 'power3.inOut',
        onComplete: () => {
          if (preloaderRef.current) { preloaderRef.current.style.display = 'none'; }
          onComplete();
        },
      });
    });
    
    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div ref={preloaderRef} className="preloader fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070e17]" aria-label="Loading WriteVerse Hub">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-primary/10 via-secondary/5 to-transparent blur-3xl pointer-events-none" />
      
      <div ref={logoRef} className="relative z-10 text-center">
        <h1 className="preloader-logo gradient-text text-4xl font-bold mb-8">WriteVerse Hub</h1>
        <p className="text-muted-foreground text-sm tracking-wider uppercase mb-8">Initializing Experience</p>
        <div className="progress-container w-[200px] h-[2px] bg-white/10 rounded-full overflow-hidden">
          <div ref={progressBarRef} className="progress-bar h-full w-0 bg-gradient-to-r from-cyan-500 to-purple-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
        </div>
        <span ref={percentRef} className="block mt-4 text-primary text-sm font-medium">{percent}%</span>
      </div>
    </div>
  );
};

export default Preloader;
