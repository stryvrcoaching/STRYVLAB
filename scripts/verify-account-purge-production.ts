import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  previewCoachAccountPurge,
  purgeCoachAccount,
  type AccountPurgeJob,
} from '@/lib/privacy/account-purge'

const TEST_MARKER = 'synthetic_account_purge_verification'
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

function requireSafeEnvironment() {
  if (process.env.ALLOW_PRODUCTION_PURGE_TEST !== 'yes') {
    throw new Error('Set ALLOW_PRODUCTION_PURGE_TEST=yes to run this destructive synthetic test.')
  }
  if (process.env.ACCOUNT_PURGE_ENABLED === 'true') {
    throw new Error('Disable ACCOUNT_PURGE_ENABLED before running the synthetic test.')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service credentials.')
  return { url, key }
}

function isMissingUser(error: { status?: number; code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''
  return error?.status === 404 || error?.code === 'user_not_found' || message.includes('user not found')
}

async function main() {
  const { url, key } = requireSafeEnvironment()
  const db = createClient(url, key)
  const runId = randomUUID()
  const coachEmail = `purge-coach-${runId}@example.invalid`
  const clientEmail = `purge-client-${runId}@example.invalid`
  const password = `Purge-${randomUUID()}-Aa1!`

  let coachId: string | null = null
  let clientUserId: string | null = null
  let clientId: string | null = null
  let jobId: string | null = null
  let completed = false

  try {
    const coachAuth = await db.auth.admin.createUser({
      email: coachEmail,
      password,
      email_confirm: true,
      user_metadata: { synthetic_test: TEST_MARKER, run_id: runId },
    })
    if (coachAuth.error || !coachAuth.data.user) throw coachAuth.error ?? new Error('Coach auth creation failed')
    coachId = coachAuth.data.user.id

    const clientAuth = await db.auth.admin.createUser({
      email: clientEmail,
      password,
      email_confirm: true,
      user_metadata: { synthetic_test: TEST_MARKER, run_id: runId },
    })
    if (clientAuth.error || !clientAuth.data.user) throw clientAuth.error ?? new Error('Client auth creation failed')
    clientUserId = clientAuth.data.user.id

    const endedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000)
    const scheduledFor = new Date(Date.now() - 60 * 60 * 1000)
    const profile = await db.from('coach_profiles').insert({
      coach_id: coachId,
      full_name: 'Synthetic Purge Coach',
      brand_name: TEST_MARKER,
      pro_email: coachEmail,
      plan: 'solo',
      billing_status: 'canceled',
      billing_ended_at: endedAt.toISOString(),
      data_export_available_until: scheduledFor.toISOString(),
      data_deletion_scheduled_at: scheduledFor.toISOString(),
    })
    if (profile.error) throw profile.error

    const client = await db.from('coach_clients').insert({
      coach_id: coachId,
      user_id: clientUserId,
      first_name: 'Synthetic',
      last_name: 'Purge Client',
      email: clientEmail,
      status: 'active',
    }).select('id').single()
    if (client.error || !client.data) throw client.error ?? new Error('Client creation failed')
    clientId = String(client.data.id)

    const coachFilePath = `${coachId}/purge-test.png`
    const clientFilePath = `${clientId}/purge-test.png`
    const [coachFile, clientFile] = await Promise.all([
      db.storage.from('coach-assets').upload(coachFilePath, ONE_PIXEL_PNG, {
        contentType: 'image/png',
        upsert: false,
      }),
      db.storage.from('profile-photos').upload(clientFilePath, ONE_PIXEL_PNG, {
        contentType: 'image/png',
        upsert: false,
      }),
    ])
    if (coachFile.error) throw coachFile.error
    if (clientFile.error) throw clientFile.error

    const preview = await previewCoachAccountPurge(db, coachId)
    if (!preview.eligible) throw new Error(`Synthetic preview blocked: ${preview.blockers.join(',')}`)
    if (preview.clientCount !== 1 || preview.clientAuthCandidates !== 1) {
      throw new Error('Synthetic preview client inventory mismatch.')
    }
    const previewFileCount = preview.storage.reduce((total, bucket) => total + bucket.files, 0)
    if (previewFileCount < 2) throw new Error('Synthetic preview did not inventory both files.')

    const job = await db.from('account_purge_jobs').update({
      status: 'processing',
      attempt_count: 1,
      started_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq('coach_id', coachId).select('*').single()
    if (job.error || !job.data) throw job.error ?? new Error('Synthetic purge job unavailable')
    jobId = String(job.data.id)

    const outcome = await purgeCoachAccount(db, job.data as AccountPurgeJob)
    if (outcome.status !== 'completed') throw new Error(`Unexpected purge outcome: ${outcome.status}`)

    const [coachUser, clientUser, profileAfter, clientAfter, jobAfter, coachFiles, clientFiles] = await Promise.all([
      db.auth.admin.getUserById(coachId),
      db.auth.admin.getUserById(clientUserId),
      db.from('coach_profiles').select('coach_id').eq('coach_id', coachId).maybeSingle(),
      db.from('coach_clients').select('id').eq('id', clientId).maybeSingle(),
      db.from('account_purge_jobs').select('id, status, manifest, completed_at').eq('id', jobId).single(),
      db.storage.from('coach-assets').list(coachId),
      db.storage.from('profile-photos').list(clientId),
    ])

    if (!coachUser.error || !isMissingUser(coachUser.error)) throw new Error('Coach auth account still exists.')
    if (!clientUser.error || !isMissingUser(clientUser.error)) throw new Error('Client auth account still exists.')
    if (profileAfter.error || profileAfter.data) throw new Error('Coach profile still exists.')
    if (clientAfter.error || clientAfter.data) throw new Error('Coach client row still exists.')
    if (jobAfter.error || jobAfter.data?.status !== 'completed' || !jobAfter.data.completed_at) {
      throw new Error('Purge proof is incomplete.')
    }
    if ((coachFiles.data ?? []).some((file) => file.name === 'purge-test.png')) {
      throw new Error('Coach storage file still exists.')
    }
    if ((clientFiles.data ?? []).some((file) => file.name === 'purge-test.png')) {
      throw new Error('Client storage file still exists.')
    }

    const manifest = typeof jobAfter.data.manifest === 'object' && jobAfter.data.manifest
      ? jobAfter.data.manifest
      : {}
    await db.from('account_purge_jobs').update({
      manifest: {
        ...manifest,
        verification: {
          synthetic: true,
          marker: TEST_MARKER,
          run_id: runId,
          verified_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)

    completed = true
    console.log(JSON.stringify({
      ok: true,
      runId,
      preview: {
        eligible: preview.eligible,
        clients: preview.clientCount,
        clientAuthCandidates: preview.clientAuthCandidates,
        inventoriedFiles: previewFileCount,
      },
      outcome,
      proof: { jobId, status: 'completed' },
    }))
  } finally {
    if (!completed) {
      if (coachId) await db.storage.from('coach-assets').remove([`${coachId}/purge-test.png`])
      if (clientId) await db.storage.from('profile-photos').remove([`${clientId}/purge-test.png`])
      if (coachId) await db.from('coach_clients').delete().eq('coach_id', coachId)
      if (coachId) await db.from('coach_profiles').delete().eq('coach_id', coachId)
      if (clientUserId) await db.auth.admin.deleteUser(clientUserId)
      if (coachId) await db.auth.admin.deleteUser(coachId)
      if (jobId) {
        await db.from('account_purge_jobs').update({
          status: 'failed',
          last_error: 'Synthetic verification failed; synthetic account cleanup attempted.',
          updated_at: new Date().toISOString(),
        }).eq('id', jobId)
      }
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : 'Unknown synthetic purge verification error',
  }))
  process.exitCode = 1
})
