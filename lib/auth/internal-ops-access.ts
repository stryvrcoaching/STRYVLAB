import {
  resolveInternalProductFeedbackAccess,
  type InternalProductFeedbackAccessResult,
} from '@/lib/auth/internal-product-feedback-access'

export type InternalOpsAccessMode = InternalProductFeedbackAccessResult['mode']
export type InternalOpsAccessResult = InternalProductFeedbackAccessResult

export async function resolveInternalOpsAccess(params: {
  userId: string;
  email?: string | null;
}): Promise<InternalOpsAccessResult> {
  return resolveInternalProductFeedbackAccess(params)
}
