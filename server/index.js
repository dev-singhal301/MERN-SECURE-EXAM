require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io Setup (Replaces Supabase Channels)
const io = new Server(server, { 
  cors: { origin: '*' } 
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join_exam_room', (studentId) => {
    socket.join(`live_candidate_${studentId}`);
    console.log(`Student ${studentId} joined their live tracking room`);
  });
});

// Make io accessible in API routes (for live terminations)
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/exams', require('./routes/examRoutes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));
// We will build and mount examRoutes and submissionRoutes in the next step!

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`MERN Server running on port ${PORT}`);
});