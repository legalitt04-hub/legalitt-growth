const { io } = require("socket.io-client");
const SOCKET_URL = "https://legalitt-growth.onrender.com";

// Try connecting without a token to see if server responds
const socket = io(SOCKET_URL, { transports: ['websocket'] });

socket.on("connect", () => {
  console.log("✅ CONNECTED TO LIVE RENDER SERVER:", socket.id);
  
  // Try sending a dummy initiate_call
  socket.emit("initiate_call", { chatId: "dummy", zegoRoomId: "dummy", mode: "video" });
  
  setTimeout(() => {
    console.log("No crash. Test finished.");
    process.exit(0);
  }, 2000);
});

socket.on("connect_error", (err) => {
  console.log("❌ LIVE SERVER CONNECTION ERROR:", err.message);
  process.exit(1);
});

socket.on("call_busy", (data) => {
  console.log("Got call_busy:", data);
});
