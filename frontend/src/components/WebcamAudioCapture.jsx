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

  // const canvasRef = useRef();
  // const [memories, setMemories] = useState([]);
  // const memoryFetchIntervalRef = useRef(null);

  // const canvas = document.getElementById('overlayCanvas');
  // const context = canvas.getContext('2d');

  // context.clearRect(0, 0, canvas.width, canvas.height);
  // context.font = "24px Arial";
  // context.fillStyle = "white";
  // context.strokeStyle = "black";
  // context.lineWidth = 2;

  // context.strokeText("Memory: Visit Japan", 20, 40);
  // context.fillText("Memory: Visit Japan", 20, 40);

  const canvasRef = useRef(null);
  const yRef = useRef(400);  

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

      // memoryFetchIntervalRef.current = setInterval(() => {
      //   fetchMemories(); // fetch every 60 seconds 
      // }, 30000);

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
    // clearInterval(memoryFetchIntervalRef.current);

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

  // useEffect(() => {
  //   if (isStreaming) {
  //     const canvas = canvasRef.current;
  //     const context = canvas.getContext('2d');

  //     const drawOverlay = () => {
  //       if (!videoRef.current) return;

  //       canvas.width = videoRef.current.videoWidth;
  //       canvas.height = videoRef.current.videoHeight;

  //       context.clearRect(0, 0, canvas.width, canvas.height);

  //       // Draw memory summaries 
  //       context.font = '24px Arial'; 
  //       context.fillStyle = 'rgba(255, 255, 255, 0.8)';
  //       context.strokeStyle = 'black';
  //       context.lineWidth = 2;

  //       memories.forEach((memory, idx) => {
  //         const y = 40 + idx * 40;
  //         context.strokeText(memory,memory_summary, 10, y);
  //         context.fillText(memory,memory_summary, 10, y);
  //       });

  //       requestAnimationFrame(drawOverlay)
  //     };

  //     drawOverlay();
  //   }
  // }, [isStreaming, memories])

  useEffect(() => {
    if (!isStreaming) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const startX = 7.5;
    const startY = 20;

    const drawLine = (x1, y1, x2, y2, stroke_style='white', line_width=2) => {
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.strokeStyle = stroke_style;
      context.lineWidth = line_width;
      context.stroke();
    }

    const drawOutlinedText = (text, x, y, font = '18px Arial', fillColor = 'white', strokeColor = 'black', lineWidth = 3) => {
      context.font = font;
      context.fillStyle = fillColor;
      context.strokeStyle = strokeColor;
      context.lineWidth = lineWidth;
    
      context.strokeText(text, x, y);
      context.fillText(text, x, y);
    };

    function draw() {
      if (!videoRef.current) return;

      // 1. Sync canvas size to video size
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Parent Rectangle Card
      const rectWidth = 250
      const rectHeight = 450

      // Fill rectangle with transparent green
      context.fillStyle = 'rgba(34, 85, 34, 0.7)';  // Dark green, 10% opacity
      context.fillRect(startX, startY, rectWidth, rectHeight);

      // Write up rectangle 
      context.strokeStyle = 'rgb(34, 85, 34)';
      context.lineWidth = 2;
      context.strokeRect(startX, startY, 250, 450);

      context.font = "14px 'Courier New', monospace";
      context.fillStyle = 'green';
      context.textBaseline = "top";
      
      // Complimentary Texts
      let currentX = startX + 5;
      let currentY  = startY + 10;
      // Name
      drawOutlinedText(`YUTA`, currentX, currentY, "36px 'Orbitron', sans-serif", '#4ed42b', '#57c43b', 3);
      // Age 
      currentX += 160;
      currentY += 5
      drawOutlinedText(`Age: 21`, currentX, currentY, "20px 'Orbitron', sans-serif", '#4ed42b', '#57c43b', 1);

      // Relationship 
      currentX -= 160;
      currentY += 60
      drawOutlinedText(`Relationship: older brother`, currentX, currentY, "14px 'Orbitron', sans-serif", '#4ed42b', '#57c43b', 1);

      // Occupation 
      currentX += 0;
      currentY += 30;
      drawOutlinedText(`Occupation: Fisherman`, currentX, currentY, "14px 'Orbitron', sans-serif", '#4ed42b', '#57c43b', 1);

      // Last Seen 
      currentX += 0;
      currentY += 30;
      drawOutlinedText(`Last Seen: 2023-05-01`, currentX, currentY, "14px 'Orbitron', sans-serif", '#4ed42b', '#57c43b', 1);

      // Residence 
      currentX += 0;
      currentY += 30;
      drawOutlinedText(`Lives at: Redondo Beach`, currentX, currentY, "14px 'Orbitron', sans-serif", '#4ed42b', '#57c43b', 1);

      // Line 
      currentX += 0;
      currentY += 40;
      drawLine(currentX, currentY, currentX + 225, currentY, '#4ed42b', 5)

  
      requestAnimationFrame(draw);
    }

    draw();
  }, [isStreaming]);

  return (
    <div className="flex flex-col items-center w-full p-4 gap-6">
  <div className="flex gap-4">
    <button
      onClick={startWebcamAndAudio}
      className="bg-green-700 hover:bg-green-800 text-white font-semibold py-2 px-6 rounded transition"
    >
      {isStreaming ? "Active camera and streaming audio..." : "Start Webcam & Audio"}
    </button>

    {isStreaming && (
      <button
        onClick={endWebcamAndAudio}
        className="bg-yellow-700 hover:bg-yellow-800 text-white font-semibold py-2 px-6 rounded transition"
      >
        Stop Webcam & Audio
      </button>
    )}
  </div>

  <div className="relative w-full aspect-video border-4 border-[#C2B280] mt-6">
    <video
      ref={videoRef}
      autoPlay
      muted
      className="absolute top-0 left-0 w-full h-full object-cover"
    />
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  </div>
</div>
  );
}

export default WebcamAudioCapture;
