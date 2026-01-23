/* ===========================================================
   Footer Component (Ported)
   =========================================================== */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { InstagramLogo, LinkedinLogo } from '@phosphor-icons/react';

gsap.registerPlugin(ScrollTrigger);

const FOOTER_LINKS = [
  { label: 'Home', href: '#hero' },
  { label: 'About', href: '#about' },
  { label: 'Features', href: '#projects' },
  { label: 'Contact', href: '#contact' },
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
];

const SOCIAL_LINKS = [
  { icon: InstagramLogo, href: 'https://instagram.com', label: 'Instagram' },
  { icon: LinkedinLogo, href: 'https://linkedin.com', label: 'LinkedIn' },
];

const PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  size: Math.random() * 4 + 1,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  delay: Math.random() * 5,
  duration: 5 + Math.random() * 5,
}));

const Footer = () => {
  const footerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const particleRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(contentRef.current,
        { opacity: 0, y: 60, filter: 'blur(10px)' },
        {
          opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: footerRef.current, start: 'top 90%', toggleActions: 'play none none reverse' }
        }
      );

      particleRefs.current.forEach((particle, index) => {
        if (particle) {
          gsap.to(particle, {
            y: '-=30', x: `+=${Math.random() * 20 - 10}`, opacity: 0.8,
            duration: PARTICLES[index]?.duration || 5, repeat: -1, yoyo: true, ease: 'power1.inOut', delay: PARTICLES[index]?.delay || 0,
          });
        }
      });
    }, footerRef);

    return () => ctx.revert();
  }, []);

  const handleNavClick = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer ref={footerRef} className="relative py-16 overflow-hidden border-t border-border/10">
      <div className="absolute inset-0 pointer-events-none">
        {PARTICLES.map((particle, index) => (
          <div key={particle.id} ref={(el) => (particleRefs.current[index] = el)}
            className="absolute rounded-full bg-primary/20"
            style={{ width: `${particle.size}px`, height: `${particle.size}px`, left: particle.left, top: particle.top, opacity: 0.3 }} />
        ))}
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div ref={contentRef} className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col items-center">
          <a href="#hero" onClick={(e) => { e.preventDefault(); handleNavClick('#hero'); }} className="text-2xl font-bold gradient-text mb-8">
            WriteVerse Hub
          </a>

          <nav className="flex flex-wrap justify-center gap-6 mb-8">
            {FOOTER_LINKS.map((link) => (
              <a key={link.label} href={link.href} onClick={(e) => {
                if (link.href.startsWith('#')) { e.preventDefault(); handleNavClick(link.href); }
              }} className="text-muted-foreground hover:text-foreground transition-colors duration-300 text-sm">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex gap-4 mb-8">
            {SOCIAL_LINKS.map((social) => (
              <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer"
                className="glass-card p-3 rounded-xl hover:glow-primary transition-all duration-300 group" aria-label={social.label}>
                <social.icon size={20} weight="light" className="text-muted-foreground group-hover:text-primary transition-colors duration-300" />
              </a>
            ))}
          </div>

          <p className="text-muted-foreground/60 text-sm text-center">
            © {new Date().getFullYear()} WriteVerse Hub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
