import { ClientGenericSkeleton } from "@/components/client/skeletons/ClientSkeletons";

/**
 * Default loading for the `/client` segment.
 * Neutral chrome only — never the home "Bonjour" skeleton
 * (that would flash on every nested navigation).
 *
 * Route-specific loading.tsx files override this for major pages.
 */
export default function ClientLoading() {
  return <ClientGenericSkeleton />;
}
