import { apiClient, aiApiClient, longRunningApiClient } from "../api/client";

export interface PersonaInfo {
  persona_id?: string;
  tone?: string;
  audience?: string;
  industry?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  excerpt?: string;
  credibility_score?: number;
  published_at?: string;
}

export interface BlogResearchRequest {
  keywords: string[];
  topic?: string;
  industry?: string;
  target_audience?: string;
  tone?: string;
  word_count_target?: number;
  persona?: PersonaInfo;
}

export interface BlogResearchResponse {
  success: boolean;
  sources: ResearchSource[];
  keyword_analysis: Record<string, any>;
  competitor_analysis: Record<string, any>;
  suggested_angles: string[];
  search_widget?: string;
  search_queries?: string[];
  error_message?: string;
}

export interface BlogOutlineSection {
  id: string;
  heading: string;
  subheadings: string[];
  key_points: string[];
  references: ResearchSource[];
  target_words?: number;
  keywords: string[];
}

export interface BlogOutlineResponse {
  success: boolean;
  title_options: string[];
  outline: BlogOutlineSection[];
}

export interface BlogSectionResponse {
  success: boolean;
  markdown: string;
  citations: ResearchSource[];
  continuity_metrics?: { flow?: number; consistency?: number; progression?: number };
}

export interface BlogSEOAnalyzeResponse {
  success: boolean;
  seo_score: number;
  density: Record<string, any>;
  structure: Record<string, any>;
  readability: Record<string, any>;
  link_suggestions: any[];
  image_alt_status: Record<string, any>;
  recommendations: string[];
}

export interface BlogSEOMetadataResponse {
  success: boolean;
  title_options: string[];
  meta_descriptions: string[];
  open_graph: Record<string, any>;
  twitter_card: Record<string, any>;
  schema: Record<string, any>;
}

export interface BlogPublishResponse {
  success: boolean;
  platform: string;
  url?: string;
  post_id?: string;
}

export const blogWriterApi = {
  async research(payload: BlogResearchRequest): Promise<BlogResearchResponse> {
    // Use the direct research endpoint for simplicity
    const { data } = await apiClient.post("/api/blog/research", payload);
    return data;
  },

  async getContinuity(sectionId: string): Promise<{ section_id: string; continuity_metrics?: Record<string, number> }> {
    const { data } = await apiClient.get(`/api/blog/section/${encodeURIComponent(sectionId)}/continuity`);
    return data;
  },

  async generateOutline(payload: { research: BlogResearchResponse; persona?: PersonaInfo; word_count?: number; custom_instructions?: string }): Promise<BlogOutlineResponse> {
    // Use the direct outline generation endpoint
    const { data } = await apiClient.post("/api/blog/outline/generate", payload);
    return data;
  },

  async refineOutline(payload: { outline: BlogOutlineSection[]; operation: string; section_id?: string; payload?: any }): Promise<BlogOutlineResponse> {
    const { data } = await apiClient.post("/api/blog/outline/refine", payload);
    return data;
  },

  async generateSection(payload: { section: BlogOutlineSection; keywords?: string[]; tone?: string; persona?: PersonaInfo; mode?: 'draft' | 'polished' }): Promise<BlogSectionResponse> {
    const { data } = await apiClient.post("/api/blog/section/generate", payload);
    return data;
  },

  async seoAnalyze(payload: { content: string; keywords?: string[] }): Promise<BlogSEOAnalyzeResponse> {
    const { data } = await apiClient.post("/api/blog/seo/analyze", payload);
    return data;
  },

  async seoMetadata(payload: { content: string; title?: string; keywords?: string[] }): Promise<BlogSEOMetadataResponse> {
    const { data } = await apiClient.post("/api/blog/seo/metadata", payload);
    return data;
  },

  async publish(payload: { platform: 'wix' | 'wordpress'; html: string; metadata: BlogSEOMetadataResponse; schedule_time?: string }): Promise<BlogPublishResponse> {
    const { data } = await apiClient.post("/api/blog/publish", payload);
    return data;
  },

  // Enhanced Outline Methods
  async enhanceSection(section: BlogOutlineSection, focus: string = 'general improvement'): Promise<BlogOutlineSection> {
    const { data } = await apiClient.post("/api/blog/outline/enhance-section", section, {
      params: { focus }
    });
    return data;
  },

  async optimizeOutline(payload: { outline: BlogOutlineSection[] }, focus: string = 'general optimization'): Promise<{ outline: BlogOutlineSection[] }> {
    const { data } = await apiClient.post("/api/blog/outline/optimize", payload, {
      params: { focus }
    });
    return data;
  },

  async rebalanceOutline(payload: { outline: BlogOutlineSection[] }, targetWords: number = 1500): Promise<{ outline: BlogOutlineSection[] }> {
    const { data } = await apiClient.post("/api/blog/outline/rebalance", payload, {
      params: { target_words: targetWords }
    });
    return data;
  }
};


