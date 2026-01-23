/* ===========================================================
   WriteVerse Hub - Main Landing Page (Ported)
   =========================================================== */

import { useState, useEffect } from 'react';
import Preloader from '@/components/landing/Preloader';
import Navigation from '@/components/landing/Navigation';
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import ProjectsSection from '@/components/landing/ProjectsSection';
import ContactSection from '@/components/landing/ContactSection';
import Footer from '@/components/landing/Footer';

const Index = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  const handlePreloaderComplete = () => {
    setIsLoaded(true);
  };

  useEffect(() => {
    if (!isLoaded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLoaded]);

  return (
    <div className="landing-theme min-h-screen text-foreground relative">
      {!isLoaded && <Preloader onComplete={handlePreloaderComplete} />}

      <main className={`relative transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <Navigation />
        <HeroSection isLoaded={isLoaded} />
        <AboutSection />
        <ProjectsSection />
        <ContactSection />
        <Footer />
      </main>
    </div>
  );
};

export default Index;
