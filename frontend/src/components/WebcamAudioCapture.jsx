import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from './Authentication/AuthContext'
import {
  loadModels,
  detectFacesWithDescriptors, 
  averageFaceDescriptors,
} from './ImageDetection/face_api_index';
import * as faceapi from 'face-api.js';
import { supabase } from './supabaseClient'
import AudioStreamer from './AudioStreamer'
import { v4 as uuidv4 } from 'uuid';
import { io } from 'socket.io-client';

import socket from './socket'; // shared FE socket

function WebcamAudioCapture() {
  const videoRef = useRef();
  const [isStreaming, setIsStreaming] = useState(false);
  const [stream, setStream] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const { user, userFriends, setUserFriends } = useAuth();
  const matchedFriendIdRef = useState("");
  const lastSentFriendIdRef = useRef("");
  const [serverSocketId, setServerSocketId] = useState("");

  const canvasRef = useRef();
  const [memories, setMemories] = useState([]);
  const memoryFetchIntervalRef = useRef(null);


  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    socket.on('server_sid', ({ sid }) => {
      console.log("🔁 Got server SID:", sid);
      setServerSocketId(sid);
    });
  }, []);

  socket.on('connect', () => {
    console.log("Socket ID:", socket.id);
  });

  const fetchMemories = async () => {

    try {
      console.log("Fetch request to backend for friend memories")
      const response = await fetch('http://localhost:5001/api/retrieve_memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          query_text: "memory context",
          session_id: serverSocketId
        })
      });


      const data = await response.json();
      console.log("Retrieved memories", data.memories)
      if (data.memories) {
        setMemories(data.memories);
      }
    } catch (error) {
      console.error("Failed to fetch memories: ", error)
    }
  };

  const startWebcamAndAudio = async () => {

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      videoRef.current.srcObject = newStream;
      setStream(newStream);
      setIsStreaming(true);

      // await fetchMemories(); // fetch when webcame starts

      memoryFetchIntervalRef.current = setInterval(() => {
        fetchMemories(); // fetch every 60 seconds 
      }, 30000);

    } catch (err) {
      console.error("Error accessing webcam and audio:", err);
    }
  };

  const endWebcamAndAudio = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setIsStreaming(false);
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    clearInterval(memoryFetchIntervalRef.current);

  };

  const notifyServerFriendId = (friendId) => {
    if (!socket || !socket.connected) return;
  
    fetch('http://localhost:5001/api/friend-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        friend_id: friendId,
        session_id: serverSocketId
      })
    })
      .then(res => res.json())
      .then(data => console.log("✅ Sent friend_id to backend:", friendId))
      .catch(err => console.error("❌ Failed to send friend_id:", err));
  };

  const registerOrAppendFace = async (descriptor) => {
    if (isRegistering || !descriptor) return;

    try {
      setIsRegistering(true);

      let closestMatch = null;
      let closestDistance = Infinity;

      for (const friend of userFriends) {
        const existingEmbeddings = friend.face_embedding || [];
        const average = averageFaceDescriptors(existingEmbeddings);

        const dist_to_average = faceapi.euclideanDistance(descriptor, average);

        if (dist_to_average < closestDistance) {
          closestDistance = dist_to_average;
          closestMatch = friend;
        }
      }
      

      if (closestMatch && closestDistance < 0.5) {
        console.log("Found a close match: ", closestDistance)
        const existingEmbeddings = closestMatch.face_embedding || [];

        if (existingEmbeddings.length < 7) {
          const updatedEmbeddings = [...existingEmbeddings, Array.from(descriptor)];
          const { error: updateError } = await supabase
            .from('social_relations')
            .update({ face_embedding: updatedEmbeddings })
            .eq('friend_id', closestMatch.friend_id);

          if (updateError) throw updateError;

          console.log("Appended to existing face:", closestMatch.first_name);
        }
        // Only update and notify if the matched friend has changed
        if (matchedFriendIdRef.current !== closestMatch.friend_id) {
          matchedFriendIdRef.current = closestMatch.friend_id;
        
          //  Only send to backend if it's a new friend_id (not duplicate)
          if (lastSentFriendIdRef.current !== closestMatch.friend_id) {
            lastSentFriendIdRef.current = closestMatch.friend_id;
            notifyServerFriendId(closestMatch.friend_id);
            console.log("Sent updated friend_id to backend:", closestMatch.friend_id);
          }
        }

      } else {
        console.log("Did not match anyone: closest distance was", closestDistance);
        const timestamp = new Date().toISOString();
        const tempName = `Person_${timestamp.substring(0, 10)}_${Date.now().toString().slice(-6)}`;
        const newFriendId = uuidv4();
        matchedFriendIdRef.current = newFriendId;

        const { error } = await supabase
          .from('social_relations')
          .insert({
            user_id: user.id,
            created_at: new Date(),
            face_embedding: [Array.from(descriptor)],
            first_name: tempName,
            last_name: 'temp',
            relationship: 'friend',
            age: 26,
            occupation: 'student',
            last_seen: 'Today',
            friend_id: newFriendId
          });
        
        notifyServerFriendId(newFriendId);
        console.log("New face registered:", tempName);
        if (error) throw error;
      }

      const { data: updatedFriends, error: fetchError } = await supabase
        .from('social_relations')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;
      setUserFriends(updatedFriends);
    } catch (error) {
      console.error("Error registering face:", error);
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    let intervalId;

    if (isStreaming) {
      const runFaceDetectionLoop = async () => {
        intervalId = setInterval(async () => {
          if (isRegistering) return;

          try {
            const detections = await detectFacesWithDescriptors(videoRef.current);
            if (detections.length > 0) {
              await registerOrAppendFace(detections[0].descriptor);
            }
          } catch (error) {
            console.error("Error in face detection loop");
          }
        }, 5000);
      };

      runFaceDetectionLoop();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isStreaming, userFriends, isRegistering, user?.id]);

  useEffect(() => {
    if (isStreaming) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      const drawOverlay = () => {
        if (!videoRef.current) return;

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw memory summaries 
        context.font = '24px Arial'; 
        context.fillStyle = 'rgba(255, 255, 255, 0.8)';
        context.strokeStyle = 'black';
        context.lineWidth = 2;

        memories.forEach((memory, idx) => {
          const y = 40 + idx * 40;
          context.strokeText(memory,memory_summary, 10, y);
          context.fillText(memory,memory_summary, 10, y);
        });

        requestAnimationFrame(drawOverlay)
      };

      drawOverlay();
    }
  }, [isStreaming, memories])

  return (
    <div>
      <button onClick={startWebcamAndAudio}>
        {isStreaming ? "Active camera and streaming audio... " : "Start Webcam & Audio"}
      </button>

      {isStreaming && (
        <button onClick={endWebcamAndAudio}>
          Stop Webcam & Audio
        </button>
      )}
      <video
        ref={videoRef}
        autoPlay
        muted
        style={{
          widht: "50%",
          height: "auto",
          marginTop: "20px",
          border: "1px solid #ddd",
        }}
      />
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0}}  />
      {/* {isStreaming && ( <AudioStreamer isStreaming={isStreaming} />)
      } */}

    </div> 
  );
}

export default WebcamAudioCapture;
