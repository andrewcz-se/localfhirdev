import { mirthClient } from '../mirthClient.js';
import { v4 as uuidv4 } from 'uuid';

export async function createMirthChannel({ xml_payload }) {
  let currentXml = xml_payload;
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    try {
      const response = await mirthClient.createChannel(currentXml);
      
      // Extraction logic based on Mirth's response to /api/channels
      const match = currentXml.match(/<id>(.*?)<\/id>/);
      const channelId = match ? match[1] : null;
      
      return {
        success: true,
        channelId,
        message: `Channel created successfully with ID: ${channelId}`,
        xml: currentXml
      };
    } catch (error) {
      const errorData = error.response?.data || error.message;
      const errorMsg = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);

      const selfCorrectableErrors = [];
      const userInputRequired = [];

      // Logic to categorize Mirth errors from Channels POST
      if (errorMsg.includes('UUID') || errorMsg.includes('id') || errorMsg.includes('id is required')) {
        selfCorrectableErrors.push('Missing or malformed channel UUID');
      }
      if (errorMsg.includes('revision')) {
        selfCorrectableErrors.push('Invalid or missing revision number');
      }
      if (errorMsg.includes('state')) {
        selfCorrectableErrors.push('Missing channel state attribute');
      }
      if (errorMsg.includes('XML') || errorMsg.includes('malformed')) {
        selfCorrectableErrors.push('Malformed XML structure');
      }
      
      if (errorMsg.includes('port')) {
        userInputRequired.push('Missing or unspecified TCP/MLLP port number');
      }
      if (errorMsg.includes('URL') || errorMsg.includes('IP') || errorMsg.includes('host')) {
        userInputRequired.push('Missing destination URL, IP, or hostname');
      }
      if (errorMsg.includes('credential') || errorMsg.includes('auth')) {
        userInputRequired.push('Missing authentication credentials for a destination');
      }
      if (errorMsg.includes('code template')) {
        userInputRequired.push('Reference to a code template that does not exist');
      }
      if (errorMsg.includes('already exists')) {
        userInputRequired.push('A channel with that name already exists');
      }

      // If no specific categorization, put in userInputRequired
      if (selfCorrectableErrors.length === 0 && userInputRequired.length === 0) {
        userInputRequired.push(`Unknown creation error: ${errorMsg}`);
      }

      // Handle Self-Correction
      if (selfCorrectableErrors.length > 0 && userInputRequired.length === 0 && attempts < MAX_ATTEMPTS) {
         if (errorMsg.includes('UUID') || errorMsg.includes('id')) {
           const newUuid = uuidv4();
           currentXml = currentXml.replace(/<id>.*?<\/id>/, `<id>${newUuid}<\/id>`);
         }
         if (errorMsg.includes('revision')) {
           currentXml = currentXml.replace(/<revision>.*?<\/revision>/, `<revision>1<\/revision>`);
         }
         // Continue loop for re-attempt
         continue;
      }

      return {
        success: false,
        selfCorrectableErrors,
        userInputRequired,
        xml: currentXml,
        error: `Failed to create channel: ${errorMsg}`
      };
    }
  }

  return {
    success: false,
    error: 'Maximum creation attempts reached during self-correction.',
    xml: currentXml
  };
}
