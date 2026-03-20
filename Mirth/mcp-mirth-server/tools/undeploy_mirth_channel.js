import { mirthClient } from '../mirthClient.js';
import { listMirthChannels } from './list_mirth_channels.js';

export async function undeployMirthChannel({ channel_id = null, channel_name = null }) {
  let targetId = channel_id;
  
  if (!targetId && channel_name) {
    const channels = await listMirthChannels();
    targetId = channels[channel_name];
    if (!targetId) {
      throw new Error(`Could not find channel with name: ${channel_name}`);
    }
  }
  
  if (!targetId) {
    throw new Error('Either channel_id or channel_name must be provided');
  }

  try {
    await mirthClient.undeployChannel(targetId);
    return {
      success: true,
      message: `Channel ${targetId} undeployed successfully`
    };
  } catch (error) {
    const errorData = error.response?.data || error.message;
    return {
      success: false,
      error: `Failed to undeploy channel: ${JSON.stringify(errorData)}`
    };
  }
}
