'use client'

import { createClient } from '@/lib/supabase/client'  
import { useState } from 'react'  
import { useRouter } from 'next/navigation'  
import Link from 'next/link'

export default function LoginPage() {  
  const [email, setEmail] = useState('')  
  const [password, setPassword] = useState('')  
  const [error, setError] = useState<string | null>(null)  
  const [loading, setLoading] = useState(false)  
  const router = useRouter()  
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {  
    e.preventDefault()  
    setLoading(true)  
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({  
      email,  
      password,  
    })

    if (error) {  
      setError(error.message)  
      setLoading(false)  
    } else {  
      router.push('/dashboard')  
      router.refresh()  
    }  
  }

  return (  
    <div className="min-h-screen flex items-center justify-center bg-gray-50">  
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">  
        <div>  
          <h1 className="text-3xl font-bold text-center text-gray-900">Getflowetic</h1>  
          <h2 className="mt-2 text-center text-gray-600">Sign in to your account</h2>  
        </div>  
          
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>  
          {error && (  
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">  
              {error}  
            </div>  
          )}  
            
          <div className="space-y-4">  
            <div>  
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">  
                Email address  
              </label>  
              <input  
                id="email"  
                name="email"  
                type="email"  
                autoComplete="email"  
                required  
                value={email}  
                onChange={(e) => setEmail(e.target.value)}  
                className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"  
                placeholder="you@example.com"  
              />  
            </div>  
              
            <div>  
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">  
                Password  
              </label>  
              <input  
                id="password"  
                name="password"  
                type="password"  
                autoComplete="current-password"  
                required  
                value={password}  
                onChange={(e) => setPassword(e.target.value)}  
                className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"  
                placeholder="••••••••"  
              />  
            </div>  
          </div>

          <button  
            type="submit"  
            disabled={loading}  
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"  
          >  
            {loading ? 'Signing in...' : 'Sign in'}  
          </button>  
        </form>

        <p className="text-center text-sm text-gray-600">  
          Don't have an account?{' '}  
          <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">  
            Sign up  
          </Link>  
        </p>  
      </div>  
    </div>  
  )  
}