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
import fsPromises from 'fs/promises';
import path from 'path';
import Highlight from './models/Highlight';
import * as Handlebars from 'handlebars';
import crypto from 'crypto';
dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ID caches with full objects
const knownUsers = new Map<string, IUser>();
const knownGroups = new Map<string, IGroup>();
let classificationTemplate: Handlebars.TemplateDelegate;
let chatResponseTemplate: Handlebars.TemplateDelegate;

// Initialize ID caches and load classification template
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

    // Load and compile templates
    const [classificationContent, chatResponseContent] = await Promise.all([
      readClassificationPrompt(),
      readChatResponsePrompt()
    ]);
    classificationTemplate = Handlebars.compile(classificationContent);
    chatResponseTemplate = Handlebars.compile(chatResponseContent);
    console.log('Loaded and compiled prompt templates');
  } catch (error) {
    console.error('Error initializing caches:', error);
    process.exit(1);
  }
}

// Middleware
app.use(express.json());

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
async function callOpenAI(prompt: string, responseFormat: 'json_object' | 'text' = 'json_object'): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    response_format: { type: responseFormat }
  });

  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('No response from AI');
  }
  return response;
}

// Get User API
app.get('/api/users', async (req: Request, res: Response) => {
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

// Get Messages API
app.get('/api/messages', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: 'Missing parameter',
        details: 'userId query parameter is required'
      });
    }

    // Validate user exists
    let user = knownUsers.get(userId as string);
    if (!user) {
      const foundUser = await User.findOne({ _id: userId });
      if (!foundUser) {
        return res.status(404).json({
          message: 'User not found',
          details: 'No user found with the provided ID'
        });
      }
      user = foundUser;
      knownUsers.set(userId as string, user);
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
app.post('/api/messages', async (req: Request, res: Response) => {
  try {
    const { userId, participantId, message } = req.body;

    // Validate required fields
    if (!userId || !participantId || !message) {
      return res.status(400).json({
        message: 'Missing required fields',
        details: 'userId, participantId, and message are required'
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
    if (foundUser) {
      knownUsers.set(userId, foundUser);
      return foundUser;
    }
    return null;
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
    const fullPrompt = classificationTemplate({
      message,
      timestamp: new Date().toISOString(),
      version: '1.0'
    });

    const response = await callOpenAI(fullPrompt);
    console.log('OpenAI Response:', response);
    
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
        result = await handleRequest(parsedResponse);
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
app.post('/api/convertTts', async (req: Request, res: Response) => {
  try {
    const { message, voice = 'alloy' } = req.body;

    if (!message) {
      return res.status(400).json({
        message: 'Missing required field',
        details: 'message field is required'
      });
    }

    // Generate speech
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: message,
    });

    // Get the audio data as a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
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
app.post('/api/convertStt', upload.single('audio'), async (req: Request, res: Response) => {
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

// Private helper to read classification prompt
async function readClassificationPrompt(): Promise<string> {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'message_classification.hbs');
    const templateContent = await fsPromises.readFile(templatePath, 'utf8');
    return templateContent;
  } catch (error) {
    console.error('Error reading classification prompt template:', error);
    throw new Error('Could not load the message classification template');
  }
}

// Private helper to read chat response prompt
async function readChatResponsePrompt(): Promise<string> {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'chat_response.hbs');
    const templateContent = await fsPromises.readFile(templatePath, 'utf8');
    return templateContent;
  } catch (error) {
    console.error('Error reading chat response template:', error);
    throw new Error('Could not load the chat response template');
  }
}

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

async function handleRequest(response: QueryResponse): Promise<string> {
  try {
    // Default to 1 day if not specified
    const lookbackDays = response.days || 1;
    const now = Math.floor(Date.now() / 1000);
    const lookbackSeconds = lookbackDays * 24 * 60 * 60;
    const startTime = now - lookbackSeconds;

    // Get all highlights within the time range
    const highlights = await Highlight.find({
      sentAt: { $gte: startTime }
    }).sort({ sentAt: 1 });

    // Group highlights by username
    const highlightsByUser: { [key: string]: Array<{ text: string; timestamp: string }> } = {};

    // Process each highlight using the cache
    for (const highlight of highlights) {
      const user = knownUsers.get(highlight.userId);
      if (user) {
        const username = user.name;
        if (!highlightsByUser[username]) {
          highlightsByUser[username] = [];
        }
        highlightsByUser[username].push({
          text: highlight.message,
          timestamp: new Date(highlight.sentAt * 1000).toISOString().split('.')[0] + 'Z'
        });
      }
    }

    // Sort each user's highlights by timestamp
    for (const username in highlightsByUser) {
      highlightsByUser[username].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }

    // console.log('Highlights before stringification: ', JSON.stringify(highlightsByUser, null, 0).replace(/\\"/g, '"'));
    const templateResponse = chatResponseTemplate({
      highlights: JSON.stringify(highlightsByUser),
      message: response.request,
      safe: true
    });
    console.log('Raw template response', templateResponse);
    
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
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 