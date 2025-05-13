export interface MessageResponse {
  userId: string;
  participantId: string;
  inputMessageId: string;
  responseMessageId: string;
  message: string;
  isFromUser: boolean;
  sentAt: number;
}

export interface QueryResponse {
  label: 'share' | 'request' | 'general_request';
  names: string[] | null;
  request_topic: string | null;
  days: number | null;
  request: string;
  userIds?: string[];  // Optional array of user IDs to filter highlights
  userId: string;  // ID of the user making the request
} 