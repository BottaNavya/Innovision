import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasPlaceholderValues =
  SUPABASE_URL?.includes('your-project-ref') ||
  SUPABASE_ANON_KEY?.includes('your_supabase_anon_key')

export const supabaseConfigError =
  'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the Vite dev server.'

export const isSupabaseConfigured =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) && !hasPlaceholderValues

const makeConfigError = () => new Error(supabaseConfigError)

const createUnconfiguredClient = () => {
  const queryBuilder = {
    select() {
      return this
    },
    eq() {
      return this
    },
    maybeSingle: async () => ({ data: null, error: makeConfigError() }),
    upsert: async () => ({ data: null, error: makeConfigError() }),
  }

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: makeConfigError() }),
      getUser: async () => ({ data: { user: null }, error: makeConfigError() }),
      signInWithOtp: async () => ({ data: null, error: makeConfigError() }),
      verifyOtp: async () => ({ data: null, error: makeConfigError() }),
      signOut: async () => ({ error: makeConfigError() }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
    },
    from: () => queryBuilder,
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: makeConfigError() }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  }
}

if (!isSupabaseConfigured) {
  console.error(supabaseConfigError)
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createUnconfiguredClient()
