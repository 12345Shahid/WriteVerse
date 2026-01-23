/* ===========================================================
   Contact/CTA Section Component (Ported)
   =========================================================== */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { InstagramLogo, LinkedinLogo, ArrowRight } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

const CTA_TITLE = "Ready to Transform Your Content Workflow?";
const CTA_SUBTITLE = "Join thousands of teams already using WriteVerse Hub to streamline their publishing process with AI-powered automation.";
const CTA_BUTTON = "Start Free Trial";
const SOCIAL_LINKS = [
  { icon: InstagramLogo, href: 'https://instagram.com', label: 'Instagram' },
  { icon: LinkedinLogo, href: 'https://linkedin.com', label: 'LinkedIn' },
];
const FEATURES = ['14-day free trial', 'No credit card required', 'Full access to all features', 'Cancel anytime'];

const ContactSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLAnchorElement>(null); // changed to anchor
  const socialRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(cardRef.current,
        { opacity: 0, y: 80, scale: 0.95 },
        {
          opacity: 1, y: 0, scale: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none reverse' }
        }
      );

      gsap.fromTo(contentRef.current,
        { opacity: 0, x: -50 },
        {
          opacity: 1, x: 0, duration: 0.8, delay: 0.3, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 60%', toggleActions: 'play none none reverse' }
        }
      );

      gsap.to(buttonRef.current, { scale: 1.02, duration: 1.5, repeat: -1, yoyo: true, ease: 'power1.inOut' });

      socialRefs.current.forEach((social, index) => {
        if (social) {
          gsap.fromTo(social,
            { opacity: 0, y: 20 },
            {
              opacity: 1, y: 0, duration: 0.5, delay: 0.5 + index * 0.1, ease: 'power3.out',
              scrollTrigger: { trigger: sectionRef.current, start: 'top 50%', toggleActions: 'play none none reverse' }
            }
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleButtonHover = (isHovering: boolean) => {
    if (buttonRef.current) {
      gsap.to(buttonRef.current, { scale: isHovering ? 1.08 : 1, duration: 0.3, ease: 'back.out(1.5)' });
    }
  };

  return (
    <section ref={sectionRef} id="contact" className="relative py-32 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6">
        <div ref={cardRef} className="glass-card rounded-3xl p-8 md:p-12 lg:p-16 neon-border max-w-4xl mx-auto">
          <div ref={contentRef} className="text-center">
            <p className="text-primary text-sm font-medium tracking-widest uppercase mb-4">Get Started Today</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-foreground">
              {CTA_TITLE.split(' ').slice(0, 3).join(' ')}<br />
              <span className="gradient-text">{CTA_TITLE.split(' ').slice(3).join(' ')}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">{CTA_SUBTITLE}</p>

            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {FEATURES.map((feature) => (
                <span key={feature} className="glass-card px-4 py-2 rounded-full text-sm text-muted-foreground">✓ {feature}</span>
              ))}
            </div>

            <Link
              to="/auth"
              ref={buttonRef} // @ts-ignore
              className="btn-premium text-lg px-12 py-5 glow-primary inline-flex items-center"
              onMouseEnter={() => handleButtonHover(true)}
              onMouseLeave={() => handleButtonHover(false)}
            >
              {CTA_BUTTON}
              <ArrowRight size={20} weight="bold" className="ml-2 inline-block" />
            </Link>

            <div className="flex justify-center gap-4 mt-10">
              {SOCIAL_LINKS.map((social, index) => (
                <a key={social.label} ref={(el) => (socialRefs.current[index] = el)} href={social.href} target="_blank" rel="noopener noreferrer"
                  className="glass-card p-3 rounded-xl hover:glow-primary transition-all duration-300 group" aria-label={social.label}>
                  <social.icon size={24} weight="light" className="text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
