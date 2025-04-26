from flask_socketio import SocketIO
from flask import request
from services.audiototext_processing import buffer_audio_chunk

# Shared mapping of session ID → friend_id
user_friend_map = {}

def register_socket_handlers(socketio: SocketIO):

    @socketio.on('connect')
    def handle_connect():
        print("🔌 Client connected:", request.sid)
        socketio.emit('server_sid', {'sid': request.sid}, to=request.sid)
    
    @socketio.on('disconnect')
    def handle_disconnect():
        print("Client disconnected: ", request.sid)
        user_friend_map.pop(request.sid, None)


    # Streaming audio
    @socketio.on('audio_chunk')
    def handle_audio(data):
        print("User Map in Websocket ", user_friend_map)
        sid = request.sid
        friend_id = user_friend_map.get(sid)

        print(f" Received {len(data)} bytes from SID {sid}, friend_id: {friend_id}")
        if friend_id:
            buffer_audio_chunk(data, friend_id)