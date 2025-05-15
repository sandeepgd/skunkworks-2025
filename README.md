# skunkworks-2025

## Run Server
```bash
npm install
# Development
npm run dev
# Production
npm run build
npm start

# Docker
docker build -t wassup-fam-app .
docker run --env-file .env -p 3000:3000 wassup-fam-app

# Docker
docker-compose up --build -d
docker logs wassup-fam-app
docker-compose down
```

## Get user
```bash
curl "http://localhost:3000/api/users?userId=U681e51661c7154e79471e280"
OR
curl "http://localhost:3000/api/users?phoneNumber=%2B18324217365"
```

## Add messages
```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "U681e50bb1c7154e79471e27f",
    "participantId": "G681e52911c7154e79471e281",
    "message": "Hello at 4:26!", "isFromUser": true
}'
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "U681e50bb1c7154e79471e27f",
    "participantId": "G681e52911c7154e79471e281",
    "message": "Hello back at 4:28!", "isFromUser": false
}'
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "U681e50bb1c7154e79471e27f",
    "participantId": "G681e52911c7154e79471e281",
    "message": "Hellos at 4:30!"                    
}'
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "U681e50bb1c7154e79471e27f",
    "participantId": "G681e52911c7154e79471e281",
    "message": "Hello back at 4:32!", "isFromUser": false
}'

curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "U681e50bb1c7154e79471e27f",
    "participantId": "U681e51661c7154e79471e280",
    "message": "Hello at 5:26!", "isFromUser": true
}'
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "U681e50bb1c7154e79471e27f",
    "participantId": "U681e51661c7154e79471e280",
    "message": "Hello back at 5:28!", "isFromUser": false
}'
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "U681e50bb1c7154e79471e27f",
    "participantId": "U681e51661c7154e79471e280",
    "message": "Hellos at 5:30!"                    
}'
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "U681e50bb1c7154e79471e27f",
    "participantId": "U681e51661c7154e79471e280",
    "message": "Hello back at 5:32!", "isFromUser": false
}'
```

## Get messages
```bash
http://localhost:3000/api/messages?userId={userId}
```

## Text-to-Speech (convertTts) API
Convert text to speech using OpenAI's tts-1 model. The API supports multiple voices and returns an MP3 file.

### Basic Usage (Default Voice)
```bash
curl -X POST \
  http://localhost:3000/api/convertTts \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you today?"}' \
  --output speech.mp3
```

### Using Specific Voice
```bash
curl -X POST \
  http://localhost:3000/api/convertTts \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you today?", "voice": "nova"}' \
  --output speech.mp3
```

Available voices:
- alloy (default)
- echo
- fable
- onyx
- nova
- shimmer

## Speech-to-Text (convertStt) API
Convert audio files to text using OpenAI's Whisper model.

### Convert Audio to Text
```bash
curl -X POST \
  http://localhost:3000/api/convertStt \
  -F "audio=@/path/to/your/audio.mp3" \
  -H "Content-Type: multipart/form-data"
```

Example response:
```json
{
  "message": "The transcribed text from your audio file"
}
```

Supported audio formats:
- mp3
- mp4
- mpeg
- mpga
- m4a
- wav
- webm

Note: Maximum file size is 25MB.

