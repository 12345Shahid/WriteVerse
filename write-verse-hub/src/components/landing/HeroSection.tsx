/* ===========================================================
   Hero Section Component (Ported)
   =========================================================== */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Link } from 'react-router-dom';

const HEADLINE = "WriteVerse Hub – The world’s most feature-rich AI writing platform";
const SUBTITLE = "Unite AI agents, workflows, and a shared knowledge base to automate your entire content pipeline.";
const CTA_TEXT = "Start Free Trial";
const SPLINE_URL = "https://my.spline.design/orb-0OdFe56nj2CjC0zB90fe6lbn/";

interface HeroSectionProps {
  isLoaded: boolean;
}

const HeroSection = ({ isLoaded }: HeroSectionProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const splineRef = useRef<HTMLDivElement>(null);
  const orbRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!isLoaded) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(headlineRef.current,
        { opacity: 0, y: 50, filter: 'blur(10px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1 }
      );

      tl.fromTo(subtitleRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8 },
        '-=0.5'
      );

      tl.fromTo(ctaRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.6 },
        '-=0.4'
      );

      tl.fromTo(splineRef.current,
        { opacity: 0, x: 100 },
        { opacity: 1, x: 0, duration: 1.2 },
        '-=1'
      );

      orbRefs.current.forEach((orb, index) => {
        if (orb) {
          gsap.to(orb, {
            y: -20,
            duration: 3 + index * 0.5,
            repeat: -1,
            yoyo: true,
            ease: 'power1.inOut',
            delay: index * 0.3,
          });
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [isLoaded]);

  const handleCtaHover = (isHovering: boolean) => {
    if (ctaRef.current) {
      gsap.to(ctaRef.current, {
        scale: isHovering ? 1.05 : 1,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  };

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div ref={splineRef} className="spline-container" style={{ opacity: 0 }}>
        <iframe src={SPLINE_URL} frameBorder="0" title="3D Background" loading="lazy" />
      </div>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[600px] pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl" />
      </div>

      <div ref={(el) => (orbRefs.current[0] = el)} className="absolute top-1/4 left-[15%] w-32 h-32 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div ref={(el) => (orbRefs.current[1] = el)} className="absolute top-1/3 right-[10%] w-48 h-48 rounded-full bg-secondary/15 blur-3xl pointer-events-none" />
      <div ref={(el) => (orbRefs.current[2] = el)} className="absolute bottom-1/4 left-[20%] w-24 h-24 rounded-full bg-accent/20 blur-2xl pointer-events-none" />
      <div ref={(el) => (orbRefs.current[3] = el)} className="absolute bottom-1/3 right-[25%] w-36 h-36 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="absolute inset-0 grid-background opacity-30 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-6 text-center">
        <p className="text-primary/80 text-sm font-medium tracking-widest uppercase mb-6" style={{ opacity: isLoaded ? 1 : 0 }}>
          Introducing
        </p>

        <h1 ref={headlineRef} className="section-title text-5xl md:text-6xl lg:text-7xl xl:text-8xl mb-6 text-foreground" style={{ opacity: 0 }}>
          <span className="gradient-text">{HEADLINE.split('–')[0]}</span>
          <br className="hidden sm:block" />
          <span className="text-foreground font-light">{HEADLINE.split('–')[1] || ''}</span>
        </h1>

        <p ref={subtitleRef} className="section-subtitle max-w-2xl mx-auto mb-10" style={{ opacity: 0 }}>
          {SUBTITLE}
        </p>

        <Link
          to="/auth"
          ref={ctaRef} // @ts-ignore
          className="btn-premium pulse-glow inline-flex"
          style={{ opacity: 0 }}
          onMouseEnter={() => handleCtaHover(true)}
          onMouseLeave={() => handleCtaHover(false)}
        >
          {CTA_TEXT}
        </Link>
      </div>
      
      <div className="absolute top-1/4 left-[10%] text-muted-foreground/10 text-6xl font-light pointer-events-none">×</div>
      <div className="absolute top-1/4 right-[10%] text-muted-foreground/10 text-6xl font-light pointer-events-none">×</div>
    </section>
  );
};

export default HeroSection;
