import type { ListingCheckLimits } from "@/types";

// Only used if GET /assistant/limits can't be reached; the backend's settings win.
export const FALLBACK_LIMITS: ListingCheckLimits = { checks_per_account: 3, max_images: 3, max_text_chars: 6000 };
