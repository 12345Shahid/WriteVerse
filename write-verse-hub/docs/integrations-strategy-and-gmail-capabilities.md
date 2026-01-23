# Integrations Strategy (29+ Apps) and Gmail Capabilities

## Integration enablement approaches

### Option A: Per-integration intent detection (deterministic routes)

**Summary**
Implement explicit routing/intent checks per integration (e.g., Gmail inbox intent → Gmail tool execution), with tailored response formatting and guardrails per app.

**Tradeoffs**
- **Complexity**
  - Low–Medium to start
  - Grows roughly linearly with number of integrations (each app adds routing + edge cases)
- **Time-to-ship**
  - Fast initial progress for a handful of key integrations
- **Reliability**
  - High for the intents you implement (deterministic behavior)
- **Customization / UX**
  - Excellent (per-app, per-intent response formatting and UX)
- **Safety / risk control**
  - Easier to enforce app-specific policies (e.g., read-only initially)
- **Maintenance**
  - Higher long-term, because behavior is distributed across many app-specific branches

**Best when**
- A small set of integrations needs a polished, deterministic experience
- You want strong predictability and clear guardrails

---

### Option B: Generic tool router (one unified routing + execution system)

**Summary**
Build a general tool-routing layer that can select tools across many integrations, fill parameters, execute tools, and summarize results with policy controls.

**Tradeoffs**
- **Complexity**
  - Medium–High upfront (selection, schema filling, error recovery, policies, confirmations)
- **Time-to-ship**
  - Slower initially, but scales much better once the router exists
- **Reliability**
  - Medium by default; can become high with good scoring + constraints + evaluations
- **Customization / UX**
  - Good but generic unless you add per-app adapters
- **Safety / risk control**
  - Must be designed carefully (especially for “write” actions)
- **Maintenance**
  - Lower long-term because improvements benefit all integrations

**Best when**
- You want broad coverage of many integrations
- You can invest in a robust safety + tool selection + parameter mapping layer

---

### Recommended approach: Hybrid

**Practical recommendation**
- Use **deterministic (per-integration) routes** for the top high-value apps (e.g., Gmail, Calendar, Drive/Docs, Slack/Teams, Sheets).
- Use a **generic tool router** for the “long tail” integrations.

**Why this works well**
- Ships quickly and gives an excellent UX for the most-used integrations
- Still scales to many integrations without adding 29 bespoke codepaths
- Lets you enforce strict “read-only” behavior early, then gradually enable write actions with confirmations

---

## Gmail capabilities: read vs draft vs send

### Can the agent only read Gmail?
Not necessarily. In most setups, Gmail integrations can support:
- **Read/list/search** (inbox, unread, recent)
- **Draft creation**
- **Send email**

### Why you may currently see only “read” behavior
This is typically due to **application code policy**, not a hard provider limitation:
- The system can intentionally route only to “read/list/search” actions for safety.
- Tool selection can also intentionally down-rank or block “send/draft” tools.

### Is it a provider limitation (Composio) or our code?
Most commonly:
- **Our code/policy limitation**: not enabling or routing to send/draft tools.
Sometimes:
- **Provider/config limitation**: OAuth scopes/config for Gmail may not include sending/drafting permissions, depending on the provider configuration.

### Is it solvable? What work is required?
Usually **yes**, it’s solvable.

**Work types**
- **Coding work**
  - Add intent routing for draft/send, or allow the tool router to select those tools
  - Add parameter extraction + validation (to/from/subject/body)
  - Add safety flows (confirmations, preview, policy checks)
- **Manual/config work (may be required)**
  - Ensure the Gmail OAuth auth config is set up with the required scopes in the integration provider setup
  - Possibly reconnect the Gmail account so the updated scopes are granted

### Implementation paths (compared)

#### Path 1: Draft-only first (recommended)
- **Pros**
  - Safest: user can review draft
  - Easy to add confirmation UX (“Here is the draft. Send?”)
- **Cons**
  - One extra step vs direct send

#### Path 2: Two-step send with confirmation
- **Pros**
  - Still safe
  - Good UX for sending with a confirmation gate
- **Cons**
  - More state management (need to keep draft/content in session)

#### Path 3: Direct send (not recommended initially)
- **Pros**
  - Fastest flow
- **Cons**
  - Highest risk: wrong recipient/body extraction has real-world consequences

---

## Suggested rollout plan (high level)

1. **Read-only integrations**
   - Enable/verify read/list/search flows and stable parameter defaults
2. **Draft capability**
   - Add “create draft” + show preview + require explicit confirmation
3. **Send capability**
   - Require explicit confirmation + safety rules (allowed recipients/domains, etc.)
4. **Broader integration router**
   - Expand router coverage across more apps, still with strict policy constraints
