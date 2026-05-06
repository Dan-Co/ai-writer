export type VoiceOption = {
  id: string;
  name: string;
  personality?: string;
  isCustom?: boolean;
  previewUrl?: string;
  gender?: "male" | "female";
  category?: string;
};

export type VoiceAudioSettings = {
  speed: number;
  volume: number;
  pitch: number;
  emotion: string;
};

export const DEFAULT_AUDIO_SETTINGS: VoiceAudioSettings = {
  speed: 1.0,
  volume: 1.0,
  pitch: 0,
  emotion: "neutral",
};

export const EMOTION_OPTIONS = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];

export const VOICE_SAMPLE_BASE = "/assets/voice-samples";

export const VOICE_PREVIEW_MAP: Record<string, string> = {
  Wise_Woman: `${VOICE_SAMPLE_BASE}/wise_woman.mp3`,
  Friendly_Person: `${VOICE_SAMPLE_BASE}/friendly_person.mp3`,
  Inspirational_girl: `${VOICE_SAMPLE_BASE}/inspirational_girl.mp3`,
  Deep_Voice_Man: `${VOICE_SAMPLE_BASE}/deep_voice_man.mp3`,
  Calm_Woman: `${VOICE_SAMPLE_BASE}/calm_woman.mp3`,
  Casual_Guy: `${VOICE_SAMPLE_BASE}/casual_guy.mp3`,
  Lively_Girl: `${VOICE_SAMPLE_BASE}/lively_girl.mp3`,
  Patient_Man: `${VOICE_SAMPLE_BASE}/patient_man.mp3`,
  Young_Knight: `${VOICE_SAMPLE_BASE}/young_knight.mp3`,
  Determined_Man: `${VOICE_SAMPLE_BASE}/determined_man.mp3`,
  Lovely_Girl: `${VOICE_SAMPLE_BASE}/lovely_girl.mp3`,
  Decent_Boy: `${VOICE_SAMPLE_BASE}/decent_boy.mp3`,
  Imposing_Manner: `${VOICE_SAMPLE_BASE}/imposing_manner.mp3`,
  Elegant_Man: `${VOICE_SAMPLE_BASE}/elegant_man.mp3`,
  Abbess: `${VOICE_SAMPLE_BASE}/abbess.mp3`,
  Sweet_Girl_2: `${VOICE_SAMPLE_BASE}/sweet_girl.mp3`,
  Exuberant_Girl: `${VOICE_SAMPLE_BASE}/exuberant_girl.mp3`,
};

export type CategoryFilter = string;

export const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "educational", label: "Educational" },
  { value: "marketing", label: "Marketing" },
  { value: "professional", label: "Professional" },
  { value: "creative", label: "Creative" },
  { value: "calming", label: "Calming" },
  { value: "motivational", label: "Motivational" },
];

export const PREDEFINED_VOICES: VoiceOption[] = [
  { id: "Wise_Woman", name: "Wise Woman", personality: "Authoritative, trustworthy female voice - perfect for educational content", previewUrl: VOICE_PREVIEW_MAP.Wise_Woman, gender: "female", category: "educational" },
  { id: "Friendly_Person", name: "Friendly Person", personality: "Warm, approachable voice - great for welcoming introductions", previewUrl: VOICE_PREVIEW_MAP.Friendly_Person, category: "marketing" },
  { id: "Inspirational_girl", name: "Inspirational Girl", personality: "Motivational, uplifting female voice - ideal for inspiration", previewUrl: VOICE_PREVIEW_MAP.Inspirational_girl, gender: "female", category: "motivational" },
  { id: "Deep_Voice_Man", name: "Deep Voice Man", personality: "Powerful, commanding male voice - excellent for serious topics", previewUrl: VOICE_PREVIEW_MAP.Deep_Voice_Man, gender: "male", category: "professional" },
  { id: "Calm_Woman", name: "Calm Woman", personality: "Soothing, composed female voice - perfect for meditation or sensitive topics", previewUrl: VOICE_PREVIEW_MAP.Calm_Woman, gender: "female", category: "calming" },
  { id: "Casual_Guy", name: "Casual Guy", personality: "Relaxed, conversational male voice - great for vlogs and tutorials", previewUrl: VOICE_PREVIEW_MAP.Casual_Guy, gender: "male", category: "marketing" },
  { id: "Lively_Girl", name: "Lively Girl", personality: "Energetic, enthusiastic female voice - ideal for exciting announcements", previewUrl: VOICE_PREVIEW_MAP.Lively_Girl, gender: "female", category: "marketing" },
  { id: "Patient_Man", name: "Patient Man", personality: "Gentle, understanding male voice - perfect for explanations", previewUrl: VOICE_PREVIEW_MAP.Patient_Man, gender: "male", category: "educational" },
  { id: "Young_Knight", name: "Young Knight", personality: "Brave, confident male voice - great for adventure and gaming", previewUrl: VOICE_PREVIEW_MAP.Young_Knight, gender: "male", category: "creative" },
  { id: "Determined_Man", name: "Determined Man", personality: "Strong, resolute male voice - excellent for motivational speeches", previewUrl: VOICE_PREVIEW_MAP.Determined_Man, gender: "male", category: "motivational" },
  { id: "Lovely_Girl", name: "Lovely Girl", personality: "Sweet, charming female voice - ideal for storytelling", previewUrl: VOICE_PREVIEW_MAP.Lovely_Girl, gender: "female", category: "creative" },
  { id: "Decent_Boy", name: "Decent Boy", personality: "Honest, sincere male voice - perfect for testimonials", previewUrl: VOICE_PREVIEW_MAP.Decent_Boy, gender: "male", category: "marketing" },
  { id: "Imposing_Manner", name: "Imposing Manner", personality: "Formal, dignified male voice - great for corporate content", previewUrl: VOICE_PREVIEW_MAP.Imposing_Manner, gender: "male", category: "professional" },
  { id: "Elegant_Man", name: "Elegant Man", personality: "Refined, sophisticated male voice - ideal for luxury content", previewUrl: VOICE_PREVIEW_MAP.Elegant_Man, gender: "male", category: "professional" },
  { id: "Abbess", name: "Abbess", personality: "Spiritual, serene female voice - perfect for meditation", previewUrl: VOICE_PREVIEW_MAP.Abbess, gender: "female", category: "calming" },
  { id: "Sweet_Girl_2", name: "Sweet Girl 2", personality: "Gentle, melodic female voice - excellent for children's content", previewUrl: VOICE_PREVIEW_MAP.Sweet_Girl_2, gender: "female", category: "creative" },
  { id: "Exuberant_Girl", name: "Exuberant Girl", personality: "Joyful, expressive female voice - ideal for celebrations", previewUrl: VOICE_PREVIEW_MAP.Exuberant_Girl, gender: "female", category: "creative" },
];

export type VoiceSelectorGenderFilter = "all" | "male" | "female";
