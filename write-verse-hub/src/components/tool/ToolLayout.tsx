import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SiteNav } from "@/components/SiteNav";
import { BrandVoiceSelector } from "./BrandVoiceSelector";
import { ModelSelector } from "./ModelSelector";
import { NaturalWriteToggleInline } from "@/components/NaturalWriteToggle";
import { useNaturalWrite } from "@/context/NaturalWriteContext";

/**
 * Shared Tool Layout Component
 * 
 * This component provides a consistent layout for all tool pages.
 * It includes the header with navigation and a container for the tool content.
 * 
 * Props:
 * - children: The tool-specific content
 * - title: Tool name for the header
 * - description: Brief description of the tool
 * 
 * TODO for backend developer:
 * - Add user authentication state to header
 * - Show user avatar and logout button when logged in
 * - Track page views for analytics
 */

interface ToolLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
}

export const ToolLayout = ({ children, title, description }: ToolLayoutProps) => {
  const { enabled: naturalWriteEnabled, setEnabled: setNaturalWrite } = useNaturalWrite();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <SiteNav />

      {/* Tool Header */}
      <div className="border-b-4 border-black bg-muted">
        <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{title}</h1>
            <p className="text-lg font-medium text-muted-foreground">{description}</p>
          </div>
          <div className="shrink-0 flex flex-col md:flex-row items-end md:items-center gap-3">
            <NaturalWriteToggleInline enabled={naturalWriteEnabled} onToggle={setNaturalWrite} />
            <ModelSelector />
            <BrandVoiceSelector />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-black bg-background py-6 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="font-bold text-sm text-muted-foreground">
            © 2025 WriterAI • <Link to="/privacy" className="hover:text-primary">Privacy</Link> • <Link to="/terms" className="hover:text-primary">Terms</Link>
          </p>
        </div>
      </footer>
    </div>
  );
};
