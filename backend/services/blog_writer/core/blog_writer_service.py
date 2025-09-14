"""
Blog Writer Service - Main orchestrator for AI Blog Writer.

Coordinates research, outline generation, content creation, and optimization.
"""

from typing import Dict, Any, List
from loguru import logger

from models.blog_models import (
    BlogResearchRequest,
    BlogResearchResponse,
    BlogOutlineRequest,
    BlogOutlineResponse,
    BlogOutlineRefineRequest,
    BlogSectionRequest,
    BlogSectionResponse,
    BlogOptimizeRequest,
    BlogOptimizeResponse,
    BlogSEOAnalyzeRequest,
    BlogSEOAnalyzeResponse,
    BlogSEOMetadataRequest,
    BlogSEOMetadataResponse,
    BlogPublishRequest,
    BlogPublishResponse,
    BlogOutlineSection,
)

from ..research import ResearchService
from ..outline import OutlineService
from ..content.enhanced_content_generator import EnhancedContentGenerator


class BlogWriterService:
    """Main service orchestrator for AI Blog Writer functionality."""
    
    def __init__(self):
        self.research_service = ResearchService()
        self.outline_service = OutlineService()
        self.content_generator = EnhancedContentGenerator()
    
    # Research Methods
    async def research(self, request: BlogResearchRequest) -> BlogResearchResponse:
        """Conduct comprehensive research using Google Search grounding."""
        return await self.research_service.research(request)
    
    async def research_with_progress(self, request: BlogResearchRequest, task_id: str) -> BlogResearchResponse:
        """Conduct research with real-time progress updates."""
        return await self.research_service.research_with_progress(request, task_id)
    
    # Outline Methods
    async def generate_outline(self, request: BlogOutlineRequest) -> BlogOutlineResponse:
        """Generate AI-powered outline from research data."""
        return await self.outline_service.generate_outline(request)
    
    async def generate_outline_with_progress(self, request: BlogOutlineRequest, task_id: str) -> BlogOutlineResponse:
        """Generate outline with real-time progress updates."""
        return await self.outline_service.generate_outline_with_progress(request, task_id)
    
    async def refine_outline(self, request: BlogOutlineRefineRequest) -> BlogOutlineResponse:
        """Refine outline with HITL operations."""
        return await self.outline_service.refine_outline(request)
    
    async def enhance_section_with_ai(self, section: BlogOutlineSection, focus: str = "general improvement") -> BlogOutlineSection:
        """Enhance a section using AI."""
        return await self.outline_service.enhance_section_with_ai(section, focus)
    
    async def optimize_outline_with_ai(self, outline: List[BlogOutlineSection], focus: str = "general optimization") -> List[BlogOutlineSection]:
        """Optimize entire outline for better flow and SEO."""
        return await self.outline_service.optimize_outline_with_ai(outline, focus)
    
    def rebalance_word_counts(self, outline: List[BlogOutlineSection], target_words: int) -> List[BlogOutlineSection]:
        """Rebalance word count distribution across sections."""
        return self.outline_service.rebalance_word_counts(outline, target_words)
    
    # Content Generation Methods
    async def generate_section(self, request: BlogSectionRequest) -> BlogSectionResponse:
        """Generate section content from outline."""
        # Compose research-lite object with minimal continuity summary if available
        research_ctx: Any = getattr(request, 'research', None)
        try:
            ai_result = await self.content_generator.generate_section(
                section=request.section,
                research=research_ctx,
                mode=(request.mode or "polished"),
            )
            markdown = ai_result.get('content') or ai_result.get('markdown') or ''
            citations = []
            # Map basic citations from sources if present
            for s in ai_result.get('sources', [])[:5]:
                citations.append({
                    "title": s.get('title') if isinstance(s, dict) else getattr(s, 'title', ''),
                    "url": s.get('url') if isinstance(s, dict) else getattr(s, 'url', ''),
                })
            if not markdown:
                markdown = f"## {request.section.heading}\n\n(Generated content was empty.)"
            return BlogSectionResponse(
                success=True,
                markdown=markdown,
                citations=citations,
                continuity_metrics=ai_result.get('continuity_metrics')
            )
        except Exception as e:
            logger.error(f"Section generation failed: {e}")
            fallback = f"## {request.section.heading}\n\nThis section will cover: {', '.join(request.section.key_points)}."
            return BlogSectionResponse(success=False, markdown=fallback, citations=[])
    
    async def optimize_section(self, request: BlogOptimizeRequest) -> BlogOptimizeResponse:
        """Optimize section content for readability and SEO."""
        # TODO: Move to optimization module
        return BlogOptimizeResponse(success=True, optimized=request.content, diff_preview=None)
    
    # SEO and Analysis Methods (TODO: Extract to optimization module)
    async def hallucination_check(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Run hallucination detection on provided text."""
        text = str(payload.get("text", "") or "").strip()
        if not text:
            return {"success": False, "error": "No text provided"}

        # Prefer direct service use over HTTP proxy
        try:
            from services.hallucination_detector import HallucinationDetector
            detector = HallucinationDetector()
            result = await detector.detect_hallucinations(text)

            # Serialize dataclass-like result to dict
            claims = []
            for c in result.claims:
                claims.append({
                    "text": c.text,
                    "confidence": c.confidence,
                    "assessment": c.assessment,
                    "supporting_sources": c.supporting_sources,
                    "refuting_sources": c.refuting_sources,
                    "reasoning": c.reasoning,
                })

            return {
                "success": True,
                "overall_confidence": result.overall_confidence,
                "total_claims": result.total_claims,
                "supported_claims": result.supported_claims,
                "refuted_claims": result.refuted_claims,
                "insufficient_claims": result.insufficient_claims,
                "timestamp": result.timestamp,
                "claims": claims,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def seo_analyze(self, request: BlogSEOAnalyzeRequest) -> BlogSEOAnalyzeResponse:
        """Analyze content for SEO optimization."""
        from services.seo_tools.on_page_seo_service import OnPageSEOService
        from services.seo_tools.image_alt_service import ImageAltService
        from services.seo_tools.content_strategy_service import ContentStrategyService

        content = request.content or ""
        target_keywords = request.keywords or []

        # On-page analysis (treat content as a virtual URL/document for now)
        on_page = OnPageSEOService()
        on_page_result = await on_page.analyze_on_page_seo(url="about:blank", target_keywords=target_keywords)

        # Image alt coverage (placeholder: no images in raw content yet)
        try:
            image_alt_service = ImageAltService()
            image_alt_status = {"total_images": 0, "missing_alt": 0}
        except Exception:
            image_alt_status = {"total_images": 0, "missing_alt": 0}

        # Strategy hints (keywords/topics)
        try:
            strategy = ContentStrategyService()
            strategy_hints = await strategy.analyze_content_topics(content=content)
        except Exception:
            strategy_hints = {"topics": [], "gaps": []}

        # Lightweight markdown parsing for headings/links/keywords
        import re
        content_text = content or ""
        words = re.findall(r"[A-Za-z0-9']+", content_text)
        total_words = max(len(words), 1)
        heading_lines = content_text.splitlines()
        h1 = sum(1 for ln in heading_lines if ln.startswith('# '))
        h2 = sum(1 for ln in heading_lines if ln.startswith('## '))
        h3 = sum(1 for ln in heading_lines if ln.startswith('### '))
        md_links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", content_text)
        external_links = [u for (_t, u) in md_links if u.startswith('http')]

        # Keyword density
        density_map: Dict[str, Any] = {"target_keywords": target_keywords}
        for kw in target_keywords:
            try:
                occurrences = len(re.findall(re.escape(kw), content_text, flags=re.IGNORECASE))
            except re.error:
                occurrences = 0
            density_map[kw] = {
                "occurrences": occurrences,
                "density": round(occurrences / total_words, 4)
            }

        # Build unified response
        recommendations: List[str] = []
        if isinstance(on_page_result.get("recommendations"), list):
            recommendations.extend(on_page_result["recommendations"]) 
        if strategy_hints.get("gaps"):
            recommendations.append("Cover missing topics: " + ", ".join(strategy_hints["gaps"]))
        if not external_links:
            recommendations.append("Add at least one credible external link to authoritative sources.")
        if h2 < 2:
            recommendations.append("Increase number of H2 sections for better structure.")

        # Internal link suggestions: generate anchors for H2s and propose cross-links
        def to_anchor(h: str) -> str:
            import re
            a = re.sub(r"[^a-z0-9\s-]", "", h.lower())
            a = re.sub(r"\s+", "-", a).strip('-')
            return a
        h2_headings = [ln[3:].strip() for ln in heading_lines if ln.startswith('## ')]
        anchors = [to_anchor(h) for h in h2_headings]
        internal_link_suggestions = []
        for i in range(len(anchors)-1):
            internal_link_suggestions.append({
                "from": h2_headings[i],
                "to": h2_headings[i+1],
                "anchor": f"#{anchors[i+1]}",
                "suggestion": f"Add internal link from '{h2_headings[i]}' to '{h2_headings[i+1]}'"
            })

        return BlogSEOAnalyzeResponse(
            success=True,
            seo_score=float(on_page_result.get("overall_score", 75)),
            density=density_map,
            structure={
                **on_page_result.get("heading_structure", {}),
                "markdown_headings": {"h1": h1, "h2": h2, "h3": h3},
                "links": {"total": len(md_links), "external": len(external_links)}
            },
            readability=on_page_result.get("content_analysis", {}),
            link_suggestions=([{"suggestion": "Add external citation links for key claims."}] if not external_links else []) + internal_link_suggestions,
            image_alt_status=image_alt_status,
            recommendations=recommendations,
        )

    async def seo_metadata(self, request: BlogSEOMetadataRequest) -> BlogSEOMetadataResponse:
        """Generate SEO metadata for content."""
        # TODO: Move to optimization module
        return BlogSEOMetadataResponse(
            success=True,
            title_options=[request.title or "Generated SEO Title"],
            meta_descriptions=["Compelling meta description..."],
            open_graph={"title": request.title or "OG Title", "image": ""},
            twitter_card={"card": "summary_large_image"},
            schema={"@type": "Article"},
        )

    async def publish(self, request: BlogPublishRequest) -> BlogPublishResponse:
        """Publish content to specified platform."""
        # TODO: Move to content module
        return BlogPublishResponse(success=True, platform=request.platform, url="https://example.com/post")
