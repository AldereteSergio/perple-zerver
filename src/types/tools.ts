/**
 * Tool arguments and results type definitions
 */

// ─── SEARCH ENGINE INTERFACE ──────────────────────────────────────────
export interface ISearchEngine {
  performSearch(query: string, model?: string): Promise<string>;
  listAvailableModels(): Promise<string[]>;
}

// ─── TOOL HANDLER TYPES ───────────────────────────────────────────────
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface ToolHandlersRegistry {
  test_tool?: ToolHandler;
  existing_tool?: ToolHandler;
  failing_tool?: ToolHandler;
  timeout_tool?: ToolHandler;
  chat_perplexity?: ToolHandler;
  get_documentation?: ToolHandler;
  find_apis?: ToolHandler;
  check_deprecated_code?: ToolHandler;
  search?: ToolHandler;
  extract_url_content?: ToolHandler;
  // Allow additional tools via index signature
  [key: string]: ToolHandler | undefined;
}

// ─── TOOL ARGUMENT TYPES ──────────────────────────────────────────────
export interface ListAvailableModelsArgs {}

export interface ChatPerplexityArgs {
  message: string;
  chat_id?: string;
  model?: string;
}

export interface ExtractUrlContentArgs {
  url: string;
  depth?: number;
}

export interface GetDocumentationArgs {
  query: string;
  context?: string;
}

export interface FindApisArgs {
  requirement: string;
  context?: string;
}

export interface CheckDeprecatedCodeArgs {
  code: string;
  technology?: string;
}

export interface SearchArgs {
  query: string;
  detail_level?: "brief" | "normal" | "detailed";
  model?: string;
}

// ─── UNION TYPES ──────────────────────────────────────────────────────
export type ToolArgs =
  | ListAvailableModelsArgs
  | ChatPerplexityArgs
  | ExtractUrlContentArgs
  | GetDocumentationArgs
  | FindApisArgs
  | CheckDeprecatedCodeArgs
  | SearchArgs;
