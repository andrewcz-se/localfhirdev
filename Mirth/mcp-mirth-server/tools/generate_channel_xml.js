import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import { v4 as uuidv4 } from 'uuid';

export async function generateChannelXml({ channel_name, source_port, destination_ip, destination_port, message_type = 'HL7V2', template_type = 'mllp-to-mllp' }) {
  const templatePath = path.join(process.cwd(), 'templates', `channel-template-${template_type}.xml`);
  
  try {
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = Handlebars.compile(templateContent);
    
    const channelId = uuidv4();
    const xml = template({
      channelId,
      channelName: channel_name,
      sourcePort: source_port,
      destinationIp: destination_ip,
      destinationPort: destination_port,
      messageType: message_type
    });
    
    return xml;
  } catch (error) {
    throw new Error(`Failed to generate channel XML: ${error.message}`);
  }
}
