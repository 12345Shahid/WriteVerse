import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Results from "./pages/Results";
import Dashboard from "./pages/Dashboard";
import EmailSubjectTool from "./pages/tools/EmailSubjectTool";
import ResumeTool from "./pages/tools/ResumeTool";
import ColdEmailTool from "./pages/tools/ColdEmailTool";
import ProductDescriptionTool from "./pages/tools/ProductDescriptionTool";
import JobDescriptionTool from "./pages/tools/JobDescriptionTool";
import LinkedInTool from "./pages/tools/LinkedInTool";
import SocialAdTool from "./pages/tools/SocialAdTool";
import SummarizerTool from "./pages/tools/SummarizerTool";
import CoverLetterTool from "./pages/tools/CoverLetterTool";
import TwitterThreadTool from "./pages/tools/TwitterThreadTool";
import FAQTool from "./pages/tools/FAQTool";
import ScriptTool from "./pages/tools/ScriptTool";
import NotFound from "./pages/NotFound";
import Features from "./pages/Features";
import About from "./pages/About";
import PublicShare from "./pages/PublicShare";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import DebugSentry from "./pages/DebugSentry";
import Pricing from "./pages/Pricing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/results" element={<Results />} />
          <Route path="/public/:slug" element={<PublicShare />} />
          <Route path="/features" element={<Features />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/debug/sentry" element={<DebugSentry />} />
          <Route path="/tools/email-subject" element={<EmailSubjectTool />} />
          <Route path="/tools/resume" element={<ResumeTool />} />
          <Route path="/tools/cold-email" element={<ColdEmailTool />} />
          <Route path="/tools/product-description" element={<ProductDescriptionTool />} />
          <Route path="/tools/job-description" element={<JobDescriptionTool />} />
          <Route path="/tools/linkedin" element={<LinkedInTool />} />
          <Route path="/tools/social-ad" element={<SocialAdTool />} />
          <Route path="/tools/summarizer" element={<SummarizerTool />} />
          <Route path="/tools/cover-letter" element={<CoverLetterTool />} />
          <Route path="/tools/twitter-thread" element={<TwitterThreadTool />} />
          <Route path="/tools/faq" element={<FAQTool />} />
          <Route path="/tools/script" element={<ScriptTool />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
