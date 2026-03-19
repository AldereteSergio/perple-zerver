/**
 * MCP Tool Schema Definitions
 * Comprehensive schemas for all available tools including descriptions, input/output schemas, examples, and metadata
 */

export const TOOL_SCHEMAS = [
  {
    name: "chat_perplexity",
    description:
      "Pepe's interactive chat mode. Use this for conversational queries, follow-up questions, and maintaining context across multiple turns. Pepe can use specific AI models and analyze attached files to give you the best answers.",
    category: "Conversation",
    keywords: ["pepe", "chat", "conversation", "dialog", "discussion", "advice", "brainstorm", "debug"],
    use_cases: [
      "Continuing multi-turn conversations with Pepe",
      "Context-aware question answering with specific models",
      "Analyzing files within a chat session",
    ],
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to send to Pepe for research.",
          examples: [
            "Pepe, explain quantum computing",
            "What do you think about the files I just uploaded?",
          ],
        },
        chat_id: {
          type: "string",
          description:
            "Optional: ID of an existing chat to continue. If not provided, Pepe starts a new one.",
          examples: ["123e4567-e89b-12d3-a456-426614174000"],
        },
        model: {
          type: "string",
          description:
            "Optional: The specific AI model Pepe should use (e.g., 'Claude Sonnet 4.6', 'GPT-5.4').",
          examples: ["Claude Sonnet 4.6", "GPT-5.4"],
        },
        attachments: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional: List of absolute file paths for Pepe to analyze.",
          examples: [["/home/user/document.pdf"]],
        },
      },
      required: ["message"],
    },
    examples: [
      {
        description: "Simple question",
        input: { message: "Explain quantum computing basics" },
        output: {
          chat_id: "new-chat-id",
          response: "Quantum computing uses qubits that can exist in superposition...",
        },
      },
      {
        description: "Continuing conversation",
        input: {
          message: "How does that compare to classical computing?",
          chat_id: "existing-chat-id",
        },
        output: {
          chat_id: "existing-chat-id",
          response: "Classical computers use bits that are either 0 or 1, while quantum...",
        },
      },
    ],
    related_tools: ["search", "get_documentation"],
  },
  {
    name: "extract_url_content",
    description:
      "Uses browser automation (Puppeteer) and Mozilla's Readability library to extract the main article text content from a given URL. Handles dynamic JavaScript rendering and includes fallback logic. For GitHub repository URLs, it attempts to fetch structured content via gitingest.com. Performs a pre-check for non-HTML content types and checks HTTP status after navigation. Ideal for getting clean text from articles/blog posts. **Note: May struggle to isolate only core content on complex homepages or dashboards, potentially including UI elements.**",
    category: "Information Extraction",
    keywords: [
      "extract",
      "url",
      "website",
      "content",
      "scrape",
      "summarize",
      "webpage",
      "fetch",
      "readability",
      "article",
      "dom",
      "puppeteer",
      "github",
      "gitingest",
      "repository",
    ],
    use_cases: [
      "Getting the main text of a news article or blog post.",
      "Summarizing web page content.",
      "Extracting documentation text.",
      "Providing website context to other models.",
    ],
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the website to extract content from.",
          examples: ["https://www.example.com/article"],
        },
        depth: {
          type: "number",
          description:
            "Optional: Maximum depth for recursive link exploration (1-5). Default is 1 (no recursion).",
          minimum: 1,
          maximum: 5,
          default: 1,
          examples: [1, 3],
        },
      },
      required: ["url"],
    },
    examples: [
      {
        description: "Successful extraction from an article",
        input: { url: "https://example-article-url.com" },
        output: {
          status: "Success",
          rootUrl: "https://example-article-url.com",
          explorationDepth: 1,
          pagesExplored: 1,
          content: [
            {
              url: "https://example-article-url.com",
              title: "Example Article Title",
              textContent: "The main body text of the article...",
            },
          ],
        },
      },
    ],
    related_tools: ["search", "get_documentation"],
  },
  {
    name: "get_documentation",
    description:
      'Automatically call this tool when working with unfamiliar APIs/libraries, needing usage examples, or checking version specifics as this can access web. Example: When adding a payment gateway, ask "Get Stripe API documentation for creating charges".',
    category: "Technical Reference",
    keywords: ["docs", "documentation", "api", "reference", "examples", "usage", "version"],
    use_cases: ["Learning new technologies", "API integration", "Troubleshooting code"],
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The technology, library, or API to get documentation for",
          examples: ["React hooks", "Python pandas", "REST API best practices"],
        },
        context: {
          type: "string",
          description: "Additional context or specific aspects to focus on",
          examples: ["focus on performance optimization", "include TypeScript examples"],
        },
      },
      required: ["query"],
    },
    examples: [
      {
        description: "Basic documentation request",
        input: { query: "React useEffect hook" },
        output: {
          response: "The useEffect hook lets you perform side effects in function components...",
        },
      },
    ],
    related_tools: ["search", "check_deprecated_code"],
  },
  {
    name: "find_apis",
    description:
      'Automatically call this tool when needing external services or real time current data (like API info, latest versions, etc.) from web. Compares options based on requirements. Example: When building a shopping site, ask "Find product image APIs with free tiers".',
    category: "API Discovery",
    keywords: ["api", "integration", "services", "endpoints", "sdk", "data", "external"],
    use_cases: [
      "Finding APIs for specific functionality",
      "Comparing API alternatives",
      "Evaluating API suitability",
    ],
    inputSchema: {
      type: "object",
      properties: {
        requirement: {
          type: "string",
          description: "The functionality or requirement you are looking to fulfill",
          examples: ["image recognition", "payment processing", "geolocation services"],
        },
        context: {
          type: "string",
          description: "Additional context about the project or specific needs",
          examples: ["prefer free tier options", "must support Python SDK"],
        },
      },
      required: ["requirement"],
    },
    examples: [
      {
        description: "Finding payment APIs",
        input: {
          requirement: "payment processing",
          context: "needs Stripe alternative",
        },
        output: {
          response: "PayPal offers global payment processing with 2.9% + $0.30 per transaction...",
        },
      },
    ],
    related_tools: ["get_documentation", "search"],
  },
  {
    name: "check_deprecated_code",
    description:
      "Automatically call this tool when reviewing legacy code, planning upgrades, or encountering warnings with real time web access. Helps identify technical debt. Example: During code reviews or before upgrading dependencies.",
    category: "Code Analysis",
    keywords: ["deprecation", "migration", "upgrade", "compatibility", "linting", "legacy", "debt"],
    use_cases: [
      "Preparing for technology upgrades",
      "Maintaining backward compatibility",
      "Identifying technical debt",
    ],
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The code snippet or dependency to check",
          examples: ["componentWillMount()", "var instead of let/const"],
        },
        technology: {
          type: "string",
          description: 'The technology or framework context (e.g., "React", "Node.js")',
          examples: ["React 16", "Python 2.7", "Node.js 12"],
        },
      },
      required: ["code"],
    },
    examples: [
      {
        description: "React lifecycle method deprecation",
        input: {
          code: "componentWillMount() {\n  // initialization code\n}",
          technology: "React",
        },
        output: {
          response:
            "componentWillMount is deprecated in React 17+. Use constructor or componentDidMount instead...",
        },
      },
    ],
    related_tools: ["get_documentation", "search"],
  },
  {
    name: "search",
    description:
      "Pepe's High-Density Web Research. MANDATORY FOR AGENT: Apply SCQA + First Principles. Deconstruct the user's request into atomic research points. Define Situation, Complication, and specific Objectives. Pepe is a raw browser executioner; your query must be a professional, structured research plan, not a simple question.",
    category: "Web Search",
    keywords: ["pepe", "search", "web", "internet", "query", "find", "information", "lookup"],
    use_cases: [
      "Answering general knowledge questions with Pepe's help.",
      "Finding specific information online using Pro models.",
      "Researching topics with attached documents.",
    ],
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query or question for Pepe.",
          examples: ["Pepe, what is the capital of France?", "Analyze this image for me"],
        },
        detail_level: {
          type: "string",
          enum: ["brief", "normal", "detailed"],
          description: "Optional: How much detail should Pepe provide (default: normal).",
          examples: ["brief", "detailed"],
        },
        model: {
          type: "string",
          description:
            "Optional: The specific AI model Pepe should use.",
          examples: ["Claude Sonnet 4.6", "GPT-5.4"],
        },
        attachments: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional: List of absolute file paths for Pepe to upload.",
          examples: [["/home/user/image.jpg"]],
        },
        stream: {
          type: "boolean",
          description:
            "Optional: Enable streaming response for a more dynamic experience (default: false).",
          examples: [true, false],
        },
      },
      required: ["query"],
    },
    examples: [
      {
        description: "Simple search query",
        input: { query: "What is the weather in London?" },
        output: { response: "The weather in London is currently..." },
      },
      {
        description: "Detailed search query",
        input: { query: "Explain the theory of relativity", detail_level: "detailed" },
        output: {
          response:
            "Albert Einstein's theory of relativity includes Special Relativity and General Relativity...",
        },
      },
    ],
    related_tools: ["chat_perplexity", "get_documentation", "find_apis"],
  },
  {
    name: "list_available_models",
    description:
      "Pepe lists all AI models currently available in your Perplexity Pro account. Use this to see which models Pepe can use for your searches (Claude, GPT, Gemini, etc.).",
    category: "Configuration",
    keywords: ["pepe", "models", "list", "available", "config", "options"],
    use_cases: ["Checking which models Pepe can use", "Verifying Pro account features"],
    inputSchema: {
      type: "object",
      properties: {},
    },
    examples: [
      {
        description: "Ask Pepe for available models",
        input: {},
        output: {
          models: ["Sonar", "GPT-5.4", "Claude Sonnet 4.6", "Gemini 3.1 Pro"],
        },
      },
    ],
    related_tools: ["search", "chat_perplexity"],
  },
  {
    name: "deep_research",
    description:
      "Pepe's intensive research mode. Performs a multi-step, deep investigation on complex topics. Pepe will explore more sources and provide a comprehensive report. Note: Pepe handles the model selection automatically in this mode.",
    category: "Web Search",
    keywords: ["pepe", "deep", "research", "comprehensive", "intensive", "thorough"],
    use_cases: [
      "In-depth market research with Pepe",
      "Complex technical investigations",
      "Comprehensive topic analysis by Pepe",
    ],
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The complex topic for Pepe to investigate deeply.",
          examples: ["Pepe, do a deep analysis of solid-state batteries future"],
        },
        attachments: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional: List of absolute file paths for Pepe's deep research.",
          examples: [["/home/user/data.csv"]],
        },
      },
      required: ["query"],
    },
    examples: [
      {
        description: "Pepe performing deep research",
        input: { query: "Investigate the impact of AI on software engineering productivity in 2025" },
        output: { response: "Detailed research report from Pepe..." },
      },
    ],
    related_tools: ["search", "chat_perplexity"],
  },
] as const;
