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
    ResearchSource,
)

from ..research import ResearchService
from ..outline import OutlineService
from ..content.enhanced_content_generator import EnhancedContentGenerator
from services.llm_providers.gemini_provider import gemini_structured_json_response
from services.cache.persistent_content_cache import persistent_content_cache
from models.blog_models import (
    MediumBlogGenerateRequest,
    MediumBlogGenerateResult,
    MediumGeneratedSection,
)


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

    async def generate_medium_blog_with_progress(self, req: MediumBlogGenerateRequest, task_id: str) -> MediumBlogGenerateResult:
        """Use Gemini structured JSON to generate a medium-length blog in one call."""
        import time
        start = time.time()

        # Prepare sections data for cache key generation
        sections_for_cache = []
        for s in req.sections:
            sections_for_cache.append({
                "id": s.id,
                "heading": s.heading,
                "keyPoints": getattr(s, "key_points", []) or getattr(s, "keyPoints", []),
                "subheadings": getattr(s, "subheadings", []),
                "keywords": getattr(s, "keywords", []),
                "targetWords": getattr(s, "target_words", None) or getattr(s, "targetWords", None),
            })

        # Check cache first
        cached_result = persistent_content_cache.get_cached_content(
            keywords=req.researchKeywords or [],
            sections=sections_for_cache,
            global_target_words=req.globalTargetWords or 1000,
            persona_data=req.persona.dict() if req.persona else None,
            tone=req.tone,
            audience=req.audience
        )
        
        if cached_result:
            logger.info(f"Using cached content for keywords: {req.researchKeywords} (saved expensive generation)")
            # Add cache hit marker to distinguish from fresh generation
            cached_result['generation_time_ms'] = 0  # Mark as cache hit
            cached_result['cache_hit'] = True
            return MediumBlogGenerateResult(**cached_result)

        # Cache miss - proceed with AI generation
        logger.info(f"Cache miss - generating new content for keywords: {req.researchKeywords}")

        # Build schema expected from the model
        schema = {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "sections": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "heading": {"type": "string"},
                            "content": {"type": "string"},
                            "wordCount": {"type": "number"},
                            "sources": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {"title": {"type": "string"}, "url": {"type": "string"}},
                                },
                            },
                        },
                    },
                },
            },
        }

        # Compose prompt
        def section_block(s):
            return {
                "id": s.id,
                "heading": s.heading,
                "outline": {
                    "keyPoints": getattr(s, "key_points", []) or getattr(s, "keyPoints", []),
                    "subheadings": getattr(s, "subheadings", []),
                    "keywords": getattr(s, "keywords", []),
                    "targetWords": getattr(s, "target_words", None) or getattr(s, "targetWords", None),
                    "references": [
                        {"title": r.title, "url": r.url} for r in getattr(s, "references", [])
                    ],
                },
            }

        payload = {
            "title": req.title,
            "globalTargetWords": req.globalTargetWords or 1000,
            "persona": req.persona.dict() if req.persona else None,
            "tone": req.tone,
            "audience": req.audience,
            "sections": [section_block(s) for s in req.sections],
        }

        system = (
            "You are a professional blog writer. Generate high-quality content for each section based on the provided outline. "
            "Write engaging, informative content that follows the section's key points and target word count. "
            "Use a professional tone and ensure the content flows naturally. "
            "Format content with proper paragraph breaks using double line breaks (\\n\\n) between paragraphs. "
            "Structure content with clear paragraphs - aim for 2-4 sentences per paragraph. "
            "Return ONLY valid JSON with no markdown formatting or explanations."
        )

        import json
        prompt = (
            f"Write blog content for the following sections. Each section should be {req.globalTargetWords or 1000} words total, distributed across all sections.\n\n"
            f"Blog Title: {req.title}\n\n"
            "For each section, write engaging content that:\n"
            "- Follows the key points provided\n"
            "- Uses the suggested keywords naturally\n"
            "- Meets the target word count\n"
            "- Maintains professional tone\n"
            "- References the provided sources when relevant\n"
            "- Breaks content into clear paragraphs (2-4 sentences each)\n"
            "- Uses double line breaks (\\n\\n) between paragraphs for proper formatting\n"
            "- Starts with an engaging opening paragraph\n"
            "- Ends with a strong concluding paragraph\n\n"
            "IMPORTANT: Format the 'content' field with proper paragraph breaks using \\n\\n between paragraphs.\n\n"
            "Return a JSON object with 'title' and 'sections' array. Each section should have 'id', 'heading', 'content', and 'wordCount'.\n\n"
            f"Sections to write:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
        )

        ai_resp = gemini_structured_json_response(
            prompt=prompt,
            schema=schema,
            temperature=0.2,
            max_tokens=8192,
            system_prompt=system,
        )

        # Check for errors in AI response
        if not ai_resp or ai_resp.get("error"):
            error_msg = ai_resp.get("error", "Empty generation result from model") if ai_resp else "No response from model"
            logger.error(f"AI generation failed: {error_msg}")
            raise Exception(f"AI generation failed: {error_msg}")

        # Normalize output
        title = ai_resp.get("title") or req.title
        out_sections = []
        for s in ai_resp.get("sections", []) or []:
            out_sections.append(
                MediumGeneratedSection(
                    id=str(s.get("id")),
                    heading=s.get("heading") or "",
                    content=s.get("content") or "",
                    wordCount=int(s.get("wordCount") or 0),
                    sources=[
                        # map to ResearchSource shape if possible; keep minimal
                        ResearchSource(title=src.get("title", ""), url=src.get("url", ""))
                        for src in (s.get("sources") or [])
                    ] or None,
                )
            )

        duration_ms = int((time.time() - start) * 1000)
        result = MediumBlogGenerateResult(
            success=True,
            title=title,
            sections=out_sections,
            model="gemini-2.5-flash",
            generation_time_ms=duration_ms,
            safety_flags=None,
        )
        
        # Cache the result for future use
        try:
            persistent_content_cache.cache_content(
                keywords=req.researchKeywords or [],
                sections=sections_for_cache,
                global_target_words=req.globalTargetWords or 1000,
                persona_data=req.persona.dict() if req.persona else None,
                tone=req.tone or "professional",
                audience=req.audience or "general",
                result=result.dict()
            )
            logger.info(f"Cached content result for keywords: {req.researchKeywords}")
        except Exception as cache_error:
            logger.warning(f"Failed to cache content result: {cache_error}")
            # Don't fail the entire operation if caching fails
        
        return result
