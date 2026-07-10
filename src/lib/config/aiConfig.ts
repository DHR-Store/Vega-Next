// lib/config/aiConfig.ts
//
// Centralised AI + TMDB configuration.
// Both the AI chat assistant (components/AI.tsx) and the AI-powered
// "Picks For You" hero slider on the Search screen (components/HeroSuggestionSlider.tsx)
// read from this single source, so the API key / model never drifts out of
// sync between features.
//
// WARNING: NEVER HARDCODE SECURE KEYS IN PRODUCTION. This is for example/internal use only.
// Move these to a secure environment/config solution (e.g. react-native-config,
// remote config, or a backend proxy) before shipping to real users.

export const GROQ_API_KEY = 'YOUR GROQ API KEY';
export const TMDB_API_KEY = 'YOUR TMDB API KEY';

// Groq's recommended model for reliable tool calling / JSON generation.
export const GROQ_MODEL = 'openai/gpt-oss-120b';
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';