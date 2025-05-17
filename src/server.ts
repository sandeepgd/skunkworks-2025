import express from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import multer from 'multer';
import User, { IUser } from './models/User';
import Chat, { IChat } from './models/Chat';
import Group, { IGroup } from './models/Group';
import { MessageResponse, QueryResponse } from './models/ChatTypes';
import OpenAI from 'openai';
import fs from 'fs';
import Highlight from './models/Highlight';
import crypto from 'crypto';
import { TtsServiceFactory } from './services/tts/TtsServiceFactory';
import { getMessageClassificationPrompt, getChatResponsePrompt } from './prompts'
import twilio from 'twilio';
import jwt from 'jsonwebtoken';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
      }
    }
  }
}

dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
  throw new Error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID environment variables are required');
}

if (!process.env.ACCESS_SECRET) {
  throw new Error('ACCESS_SECRET environment variable is required');
}

const ACCESS_SECRET = process.env.ACCESS_SECRET;

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize TTS service based on configuration
const ttsFactory = TtsServiceFactory.getInstance();
const TTS_PROVIDER = process.env.TTS_PROVIDER || 'openai';

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (TTS_PROVIDER === 'elevenlabs') {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required when using ElevenLabs TTS');
  }
  ttsFactory.initializeElevenLabs(process.env.ELEVENLABS_API_KEY);
  console.log('Initialized ElevenLabs TTS service');
} else {
  ttsFactory.initializeOpenAi(process.env.OPENAI_API_KEY);
  console.log('Initialized OpenAI TTS service');
}

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

// Authentication middleware
const authenticateToken = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer token

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      details: 'No access token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as { userId: string };
    req.user = decoded; // Attach user info to request object
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid token',
      details: error instanceof Error ? error.message : 'Token verification failed'
    });
  }
};

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (OpenAI's current limit)
  },
});

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

// Add this after the OpenAI client initialization and before the routes
async function callOpenAI(prompt: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    response_format: { type: "json_object" }
  });

  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('No response from AI');
  }
  return response;
}

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Helper function to generate new tokens
function generateNewTokens(userId: string): {
  accessToken: { token: string; expiresAt: number };
  refreshToken: { token: string; expiresAt: number };
} {
  const now = Math.floor(Date.now() / 1000);
  
  // Generate new access token
  const accessToken = {
    token: jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: '30m' }),
    expiresAt: now + (30 * 60) // 30 minutes from now
  };

  // Generate new refresh token
  const refreshToken = {
    token: crypto.randomBytes(40).toString('hex'),
    expiresAt: now + (30 * 24 * 60 * 60) // 30 days from now
  };

  return { accessToken, refreshToken };
}

// Create User API with verification
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { name, phoneNumber, code } = req.body;

    // Validate required fields
    if (!name || !phoneNumber) {
      const response = {
        success: false,
        message: 'Missing required fields',
        details: 'name and phoneNumber are required'
      };
      return res.status(400).json(response);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    const isExistingUser = !!existingUser;

    // If no verification code provided, send OTP
    if (!code) {
      try {
        await twilioClient.verify.v2
          .services(verifyServiceSid)
          .verifications.create({ to: phoneNumber, channel: 'sms' });

        const response = {
          success: true,
          message: 'Verification code sent',
          details: 'Please check your phone for the verification code'
        };
        return res.status(200).json(response);
      } catch (error) {
        console.error('Error sending verification code:', error);
        const response = {
          success: false,
          message: 'Error sending verification code',
          details: error instanceof Error ? error.message : 'Unknown error occurred'
        };
        return res.status(500).json(response);
      }
    }

    // If verification code provided, verify and create/update user
    try {
      const verificationCheck = await twilioClient.verify.v2
        .services(verifyServiceSid)
        .verificationChecks.create({ to: phoneNumber, code });

      if (verificationCheck.status !== 'approved') {
        const response = {
          success: false,
          message: 'Invalid verification code',
          details: 'The provided verification code is invalid or expired'
        };
        return res.status(400).json(response);
      }

      let user: IUser;
      let tokens;
      if (isExistingUser) {
        // Update existing user
        existingUser.name = name;
        existingUser.modifiedAt = Math.floor(Date.now() / 1000);
        await existingUser.save();
        user = existingUser;
        console.log('User updated successfully');
        tokens = generateNewTokens(user._id);
        user.refreshToken = tokens.refreshToken;
        await user.save();
        knownUsers.set(user._id, user);
      } else {
        // Create new user
        const now = Math.floor(Date.now() / 1000);
        const userId = 'U' + new mongoose.Types.ObjectId().toString();
        tokens = generateNewTokens(userId);
        
        user = new User({
          _id: userId,
          name,
          phoneNumber,
          groups: [],
          createdAt: now,
          modifiedAt: now,
          refreshToken: tokens.refreshToken
        });

        // Delete any orphaned groups belonging to this user
        await Group.deleteMany({ createdBy: user._id });
        
        // Create group documents
        const defaultGroups = ['Everyone', 'Family', 'Friends', 'Followers'];
        const groupDocs = defaultGroups.map(name => ({
          _id: 'G' + new mongoose.Types.ObjectId().toString(),
          name,
          createdBy: user._id,
          createdAt: now
        }));

        // Bulk insert groups
        const createdGroups = await Group.insertMany(groupDocs);
        
        // Add groups to cache
        createdGroups.forEach(group => knownGroups.set(group._id, group));

        // Update user with their groups
        user.groups = createdGroups.map(group => ({
          name: group.name,
          id: group._id
        }));
        await user.save();
        knownUsers.set(user._id, user);
        console.log('User created successfully');
      }

      const response = {
        success: true,
        message: isExistingUser ? 'User updated successfully' : 'User created successfully',
        user: {
          _id: user._id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          createdAt: user.createdAt,
          modifiedAt: user.modifiedAt,
          groups: user.groups,
          refreshToken: user.refreshToken?.token
        },
        accessToken: tokens.accessToken
      };
      return res.status(201).json(response);
    } catch (error) {
      console.error('Error verifying code:', error);
      const response = {
        success: false,
        message: 'Error verifying code',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      return res.status(500).json(response);
    }
  } catch (error) {
    console.error('Error in createUser API:', error);
    const response = {
      success: false,
      message: 'Error creating/updating user',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return res.status(500).json(response);
  }
});

// Get User API
app.get('/api/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId, phoneNumber } = req.query;

    // Validate that at least one identifier is provided
    if (!userId && !phoneNumber) {
      return res.status(400).json({
        message: 'Missing identifier',
        details: 'Either userId or phoneNumber must be provided'
      });
    }

    // Build query based on provided parameters
    const query: any = {};
    if (userId) query._id = userId;
    if (phoneNumber) query.phoneNumber = phoneNumber;

    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        details: 'No user found with the provided identifier(s)'
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

// Token API
// A quick note about tokens.
// There are 2 kinds of tokens: accessToken and refreshToken.
// accessToken:
// - Valid for 30 minutes
// - Need to be sent with every request
// - This avoids having to send password with every request
// - If expired, need to refresh with refreshToken using /api/token
// - refreshToken is also refreshed when accessToken is refreshed
// - We don't need to cache or track accessToken because the signature-based authentication
//   done by jwt.verify() is enough
// refreshToken:
// - Valid for 30 days
// - Need to be sent only when accessToken is being refreshed
// - If expired, user needs to login again through Twilio Verify
app.post('/api/token', async (req: Request, res: Response) => {
  try {
    const { userId, refreshToken } = req.body;

    // Validate required fields
    if (!userId || !refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        details: 'userId and refreshToken are required'
      });
    }

    // Get user from cache or database
    let user = knownUsers.get(userId);
    if (!user) {
      const foundUser = await User.findOne({ _id: userId });
      if (!foundUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          details: 'No user found with the provided ID'
        });
      }
      user = foundUser;
      knownUsers.set(userId, user);
    }

    // Validate refresh token
    if (!user.refreshToken || user.refreshToken.token !== refreshToken || user.refreshToken.expiresAt < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        details: 'The provided refresh token is invalid or expired'
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateNewTokens(userId);
    
    // Update user with new refresh token
    user.refreshToken = newRefreshToken;
    await user.save();
    knownUsers.set(userId, user);

    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Error in token API:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating tokens',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get Messages API
app.get('/api/messages', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        message: 'Missing user context',
        details: 'User ID not found in authentication token'
      });
    }

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

    // Calculate time range (last 30 days)
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    // Get all messages
    const messages = await Chat.find({
      $and: [
        { userId: userId },
        { sentAt: { $gte: thirtyDaysAgo } }
      ]
    });

    // Group messages by participant
    const participantMessages = new Map();

    // First, add all user's groups to the map
    for (const group of user.groups) {
      const groupDetails = knownGroups.get(group.id);
      if (groupDetails) {
        participantMessages.set(group.id, {
          participantId: group.id,
          isGroup: true,
          name: groupDetails.name,
          messages: []
        });
      }
    }

    // Then process messages
    for (const msg of messages) {
      const participantId = msg.participantId;
      
      if (!participantMessages.has(participantId)) {
        // Get participant details
        let participant;
        let isGroup = false;
        let name = '';

        // Check if participant is a user
        const userParticipant = knownUsers.get(participantId);
        if (userParticipant) {
          participant = userParticipant;
          name = userParticipant.name;
        } else {
          // Check if participant is a group
          const groupParticipant = knownGroups.get(participantId);
          if (groupParticipant) {
            participant = groupParticipant;
            isGroup = true;
            name = groupParticipant.name;
          }
        }

        if (participant) {
          participantMessages.set(participantId, {
            participantId,
            isGroup,
            name,
            messages: []
          });
        }
      }

      // Add message to participant's messages
      const participantData = participantMessages.get(participantId);
      if (participantData) {
        participantData.messages.push({
          id: msg._id?.toString() || '',
          message: msg.message,
          sentAt: msg.sentAt,
          isFromUser: msg.isFromUser
        });
      }
    }

    // Convert map to array and sort messages by sentAt
    const response = Array.from(participantMessages.values()).map(participant => ({
      ...participant,
      messages: participant.messages.sort((a: { sentAt: number }, b: { sentAt: number }) => a.sentAt - b.sentAt)
    }));

    res.json(response);
  } catch (error) {
    console.error('Error in getMessages API:', error);
    res.status(500).json({
      message: 'Error fetching messages',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Create Message API
app.post('/api/messages', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { participantId, message } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: 'Missing user context',
        details: 'User ID not found in authentication token'
      });
    }

    // Validate required fields
    if (!participantId || !message) {
      return res.status(400).json({
        message: 'Missing required fields',
        details: 'participantId and message are required'
      });
    }

    // Validate and get user
    const user = await validateAndGetUser(userId);
    if (!user) {
      return res.status(400).json({
        message: 'Invalid sender ID',
        details: 'The userId must be a valid user ID'
      });
    }

    // Process message through OpenAI
    const aiResponse = await processMessageWithAI(user, participantId, message);
    res.status(201).json(aiResponse);
  } catch (error) {
    console.error('Error in createMessage API:', error);
    res.status(500).json({
      message: 'Error creating message',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Helper function to validate and get user
async function validateAndGetUser(userId: string): Promise<IUser | null> {
  let user = knownUsers.get(userId);
  if (!user) {
    const foundUser = await User.findOne({ _id: userId });
    if (!foundUser) {
      return null;
    }
    user = foundUser;
    knownUsers.set(userId, user);
  }
  return user;
}

// Helper function to validate participant
async function validateParticipant(participantId: string, userGroupIds: string[]): Promise<{ isValid: boolean; isGroup: boolean }> {
  // Check if participant is a user
  const participant = knownUsers.get(participantId) ?? await User.findOne({ _id: participantId });
  if (participant) {
    knownUsers.set(participantId, participant);
    return { isValid: true, isGroup: false };
  }

  // Check if participant is a group
  const group = knownGroups.get(participantId) ?? await Group.findOne({ _id: participantId });
  if (group) {
    knownGroups.set(participantId, group);
    // Validate user is member of group
    return { isValid: userGroupIds.includes(participantId), isGroup: true };
  }

  return { isValid: false, isGroup: false };
}

// Helper function to process message with OpenAI
async function processMessageWithAI(user: IUser, participantId: string, message: string): Promise<MessageResponse | null> {
  try {
    const fullPrompt = getMessageClassificationPrompt({ message });

    const response = await callOpenAI(fullPrompt);
    
    let parsedResponse: QueryResponse;
    try {
      parsedResponse = JSON.parse(response) as QueryResponse;
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error);
      console.error('Raw response:', response);
      throw new Error('Failed to parse AI response as JSON');
    }
    
    let result: string;
    switch (parsedResponse.label) {
      case 'share':
        result = await handleShare(user, participantId, message);
        break;
      case 'request':
        result = await handleRequest(user._id, message, parsedResponse);
        break;
      case 'general_request':
        result = handleGeneralRequest();
        break;
      default:
        return null;
    }

    // Create both messages in a single operation
    const now = Math.floor(Date.now() / 1000);
    const chats = await Chat.insertMany([
      {
        userId: user._id,
        participantId,
        message,
        isFromUser: true,
        sentAt: now
      },
      {
        userId: user._id,
        participantId,
        message: result,
        isFromUser: false,
        sentAt: now
      }
    ]);

    return {
      userId: user._id,
      participantId,
      inputMessageId: chats[0]._id.toString(),
      responseMessageId: chats[1]._id.toString(),
      message: result,
      isFromUser: false,
      sentAt: now
    };
  } catch (error) {
    console.error('Error processing with AI:', error);
    return null;
  }
}

// Text-to-Speech API
app.post('/api/convertTts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        message: 'Missing required field',
        details: 'message field is required'
      });
    }

    // Get the TTS service
    const ttsService = ttsFactory.getService();

    // Generate speech
    const buffer = await ttsService.convertToSpeech(message);
    
    // Set response headers for audio streaming
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Content-Disposition': 'attachment; filename="speech.mp3"'
    });

    // Send the audio buffer directly
    res.send(buffer);
  } catch (error) {
    console.error('Error in convertTts API:', error);
    res.status(500).json({
      message: 'Error generating speech',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Speech-to-Text API
app.post('/api/convertStt', authenticateToken, upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        message: 'Missing required file or file buffer',
        details: 'audio file is required'
      });
    }

    const mime = req.file.mimetype;
    const mimeToExt: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/x-m4a': 'm4a',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
    };

    if (!mimeToExt[mime]) {
      return res.status(400).json({
        message: 'Unsupported audio format',
        details: `Audio format ${mime} is not supported. Supported formats are: ${Object.keys(mimeToExt).join(', ')}`
      });
    }

    // Create a temporary file path with a unique name
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const extension = mimeToExt[mime] || 'mp3';
    const tempFilePath = `/tmp/audio_${timestamp}_${randomBytes}.${extension}`;
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Transcribe the audio using the file path
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });

    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);

    res.json({
      message: transcription.text
    });
  } catch (error) {
    console.error('Error in convertStt API:', error);
    res.status(500).json({
      message: 'Error transcribing audio',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Handler functions
async function handleShare(user: IUser, participantId: string | undefined, originalQuery: string): Promise<string> {
  if (!originalQuery?.trim()) {
    throw new Error('Unable to find the update to be shared');
  }

  const highlight = new Highlight({
    userId: user._id,
    toId: participantId, 
    message: originalQuery,
    sentAt: Math.floor(Date.now() / 1000)
  });
  await highlight.save();

  return 'Thank you for sharing!';
}

async function handleRequest(userId: string, message: string, response: QueryResponse): Promise<string> {
  try {
    // Default to 7 days if not specified
    const lookbackDays = response.days || 7;
    const now = Math.floor(Date.now() / 1000);
    const lookbackSeconds = lookbackDays * 24 * 60 * 60;
    const startTime = now - lookbackSeconds;

    // Get all userIds from the cache, excluding the calling user
    const userIds = Array.from(knownUsers.keys()).filter(id => id !== userId);
    if (userIds.length === 0) {
      console.warn('No other users found in cache');
      return 'No updates available from others at the moment.';
    }

    // Log users we're fetching highlights for
    const userNames = userIds.map(id => knownUsers.get(id)?.name || id).join(', ');

    // Get all highlights within the time range for known users (excluding caller)
    const highlights = await Highlight.find({
      userId: { $in: userIds },
      sentAt: { $gte: startTime }
    }).sort({ sentAt: 1 });

    // Group highlights by username
    const highlightsByUser: { [key: string]: Array<{ message: string; timestamp: string }> } = {};

    // Process each highlight using the cache
    for (const highlight of highlights) {
      const user = knownUsers.get(highlight.userId);
      if (user) {
        const username = user.name;
        if (!highlightsByUser[username]) {
          highlightsByUser[username] = [];
        }
        highlightsByUser[username].push({
          message: highlight.message,
          timestamp: new Date(highlight.sentAt * 1000).toISOString().split('.')[0] + 'Z'
        });
      }
    }

    // Sort each user's highlights by timestamp
    for (const username in highlightsByUser) {
      highlightsByUser[username].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }

    const templateResponse = getChatResponsePrompt({
      today: new Date().toISOString().split('T')[0],
      highlights: JSON.stringify(highlightsByUser),
      message: message
    });
    
    const aiResponse = await callOpenAI(templateResponse);
    const parsedResponse = JSON.parse(aiResponse);
    return parsedResponse.summary;
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return 'Sorry, I had trouble retrieving the updates. Please try again.';
  }
}

function handleGeneralRequest(): string {
  return "Got it! I don't have anything new to share right now, but I'm here if you want to tell me something or check in on others.";
}

// Start server
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Handle graceful shutdown
const shutdown = async () => {
  console.log('Received shutdown signal. Closing server...');
  
  // Close server
  server.close(() => {
    console.log('Server closed');
  });

  // Close MongoDB connection
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }

  // Exit process
  process.exit(0);
};

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', shutdown);

// Handle SIGTERM
process.on('SIGTERM', shutdown); 