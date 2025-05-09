const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Chat = require('./models/Chat');

dotenv.config();
const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

// GET /messages?userId=123&page=1&limit=10
app.get('/messages', async (req, res) => {
    const { userId, page = 1, limit = 10 } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
  
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
  
    try {
      const chats = await Chat.find({
        $or: [{ fromId: userId }, { toId: userId }]
      })
      .sort({ sentAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
  
      const total = await Chat.countDocuments({
        $or: [{ fromId: userId }, { toId: userId }]
      });
  
      res.json({
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        data: chats
      });
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });
  
app.post('/messages', async (req, res) => {
    const { fromId, toId, message, generatedByAI = false, sentAt } = req.body;
  
    if (!fromId || !toId || !message || !sentAt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
  
    try {
      const chat = new Chat({ fromId, toId, message, generatedByAI, sentAt });
      await chat.save();
      res.status(201).json(chat);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));