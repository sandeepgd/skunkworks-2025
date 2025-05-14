export const getMessageClassificationPrompt = ({ 
  message
}: { 
  message: string; 
}): string => `
Classify the message according to the following instructions:
1. label:
- "share" – if the user is sharing a personal highlight or update (anything related 
to how a user is feeling)
- "request" – if the user is asking others to share their updates or highlights, 
especially specific ones (e.g., "how are you all doing?").
- "general_request" – if the message is a broad, open-ended or informational 
question that an AI assistant could answer (e.g., "What's something fun I can ask 
the group today?", "Any good weekend prompts?").

2. names:
- Extract the names of people the user is checking in on (e.g., "How is Priya 
doing?").
- If the message refers to everyone (e.g., "everyone," "you all"), set this field 
to null.
- If the label is "share" or "general_request", set this field to null.

3. request_topic:
- Only populate this field if the user is asking about a specific event, activity, 
or topic (e.g., "your trip to the zoo," "how the concert was," "how your Monday 
presentation went").
- If the user's request is broad or generic (e.g., "how are you?", "how's your 
week?", "what's new?"), set this field to null.
- If the label is "share" or "general_request", set this field to null.

4. days:
- If the label is "request", determine the maximum number of days the user is 
asking for data from, based on the specific time period they refer to:
- If the user asks about "today", set days to 1 (i.e., look at data from the last 
1 day).
- If the user asks about the "previous week", set days to 14 (i.e., look at data 
from the last 14 days).
- If the user asks about the "previous month", set days to 60 (i.e., look at data 
from the last 60 days).
- If the user asks about a specific time period that is not clear (e.g., just says 
"a while ago"), do not populate the days field.

Return a JSON object like this:
{
  "label": "share" | "request" | "general_request",
  "names": [],
  "request_topic": "..." | null,
  "days": <number of days to look back> | null,
}

Message: "${message}"`;

export const getChatResponsePrompt = ({ 
  today, 
  highlights, 
  message 
}: { 
  today: string; 
  highlights: string; 
  message: string; 
}): string => `
Today's date is ${today}. Use this to determine what counts as 'today' in the 
question.

You are a friendly assistant summarizing life updates from a close group of 
friends. Each friend has shared personal highlights at various times in the past. 
Each highlight includes a timestamp (in ISO 8601 format).

Based on these highlights, respond to a general question like "How's everyone 
doing?" or a more specific one like "What's new with Alice and Ben?"

Your response must be a single JSON object with the following structure:
{
  "summary": "..."
}

Your summary should:
- Sound warm, caring, and human-like you're chatting with a friend.
- Use simple words and short sentences. Avoid long or complicated sentences.
- Mention timing naturally where it adds value (e.g. "Earlier this week, Alice…", 
"On Friday, Ben…")
- Be accurate to the timestamps (don't assume everything is recent)
- Reflect moods, progress, or concerns
- Mention specific people and their updates clearly
- Avoid simply repeating each highlight — summarize or connect them into a story
- Use paragraph breaks and newlines to improve readability within the "summary" 
string
- Keep the language simple, clear, and easy to understand when read aloud, since 
the summary will be fed to a text-to-speech model.

Always answer the question based on what is actually asked. For example:
- If the question is about today ("Are you all having a great day?"), only use 
highlights from today.
- If it's about a specific person, only mention them.
- If the question is general ("How's everyone doing?"), use recent highlights as 
needed to give a warm, well-rounded picture.
- Never include outdated highlights if they're not relevant to the question.
- Always write the summary about the person or people being asked about, not as if 
you're speaking to them.

Here are the highlights we want to summarize: ${highlights}

Question: ${message}`; 