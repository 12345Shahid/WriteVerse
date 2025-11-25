export interface ToolConfig {
  id: string;
  label: string;
  path: string;
}

export interface ToolCategory {
  id: string;
  label: string;
  tools: ToolConfig[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "blog-articles",
    label: "Blog & Articles",
    tools: [
      { id: "blog-helper", label: "Blog Intros & Outlines", path: "/tools/blog-helper" },
    ],
  },
  {
    id: "longform-seo",
    label: "Long-form & SEO",
    tools: [
      { id: "blog-post", label: "Full Blog Post Writer", path: "/tools/blog-post" },
      { id: "article-from-outline", label: "Article From Outline", path: "/tools/article-from-outline" },
      { id: "seo-blog-optimizer", label: "SEO Blog Optimizer", path: "/tools/seo-blog-optimizer" },
    ],
  },
  {
    id: "copywriting",
    label: "Copywriting",
    tools: [
      { id: "copy-helper", label: "Copywriting Helper", path: "/tools/copy-helper" },
    ],
  },
  {
    id: "email-outreach",
    label: "Email & Outreach",
    tools: [
      { id: "email-subject", label: "Email Subject Lines", path: "/tools/email-subject" },
      { id: "cold-email", label: "Cold Emails", path: "/tools/cold-email" },
      { id: "cover-letter", label: "Cover Letter", path: "/tools/cover-letter" },
      { id: "email-writer", label: "Email Writer", path: "/tools/email-writer" },
    ],
  },
  {
    id: "career-hiring",
    label: "Career & Hiring",
    tools: [
      { id: "resume", label: "Resume Bullets", path: "/tools/resume" },
      { id: "job-description", label: "Job Descriptions", path: "/tools/job-description" },
    ],
  },
  {
    id: "product-sales",
    label: "Product & Sales",
    tools: [
      { id: "product-description", label: "Product Descriptions", path: "/tools/product-description" },
      { id: "social-ad", label: "Social Ad Copy", path: "/tools/social-ad" },
    ],
  },
  {
    id: "social-content",
    label: "Social & Content",
    tools: [
      { id: "linkedin", label: "LinkedIn Posts", path: "/tools/linkedin" },
      { id: "twitter-thread", label: "Twitter/X Thread", path: "/tools/twitter-thread" },
      { id: "script", label: "Script/Voiceover", path: "/tools/script" },
      { id: "social-helper", label: "Social Content Helper", path: "/tools/social-helper" },
    ],
  },
  {
    id: "editing-rewrite",
    label: "Editing & Rewrite",
    tools: [
      { id: "rewrite-helper", label: "Rewrite & Editing Helper", path: "/tools/rewrite-helper" },
    ],
  },
  {
    id: "longform-business",
    label: "Case Studies & Reports",
    tools: [
      { id: "case-study-writer", label: "Case Study Writer", path: "/tools/case-study-writer" },
      { id: "landing-page-writer", label: "Landing Page Writer", path: "/tools/landing-page-writer" },
      { id: "report-writer", label: "Report / Whitepaper Writer", path: "/tools/report-writer" },
    ],
  },
  {
    id: "utilities",
    label: "Utilities",
    tools: [
      { id: "summarizer", label: "Summarizer", path: "/tools/summarizer" },
      { id: "faq", label: "FAQ Generator", path: "/tools/faq" },
    ],
  },
];
