/* ===========================================================
   Navigation Component (Ported for Landing Page)
   =========================================================== */

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import gsap from 'gsap';
import { Link, useNavigate } from 'react-router-dom';

// ===== NAVIGATION LINKS =====
const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/features' }, // Mapped to UseCases page
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/#contact' },
];

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isOpen) {
      gsap.fromTo(
        '.mobile-nav-item',
        { opacity: 0, x: -30 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
          stagger: 0.1,
          ease: 'power3.out',
        }
      );
    }
  }, [isOpen]);

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'glass-card border-b border-white/10' // customized border for landing
            : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <a
              href="#hero"
              onClick={(e) => { e.preventDefault(); handleNavClick('#hero'); }}
              className="relative z-10 text-xl font-bold tracking-tight gradient-text"
            >
              WriteVerse Hub
            </a>
            
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                link.href.startsWith('/#') ? (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(link.href.replace('/', ''));
                    }}
                    className="text-muted-foreground hover:text-white transition-colors duration-300 text-sm font-medium tracking-wide"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="text-muted-foreground hover:text-white transition-colors duration-300 text-sm font-medium tracking-wide"
                  >
                    {link.label}
                  </Link>
                )
              ))}
              
              {/* App Links */}
              <Link
                to="/auth"
                className="text-muted-foreground hover:text-white transition-colors duration-300 text-sm font-medium tracking-wide"
              >
                Sign In
              </Link>

              <Link
                to="/auth"
                className="btn-glass text-sm"
              >
                Get Started
              </Link>
            </div>
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden relative z-10 p-2 text-foreground hover:text-primary transition-colors"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>
      
      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-all duration-500 ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
        
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8">
          {NAV_LINKS.map((link) => (
            link.href.startsWith('/#') ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href.replace('/', ''));
                }}
                className="mobile-nav-item text-3xl font-light text-foreground hover:text-primary transition-colors duration-300"
                style={{ opacity: 0 }}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setIsOpen(false)}
                className="mobile-nav-item text-3xl font-light text-foreground hover:text-primary transition-colors duration-300"
                style={{ opacity: 0 }}
              >
                {link.label}
              </Link>
            )
          ))}
          
          <Link
             to="/dashboard"
             className="mobile-nav-item btn-premium mt-8"
             style={{ opacity: 0 }}
          >
            Start Free Trial
          </Link>
        </div>
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
      </div>
    </>
  );
};

export default Navigation;
