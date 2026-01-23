/* ===========================================================
   Projects/Features Section Component (Ported)
   =========================================================== */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Import images from assets
import projectDashboard from '@/assets/project-dashboard.png';
import projectWorkflow from '@/assets/project-workflow.png';
import projectAgents from '@/assets/project-agents.png';
import projectKnowledge from '@/assets/project-knowledge.png';
import projectVoice from '@/assets/project-voice.png';
import projectChat from '@/assets/project-chat.png';

gsap.registerPlugin(ScrollTrigger);

const PROJECTS = [
  { id: 1, title: 'Dashboard', description: 'Real-time analytics and credit tracking for your entire team.', image: projectDashboard },
  { id: 2, title: 'Workflow Builder', description: 'Visual node-based editor for multi-step content automation.', image: projectWorkflow },
  { id: 3, title: 'Custom Agents', description: 'Create specialized AI agents tailored to your unique needs.', image: projectAgents },
  { id: 4, title: 'Knowledge Base', description: 'Train AI on your documents for context-aware responses.', image: projectKnowledge },
  { id: 5, title: 'Brand Voice', description: 'Calibrate tone and style for consistent brand messaging.', image: projectVoice },
  { id: 6, title: 'Team Chat', description: 'Collaborative AI workspace with real-time co-authoring.', image: projectChat },
];

const ProjectsSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(headerRef.current,
        { opacity: 0, y: 50, filter: 'blur(10px)' },
        {
          opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', toggleActions: 'play none none reverse' }
        }
      );

      cardRefs.current.forEach((card, index) => {
        if (card) {
          gsap.fromTo(card,
            { opacity: 0, y: 80, scale: 0.9 },
            {
              opacity: 1, y: 0, scale: 1, duration: 0.8, delay: index * 0.15, ease: 'power3.out',
              scrollTrigger: { trigger: cardsContainerRef.current, start: 'top 70%', toggleActions: 'play none none reverse' }
            }
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleCardHover = (card: HTMLDivElement | null, isHovering: boolean) => {
    if (card) {
      gsap.to(card, { y: isHovering ? -10 : 0, scale: isHovering ? 1.02 : 1, duration: 0.3, ease: 'power2.out' });
    }
  };

  return (
    <section ref={sectionRef} id="projects" className="relative py-32 overflow-hidden">
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div ref={headerRef} className="container mx-auto px-6 mb-16 text-center">
        <p className="text-primary text-sm font-medium tracking-widest uppercase mb-4">Platform Features</p>
        <h2 className="section-title text-4xl md:text-5xl lg:text-6xl mb-6">Powerful <span className="gradient-text">Capabilities</span></h2>
        <p className="section-subtitle">Everything you need to transform your content workflow with AI.</p>
      </div>

      <div ref={cardsContainerRef} className="relative">
        <div className="flex gap-6 px-6 pb-6 overflow-x-auto hide-scrollbar md:flex-wrap md:justify-center lg:overflow-visible">
          {PROJECTS.map((project, index) => (
            <div key={project.id} ref={(el) => (cardRefs.current[index] = el)}
              className="flex-shrink-0 w-[300px] md:w-[350px] feature-card group cursor-pointer"
              onMouseEnter={() => handleCardHover(cardRefs.current[index], true)}
              onMouseLeave={() => handleCardHover(cardRefs.current[index], false)}>
              <div className="relative mb-4 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
                <img src={project.image} alt={project.title} className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">{project.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{project.description}</p>
              <div className="mt-4 flex items-center text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Learn more <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProjectsSection;
