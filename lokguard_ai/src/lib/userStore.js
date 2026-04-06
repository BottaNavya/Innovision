import { supabase } from '../supabaseClient'

const USERS_TABLE_MISSING_PATTERN = /could not find the table ['"`]public\.users['"`] in the schema cache|relation "public\.users" does not exist|schema cache/i

const isUsersTableMissingError = (error) => {
  const message = String(error?.message || error?.details || error?.hint || '')
  return USERS_TABLE_MISSING_PATTERN.test(message)
}

const storeLocalProfileFallback = (userId, payload) => {
  if (!userId) return

  try {
    const existing = JSON.parse(localStorage.getItem('user') || '{}')
    const next = {
      ...existing,
      ...payload,
      id: userId,
      pendingSync: true,
      updatedAt: new Date().toISOString(),
    }

    localStorage.setItem('user', JSON.stringify(next))
    localStorage.setItem(
      'lokguard_profile_shadow',
      JSON.stringify({
        id: userId,
        ...payload,
        savedAt: new Date().toISOString(),
      })
    )
  } catch {
    // Ignore local storage failures.
  }
}

const readLocalProfileFallback = (userId) => {
  if (!userId) return null

  try {
    const shadow = JSON.parse(localStorage.getItem('lokguard_profile_shadow') || 'null')
    if (shadow && shadow.id === userId) {
      return shadow
    }
  } catch {
    // Ignore malformed local storage.
  }

  return null
}

export async function resolveLoginEmail(identifier) {
  const inputIdentifier = (identifier || '').trim()
  if (!inputIdentifier) return ''

  const { data, error } = await supabase.rpc('resolve_login_email', {
    input_identifier: inputIdentifier,
  })

  if (error) throw error
  return data || ''
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user || null
}

export async function getCurrentUserId() {
  const user = await getCurrentUser()
  return user?.id || ''
}

export async function fetchUserProfile(userId) {
  if (!userId) return null

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    if (isUsersTableMissingError(error)) {
      return readLocalProfileFallback(userId)
    }

    throw error
  }

  return data
}

export async function upsertUserProfile(userId, payload) {
  if (!userId) throw new Error('Missing user id for profile upsert.')

  const now = new Date().toISOString()
  const record = {
    id: userId,
    ...payload,
    updated_at: now,
  }

  const { error } = await supabase
    .from('users')
    .upsert(record, { onConflict: 'id' })

  if (error) {
    if (isUsersTableMissingError(error)) {
      storeLocalProfileFallback(userId, payload)
      return
    }

    throw error
  }

  storeLocalProfileFallback(userId, payload)
}

export async function uploadUserDocument(userId, bucket, file, prefix) {
  if (!userId || !file) return ''

  const safeName = file.name.replace(/\s+/g, '_')
  const path = `${userId}/${prefix}_${Date.now()}_${safeName}`

  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .upload(path, file, { upsert: true })

  if (uploadError) {
    const uploadMessage = String(uploadError?.message || '').toLowerCase()
    if (uploadMessage.includes('bucket') && uploadMessage.includes('not found')) {
      const normalizedError = new Error("Storage bucket 'user-documents' not found. Create it in Supabase Storage and try again.")
      normalizedError.code = 'storage/bucket-not-found'
      throw normalizedError
    }

    throw uploadError
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl || ''
}
