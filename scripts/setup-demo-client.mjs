import { createClient } from '@supabase/supabase-js'

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function optionalEnv(name, fallback = null) {
  const value = process.env[name]?.trim()
  return value ? value : fallback
}

async function findAuthUserByEmail(db, email) {
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((user) => user.email === email) ?? null
}

async function main() {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const coachId = requiredEnv('CLIENT_DEMO_COACH_ID')
  const email = requiredEnv('CLIENT_DEMO_EMAIL').toLowerCase()
  const password = requiredEnv('CLIENT_DEMO_PASSWORD')

  const firstName = optionalEnv('CLIENT_DEMO_FIRST_NAME', 'Demo')
  const lastName = optionalEnv('CLIENT_DEMO_LAST_NAME', 'Nutrition')
  const gender = optionalEnv('CLIENT_DEMO_GENDER', 'prefer_not_to_say')
  const timezone = optionalEnv('CLIENT_DEMO_TIMEZONE', 'Europe/Brussels')
  const language = optionalEnv('CLIENT_DEMO_LANGUAGE', 'fr')

  const db = createClient(supabaseUrl, serviceRoleKey)

  let authUser = await findAuthUserByEmail(db, email)
  if (!authUser) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        source: 'local-demo',
      },
    })
    if (error || !data.user) {
      throw error ?? new Error('Unable to create auth user')
    }
    authUser = data.user
    console.log(`Created auth user ${authUser.id}`)
  } else {
    const { error } = await db.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      ban_duration: 'none',
      user_metadata: {
        ...(authUser.user_metadata ?? {}),
        first_name: firstName,
        last_name: lastName,
        source: 'local-demo',
      },
    })
    if (error) throw error
    console.log(`Updated auth user ${authUser.id}`)
  }

  const { data: existingClient, error: existingClientError } = await db
    .from('coach_clients')
    .select('id')
    .eq('coach_id', coachId)
    .eq('email', email)
    .maybeSingle()

  if (existingClientError) throw existingClientError

  let clientId = existingClient?.id ?? null
  const payload = {
    coach_id: coachId,
    user_id: authUser.id,
    first_name: firstName,
    last_name: lastName,
    email,
    gender,
    timezone,
    status: 'active',
    password_set: true,
  }

  if (clientId) {
    const { error } = await db.from('coach_clients').update(payload).eq('id', clientId)
    if (error) throw error
    console.log(`Updated coach_clients row ${clientId}`)
  } else {
    const { data, error } = await db.from('coach_clients').insert(payload).select('id').single()
    if (error || !data) {
      throw error ?? new Error('Unable to create coach_clients row')
    }
    clientId = data.id
    console.log(`Created coach_clients row ${clientId}`)
  }

  const { error: preferencesError } = await db
    .from('client_preferences')
    .upsert(
      {
        client_id: clientId,
        language,
      },
      { onConflict: 'client_id' },
    )

  if (preferencesError) throw preferencesError

  console.log('')
  console.log('Demo client ready:')
  console.log(`- client_id: ${clientId}`)
  console.log(`- auth_user_id: ${authUser.id}`)
  console.log(`- email: ${email}`)
  console.log(`- password source: CLIENT_DEMO_PASSWORD`)
}

main().catch((error) => {
  console.error('Failed to provision demo client')
  console.error(error)
  process.exit(1)
})
