import { useState } from 'react'
import { supabase } from '../supabaseClient'

function SignInForm() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setMessage('')
        setLoading(true)

        let result 
        if (isSignUp) {
            result = await supabase.auth.signUp({ email, password })
        } else {
            result = await supabase.auth.signInWithPassword( { email, password})
        }

        const { error } = result 
        if (error) {
            setError(error.message)
        } else {
            setMessage(isSignUp ? 'Check your email to confirm sign up.' : 'Signed in successfully!')
        }

        setLoading(false)
    }

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
          })
          if (error) console.log('OAuth error:', error.message)
    }

    return (
    
        <div className="flex flex-col items-center w-full max-w-sm mx-auto gap-6 p-6 bg-[#2D4739] text-[#C2B280] rounded-md shadow-lg">
      <h2 className="text-2xl font-bold">{isSignUp ? 'Sign Up' : 'Sign In'}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <input
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded p-2 bg-white text-black"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded p-2 bg-white text-black"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-green-700 hover:bg-green-800 text-white font-semibold py-2 rounded transition disabled:opacity-50"
        >
          {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>

      <div className="text-center text-sm">
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError('')
            setMessage('')
          }}
          className="underline text-blue-300 hover:text-blue-400 transition"
        >
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </button>
      </div>

      <button
        onClick={handleGoogleLogin}
        className="bg-blue-800 hover:bg-blue-900 text-white font-semibold py-2 px-4 rounded"
      >
        Sign in with Google
      </button>

      {error && <p className="text-red-400">{error}</p>}
      {message && <p className="text-green-400">{message}</p>}
    </div>
  )
}


export default SignInForm;