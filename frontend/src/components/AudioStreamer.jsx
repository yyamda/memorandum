import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

import socket from './socket'; // shared FE socket

function AudioStreamer( { isStreaming}) {
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null); 
    const recordingIntervalRef = useRef(null);

    useEffect(() => {
        let isComponentMounted = true;
    
        const startStreaming = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
    
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
    
            mediaRecorderRef.current = mediaRecorder;
    
            let chunks = [];
    
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    console.log("Adding chunk to buffer");
                    chunks.push(e.data);
                }
            };
    
            mediaRecorder.onstop = async () => {
                const completeBlob = new Blob(chunks, { type: 'audio/webm' });
                const arrayBuffer = await completeBlob.arrayBuffer();
                socket.emit('audio_chunk', arrayBuffer);
                chunks = [];
    
                if (isStreaming && isComponentMounted) {
                    mediaRecorder.start(); // start next cycle
                    recordingIntervalRef.current = setTimeout(() => {
                        if (mediaRecorder.state !== 'inactive') {
                            mediaRecorder.stop();
                        }
                    }, 20000);
                }
            };
    
            // start first cycle
            mediaRecorder.start();
            recordingIntervalRef.current = setTimeout(() => {
                if (mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            }, 20000);
        };
    
        const stopStreaming = () => {
            isComponentMounted = false;
            console.log("Stopping audio streaming...");
    
            if (recordingIntervalRef.current) {
                clearTimeout(recordingIntervalRef.current);
            }
    
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
    
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    
        if (isStreaming) {
            startStreaming();
        } else {
            stopStreaming();
        }
    
        return () => stopStreaming();
    }, [isStreaming]);
    

    return null
}


export default AudioStreamer;