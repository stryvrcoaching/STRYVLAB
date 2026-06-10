# RESPONSIVE FIXES - QUICK REFERENCE
## Format: File → Issue → Fix

---

## CRITICAL FIXES (Horizontal Scroll & Overflow)

**File:** `app/components/sections/hero-medisync.tsx`  
**Issue:** Fixed width navigation card `w-[350px]` causes horizontal scroll on 320px viewports  
**Fix:** Change line 110 to `w-full max-w-[350px]` or `w-[calc(100%-24px)]`

**File:** `app/components/sections/hero-medisync.tsx`  
**Issue:** Inline style `width: '500px'` on supporting text causes overflow  
**Fix:** Remove inline style on line 93, use `max-w-[500px] w-full` classes

**File:** `app/components/sections/journey-section.tsx`  
**Issue:** Floating tags positioned absolutely (`left: '-80px'`) cause horizontal scroll  
**Fix:** Add `overflow-hidden` to parent container or use responsive positioning: `left-0 sm:-left-20`

**File:** `app/components/sections/features-arc.tsx`  
**Issue:** Fixed width cards `w-64 h-80` overflow on mobile  
**Fix:** Change line 71 to `w-full max-w-64 h-80` or `w-full sm:w-64`

**File:** `app/components/sections/journey-section.tsx`  
**Issue:** Phone mockup fixed width `w-64` causes overflow  
**Fix:** Change line 45 to `w-48 sm:w-56 md:w-64 h-[400px] sm:h-[450px] md:h-[500px]`

**File:** `app/components/sections/about-medisync.tsx`  
**Issue:** Horizontal line fixed width `w-64` may overflow  
**Fix:** Change line 29 to `w-full max-w-64` or `w-48 sm:w-64`

---

## TOUCH TARGET FIXES (44x44px Minimum)

**File:** `app/components/layout/header-medisync.tsx`  
**Issue:** Hamburger button `p-2` = ~24x24px, below 44x44px minimum  
**Fix:** Change line 179 to `p-3` or add `min-w-[44px] min-h-[44px]`

**File:** `app/components/layout/header-medisync.tsx`  
**Issue:** Mobile nav links `px-4 py-2` = ~32px height, below 44px minimum  
**Fix:** Change line 209 to `px-4 py-3` or add `min-h-[44px]`

**File:** `app/components/calculators/MacroCalculator.tsx`  
**Issue:** Gender buttons `py-3 px-4` = ~36px height  
**Fix:** Change lines 95, 105 to add `min-h-[44px]` or `h-11`

**File:** `app/components/calculators/BodyFatCalculator.tsx`  
**Issue:** Gender buttons `py-3 px-4` = ~36px height  
**Fix:** Change lines 129, 139 to add `min-h-[44px]` or `h-11`

**File:** `components/mini-scan/QuestionCard.tsx`  
**Issue:** Choice buttons `px-6 py-4` = ~40px height  
**Fix:** Change line 83 to add `min-h-[44px]`

**File:** `app/components/sections/footer-medisync.tsx`  
**Issue:** Footer links may not meet 44px touch target  
**Fix:** Add `min-h-[44px]` or ensure `py-3` padding on all links (lines 50, 53, 65, 78)

---

## FONT SCALING FIXES (16px+ Body Text)

**File:** `app/components/sections/hero-medisync.tsx`  
**Issue:** Navigation text `text-xs` = 11.1px, below 16px minimum  
**Fix:** Change line 117 to `text-sm md:text-xs` or `text-base md:text-sm`

**File:** `app/components/sections/hero-medisync.tsx`  
**Issue:** Hero heading may be too large on smallest viewports  
**Fix:** Change line 61 to `text-[32px] sm:text-[40px] md:text-[45px] lg:text-[50px]`

---

## FORM INPUT FIXES (Full-Width on Mobile)

**File:** `app/components/calculators/MacroCalculator.tsx`  
**Issue:** Grid layout doesn't stack until `lg:` breakpoint  
**Fix:** Change line 85 to `grid md:grid-cols-2` for better tablet experience

**File:** `app/components/calculators/MacroCalculator.tsx`  
**Issue:** Header flex layout may break on mobile with LanguageSwitcher  
**Fix:** Change line 73 to `flex-col md:flex-row` with proper gap spacing

**File:** `components/mini-scan/QuestionCard.tsx`  
**Issue:** Range slider `h-2` too small for mobile interaction  
**Fix:** Change line 103 to `h-3 md:h-2`

**File:** `components/mini-scan/EmailCapture.tsx`  
**Issue:** Gender buttons grid gap may be too tight  
**Fix:** Change line 77 to `gap-3 sm:gap-4`

---

## GRID/FLEX LAYOUT FIXES

**File:** `app/components/sections/features-arc.tsx`  
**Issue:** Cards container gap `gap-8` too large on mobile  
**Fix:** Change line 54 to `gap-4 sm:gap-6 md:gap-8`

**File:** `app/components/sections/scores-section.tsx`  
**Issue:** Card max-width `max-w-xs` may be too restrictive on tablets  
**Fix:** Change line 39 to `max-w-sm md:max-w-xs` or `w-full`

---

## HOVER TO TOUCH CONVERSIONS

**File:** `app/components/layout/header-medisync.tsx`  
**Issue:** Desktop nav links hover-only, no touch alternative  
**Fix:** Add `active:bg-[rgba(255,255,255,0.15)]` and `touch-manipulation` class to line 161

**File:** `app/components/sections/hero-medisync.tsx`  
**Issue:** CTA button `hover:scale-[1.02]` only, no touch feedback  
**Fix:** Add `active:scale-[0.98]` to line 75

**File:** `app/components/sections/about-medisync.tsx`  
**Issue:** Icon circle `whileHover` only, no touch alternative  
**Fix:** Add `whileTap={{ scale: 0.95 }}` to line 34

**File:** `app/components/sections/features-arc.tsx`  
**Issue:** CTA button `hover:shadow-light` only  
**Fix:** Add `active:scale-[0.98]` to line 115

**File:** `app/components/ui/glass-card.tsx`  
**Issue:** `hover:translate-y-[-4px]` only works on hover  
**Fix:** Add `active:translate-y-[-2px]` or disable on touch using `@media (hover: hover)`

---

## IMAGE SCALING FIXES

**File:** `app/components/sections/closing-hero.tsx`  
**Issue:** Image may not scale properly, verify aspect-ratio  
**Fix:** Add `aspect-ratio` class or ensure container has proper constraints on line 16

---

## GLASSMORPHISM READABILITY FIXES

**File:** `app/components/ui/glass-card.tsx`  
**Issue:** Backdrop blur `backdrop-blur-[16px]` may impact mobile performance  
**Fix:** Change line 97 to `backdrop-blur-md md:backdrop-blur-[16px]`

**File:** `app/components/sections/footer-medisync.tsx`  
**Issue:** Background image blur `filter: blur(15px)` may cause performance issues  
**Fix:** Add `will-change: transform` and optimize image loading on line 15

---

## LAYOUT PADDING FIXES

**File:** `app/layout.tsx`  
**Issue:** Padding-top `pt-16` may be too much on small screens  
**Fix:** Change line 32 to `pt-14 md:pt-16` or verify header height matches

**File:** `app/components/ui/glass-card.tsx`  
**Issue:** Padding `p-6` on mobile may feel cramped  
**Fix:** Verify line 113 padding is appropriate, consider `p-4 sm:p-6 md:p-8`

---

## SUMMARY BY PRIORITY

### CRITICAL (Fix Immediately - Causes Horizontal Scroll):
1. `hero-medisync.tsx` - Fixed width navigation card
2. `hero-medisync.tsx` - Inline width style
3. `journey-section.tsx` - Floating tags overflow
4. `features-arc.tsx` - Fixed width cards

### HIGH (Touch Targets & Font Sizes):
5. `header-medisync.tsx` - Hamburger button size
6. `header-medisync.tsx` - Mobile nav links
7. `MacroCalculator.tsx` - Gender buttons
8. `BodyFatCalculator.tsx` - Gender buttons
9. `QuestionCard.tsx` - Choice buttons
10. `hero-medisync.tsx` - Font size below 16px

### MEDIUM (UX Improvements):
11. All hover-to-touch conversions
12. Grid breakpoint adjustments
13. Performance optimizations (blur effects)

---

*Quick reference for implementing fixes - See RESPONSIVE_AUDIT_REPORT.md for detailed analysis*




