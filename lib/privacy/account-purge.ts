import type { SupabaseClient } from '@supabase/supabase-js'

const STORAGE_PAGE_SIZE = 1000
const STORAGE_DELETE_BATCH_SIZE = 100

type StorageTarget = {
  bucket: string
  prefixes: string[]
  exactPaths?: string[]
}

export type AccountPurgeManifest = {
  version: 1
  preparedAt: string
  clientIds: string[]
  clientUserIds: string[]
  storageTargets: StorageTarget[]
  externalProviderReview: string[]
  authDeletedAt?: string
  storageDeletedAt?: string
  clientAuthReview?: {
    candidates: number
    deleted: number
  }
}

export type AccountPurgeJob = {
  id: string
  coach_id: string
  status: string
  scheduled_for: string
  attempt_count: number
  manifest?: Partial<AccountPurgeManifest> | null
}

type PurgeOutcome =
  | { status: 'completed'; deletedFiles: number }
  | { status: 'legal_review'; reason: string }
  | { status: 'canceled'; reason: string }

export type AccountPurgePreview = {
  coachId: string
  eligible: boolean
  blockers: string[]
  scheduledFor: string | null
  clientCount: number
  clientAuthCandidates: number
  storage: Array<{ bucket: string; files: number }>
  externalProviderReview: string[]
}

function isMissingBucketError(error: { message?: string; statusCode?: string | number } | null) {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return error.statusCode === 404 || error.statusCode === '404' || message.includes('bucket not found')
}

function normalizedPath(...parts: string[]) {
  return parts.map((part) => part.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')
}

async function listStorageFiles(
  db: SupabaseClient,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 20) throw new Error(`Storage traversal depth exceeded for ${bucket}/${prefix}`)

  const paths: string[] = []
  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data, error } = await db.storage.from(bucket).list(prefix, {
      limit: STORAGE_PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (isMissingBucketError(error)) return []
    if (error) throw new Error(`Unable to list ${bucket}/${prefix}: ${error.message}`)

    const page = data ?? []
    for (const item of page) {
      if (item.name === '.emptyFolderPlaceholder') continue
      const itemPath = normalizedPath(prefix, item.name)
      if (item.id || item.metadata) {
        paths.push(itemPath)
      } else {
        paths.push(...await listStorageFiles(db, bucket, itemPath, depth + 1))
      }
    }

    if (page.length < STORAGE_PAGE_SIZE) break
  }

  return paths
}

async function removeStoragePaths(db: SupabaseClient, bucket: string, paths: string[]) {
  let deleted = 0
  const uniquePaths = [...new Set(paths.filter(Boolean))]

  for (let index = 0; index < uniquePaths.length; index += STORAGE_DELETE_BATCH_SIZE) {
    const batch = uniquePaths.slice(index, index + STORAGE_DELETE_BATCH_SIZE)
    const { error } = await db.storage.from(bucket).remove(batch)
    if (isMissingBucketError(error)) return deleted
    if (error) throw new Error(`Unable to remove files from ${bucket}: ${error.message}`)
    deleted += batch.length
  }

  return deleted
}

export async function removeAccountStorage(
  db: SupabaseClient,
  targets: StorageTarget[],
) {
  let deletedFiles = 0

  for (const target of targets) {
    const listed = (
      await Promise.all(target.prefixes.map((prefix) => listStorageFiles(db, target.bucket, prefix)))
    ).flat()
    deletedFiles += await removeStoragePaths(
      db,
      target.bucket,
      [...listed, ...(target.exactPaths ?? [])],
    )
  }

  return deletedFiles
}

async function countAccountStorage(
  db: SupabaseClient,
  targets: StorageTarget[],
) {
  const inventory: Array<{ bucket: string; files: number }> = []

  for (const target of targets) {
    const listed = (
      await Promise.all(target.prefixes.map((prefix) => listStorageFiles(db, target.bucket, prefix)))
    ).flat()
    const uniquePaths = new Set([...listed, ...(target.exactPaths ?? [])].filter(Boolean))
    inventory.push({ bucket: target.bucket, files: uniquePaths.size })
  }

  return inventory
}

async function financialRetentionReason(db: SupabaseClient, coachId: string) {
  const checks = await Promise.all([
    db.from('coach_invoices').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
    db.from('subscription_payments').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
    db.from('sales_commissions').select('id', { count: 'exact', head: true }).eq('coach_id', coachId),
    db.from('sales_partners').select('id', { count: 'exact', head: true }).eq('user_id', coachId),
  ])

  const failed = checks.find((check) => check.error)
  if (failed?.error) throw new Error(`Financial retention check failed: ${failed.error.message}`)

  const labels = ['coach_invoices', 'subscription_payments', 'sales_commissions', 'sales_partner']
  const present = checks
    .map((check, index) => ((check.count ?? 0) > 0 ? labels[index] : null))
    .filter((label): label is string => Boolean(label))

  return present.length > 0 ? `financial_records_present:${present.join(',')}` : null
}

async function prepareManifest(db: SupabaseClient, coachId: string): Promise<AccountPurgeManifest> {
  const [clientsResult, thumbnailsResult] = await Promise.all([
    db.from('coach_clients').select('id, user_id').eq('coach_id', coachId),
    db.from('morpho_annotations').select('thumbnail_path').eq('coach_id', coachId).not('thumbnail_path', 'is', null),
  ])

  if (clientsResult.error) throw new Error(`Unable to inventory clients: ${clientsResult.error.message}`)
  if (thumbnailsResult.error) throw new Error(`Unable to inventory thumbnails: ${thumbnailsResult.error.message}`)

  const clientIds = (clientsResult.data ?? []).map((client) => String(client.id))
  const clientUserIds = [...new Set((clientsResult.data ?? [])
    .map((client) => typeof client.user_id === 'string' ? client.user_id : null)
    .filter((userId): userId is string => Boolean(userId) && userId !== coachId))]
  const thumbnailPaths = (thumbnailsResult.data ?? [])
    .map((row) => typeof row.thumbnail_path === 'string' ? row.thumbnail_path : null)
    .filter((path): path is string => Boolean(path))

  return {
    version: 1,
    preparedAt: new Date().toISOString(),
    clientIds,
    clientUserIds,
    storageTargets: [
      { bucket: 'coach-assets', prefixes: [coachId] },
      { bucket: 'assessment-photos', prefixes: [coachId] },
      { bucket: 'profile-photos', prefixes: clientIds },
      { bucket: 'morpho-photos', prefixes: clientIds, exactPaths: thumbnailPaths },
      { bucket: 'meal-photos', prefixes: clientIds },
      { bucket: 'nutrition-photo-logs', prefixes: clientIds },
      { bucket: 'chat-attachments', prefixes: clientIds },
      { bucket: 'exercise-images', prefixes: [coachId, `rewards/${coachId}`] },
      { bucket: 'exercise-media', prefixes: [`custom-exercises/${coachId}`] },
    ],
    externalProviderReview: ['Stripe', 'Resend', 'Vercel', 'Supabase backups'],
  }
}

export async function previewCoachAccountPurge(
  db: SupabaseClient,
  coachId: string,
): Promise<AccountPurgePreview> {
  const { data: profile, error } = await db
    .from('coach_profiles')
    .select('billing_status, data_deletion_scheduled_at')
    .eq('coach_id', coachId)
    .maybeSingle()

  if (error) throw new Error(`Unable to verify coach profile: ${error.message}`)
  if (!profile) throw new Error('Coach profile not found')

  const blockers: string[] = []
  if (profile.billing_status !== 'canceled') blockers.push('account_not_canceled')

  const scheduledFor = typeof profile.data_deletion_scheduled_at === 'string'
    ? profile.data_deletion_scheduled_at
    : null
  if (!scheduledFor) {
    blockers.push('deletion_not_scheduled')
  } else if (new Date(scheduledFor) > new Date()) {
    blockers.push('retention_window_open')
  }

  const legalReason = await financialRetentionReason(db, coachId)
  if (legalReason) blockers.push(legalReason)

  const manifest = await prepareManifest(db, coachId)
  const storage = await countAccountStorage(db, manifest.storageTargets)

  return {
    coachId,
    eligible: blockers.length === 0,
    blockers,
    scheduledFor,
    clientCount: manifest.clientIds.length,
    clientAuthCandidates: manifest.clientUserIds.length,
    storage,
    externalProviderReview: manifest.externalProviderReview,
  }
}

async function scrubRetainedLogs(db: SupabaseClient, coachId: string, jobId: string) {
  const pseudonymousEmail = `deleted-${jobId}@privacy.invalid`
  const salesLeads = await db.from('sales_leads').select('id').eq('coach_id', coachId)
  if (salesLeads.error) throw new Error(`Unable to inventory retained sales leads: ${salesLeads.error.message}`)

  const operations = [
    db.from('privacy_requests').update({
      requester_email: pseudonymousEmail,
      request_details: null,
      outcome_summary: 'Account data purged; minimal request evidence retained.',
      updated_at: new Date().toISOString(),
    }).eq('requester_user_id', coachId),
    db.from('security_events').update({
      actor_email: null,
      ip_address: null,
      user_agent: null,
      meta: {},
    }).eq('actor_user_id', coachId),
    db.from('security_incidents').update({
      actor_email: null,
      ip_address: null,
      meta: {},
    }).eq('actor_user_id', coachId),
    db.from('sensitive_operation_audit').update({
      actor_email: null,
      ip_address: null,
      user_agent: null,
      payload: {},
    }).eq('actor_user_id', coachId),
    db.from('internal_dashboard_access_audit').update({
      user_email: null,
      ip_address: null,
      user_agent: null,
    }).eq('user_id', coachId),
    db.from('product_events').delete().eq('user_id', coachId),
  ]

  const results = await Promise.all(operations)
  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error(`Unable to minimize retained logs: ${failed.error.message}`)

  for (const [index, lead] of (salesLeads.data ?? []).entries()) {
    const leadEmail = `deleted-${jobId}-${index}@privacy.invalid`
    const { error } = await db.from('sales_leads').update({
      contact_name: 'Compte supprimé',
      email: leadEmail,
      normalized_email: leadEmail,
      company_name: null,
      phone: null,
      notes: null,
      next_follow_up_at: null,
      status: 'archived',
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)
    if (error) throw new Error(`Unable to minimize retained sales lead: ${error.message}`)
  }
}

function isMissingAuthUser(error: { message?: string; status?: number; code?: string } | null) {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return error.status === 404 || error.code === 'user_not_found' || message.includes('user not found')
}

async function ensureJobStillProcessing(db: SupabaseClient, jobId: string) {
  const { data, error } = await db
    .from('account_purge_jobs')
    .select('status')
    .eq('id', jobId)
    .single()

  if (error) throw new Error(`Unable to verify purge job: ${error.message}`)
  return data?.status === 'processing'
}

async function deleteOrphanClientAuthUsers(
  db: SupabaseClient,
  clientUserIds: string[],
) {
  let deleted = 0

  for (const userId of clientUserIds) {
    const { count, error } = await db
      .from('coach_clients')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) throw new Error(`Unable to verify client auth ownership: ${error.message}`)
    if ((count ?? 0) > 0) continue

    const { error: deleteError } = await db.auth.admin.deleteUser(userId)
    if (deleteError && !isMissingAuthUser(deleteError)) {
      throw new Error(`Unable to delete orphan client auth account: ${deleteError.message}`)
    }
    deleted += 1
  }

  return deleted
}

export async function purgeCoachAccount(
  db: SupabaseClient,
  job: AccountPurgeJob,
): Promise<PurgeOutcome> {
  let manifest = job.manifest?.version === 1
    ? job.manifest as AccountPurgeManifest
    : null

  if (!manifest) {
    const { data: profile, error: profileError } = await db
      .from('coach_profiles')
      .select('billing_status, data_deletion_scheduled_at')
      .eq('coach_id', job.coach_id)
      .maybeSingle()

    if (profileError) throw new Error(`Unable to verify coach profile: ${profileError.message}`)
    if (!profile || profile.billing_status !== 'canceled') {
      await db.from('account_purge_jobs').update({
        status: 'canceled',
        last_error: 'Account is no longer canceled.',
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      return { status: 'canceled', reason: 'account_not_canceled' }
    }

    const legalReason = await financialRetentionReason(db, job.coach_id)
    if (legalReason) {
      await db.from('account_purge_jobs').update({
        status: 'legal_review',
        legal_hold_reason: legalReason,
        next_attempt_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      return { status: 'legal_review', reason: legalReason }
    }

    manifest = await prepareManifest(db, job.coach_id)
    const saved = await db.from('account_purge_jobs').update({
      manifest,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)
    if (saved.error) throw new Error(`Unable to save purge manifest: ${saved.error.message}`)
  }

  if (!await ensureJobStillProcessing(db, job.id)) {
    return { status: 'canceled', reason: 'job_no_longer_processing' }
  }

  await scrubRetainedLogs(db, job.coach_id, job.id)

  const { error: authDeleteError } = await db.auth.admin.deleteUser(job.coach_id)
  if (authDeleteError && !isMissingAuthUser(authDeleteError)) {
    throw new Error(`Unable to delete auth account: ${authDeleteError.message}`)
  }

  const deletedClientAuthUsers = await deleteOrphanClientAuthUsers(
    db,
    manifest.clientUserIds ?? [],
  )

  manifest = {
    ...manifest,
    authDeletedAt: new Date().toISOString(),
    clientAuthReview: {
      candidates: manifest.clientUserIds?.length ?? 0,
      deleted: deletedClientAuthUsers,
    },
  }
  const authMarked = await db.from('account_purge_jobs').update({
    manifest,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id)
  if (authMarked.error) throw new Error(`Unable to record auth deletion: ${authMarked.error.message}`)

  const deletedFiles = await removeAccountStorage(db, manifest.storageTargets)
  manifest = { ...manifest, storageDeletedAt: new Date().toISOString() }

  const completedAt = new Date().toISOString()
  const completed = await db.from('account_purge_jobs').update({
    status: 'completed',
    completed_at: completedAt,
    next_attempt_at: null,
    last_error: null,
    manifest,
    updated_at: completedAt,
  }).eq('id', job.id)
  if (completed.error) throw new Error(`Unable to complete purge job: ${completed.error.message}`)

  await db.from('privacy_requests').update({
    status: 'completed',
    completed_at: completedAt,
    updated_at: completedAt,
  }).eq('requester_email', `deleted-${job.id}@privacy.invalid`).eq('request_type', 'erasure')

  return { status: 'completed', deletedFiles }
}
