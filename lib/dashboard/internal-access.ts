import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { resolveInternalProductFeedbackAccess } from '@/lib/auth/internal-product-feedback-access'
import {
  isDashboardRateLimited,
  maybeSendDashboardSecurityAlert,
  writeDashboardAccessAudit,
} from '@/lib/security/internal-dashboard-guard'
import { createDashboardServiceClient } from '@/lib/dashboard/service'
import {
  evaluateInternalSessionPosture,
  getInternalSessionPosture,
} from '@/lib/security/internal-session-posture'

export async function requireInternalDashboardAccess(req: NextRequest, dashboardKey: string) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  const db = createDashboardServiceClient()

  if (await isDashboardRateLimited({ db, dashboardKey, req })) {
    await writeDashboardAccessAudit({
      db,
      dashboardKey,
      req,
      outcome: 'rate_limited',
      reason: 'too_many_requests',
      userId: user?.id,
      userEmail: user?.email,
    })
    await maybeSendDashboardSecurityAlert({
      db,
      dashboardKey,
      req,
      reason: 'too_many_requests',
      userId: user?.id,
      userEmail: user?.email,
    })
    return { error: NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 }) }
  }

  if (authError || !user) {
    await writeDashboardAccessAudit({
      db,
      dashboardKey,
      req,
      outcome: 'unauthenticated',
      reason: 'missing_session',
    })
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  const access = resolveInternalProductFeedbackAccess({ userId: user.id, email: user.email })
  if (!access.allowed) {
    const reason = access.mode === 'unset' ? 'allowlist_not_configured' : 'uuid_not_allowlisted'
    const alertSent = await maybeSendDashboardSecurityAlert({
      db,
      dashboardKey,
      req,
      reason,
      userId: user.id,
      userEmail: user.email,
    })
    await writeDashboardAccessAudit({
      db,
      dashboardKey,
      req,
      outcome: 'denied',
      reason,
      userId: user.id,
      userEmail: user.email,
      alertSent,
    })
    return {
      error: NextResponse.json(
        { error: access.mode === 'unset' ? 'Allowlist interne non configurée' : 'Accès refusé' },
        { status: 403 },
      ),
    }
  }

  const { posture, policy } = await getInternalSessionPosture({
    supabase,
    req,
    user,
  })
  const postureCheck = evaluateInternalSessionPosture(posture)
  if (!postureCheck.ok) {
    const alertSent = await maybeSendDashboardSecurityAlert({
      db,
      dashboardKey,
      req,
      reason: postureCheck.reason,
      userId: user.id,
      userEmail: user.email,
    })
    await writeDashboardAccessAudit({
      db,
      dashboardKey,
      req,
      outcome: 'denied',
      reason: postureCheck.reason,
      userId: user.id,
      userEmail: user.email,
      alertSent,
    })
    return {
      error: NextResponse.json(
        {
          error:
            postureCheck.reason === 'mfa_required'
              ? 'MFA requise'
              : postureCheck.reason === 'reauth_required'
                ? 'Réauthentification requise'
                : 'Accès refusé',
        },
        { status: 403 },
      ),
    }
  }

  await writeDashboardAccessAudit({
    db,
    dashboardKey,
    req,
    outcome: 'allowed',
    reason: 'uuid_allowlisted',
    userId: user.id,
    userEmail: user.email,
  })

  return { db, user, posture, policy }
}
