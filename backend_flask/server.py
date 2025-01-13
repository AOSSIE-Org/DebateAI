# Monkey patching must happen first before importing other modules
import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room, emit
from flask_cors import CORS

# Initialize Flask app and SocketIO
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# Rooms dictionary to manage active rooms
rooms = {}
print("Server is running...")

# Route to create a new room
@app.route('/create-room', methods=['POST'])
def create_room():
    data = request.json
    room_id = data.get('room_id')
    if not room_id:
        return jsonify({"error": "Room ID is required"}), 400

    if room_id in rooms:
        return jsonify({"error": "Room already exists"}), 400

    rooms[room_id] = []
    return jsonify({"message": f"Room {room_id} created successfully."}), 201

# Route to join an existing room
@app.route('/join-room', methods=['POST'])
def join_room_route():
    data = request.json
    room_id = data.get('room_id')
    user = data.get('user')
    if room_id not in rooms:
        return jsonify({"error": "Room does not exist"}), 404

    if len(rooms[room_id]) >= 2:
        return jsonify({"error": "Room is full"}), 403

    rooms[room_id].append(user)
    return jsonify({"message": f"User {user} joined room {room_id}."}), 200

# WebSocket event to handle a user joining a room
@socketio.on('join')
def handle_join(data):
    room_id = data['room']
    user = data['user']
    join_room(room_id)
    emit('user_joined', {'user': user}, room=room_id)

# WebSocket event to handle a user leaving a room
@socketio.on('leave')
def handle_leave(data):
    room_id = data['room']
    user = data['user']
    leave_room(room_id)
    emit('user_left', {'user': user}, room=room_id)

# WebSocket event to handle messages in a room
@socketio.on('message')
def handle_message(data):
    room_id = data['room']
    message = data['message']
    user = data['user']
    emit('message', {'user': user, 'message': message}, room=room_id)

# Main entry point of the application
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
