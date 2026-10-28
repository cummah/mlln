import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

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
    .eq('freq', freq)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return new Response(JSON.stringify({ filters: null, strategy: null, updated_at: null }))
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify(data))
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const body = await request.json()
    const { freq, filters, strategy } = body

    if (!freq || !['weekly', 'monthly'].includes(freq) || !filters || !strategy) {
      return new Response(JSON.stringify({ error: 'Missing required fields: freq, filters, strategy' }), { status: 400 })
    }

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
      return new Response(JSON.stringify({ error: `Database error: ${error.message}` }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true }))
  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${err instanceof Error ? err.message : 'unknown'}` }), { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

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
    .eq('freq', freq)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }))
}
