"""
Podcast Context Builder Service

Builds unified context for AI prompts from multiple sources:
- Podcast Bible (user personalization)
- Website Extraction (from Exa)
- Topic Context (category research: News/Finance)
"""

from typing import Dict, Any, Optional, List
from loguru import logger


class PodcastContextBuilder:
    """Builds unified context for AI prompt enhancements."""
    
    def build_enhance_context(
        self,
        idea: str,
        bible_context: str = "",
        website_data: Optional[Dict[str, Any]] = None,
        topic_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Build context for topic enhancement prompt.
        
        Args:
            idea: Raw podcast idea/keywords
            bible_context: Serialized Podcast Bible string
            website_data: Website extraction data (title, summary, highlights, url, subpages)
            topic_context: Category research data (category, topics, selected_topic)
            
        Returns:
            Dict with:
                - prompt: The formatted prompt
                - contexts_used: List of context types being used
                - context_description: Human-readable description for logging
        """
        contexts_used = []
        context_parts = []
        
        # Track what contexts are available
        if bible_context:
            contexts_used.append("Podcast Bible")
            
        if website_data:
            contexts_used.append("Website Analysis")
            
        if topic_context:
            category = topic_context.get("category", "unknown")
            contexts_used.append(f"Category Research ({category})")
        
        # Build Bible section
        if bible_context:
            context_parts.append(f"USER PERSONALIZATION CONTEXT (Podcast Bible):\n{bible_context}")
        
        # Build Website section
        if website_data:
            website_section = self._format_website_section(website_data)
            context_parts.append(website_section)
        
        # Build Topic/Category section
        if topic_context:
            topic_section = self._format_topic_section(topic_context)
            context_parts.append(topic_section)
        
        # Select appropriate prompt template based on available context
        prompt = self._select_prompt(idea, context_parts, website_data, topic_context)
        
        return {
            "prompt": prompt,
            "contexts_used": contexts_used,
            "context_description": ", ".join(contexts_used) if contexts_used else "basic idea only",
        }
    
    def _format_website_section(self, website_data: Dict[str, Any]) -> str:
        """Format website data for prompt inclusion."""
        parts = []
        
        if website_data.get("url"):
            parts.append(f"Source URL: {website_data['url']}")
        
        if website_data.get("title"):
            parts.append(f"Company/Organization: {website_data['title']}")
        
        if website_data.get("summary"):
            parts.append(f"About: {website_data['summary']}")
        
        if website_data.get("highlights"):
            highlights = website_data.get("highlights", [])
            if highlights:
                parts.append(f"Key Highlights: {', '.join(highlights[:3])}")
        
        if website_data.get("subpages"):
            subpages = website_data.get("subpages", [])
            if subpages:
                subpage_titles = [sp.get("title", sp.get("url", "")) for sp in subpages[:3]]
                parts.append(f"Subpages: {', '.join(subpage_titles)}")
        
        return "WEBSITE CONTENT ANALYSIS:\n" + "\n".join(parts)
    
    def _format_topic_section(self, topic_context: Dict[str, Any]) -> str:
        """Format category research data for prompt inclusion."""
        parts = []
        
        category = topic_context.get("category", "")
        if category:
            parts.append(f"Research Category: {category.upper()}")
        
        # Include selected topic details
        selected = topic_context.get("selected_topic", {})
        if selected:
            if selected.get("title"):
                parts.append(f"Selected Topic: {selected['title']}")
            if selected.get("snippet"):
                parts.append(f"Context: {selected['snippet']}")
            if selected.get("url"):
                parts.append(f"Source: {selected['url']}")
        
        # Include some alternative topics for reference
        topics = topic_context.get("topics", [])
        if topics:
            alt_titles = [t.get("title", "") for t in topics[:3] if t.get("title")]
            if alt_titles:
                parts.append(f"Related Topics: {', '.join(alt_titles)}")
        
        return "CATEGORY RESEARCH CONTEXT:\n" + "\n".join(parts)
    
    def _select_prompt(
        self,
        idea: str,
        context_parts: List[str],
        website_data: Optional[Dict[str, Any]],
        topic_context: Optional[Dict[str, Any]],
    ) -> str:
        """Select and format the appropriate prompt based on available context."""
        
        context_str = "\n\n".join(context_parts)
        
        # Full context prompt (all sources available)
        if website_data and topic_context:
            return f"""You are a creative podcast producer. Generate 3 distinct, compelling podcast episode concepts from the raw idea, enriched with website content analysis AND category research.

{context_str}

RAW IDEA/KEYWORDS: "{idea}"

TASK:
Generate 3 different enhanced versions that INCORPORATE both the website content AND category research context:
1. Professional & Expert-led angle (leverage website authority + research insights)
2. Storytelling & Human interest angle (brand narratives + research findings)
3. Trendy & Contemporary angle (current trends + research relevance)

Each version should:
- Be 2-3 sentences
- Reference specific elements from both website AND research when relevant
- Be audience-focused and align with host persona if provided
- NOT just repeat summaries - create fresh podcast angles

Return JSON with:
- enhanced_ideas: array of 3 strings (each a complete episode pitch)
- rationales: array of 3 strings explaining each approach

Example format:
{{
  "enhanced_ideas": ["Pitch 1...", "Pitch 2...", "Pitch 3..."],
  "rationales": ["Reason 1", "Reason 2", "Reason 3"]
}}
"""
        
        # Website-only context
        elif website_data:
            return f"""You are a creative podcast producer. Generate 3 distinct, compelling podcast episode concepts from the raw idea, enriched with website content analysis.

{context_str}

RAW IDEA/KEYWORDS: "{idea}"

TASK:
Generate 3 different enhanced versions that INCORPORATE the website content:
1. Professional & Expert-led angle (focus on authority, insights from website)
2. Storytelling & Human interest angle (brand narratives, personal connections)
3. Trendy & Contemporary angle (modern perspectives, current relevance)

Each version should:
- Be 2-3 sentences
- Reference specific elements from the website when relevant
- Be audience-focused and align with host persona if provided

Return JSON with:
- enhanced_ideas: array of 3 strings
- rationales: array of 3 strings

Example format:
{{
  "enhanced_ideas": ["Pitch 1...", "Pitch 2...", "Pitch 3..."],
  "rationales": ["Reason 1", "Reason 2", "Reason 3"]
}}
"""
        
        # Category research only context
        elif topic_context:
            category = topic_context.get("category", "research").upper()
            return f"""You are a creative podcast producer. Generate 3 distinct, compelling podcast episode concepts from the raw idea, enriched with {category} category research.

{context_str}

RAW IDEA/KEYWORDS: "{idea}"

TASK:
Generate 3 different enhanced versions that INCORPORATE the {category} research:
1. Professional & Expert-led angle (leverage research insights and data)
2. Storytelling & Human interest angle (real-world applications, human impact)
3. Trendy & Contemporary angle (cutting-edge trends, future outlook)

Each version should:
- Be 2-3 sentences
- Reference specific elements from the research when relevant
- Connect the research to the raw idea meaningfully

Return JSON with:
- enhanced_ideas: array of 3 strings
- rationales: array of 3 strings

Example format:
{{
  "enhanced_ideas": ["Pitch 1...", "Pitch 2...", "Pitch 3..."],
  "rationales": ["Reason 1", "Reason 2", "Reason 3"]
}}
"""
        
        # Standard context (no additional context)
        else:
            return f"""You are a creative podcast producer. Generate 3 distinct, compelling podcast episode concepts from the raw idea.

{context_str}

RAW IDEA/KEYWORDS: "{idea}"

TASK:
Generate 3 different enhanced versions with unique angles:
1. Professional & Expert-led angle (focus on authority, insights)
2. Storytelling & Human interest angle (focus on narratives, emotions)
3. Trendy & Contemporary angle (focus on trends, modern relevance)

Each version should be 2-3 sentences, audience-focused.

Return JSON with:
- enhanced_ideas: array of 3 strings
- rationales: array of 3 strings

Example format:
{{
  "enhanced_ideas": ["Pitch 1...", "Pitch 2...", "Pitch 3..."],
  "rationales": ["Reason 1", "Reason 2", "Reason 3"]
}}
"""
    
    def format_context_for_logging(
        self,
        website_data: Optional[Dict] = None,
        topic_context: Optional[Dict] = None,
    ) -> str:
        """Format context description for logging."""
        contexts = []
        
        if website_data:
            title = website_data.get("title", "Unknown")
            contexts.append(f"Website: {title[:30]}...")
        
        if topic_context:
            category = topic_context.get("category", "unknown")
            selected = topic_context.get("selected_topic", {})
            topic_title = selected.get("title", "Not selected")
            contexts.append(f"Category: {category} ({topic_title[:20]}...)")
        
        return " | ".join(contexts) if contexts else "No extended context"


# Singleton instance for reuse
context_builder = PodcastContextBuilder()