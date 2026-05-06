"""
Podcast cost estimation helpers.

Builds user-facing podcast estimates from the subscription pricing catalog
instead of hard-coded frontend heuristics.

Supports multiple models for each component:
- Audio TTS: minimax/speech-02-hd (default), qwen3-tts, cosyvoice-tts
- Voice Clone: qwen3, cosyvoice, minimax  
- Image: qwen-image (default), ideogram-v3-turbo
- Video: wan-2.5 (default), kling-v2.5, infinitetalk
- LLM: gemini-2.5-flash (default)
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from models.subscription_models import APIProvider
from services.subscription.pricing_service import PricingService


def _round_money(value: float) -> float:
    return round(float(value), 4)


def _load_pricing(
    pricing_service: PricingService,
    provider: APIProvider,
    preferred_model: str,
) -> Optional[Dict[str, Any]]:
    """Load pricing for a provider and model, with fallback to default."""
    pricing = pricing_service.get_pricing_for_provider_model(provider, preferred_model)
    if pricing:
        return pricing
    # Fallback to provider default model row (if configured).
    return pricing_service.get_pricing_for_provider_model(provider, "default")


# Default models used in podcast generation
DEFAULT_MODELS = {
    "gemini": "gemini-2.5-flash",
    "exa": "exa-search",
    "audio_tts": "minimax/speech-02-hd",
    "voice_clone": "wavespeed-ai/qwen3-tts/voice-clone",
    "image": "qwen-image",
    "video": "wan-2.5",
}


def estimate_podcast_cost(
    *,
    db: Session,
    duration_minutes: int,
    speakers: int,
    query_count: int,
    include_avatar_phase: bool = True,
    # Optional model overrides
    gemini_model: str = "gemini-2.5-flash",
    audio_tts_model: str = "minimax/speech-02-hd",
    voice_clone_engine: str = "qwen3",
    image_model: str = "qwen-image",
    video_model: str = "wan-2.5",
) -> Optional[Dict[str, Any]]:
    """
    Compute a backend estimate for podcast creation.
    
    Supports customizable models for each component.
    Uses pricing_catalog for accurate cost calculation.
    """
    pricing_service = PricingService(db)

    # Load pricing for each component and model
    gemini_pricing = _load_pricing(pricing_service, APIProvider.GEMINI, gemini_model)
    exa_pricing = _load_pricing(pricing_service, APIProvider.EXA, "exa-search")
    
    # Audio TTS pricing (minimax/speech-02-hd)
    audio_pricing = _load_pricing(pricing_service, APIProvider.AUDIO, audio_tts_model)
    
    # Voice clone pricing (different engines)
    voice_clone_model = f"wavespeed-ai/{voice_clone_engine}-tts/voice-clone"
    voice_clone_pricing = _load_pricing(pricing_service, APIProvider.AUDIO, voice_clone_model)
    if not voice_clone_pricing:
        # Try alternate model names
        voice_clone_pricing = _load_pricing(pricing_service, APIProvider.AUDIO, f"{voice_clone_engine}/voice-clone")
    
    # Image pricing (qwen-image or ideogram)
    image_pricing = _load_pricing(pricing_service, APIProvider.STABILITY, image_model)
    
    # Video pricing (wan-2.5, kling, or infinitetalk)
    video_pricing = _load_pricing(pricing_service, APIProvider.VIDEO, video_model)

    # Return None if critical pricing unavailable (fail fast)
    if not gemini_pricing:
        return None

    # Configuration
    minutes = max(1, int(duration_minutes or 1))
    speaker_count = max(1, int(speakers or 1))
    research_queries = max(1, int(query_count or 1))

    # Token usage assumptions per phase
    analysis_input_tokens = 1800
    analysis_output_tokens = 1000
    research_synthesis_input_tokens = 2200
    research_synthesis_output_tokens = 900
    script_input_tokens = max(1800, minutes * 300)
    script_output_tokens = max(2200, minutes * 700)
    
    # TTS: ~900 chars per minute per speaker
    estimated_tts_tokens = max(900, minutes * 900 * speaker_count)
    
    # Voice clone: 1 clone operation per speaker
    voice_clone_count = speaker_count

    # ===== COST CALCULATIONS =====

    # 1. Analysis phase (LLM)
    analysis_cost = (
        analysis_input_tokens * float(gemini_pricing.get("cost_per_input_token") or 0.0)
        + analysis_output_tokens * float(gemini_pricing.get("cost_per_output_token") or 0.0)
    )

    # 2. Research phase
    # 2a. LLM for research synthesis
    research_llm_cost = (
        research_synthesis_input_tokens * float(gemini_pricing.get("cost_per_input_token") or 0.0)
        + research_synthesis_output_tokens * float(gemini_pricing.get("cost_per_output_token") or 0.0)
    )
    # 2b. Search API (Exa)
    research_search_cost = 0.0
    if exa_pricing:
        research_search_cost = research_queries * float(exa_pricing.get("cost_per_request") or 0.0)
    research_cost = research_search_cost + research_llm_cost

    # 3. Script generation (LLM)
    script_cost = (
        script_input_tokens * float(gemini_pricing.get("cost_per_input_token") or 0.0)
        + script_output_tokens * float(gemini_pricing.get("cost_per_output_token") or 0.0)
    )

    # 4. Audio TTS
    tts_cost = 0.0
    if audio_pricing:
        tts_cost = estimated_tts_tokens * float(audio_pricing.get("cost_per_input_token") or 0.0)

    # 5. Voice cloning (if needed)
    voice_clone_cost = 0.0
    if voice_clone_pricing:
        voice_clone_cost = voice_clone_count * (
            float(voice_clone_pricing.get("cost_per_request") or 0.0)
            + estimated_tts_tokens * float(voice_clone_pricing.get("cost_per_input_token") or 0.0)
        )

    # 6. Avatar image generation
    avatar_cost = 0.0
    if include_avatar_phase and image_pricing:
        image_unit = float(image_pricing.get("cost_per_image") or image_pricing.get("cost_per_request") or 0.0)
        avatar_cost = speaker_count * image_unit

    # 7. Video rendering
    video_cost = 0.0
    if video_pricing:
        # Assume 1 video render per minute (upper bound)
        video_cost = minutes * float(video_pricing.get("cost_per_request") or 0.0)

    # ===== TOTALS =====
    llm_total = analysis_cost + research_llm_cost + script_cost
    audio_total = tts_cost + voice_clone_cost
    media_total = avatar_cost + video_cost
    total = llm_total + research_search_cost + audio_total + media_total

    return {
        # Cost breakdown
        "analysisCost": _round_money(analysis_cost),
        "researchCost": _round_money(research_cost),
        "researchSearchCost": _round_money(research_search_cost),
        "researchLlmCost": _round_money(research_llm_cost),
        "scriptCost": _round_money(script_cost),
        "ttsCost": _round_money(tts_cost),
        "voiceCloneCost": _round_money(voice_clone_cost),
        "avatarCost": _round_money(avatar_cost),
        "videoCost": _round_money(video_cost),
        "total": _round_money(total),
        # Totals by category
        "llmCost": _round_money(llm_total),
        "audioCost": _round_money(audio_total),
        "mediaCost": _round_money(media_total),
        # Currency
        "currency": "USD",
        "source": "pricing_catalog",
        # Models used for this estimate
        "models": {
            "llm": gemini_model,
            "research": "exa-search",
            "audio_tts": audio_tts_model,
            "voice_clone": voice_clone_model,
            "image": image_model,
            "video": video_model,
        },
        # Assumptions used
        "assumptions": {
            "analysis_input_tokens": analysis_input_tokens,
            "analysis_output_tokens": analysis_output_tokens,
            "research_synthesis_input_tokens": research_synthesis_input_tokens,
            "research_synthesis_output_tokens": research_synthesis_output_tokens,
            "script_input_tokens": script_input_tokens,
            "script_output_tokens": script_output_tokens,
            "estimated_tts_tokens": estimated_tts_tokens,
            "research_queries": research_queries,
            "voice_clone_count": voice_clone_count,
            "video_requests": minutes,
            "avatar_requests": speaker_count if include_avatar_phase else 0,
        },
    }