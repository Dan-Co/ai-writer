"""
Category Research Handlers

Research endpoints using Tavily or Exa for category-based topic discovery.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from loguru import logger
from types import SimpleNamespace

from middleware.auth_middleware import get_current_user
from services.research.tavily_service import TavilyService
from services.blog_writer.research.exa_provider import ExaResearchProvider

router = APIRouter(prefix="/research", tags=["Podcast Category Research"])

CATEGORY_PROVIDER_MAP = {
    "news": "tavily",
    "finance": "tavily",
    "research-paper": "exa",
    "personal-site": "exa",
}

EXA_CATEGORY_MAP = {
    "research-paper": "research paper",
    "personal-site": "personal site",
}


class CategoryResearchRequest(BaseModel):
    category: str
    keyword: Optional[str] = None
    max_results: Optional[int] = 8
    website_url: Optional[str] = None


class CategoryTopic(BaseModel):
    title: str
    url: str
    snippet: str
    score: float
    favicon: Optional[str] = None


class CategoryResearchResponse(BaseModel):
    success: bool
    category: str
    provider: str
    topics: List[CategoryTopic]
    query: Optional[str] = None
    error: Optional[str] = None


def _normalize_tavily_results(results: List[Dict]) -> List[CategoryTopic]:
    topics = []
    for item in results:
        topics.append(CategoryTopic(
            title=item.get("title", ""),
            url=item.get("url", ""),
            snippet=item.get("content", ""),
            score=item.get("score", 0.0),
            favicon=item.get("favicon"),
        ))
    return topics


def _normalize_exa_results(results: List[Dict], query: str) -> List[CategoryTopic]:
    topics = []
    for idx, item in enumerate(results):
        score = 1.0 - (idx * 0.1)
        topics.append(CategoryTopic(
            title=item.get("title", "") or f"Result {idx + 1}",
            url=item.get("url", ""),
            snippet=item.get("summary", "") or item.get("text", "") or "",
            score=max(0.5, score),
            favicon=None,
        ))
    return topics


async def _search_tavily(category: str, keyword: str, max_results: int) -> CategoryResearchResponse:
    logger.info(f"[CategoryResearch] Using Tavily for category={category}, keyword={keyword}")
    
    try:
        tavily = TavilyService()
        result = await tavily.search(
            query=keyword,
            topic=category,
            search_depth="basic",
            max_results=max_results,
            include_favicon=True,
        )

        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Tavily search failed")
            )

        topics = _normalize_tavily_results(result.get("results", []))
        logger.info(f"[CategoryResearch] Tavily found {len(topics)} topics")

        return CategoryResearchResponse(
            success=True,
            category=category,
            provider="tavily",
            topics=topics,
            query=keyword,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CategoryResearch] Tavily error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def _search_exa(category: str, keyword: str, max_results: int, website_url: Optional[str] = None) -> CategoryResearchResponse:
    exa_category = EXA_CATEGORY_MAP.get(category, category)
    
    logger.info(f"[CategoryResearch] Exa: category={category}, exa_category={exa_category}, keyword={keyword}, website_url={website_url}")

    try:
        # Import exa directly for more control
        import os
        from urllib.parse import urlparse
        exa_api_key = os.getenv("EXA_API_KEY")
        if not exa_api_key:
            raise HTTPException(status_code=500, detail="EXA_API_KEY not configured")
        
        from exa_py import Exa
        exa = Exa(exa_api_key)
        logger.info(f"[CategoryResearch] Exa client initialized")
        
        # Build search parameters
        search_params = {
            "num_results": max_results,
            "category": exa_category,
        }
        
        # For personal-site, extract domain from URL if provided
        include_domains = None
        if category == "personal-site" and website_url:
            try:
                parsed = urlparse(website_url)
                if parsed.netloc:
                    include_domains = [parsed.netloc]
                    logger.info(f"[CategoryResearch] Personal site - limiting to domain: {parsed.netloc}")
                elif parsed.path and "." in parsed.path:
                    # Could be domain without protocol
                    include_domains = [parsed.path]
                    logger.info(f"[CategoryResearch] Personal site - using as domain: {parsed.path}")
            except Exception as url_err:
                logger.warning(f"[CategoryResearch] Failed to parse website_url: {url_err}")
        
        logger.info(f"[CategoryResearch] Calling Exa with params: {search_params}, include_domains={include_domains}")
        
        # Make the search call
        results = exa.search_and_contents(
            query=keyword,
            type="auto" if category != "personal-site" else "neural",
            num_results=max_results,
            category=exa_category,
            text=True,
            summary=True,
            include_domains=include_domains,
        )
        
        logger.info(f"[CategoryResearch] Exa search completed, got results")
        
        # Transform results to our format
        topics = []
        if results and hasattr(results, 'results'):
            for item in results.results:
                title = getattr(item, 'title', 'Untitled')
                url = getattr(item, 'url', '')
                snippet = getattr(item, 'summary', '') or getattr(item, 'text', '') or ''
                score = 0.8  # Default score for Exa results
                
                topics.append(CategoryTopic(
                    title=title,
                    url=url,
                    snippet=snippet[:300] if snippet else '',
                    score=score,
                    favicon=None,
                ))
        
        logger.info(f"[CategoryResearch] Exa found {len(topics)} topics")

        return CategoryResearchResponse(
            success=True,
            category=category,
            provider="exa",
            topics=topics,
            query=keyword,
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"[CategoryResearch] Exa error: {type(e).__name__}: {e}")
        logger.error(f"[CategoryResearch] Stack: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Exa search failed: {str(e)}")


@router.post("/tavily-category", response_model=CategoryResearchResponse)
async def research_by_category(
    request: CategoryResearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Research topics by category using Tavily or Exa.
    
    Categories:
    - news, finance: Uses Tavily
    - research-paper, personal-site: Uses Exa
    """
    category = request.category.lower()
    valid_categories = list(CATEGORY_PROVIDER_MAP.keys())
    
    logger.info(f"[CategoryResearch] Full request payload: category={request.category}, keyword={request.keyword}, website_url={request.website_url}")
    
    if category not in valid_categories:
        logger.error(f"[CategoryResearch] Invalid category: {category}, valid: {valid_categories}")
        raise HTTPException(
            status_code=400,
            detail=f"Category must be one of: {', '.join(valid_categories)}"
        )

    keyword = request.keyword or category
    max_results = min(max(request.max_results or 8, 5), 10)
    website_url = request.website_url

    logger.info(f"[CategoryResearch] Processing: category={category}, keyword={keyword}, max_results={max_results}, website_url={website_url}")

    provider = CATEGORY_PROVIDER_MAP.get(category, "tavily")
    logger.info(f"[CategoryResearch] Selected provider: {provider} for category: {category}")

    try:
        if provider == "tavily":
            return await _search_tavily(category, keyword, max_results)
        elif provider == "exa":
            return await _search_exa(category, keyword, max_results, website_url)
        else:
            raise HTTPException(status_code=500, detail="Unknown provider")
    except Exception as e:
        logger.error(f"[CategoryResearch] Outer error: {type(e).__name__}: {e}", exc_info=True)
        raise