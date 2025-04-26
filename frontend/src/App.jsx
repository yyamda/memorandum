import { useState } from 'react';
import WebcamAudioCapture from './components/WebcamAudioCapture';
import { useAuth } from './components/Authentication/AuthContext';
import SignInForm from './components/Authentication/SignInForm';
import SignOutButton from './components/Authentication/Signout';

function App() {
  const { user, userFriends } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4"
         style={{ backgroundColor: '#2D4739', color: '#C2B280' }} // Army dark green background, light brown text
    >
      {user ? (
        <div className="w-full p-4 flex flex-col gap-4 border-4"
             style={{ borderColor: '#C2B280' }} // Light brown border
        >
          <div className="text-lg font-semibold" style={{ color: '#D2B48C' }}>
            User Logged In
            <SignOutButton />
          </div>
          <WebcamAudioCapture />
          
        </div>
      ) : (
        <div className="w-full max-w-md flex flex-col items-center justify-center p-8 border-4"
             style={{ borderColor: '#C2B280' }}
        >
          <div className="text-lg font-semibold mb-4" style={{ color: '#D2B48C' }}>
            User Not Logged In
          </div>
          <SignInForm />
        </div>
      )}
    </div>
  );
}

export default App;