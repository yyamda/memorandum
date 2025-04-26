import { supabase } from '../supabaseClient'

export default function SignOutButton() {
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) console.error("error signing out: ", error.message)
    }

    return (
        <button onClick={handleLogout}
        className="mt-4 bg-yellow-900 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition"
    >
      Sign Out
    </button>


    )
}