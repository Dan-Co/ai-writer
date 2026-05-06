"""
Website-aware prompts for podcast topic enhancement.

This module provides prompts for enhancing podcast topics with optional
website extraction data for richer context.
"""

from typing import Dict, Any, Optional
from string import Template


# Standard prompt for when no website data is available
STANDARD_ENHANCE_PROMPT = Template("""">You are a creative podcast producer. Generate 3 distinct, compelling podcast episode concepts from the raw idea.

${bible_context}

RAW IDEA/KEYWORDS: "$idea"

TASK:
Generate 3 different enhanced versions, each with a unique angle:
1. Professional & Expert-led angle (focus on authority, insights, and expertise)
2. Storytelling & Human interest angle (focus on narratives, emotions, and personal connections)
3. Trendy & Contemporary angle (focus on current trends, modern perspectives, and relevance)

Each version should be 2-3 sentences, audience-focused, and align with host persona if provided.

Return JSON with:
- enhanced_ideas: array of 3 strings, each string being a complete episode pitch (NOT objects, just plain strings)
- rationales: array of 3 strings explaining the approach for each version

IMPORTANT: enhanced_ideas must be an array of plain strings, NOT objects. Example:
{
  "enhanced_ideas": [
    "Your expert guide to AI advancement: A practical look at how AI is transforming industries...",
    "The human stories behind AI innovation: From Silicon Valley to your daily life...",
    "AI in 2026: What's trending and what's next in artificial intelligence..."
  ],
  "rationales": [
    "Professional approach focusing on expertise and authority",
    "Storytelling approach emphasizing human connection",
    "Contemporary approach highlighting current relevance"
  ]
}
""")


# Website-aware prompt for when website data is available
WEBSITE_AWARE_ENHANCE_PROMPT = Template("""">You are a creative podcast producer. Generate 3 distinct, compelling podcast episode concepts from the raw idea, enriched with website content analysis.

${bible_context}

WEBSITE CONTENT ANALYSIS:
${website_context}

RAW IDEA/KEYWORDS: "$idea"

TASK:
Generate 3 different enhanced versions, each with a unique angle, that INCORPORATE the website content context:
1. Professional & Expert-led angle (focus on authority, insights, and expertise from the website)
2. Storytelling & Human interest angle (focus on narratives, emotions, and personal connections tied to the brand)
3. Trendy & Contemporary angle (focus on current trends, modern perspectives, and relevance leveraging the site's focus areas)

Each version should:
- Be 2-3 sentences
- Reference specific elements from the website content when relevant
- Be audience-focused and align with host persona if provided
- NOT just repeat the website summary - create fresh podcast angles

Return JSON with:
- enhanced_ideas: array of 3 strings, each string being a complete episode pitch (NOT objects, just plain strings)
- rationales: array of 3 strings explaining the approach for each version

IMPORTANT: enhanced_ideas must be an array of plain strings, NOT objects. Example:
{
  "enhanced_ideas": [
    "Your expert guide to AI advancement: A practical look at how AI is transforming industries...",
    "The human stories behind AI innovation: From Silicon Valley to your daily life...",
    "AI in 2026: What's trending and what's next in artificial intelligence..."
  ],
  "rationales": [
    "Professional approach focusing on expertise and authority",
    "Storytelling approach emphasizing human connection",
    "Contemporary approach highlighting current relevance"
  ]
}
""")


def get_enhance_topic_prompt(
    idea: str,
    bible_context: str = "",
    website_data: Optional[Dict[str, Any]] = None
) -> str:
    """
    Returns the appropriate prompt based on available context.
    
    Args:
        idea: The raw podcast idea or keywords
        bible_context: Optional Podcast Bible context string
        website_data: Optional website extraction data
        
    Returns:
        Formatted prompt string with appropriate context
    """
    # Build bible context section
    bible_section = f"USER PERSONALIZATION CONTEXT (Podcast Bible):\n{bible_context}\n" if bible_context else ""
    
    if website_data:
        # Build website context section
        website_context_parts = []
        if website_data.get('url'):
            website_context_parts.append(f"Source: {website_data.get('url')}")
        if website_data.get('title'):
            website_context_parts.append(f"Company/Organization: {website_data.get('title')}")
        if website_data.get('summary'):
            website_context_parts.append(f"About: {website_data.get('summary')}")
        if website_data.get('highlights'):
            highlights_str = ', '.join(website_data.get('highlights', [])[:3])
            website_context_parts.append(f"Key Highlights: {highlights_str}")
        if website_data.get('subpages'):
            subpages_str = ', '.join([
                sp.get('title', sp.get('url', '')) 
                for sp in website_data.get('subpages', [])[:3]
            ])
            website_context_parts.append(f"Subpages: {subpages_str}")
        
        website_context_str = "\n".join(website_context_parts)
        
        return WEBSITE_AWARE_ENHANCE_PROMPT.substitute(
            idea=idea,
            bible_context=bible_section,
            website_context=website_context_str
        )
    else:
        return STANDARD_ENHANCE_PROMPT.substitute(
            idea=idea,
            bible_context=bible_section
        )


def format_website_context(website_data: Dict[str, Any]) -> str:
    """
    Format website data for inclusion in progress messages.
    
    Args:
        website_data: Website extraction data
        
    Returns:
        Formatted string describing what's being used
    """
    parts = []
    
    if website_data.get('title'):
        parts.append(f"• {website_data['title']}")
    
    if website_data.get('summary'):
        summary_preview = website_data['summary'][:100]
        parts.append(f"• Summary: {summary_preview}...")
    
    if website_data.get('highlights'):
        parts.append(f"• {len(website_data['highlights'])} key highlights")
    
    if website_data.get('subpages'):
        parts.append(f"• {len(website_data['subpages'])} subpages analyzed")
    
    if website_data.get('url'):
        parts.append(f"• Source: {website_data['url']}")
    
    return "\n".join(parts) if parts else "Basic website analysis"
    
    if website_data.get('title'):
        parts.append(f"• {website_data['title']}")
    
    if website_data.get('summary'):
        summary_preview = website_data['summary'][:100]
        parts.append(f"• Summary: {summary_preview}...")
    
    if website_data.get('highlights'):
        parts.append(f"• {len(website_data['highlights'])} key highlights")
    
    if website_data.get('subpages'):
        parts.append(f"• {len(website_data['subpages'])} subpages analyzed")
    
    if website_data.get('url'):
        parts.append(f"• Source: {website_data['url']}")
    
    return "\n".join(parts) if parts else "Basic website analysis"