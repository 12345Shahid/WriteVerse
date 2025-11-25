# Phase 3: External Integrations & Upgrades

**Goal**: Upgrade selected tools with external APIs for better accuracy (SEO, grammar, plagiarism, translation, research) and implement blocked tools.

## 3.1 Identify & Choose Integrations

### Likely Candidates

#### **SEO**
*   **Features**: Keyword Generator, SEO Brief, Keyword Clusters, SERP Snippets.
*   **Integration**: Connect with an SEO API (e.g., DataForSEO, Ahrefs, Semrush, Serpstat).
    *   *Start with*: Read-only metrics (Search Volume, KD, CPC).
*   **Implementation Note**: DataForSEO is recommended for pay-as-you-go flexibility.

#### **Grammar / Quality**
*   **Features**: Grammar Correction, Improve Writing, Tone Changer.
*   **Integration**:
    *   Option A: Use robust LLM prompts (Gemini/GPT-4) for "AI Editing".
    *   Option B: Integrate dedicated APIs like LanguageTool or Grammarly (if specific scoring/branding is needed).

#### **Plagiarism Checker**
*   **Features**: Check content against the web.
*   **Integration**: Middleware to send text to a provider and present results.
*   **Providers**: Copyscape, Originality.ai, Unicheck.
*   **Constraint**: Requires external API; AI models alone cannot reliably check plagiarism.

#### **Translation**
*   **Features**: High-quality localization.
*   **Integration**: DeepL API or Google Translate API.
*   **Fallback**: Advanced LLM translation (often sufficient for many use cases).

#### **Research Summary**
*   **Features**: Fetch content from URLs, summarize, web search.
*   **Integration**:
    *   **Fetching**: Firecrawl, Browserless, or simple HTML fetchers.
    *   **Process**: Fetch HTML -> Parse Text -> Summarize via LLM.

## 3.2 Implementation Decisions (To Be Decided)
*   **Billing**: How to handle API costs? (Per-user limits vs. team billing).
*   **Rate Limits**: Caching strategy for SEO data to avoid API drain.
*   **Free Plans**: Which of these features are gated behind Pro/Premium?

## 3.3 Specific Tool Upgrades
*   **SEO Blog Optimizer**: Needs real keyword data to be truly effective.
*   **Case Study Writer**: Could benefit from web search to find real details about the client/company if provided.
