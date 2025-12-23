import { createClient } from '@/lib/supabase/server'  
import { NextResponse } from 'next/server'

export async function GET(request: Request) {  
  const { searchParams, origin } = new URL(request.url)  
  const code = searchParams.get('code')  
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {  
    const supabase = await createClient()  
    const { error } = await supabase.auth.exchangeCodeForSession(code)  
      
    if (!error) {  
      // Check if user has a tenant, if not create one  
      const { data: { user } } = await supabase.auth.getUser()  
        
      if (user) {  
        const { data: memberships } = await supabase  
          .from('memberships')  
          .select('tenant_id')  
          .eq('user_id', user.id)  
          .limit(1)  
          
        // If no membership, create a default tenant  
        if (!memberships || memberships.length === 0) {  
          const { data: tenant } = await supabase  
            .from('tenants')  
            .insert({ name: user.email?.split('@')[0] + "'s Workspace" })  
            .select()  
            .single()  
            
          if (tenant) {  
            await supabase  
              .from('memberships')  
              .insert({ tenant_id: tenant.id, user_id: user.id, role: 'admin' })  
          }  
        }  
      }  
        
      return NextResponse.redirect(`${origin}${next}`)  
    }  
  }

  // Return the user to an error page with instructions  
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)  
}