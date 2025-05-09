import express from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { IUser } from './models/User';
import Chat from './models/Chat';
import Group, { IGroup } from './models/Group';

dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

const app = express();
const port = process.env.PORT || 3000;

// ID caches with full objects
const knownUsers = new Map<string, IUser>();
const knownGroups = new Map<string, IGroup>();

// Initialize ID caches
async function initializeCaches() {
  try {
    // Initialize user cache
    const users = await User.find({});
    users.forEach(user => knownUsers.set(user._id, user));
    console.log(`Initialized user cache with ${knownUsers.size} users`);

    // Initialize group cache
    const groups = await Group.find({});
    groups.forEach(group => knownGroups.set(group._id, group));
    console.log(`Initialized group cache with ${knownGroups.size} groups`);
  } catch (error) {
    console.error('Error initializing caches:', error);
    process.exit(1);
  }
}

// Middleware
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await initializeCaches();
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Get User API
app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id });

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        details: 'No user found with the provided ID'
      });
    }

    // Add user to cache if not already present
    if (!knownUsers.has(user._id)) {
      knownUsers.set(user._id, user);
    }

    res.json(user);
  } catch (error) {
    console.error('Error in getUser API:', error);
    res.status(500).json({ 
      message: 'Error fetching user',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get Messages API
app.get('/api/messages/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    let user = knownUsers.get(userId);
    if (!user) {
      const foundUser = await User.findOne({ _id: userId });
      if (!foundUser) {
        return res.status(404).json({
          message: 'User not found',
          details: 'No user found with the provided ID'
        });
      }
      user = foundUser;
      knownUsers.set(userId, user);
    }

    // Get group IDs from user's groups array
    const groupIds = user.groups.map(group => group.id);
    
    // Create contactIds array that includes both user IDs and group IDs
    const contactIds = [...new Set([...Array.from(knownUsers.keys()), ...groupIds])];

    // Calculate time range (last 30 days)
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    // Get all messages
    const messages = await Chat.find({
      $and: [
        { sentAt: { $gte: thirtyDaysAgo } },
        {
          $or: [
            { fromId: userId, toId: { $in: contactIds } },
            { fromId: { $in: contactIds }, toId: userId }
          ]
        }
      ]
    });

    res.json(messages);
  } catch (error) {
    console.error('Error in getMessages API:', error);
    res.status(500).json({
      message: 'Error fetching messages',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Create Message API
app.post('/api/messages', async (req: Request, res: Response) => {
  try {
    const { fromId, toId, message, generatedByAI } = req.body;

    // Validate required fields
    if (!fromId || !toId || !message) {
      return res.status(400).json({
        message: 'Missing required fields',
        details: 'fromId, toId, and message are required'
      });
    }

    // Validate fromId exists (must be a user)
    let fromUser = knownUsers.get(fromId);
    if (!fromUser) {
      const foundUser = await User.findOne({ _id: fromId });
      if (!foundUser) {
        return res.status(400).json({
          message: 'Invalid sender ID',
          details: 'The fromId must be a valid user ID'
        });
      }
      fromUser = foundUser;
      knownUsers.set(fromId, fromUser);
    }

    // Get sender's group IDs
    const senderGroupIds = fromUser.groups.map(group => group.id);

    // Validate toId exists (can be either user or group)
    let toUser = knownUsers.get(toId);
    let toGroup = knownGroups.get(toId);

    if (!toUser && !toGroup) {
      // Check if it's a user
      const foundUser = await User.findOne({ _id: toId });
      if (foundUser) {
        toUser = foundUser;
        knownUsers.set(toId, toUser);
      } else {
        // Check if it's a group
        const foundGroup = await Group.findOne({ _id: toId });
        if (!foundGroup) {
          return res.status(400).json({
            message: 'Invalid recipient ID',
            details: 'The toId must be either a valid user ID or group ID'
          });
        }
        toGroup = foundGroup;
        knownGroups.set(toId, toGroup);

        // Validate that sender is a member of the group
        if (!senderGroupIds.includes(toId)) {
          return res.status(403).json({
            message: 'Unauthorized',
            details: 'You can only send messages to groups you are a member of'
          });
        }
      }
    }

    // Create new chat message
    const chat = new Chat({
      fromId,
      toId,
      message,
      generatedByAI: generatedByAI || false,
      sentAt: Math.floor(Date.now() / 1000) // Current time in Unix seconds
    });

    await chat.save();

    res.status(201).json(chat);
  } catch (error) {
    console.error('Error in createMessage API:', error);
    res.status(500).json({
      message: 'Error creating message',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 
