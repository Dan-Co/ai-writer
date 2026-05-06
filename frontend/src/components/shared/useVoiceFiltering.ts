import { useMemo } from "react";
import { VoiceOption, PREDEFINED_VOICES, VoiceSelectorGenderFilter, CategoryFilter } from "./voiceConstants";
import { VoiceCloneResponse } from "../../api/brandAssets";
import { VOICE_CLONE_ID } from "./VoiceSelector";

export interface UseVoiceFilteringParams {
  showVoiceClone: boolean;
  voiceClone: VoiceCloneResponse | null;
  value: string;
  genderFilter: VoiceSelectorGenderFilter;
  categoryFilter: CategoryFilter;
}

export interface UseVoiceFilteringReturn {
  voiceOptions: VoiceOption[];
  filteredVoices: VoiceOption[];
}

export const useVoiceFiltering = ({
  showVoiceClone,
  voiceClone,
  value,
  genderFilter,
  categoryFilter,
}: UseVoiceFilteringParams): UseVoiceFilteringReturn => {
  const voiceOptions = useMemo(() => {
    const options: VoiceOption[] = [...PREDEFINED_VOICES];
    
    if (showVoiceClone && voiceClone?.success && voiceClone.custom_voice_id) {
      options.unshift({
        id: VOICE_CLONE_ID,
        name: voiceClone.voice_name || voiceClone.custom_voice_id || "My Voice Clone",
        personality: "Your own voice - cloned from audio sample",
        isCustom: true,
        previewUrl: voiceClone.preview_audio_url,
      });
    }
    
    return options;
  }, [showVoiceClone, voiceClone]);

  const filteredVoices = useMemo(() => {
    const filtered = PREDEFINED_VOICES.filter(v => {
      if (genderFilter !== "all" && v.gender !== genderFilter) return false;
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      return true;
    });
    if (value && value !== VOICE_CLONE_ID && !filtered.some(v => v.id === value)) {
      const selected = PREDEFINED_VOICES.find(v => v.id === value);
      if (selected) filtered.unshift(selected);
    }
    return filtered;
  }, [genderFilter, categoryFilter, value]);

  return { voiceOptions, filteredVoices };
};