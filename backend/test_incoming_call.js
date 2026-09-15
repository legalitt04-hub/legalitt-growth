const { io } = require("socket.io-client");

// Simulating the user connecting directly to the local backend
const SOCKET_URL = "http://localhost:5000";

// For this test, we need two valid tokens from the local DB.
// Let's first query the DB for two users.
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require("./src/models/User");
  const users = await User.find({}).limit(2);
  
  if (users.length < 2) {
    console.log("Need 2 users to test.");
    process.exit(1);
  }

  const callerToken = jwt.sign({ id: users[0]._id, role: users[0].role }, process.env.JWT_SECRET || 'secret');
  const receiverToken = jwt.sign({ id: users[1]._id, role: users[1].role }, process.env.JWT_SECRET || 'secret');

  console.log(`Caller: ${users[0]._id} (${users[0].name})`);
  console.log(`Receiver: ${users[1]._id} (${users[1].name})`);

  const callerSocket = io(SOCKET_URL, { auth: { token: callerToken }, transports: ['websocket'] });
  const receiverSocket = io(SOCKET_URL, { auth: { token: receiverToken }, transports: ['websocket'] });

  receiverSocket.on("connect", () => {
    console.log("Receiver connected with ID:", receiverSocket.id);
  });

  receiverSocket.on("incoming_call", (data) => {
    console.log("✅ SUCCESS: Receiver got incoming_call!", data);
    process.exit(0);
  });

  callerSocket.on("connect", () => {
    console.log("Caller connected with ID:", callerSocket.id);
    
    setTimeout(() => {
      // First, fetch or create a chat to get a valid chatId
      const Chat = require("./src/models/Chat");
      Chat.findOne({ participants: { $all: [users[0]._id, users[1]._id] } }).then(chat => {
        let chatId = chat ? chat._id : 'dummy_chat_id';
        
        console.log("Caller emitting initiate_call...");
        callerSocket.emit("initiate_call", {
          chatId: chatId,
          zegoRoomId: "test-room-123",
          mode: "video"
        });
      });
    }, 1000);
  });

  callerSocket.on("call_busy", (data) => {
    console.log("❌ FAILED: Caller received call_busy!", data);
    process.exit(1);
  });

});
