import { useState } from 'react'
import WebcamAudioCapture from './components/WebcamAudioCapture';
import { useAuth } from './components/Authentication/AuthContext';
import SignInForm  from './components/Authentication/SignInForm';
import SignOutButton from './components/Authentication/Signout';


function App() {
  const { user, userFriends } = useAuth()

  return (
      <div>
        {user ? (
          <div>
            User Logged In
            <WebcamAudioCapture/>
            <SignOutButton/>
          </div>
        ) : (
          <div>
            User Not Logged In
            <SignInForm/>
          </div>
        )}
      </div>
  )
}

export default App
