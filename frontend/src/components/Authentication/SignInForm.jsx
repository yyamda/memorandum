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
    
        <div>
            <h2>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>

            <form onSubmit={handleSubmit}>
                <input
                type="email"
                placeholder="Email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                />
                <input
                type="password"
                placeholder="Password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit" disabled={loading}>
                {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
                </button>
            </form>

            <p style={{ marginTop: 10 }}>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                type="button"
                onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError('')
                    setMessage('')
                }}
                >
                {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
            </p>

            <button onClick={handleGoogleLogin} >
                Sign in with Google
            </button>

            {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}
            {message && <p style={{ color: 'green', marginTop: 10 }}>{message}</p>}
        </div>
  )
}


export default SignInForm;