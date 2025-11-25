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
import BlogHelperTool from "./pages/tools/BlogHelperTool";
import CopyHelperTool from "./pages/tools/CopyHelperTool";
import SocialHelperTool from "./pages/tools/SocialHelperTool";
import EmailWriterTool from "./pages/tools/EmailWriterTool";
import RewriteHelperTool from "./pages/tools/RewriteHelperTool";
import BlogPostTool from "./pages/tools/BlogPostTool";
import ArticleFromOutlineTool from "./pages/tools/ArticleFromOutlineTool";
import SeoBlogOptimizerTool from "./pages/tools/SeoBlogOptimizerTool";
import CaseStudyWriterTool from "./pages/tools/CaseStudyWriterTool";
import LandingPageWriterTool from "./pages/tools/LandingPageWriterTool";
import ReportWriterTool from "./pages/tools/ReportWriterTool";
import NotFound from "./pages/NotFound";
import Features from "./pages/Features";
import About from "./pages/About";
import PublicShare from "./pages/PublicShare";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

import { TeamProvider } from "./context/TeamContext";
import { BrandVoiceProvider } from "./context/BrandVoiceContext";
import TeamSettings from "./pages/settings/TeamSettings";
import SettingsHub from "./pages/settings/SettingsHub";
import TagsManager from "./pages/settings/TagsManager";
import JoinPage from "./pages/JoinPage";
import ProjectsList from "./pages/projects/ProjectsList";
import ProjectDetail from "./pages/projects/ProjectDetail";
import FileManager from "./pages/files/FileManager";
import TeamChat from "./pages/chat/TeamChat";
import Templates from "./pages/templates/Templates";
import TemplateBuilder from "./pages/templates/TemplateBuilder";
import TemplateRunner from "./pages/templates/TemplateRunner";
import BrandVoices from "./pages/brand-voice/BrandVoices";
import BrandVoiceBuilder from "./pages/brand-voice/BrandVoiceBuilder";
import WorkflowList from "./pages/workflows/WorkflowList";
import WorkflowBuilder from "./pages/workflows/WorkflowBuilder";
import WorkflowRunner from "./pages/workflows/WorkflowRunner";
import KnowledgeBase from "./pages/knowledge/KnowledgeBase";
import AgentList from "./pages/agents/AgentList";
import AgentBuilder from "./pages/agents/AgentBuilder";
import AgentChat from "./pages/agents/AgentChat";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TeamProvider>
        <BrandVoiceProvider>
          <BrowserRouter>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<SettingsHub />} />
            <Route path="/settings/team" element={<TeamSettings />} />
            <Route path="/settings/tags" element={<TagsManager />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/chat" element={<TeamChat />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/files" element={<FileManager />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/templates/new" element={<TemplateBuilder />} />
            <Route path="/templates/:id/edit" element={<TemplateBuilder />} />
            <Route path="/templates/:id/run" element={<TemplateRunner />} />
            <Route path="/brand-voice" element={<BrandVoices />} />
            <Route path="/brand-voice/new" element={<BrandVoiceBuilder />} />
            <Route path="/brand-voice/:id" element={<BrandVoiceBuilder />} />
            <Route path="/workflows" element={<WorkflowList />} />
            <Route path="/workflows/new" element={<WorkflowBuilder />} />
            <Route path="/workflows/:id/edit" element={<WorkflowBuilder />} />
            <Route path="/workflows/:id/run" element={<WorkflowRunner />} />
            <Route path="/knowledge" element={<KnowledgeBase />} />
            <Route path="/agents" element={<AgentList />} />
            <Route path="/agents/new" element={<AgentBuilder />} />
            <Route path="/agents/:id/edit" element={<AgentBuilder />} />
            <Route path="/agents/:id/chat" element={<AgentChat />} />
            <Route path="/results" element={<Results />} />
          <Route path="/public/:slug" element={<PublicShare />} />
          <Route path="/features" element={<Features />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
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
          <Route path="/tools/blog-helper" element={<BlogHelperTool />} />
          <Route path="/tools/copy-helper" element={<CopyHelperTool />} />
          <Route path="/tools/social-helper" element={<SocialHelperTool />} />
          <Route path="/tools/email-writer" element={<EmailWriterTool />} />
          <Route path="/tools/rewrite-helper" element={<RewriteHelperTool />} />
          <Route path="/tools/blog-post" element={<BlogPostTool />} />
          <Route path="/tools/article-from-outline" element={<ArticleFromOutlineTool />} />
          <Route path="/tools/seo-blog-optimizer" element={<SeoBlogOptimizerTool />} />
          <Route path="/tools/case-study-writer" element={<CaseStudyWriterTool />} />
          <Route path="/tools/landing-page-writer" element={<LandingPageWriterTool />} />
          <Route path="/tools/report-writer" element={<ReportWriterTool />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
          </BrowserRouter>
        </BrandVoiceProvider>
      </TeamProvider>
  </TooltipProvider>
</QueryClientProvider>
);

export default App;
