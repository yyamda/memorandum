from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()


app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY')
socketio = SocketIO(app, cors_allowed_origins="*")

# Import routes (register WebSocket handlers)
from routes.websocket import register_socket_handlers, user_friend_map
register_socket_handlers(socketio)

@app.route('/')
def index():
    return "Flask + SocketIO is running"

# New POST route to receive and store friend_id per socket session
@app.route('/api/friend-match', methods=['POST'])
def set_friend_id():
    print("Received Post from frontend")
    data = request.get_json()
    session_id = data.get('session_id')
    friend_id = data.get('friend_id')

    if not session_id or not friend_id:
        return jsonify({'status': 'error', 'message': 'Missing session_id or friend_id'}), 400

    user_friend_map[session_id] = friend_id
    print(f"Mapped session_id {session_id} to friend_id {friend_id}")
    

    print("UserMap: ", user_friend_map)
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    socketio.run(app, debug=True, host="0.0.0.0", port=5001)