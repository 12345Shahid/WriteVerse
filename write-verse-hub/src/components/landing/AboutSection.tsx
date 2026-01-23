/* ===========================================================
   About Section Component (Ported)
   =========================================================== */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Robot, TreeStructure, Books, Microphone, Users } from '@phosphor-icons/react';
// Correct path to copied assets
import collectiveIntelligence from '@/assets/collective-intelligence.png';

gsap.registerPlugin(ScrollTrigger);

const BIO_TEXT = `WriteVerse Hub is the world's most feature-rich AI writing platform. 
Unite custom AI agents, multi-step workflows, and a shared knowledge base to automate 
your entire content pipeline—from research to final polished draft.`;

const FEATURES = [
  { icon: Robot, label: 'Custom Agents' },
  { icon: TreeStructure, label: 'Workflows' },
  { icon: Books, label: 'Knowledge Base' },
  { icon: Microphone, label: 'Brand Voice' },
  { icon: Users, label: 'Team Analytics' },
];

const AboutSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(sectionRef.current,
        { opacity: 0, filter: 'blur(10px)' },
        {
          opacity: 1, filter: 'blur(0px)', duration: 1,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', end: 'top 50%', toggleActions: 'play none none reverse' }
        }
      );

      gsap.fromTo(imageRef.current,
        { opacity: 0, x: -100, filter: 'blur(10px)' },
        {
          opacity: 1, x: 0, filter: 'blur(0px)', duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none reverse' }
        }
      );

      gsap.fromTo(contentRef.current,
        { opacity: 0, x: 50 },
        {
          opacity: 1, x: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 60%', toggleActions: 'play none none reverse' }
        }
      );

      featureRefs.current.forEach((feature, index) => {
        if (feature) {
          gsap.fromTo(feature,
            { opacity: 0, y: 30, scale: 0.8 },
            {
              opacity: 1, y: 0, scale: 1, duration: 0.5, delay: index * 0.15, ease: 'back.out(1.5)',
              scrollTrigger: { trigger: sectionRef.current, start: 'top 50%', toggleActions: 'play none none reverse' }
            }
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="about" className="relative py-32 overflow-hidden" style={{ opacity: 0 }}>
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div ref={imageRef} className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-3xl transform scale-90 -z-10" />
            <div className="glass-card rounded-3xl p-4 neon-border">
              <img src={collectiveIntelligence} alt="Collective Intelligence" className="w-full h-auto rounded-2xl" />
            </div>
          </div>

          <div ref={contentRef}>
            <p className="text-primary text-sm font-medium tracking-widest uppercase mb-4">About Us</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Collective <span className="gradient-text">Intelligence</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-10">{BIO_TEXT}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {FEATURES.map((feature, index) => (
                <div key={feature.label} ref={(el) => (featureRefs.current[index] = el)}
                  className="glass-card rounded-xl p-4 text-center hover:glow-accent transition-all duration-300 group cursor-pointer">
                  <feature.icon size={32} weight="light" className="mx-auto mb-2 text-primary group-hover:text-accent transition-colors duration-300" />
                  <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-300">{feature.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
