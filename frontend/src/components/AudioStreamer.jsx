import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

import socket from './socket'; // shared FE socket

function AudioStreamer({ isStreaming }) {
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const recordingIntervalRef = useRef(null);
    const hasStartedRef = useRef(false); // 🚀 Track if streaming already started

    useEffect(() => {
        const startStreaming = async () => {
            console.log("🎬 Starting streaming...");

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorderRef.current = mediaRecorder;

            let chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const completeBlob = new Blob(chunks, { type: 'audio/webm' });
                const arrayBuffer = await completeBlob.arrayBuffer();

                console.log("📡 Emitting audio_chunk to backend...");
                socket.emit('audio_chunk', arrayBuffer);

                chunks = [];

                if (isStreaming) {
                    mediaRecorder.start();
                    recordingIntervalRef.current = setTimeout(() => {
                        if (mediaRecorder.state !== 'inactive') {
                            mediaRecorder.stop();
                        }
                    }, 30000); // 30 seconds
                }
            };

            // Start the first cycle
            mediaRecorder.start();
            recordingIntervalRef.current = setTimeout(() => {
                if (mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            }, 30000);
        };

        const stopStreaming = () => {
            console.log("🛑 Stopping streaming...");

            if (recordingIntervalRef.current) {
                clearTimeout(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }

            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            mediaRecorderRef.current = null;
        };

        if (isStreaming && !hasStartedRef.current) {
            startStreaming();
            hasStartedRef.current = true;
        } else if (!isStreaming && hasStartedRef.current) {
            stopStreaming();
            hasStartedRef.current = false;
        }

        return () => {
            console.log("🔧 Cleanup AudioStreamer...");
            stopStreaming();
            hasStartedRef.current = false;
        };
    }, [isStreaming]);

    return null;
}

export default AudioStreamer;
