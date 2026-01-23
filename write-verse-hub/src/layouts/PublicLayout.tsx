import { ReactNode, useEffect } from 'react';
import Navigation from '@/components/landing/Navigation';
import Footer from '@/components/landing/Footer';

interface PublicLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

const PublicLayout = ({ children, showFooter = true }: PublicLayoutProps) => {
  // Ensure the body has the dark theme background to prevent flashes
  useEffect(() => {
    document.body.classList.add('landing-page-body');
    return () => {
      document.body.classList.remove('landing-page-body');
    };
  }, []);

  return (
    <div className="landing-theme min-h-screen flex flex-col relative text-foreground bg-background overflow-x-hidden">
      {/* Shared Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div className="absolute inset-0 bg-[#070e17]" /> 
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-primary/5 rounded-full blur-[100px] opacity-20" />
         <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px] opacity-20" />
      </div>

      <Navigation />
      
      <main className="flex-grow relative z-10 pt-24">
        {children}
      </main>

      {showFooter && <Footer />}
    </div>
  );
};

export default PublicLayout;
