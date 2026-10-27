import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const headersList = headers()
  const authHeader = headersList.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const freq = searchParams.get('freq')

  if (!freq || !['weekly', 'monthly'].includes(freq)) {
    return new Response(JSON.stringify({ error: 'Invalid freq parameter' }), { status: 400 })
  }

  const { data, error } = await supabase
    .from('signal_filter_preferences')
    .select('filters,strategy,updated_at')
    .eq('user_id', user.id)
    .eq('freq', freq)
    .single()

  if (error) {
    // No preferences saved yet is not an error
    if (error.code === 'PGRST116') {
      return new Response(JSON.stringify({ filters: null, strategy: null, updated_at: null }))
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify(data))
}

export async function POST(request: Request) {
  try {
    const headersList = headers()
    const authHeader = headersList.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[signal-preferences POST] No auth header')
      return new Response(JSON.stringify({ error: 'Unauthorized: no auth header' }), { status: 401 })
    }

    const token = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('[signal-preferences POST] Auth error:', authError?.message)
      return new Response(JSON.stringify({ error: `Unauthorized: ${authError?.message || 'no user'}` }), { status: 401 })
    }

    const body = await request.json()
    const { freq, filters, strategy } = body

    if (!freq || !['weekly', 'monthly'].includes(freq) || !filters || !strategy) {
      console.error('[signal-preferences POST] Missing fields:', { freq, hasFilters: !!filters, hasStrategy: !!strategy })
      return new Response(JSON.stringify({ error: 'Missing required fields: freq, filters, strategy' }), { status: 400 })
    }

    console.log(`[signal-preferences POST] Saving for user ${user.id}, freq ${freq}`)

    const { error } = await supabase
      .from('signal_filter_preferences')
      .upsert({
        user_id: user.id,
        freq,
        filters,
        strategy,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.error('[signal-preferences POST] Upsert error:', error.message)
      return new Response(JSON.stringify({ error: `Database error: ${error.message}` }), { status: 500 })
    }

    console.log(`[signal-preferences POST] Success for user ${user.id}, freq ${freq}`)
    return new Response(JSON.stringify({ success: true }))
  } catch (err) {
    console.error('[signal-preferences POST] Unexpected error:', err)
    return new Response(JSON.stringify({ error: `Server error: ${err instanceof Error ? err.message : 'unknown'}` }), { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const headersList = headers()
  const authHeader = headersList.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const freq = searchParams.get('freq')

  if (!freq || !['weekly', 'monthly'].includes(freq)) {
    return new Response(JSON.stringify({ error: 'Invalid freq parameter' }), { status: 400 })
  }

  const { error } = await supabase
    .from('signal_filter_preferences')
    .delete()
    .eq('user_id', user.id)
    .eq('freq', freq)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }))
}
