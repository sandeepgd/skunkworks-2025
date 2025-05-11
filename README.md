# skunkworks-2025

## Run Server
```bash
npm install
npm run dev
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
