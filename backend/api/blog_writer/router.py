from fastapi import APIRouter, HTTPException
from typing import Any, Dict
import asyncio
import uuid
from datetime import datetime
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
    HallucinationCheckRequest,
    HallucinationCheckResponse,
)
from services.blog_writer.blog_service import BlogWriterService


router = APIRouter(prefix="/api/blog", tags=["AI Blog Writer"])

service = BlogWriterService()

# Simple in-memory task storage (in production, use Redis or database)
task_storage: Dict[str, Dict[str, Any]] = {}


def cleanup_old_tasks():
    """Remove tasks older than 1 hour to prevent memory leaks."""
    current_time = datetime.now()
    tasks_to_remove = []
    
    for task_id, task_data in task_storage.items():
        if (current_time - task_data["created_at"]).total_seconds() > 3600:  # 1 hour
            tasks_to_remove.append(task_id)
    
    for task_id in tasks_to_remove:
        del task_storage[task_id]


@router.get("/health")
async def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "ai_blog_writer"}


@router.get("/cache/stats")
async def get_cache_stats() -> Dict[str, Any]:
    """Get research cache statistics."""
    try:
        from services.cache.research_cache import research_cache
        return research_cache.get_cache_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cache/clear")
async def clear_cache() -> Dict[str, Any]:
    """Clear the research cache."""
    try:
        from services.cache.research_cache import research_cache
        research_cache.clear_cache()
        return {"status": "success", "message": "Research cache cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/research/start")
async def start_research(request: BlogResearchRequest) -> Dict[str, Any]:
    """Start a research operation and return a task ID for polling."""
    try:
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        task_storage[task_id] = {
            "status": "pending",
            "created_at": datetime.now(),
            "result": None,
            "error": None
        }
        
        # Start the research operation in the background
        asyncio.create_task(run_research_task(task_id, request))
        
        return {"task_id": task_id, "status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/research/status/{task_id}")
async def get_research_status(task_id: str) -> Dict[str, Any]:
    """Get the status of a research operation."""
    # Cleanup old tasks periodically
    cleanup_old_tasks()
    
    if task_id not in task_storage:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = task_storage[task_id]
    response = {
        "task_id": task_id,
        "status": task["status"],
        "created_at": task["created_at"].isoformat(),
        "progress_messages": task.get("progress_messages", [])
    }
    
    if task["status"] == "completed":
        response["result"] = task["result"]
    elif task["status"] == "failed":
        response["error"] = task["error"]
    
    return response


async def run_research_task(task_id: str, request: BlogResearchRequest):
    """Background task to run research and update status with progress messages."""
    try:
        # Update status to running
        task_storage[task_id]["status"] = "running"
        task_storage[task_id]["progress_messages"] = []
        
        # Send initial progress message
        await _update_progress(task_id, "🔍 Starting research operation...")
        
        # Check cache first
        await _update_progress(task_id, "📋 Checking cache for existing research...")
        
        # Run the actual research with progress updates
        result = await service.research_with_progress(request, task_id)
        
        # Check if research failed gracefully
        if not result.success:
            await _update_progress(task_id, f"❌ Research failed: {result.error_message or 'Unknown error'}")
            task_storage[task_id]["status"] = "failed"
            task_storage[task_id]["error"] = result.error_message or "Research failed"
        else:
            await _update_progress(task_id, f"✅ Research completed successfully! Found {len(result.sources)} sources and {len(result.search_queries or [])} search queries.")
            # Update status to completed
            task_storage[task_id]["status"] = "completed"
            task_storage[task_id]["result"] = result.dict()
        
    except Exception as e:
        await _update_progress(task_id, f"❌ Research failed with error: {str(e)}")
        # Update status to failed
        task_storage[task_id]["status"] = "failed"
        task_storage[task_id]["error"] = str(e)


async def _update_progress(task_id: str, message: str):
    """Update progress message for a task."""
    if task_id in task_storage:
        if "progress_messages" not in task_storage[task_id]:
            task_storage[task_id]["progress_messages"] = []
        
        progress_entry = {
            "timestamp": datetime.now().isoformat(),
            "message": message
        }
        task_storage[task_id]["progress_messages"].append(progress_entry)
        
        # Keep only last 10 progress messages to prevent memory bloat
        if len(task_storage[task_id]["progress_messages"]) > 10:
            task_storage[task_id]["progress_messages"] = task_storage[task_id]["progress_messages"][-10:]
        
        logger.info(f"Progress update for task {task_id}: {message}")


@router.post("/research", response_model=BlogResearchResponse)
async def research(request: BlogResearchRequest) -> BlogResearchResponse:
    """Legacy endpoint - kept for backward compatibility."""
    try:
        return await service.research(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/outline/start")
async def start_outline_generation(request: BlogOutlineRequest) -> Dict[str, Any]:
    """Start an outline generation operation and return a task ID for polling."""
    try:
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        task_storage[task_id] = {
            "status": "pending",
            "created_at": datetime.now(),
            "result": None,
            "error": None,
            "progress_messages": []
        }
        
        # Start the outline generation operation in the background
        asyncio.create_task(run_outline_generation_task(task_id, request))
        
        return {"task_id": task_id, "status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/outline/status/{task_id}")
async def get_outline_status(task_id: str) -> Dict[str, Any]:
    """Get the status of an outline generation operation."""
    # Cleanup old tasks periodically
    cleanup_old_tasks()
    
    if task_id not in task_storage:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = task_storage[task_id]
    response = {
        "task_id": task_id,
        "status": task["status"],
        "created_at": task["created_at"].isoformat(),
        "progress_messages": task.get("progress_messages", [])
    }
    
    if task["status"] == "completed":
        response["result"] = task["result"]
    elif task["status"] == "failed":
        response["error"] = task["error"]
    
    return response


async def run_outline_generation_task(task_id: str, request: BlogOutlineRequest):
    """Background task to run outline generation and update status with progress messages."""
    try:
        # Update status to running
        task_storage[task_id]["status"] = "running"
        task_storage[task_id]["progress_messages"] = []
        
        # Send initial progress message
        await _update_progress(task_id, "🧩 Starting outline generation...")
        
        # Run the actual outline generation with progress updates
        result = await service.generate_outline_with_progress(request, task_id)
        
        # Update status to completed
        await _update_progress(task_id, f"✅ Outline generated successfully! Created {len(result.outline)} sections with {len(result.title_options)} title options.")
        task_storage[task_id]["status"] = "completed"
        task_storage[task_id]["result"] = result.dict()
        
    except Exception as e:
        await _update_progress(task_id, f"❌ Outline generation failed: {str(e)}")
        # Update status to failed
        task_storage[task_id]["status"] = "failed"
        task_storage[task_id]["error"] = str(e)


@router.post("/outline/generate", response_model=BlogOutlineResponse)
async def generate_outline(request: BlogOutlineRequest) -> BlogOutlineResponse:
    """Legacy endpoint - kept for backward compatibility."""
    try:
        return await service.generate_outline(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/outline/refine", response_model=BlogOutlineResponse)
async def refine_outline(request: BlogOutlineRefineRequest) -> BlogOutlineResponse:
    try:
        return await service.refine_outline(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/outline/enhance-section")
async def enhance_section(section_data: Dict[str, Any], focus: str = "general improvement"):
    """Enhance a specific section with AI improvements."""
    try:
        from models.blog_models import BlogOutlineSection
        section = BlogOutlineSection(**section_data)
        enhanced_section = await service.enhance_section_with_ai(section, focus)
        return enhanced_section.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/outline/optimize")
async def optimize_outline(outline_data: Dict[str, Any], focus: str = "general optimization"):
    """Optimize entire outline for better flow, SEO, and engagement."""
    try:
        from models.blog_models import BlogOutlineSection
        outline = [BlogOutlineSection(**section) for section in outline_data.get('outline', [])]
        optimized_outline = await service.optimize_outline_with_ai(outline, focus)
        return {"outline": [section.dict() for section in optimized_outline]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/outline/rebalance")
async def rebalance_outline(outline_data: Dict[str, Any], target_words: int = 1500):
    """Rebalance word count distribution across outline sections."""
    try:
        from models.blog_models import BlogOutlineSection
        outline = [BlogOutlineSection(**section) for section in outline_data.get('outline', [])]
        rebalanced_outline = service.rebalance_word_counts(outline, target_words)
        return {"outline": [section.dict() for section in rebalanced_outline]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/section/generate", response_model=BlogSectionResponse)
async def generate_section(request: BlogSectionRequest) -> BlogSectionResponse:
    try:
        return await service.generate_section(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/section/{section_id}/continuity")
async def get_section_continuity(section_id: str) -> Dict[str, Any]:
    """Fetch last computed continuity metrics for a section (if available)."""
    try:
        # Access the in-memory continuity from the generator
        gen = service.content_generator
        # Find the last stored summary for the given section id
        # For now, expose the most recent metrics if the section was just generated
        # We keep a small in-memory snapshot on the generator object
        continuity: Dict[str, Any] = getattr(gen, "_last_continuity", {})
        metrics = continuity.get(section_id)
        return {"section_id": section_id, "continuity_metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/section/optimize", response_model=BlogOptimizeResponse)
async def optimize_section(request: BlogOptimizeRequest) -> BlogOptimizeResponse:
    try:
        return await service.optimize_section(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quality/hallucination-check", response_model=HallucinationCheckResponse)
async def hallucination_check(request: HallucinationCheckRequest) -> HallucinationCheckResponse:
    try:
        return await service.hallucination_check(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seo/analyze", response_model=BlogSEOAnalyzeResponse)
async def seo_analyze(request: BlogSEOAnalyzeRequest) -> BlogSEOAnalyzeResponse:
    try:
        return await service.seo_analyze(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seo/metadata", response_model=BlogSEOMetadataResponse)
async def seo_metadata(request: BlogSEOMetadataRequest) -> BlogSEOMetadataResponse:
    try:
        return await service.seo_metadata(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/publish", response_model=BlogPublishResponse)
async def publish(request: BlogPublishRequest) -> BlogPublishResponse:
    try:
        return await service.publish(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


