import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from '../supabaseClient'
import { createClient } from '@supabase/supabase-js'


const AuthContext = createContext()

export const AuthProvider = ( { children }) => {
    const [user, setUser] = useState(null)
    const [userFriends, setUserFriends] = useState([])

    // fetch session sign in 
    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setUser(session?.user ?? null )

        }

        getSession() 

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    // fetch the user's friends when user logs in 
    useEffect(() => {
        const fetchFriends = async () => {
            if (!user) {
                setUserFriends([])
                return
            }
            
            console.log(user.id)
            let { data: social_relations, error } = await supabase 
                .from('social_relations')
                .select('*')
                .eq('user_id', user.id);

            if (error) {
                console.error("Error fetching friends: ", error)
                setUserFriends([]) 
            } else {
                console.log("got some friends")
                console.log(social_relations)
                setUserFriends(social_relations)
            }
        }
        fetchFriends()
    }, [user])

    return (
        <AuthContext.Provider value={{ user, userFriends, setUserFriends }}> 
            {children}

        </AuthContext.Provider>
    )
}


export const useAuth = () => useContext(AuthContext)
