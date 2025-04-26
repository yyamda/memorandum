import { supabase } from '../supabaseClient'

export default function SignOutButton() {
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) console.error("error signing out: ", error.message)
    }

    return (
        <button onClick={handleLogout}>
            Sign Out
        </button>


    )
}