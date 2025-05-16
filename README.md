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

## Launching AWS EC2 Instance
```bash
- Use the existing pem file
- Choose a security group that opens 3000 port to the internet
- Copy contents of ec2-launch.sh in User Data section under Advanced
  - Make sure to fill in environment variables
- SSH into the node: ssh -i newkey.pem ec2-user@18.216.5.10
  - check startup logs in /var/log/my-startup.log
  - Wait until you see “Application deployment completed!”
- Make sure to attach the Elastic IP (current EIP: 18.216.5.10) to this node.

Ideally, we should have a launch template and an ASG of size 1, so we need not do
the above steps manually. I tried this once by creating a launch template and
an ENI associated with the Elastic IP, but ran into an issue with it.
```

## Register a user
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Sandeep Dhoot","phoneNumber":"+18324217365"}'
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

### Twilio curl commands
```bash
curl -X POST https://verify.twilio.com/v2/Services/TWILIO_VERIFY_SERVICE_SID/Verifications \
  --data-urlencode "To=+1234567890" \
  --data-urlencode "Channel=sms" \
  -u TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN

curl -X POST https://verify.twilio.com/v2/Services/TWILIO_VERIFY_SERVICE_SID/VerificationCheck \
  --data-urlencode "To=+1234567890" \
  --data-urlencode "Code=123456" \
  -u TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN
```

### mongodump and mongorestore
```bash
# Dump a db
~/Downloads/mongodb-database-tools/bin/mongorestore --uri=<uri> --db=test /tmp/atlas_dump
# Restore a dump
~/Downloads/mongodb-database-tools/bin/mongorestore --uri=<uri> /tmp/atlas_dump
```