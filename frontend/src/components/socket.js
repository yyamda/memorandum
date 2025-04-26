// socket.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5001', {
  transports: ['websocket'], // optional, for extra safety
});

export default socket;