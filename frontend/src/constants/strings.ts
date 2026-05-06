/**
 * Centralized user-facing strings.
 *
 * Why centralize?
 * - Single source of truth for ALL text shown to users
 * - Future i18n is trivial — just create strings.es.ts, strings.fr.ts, etc.
 *   and swap based on user's selected language
 * - Easier to audit copy and maintain consistent voice
 *
 * Voice guidelines for MAK:
 * - Warm + confident (never apologetic / never dismissive)
 * - Action-oriented (tell user what to do next)
 * - No error codes ever (503/504 are internal-only)
 * - Empathetic but not saccharine
 */

export type AnalyzeMode = 'skinCare' | 'makeup' | 'travel';

export const STRINGS = {
  // ============================================================
  // Error sheet copy (shown in the bottom sheet modal)
  // ============================================================
  errors: {
    busy: {
      title: 'Almost there!',
      body: 'The service is a little busy right now \u2014 give it a moment, then tap below.',
      primaryCta: 'Try Again',
      secondaryCta: 'Choose Different Photo',
    },
    timeout: {
      title: 'This is taking a moment',
      body: 'Your analysis is running a bit slow \u2014 let\u2019s give it another go.',
      primaryCta: 'Try Again',
      secondaryCta: 'Choose Different Photo',
    },
    badImage: {
      title: 'Let\u2019s try a different photo',
      body: 'For the best results, use a clear, well-lit photo with your face centered and visible.',
      primaryCta: 'Choose Another Photo',
    },
    network: {
      title: 'Connection hiccup',
      body: 'We can\u2019t reach our servers right now. Check your internet and tap below.',
      primaryCta: 'Try Again',
    },
    generic: {
      title: 'Something went sideways',
      body: 'Don\u2019t worry, this happens sometimes. Tap to try again.',
      primaryCta: 'Try Again',
    },
  },

  // ============================================================
  // Loading rotator messages — different per analysis mode
  // ============================================================
  loading: {
    skinCare: [
      'Analyzing your skin...',
      'Looking at your skin tone & texture...',
      'Crafting your personalized routine...',
      'Almost done \u2014 adding final touches \u2728',
    ],
    makeup: [
      'Analyzing your face...',
      'Studying your tone & undertone...',
      'Curating makeup ideas just for you...',
      'Almost done \u2014 adding final touches \u2728',
    ],
    travel: [
      'Studying your destination...',
      'Checking the weather & vibe...',
      'Curating styling ideas for your trip...',
      'Almost done \u2014 packing your suggestions \u2728',
    ],
  },

  // ============================================================
  // Banners & hints
  // ============================================================
  banners: {
    firstScanHint: 'First scan after install may take up to 30 seconds \u2014 that\u2019s normal \u2728',
    photoTip: 'Pro tip: clear, well-lit photos get the best results \u{1F4A1}',
  },

  // Shown INSIDE the loading rotator after 10s of waiting (not before)
  loadingHints: {
    delayed: 'First scan can take 20\u201330 seconds \u2014 hang tight, this is normal!',
  },

  // ============================================================
  // Chat (Ask MAK) error messages — inline bot messages, not popups
  // ============================================================
  chat: {
    errorMessage:
      'I\u2019m having a little trouble responding right now \u2014 give it a moment and try again \u2728',
  },
};

/**
 * Helper to map HTTP status / error type to error variant key.
 * NEVER expose status codes to users \u2014 this is internal only.
 */
export function mapErrorToVariant(err: unknown): keyof typeof STRINGS.errors {
  // Type-narrow via duck typing
  const error = err as {
    response?: { status?: number };
    code?: string;
    message?: string;
  };

  // Network / no response
  if (!error?.response) {
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      return 'timeout';
    }
    return 'network';
  }

  const status = error.response.status;

  if (status === 400 || status === 422) return 'badImage';
  if (status === 503) return 'busy';
  if (status === 504) return 'timeout';
  if (status === 408) return 'timeout';

  return 'generic';
}
