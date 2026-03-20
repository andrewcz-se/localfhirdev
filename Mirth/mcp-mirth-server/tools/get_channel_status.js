import { mirthClient } from '../mirthClient.js';
import { listMirthChannels } from './list_mirth_channels.js';

export async function getChannelStatus({ channel_id = null, channel_name = null }) {
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
    const data = await mirthClient.getChannelStatuses();
    // Mirth returns a list/dashboardStatus object or array
    let statuses = [];
    if (data.list && data.list.dashboardStatus) {
      statuses = Array.isArray(data.list.dashboardStatus) ? data.list.dashboardStatus : [data.list.dashboardStatus];
    } else if (Array.isArray(data)) {
      statuses = data;
    }
    
    const status = statuses.find(s => s.channelId === targetId);
    
    if (!status) {
      return {
        success: false,
        error: `Could not find status for channel ${targetId}`
      };
    }
    
    // Extract statistics from Mirth's linked-hash-map entry structure if needed
    let stats = {
      queued: status.queued || 0,
      received: 0,
      sent: 0,
      error: 0
    };

    if (status.statistics && status.statistics.entry) {
      const entries = Array.isArray(status.statistics.entry) ? status.statistics.entry : [status.statistics.entry];
      entries.forEach(e => {
        const key = e["com.mirth.connect.donkey.model.message.Status"];
        const val = parseInt(e["long"]);
        if (key === "RECEIVED") stats.received = val;
        if (key === "SENT") stats.sent = val;
        if (key === "ERROR") stats.error = val;
      });
    } else {
      stats.received = status.received || 0;
      stats.sent = status.sent || 0;
      stats.error = status.error || 0;
    }
    
    return {
      success: true,
      channelId: status.channelId,
      name: status.name,
      state: status.state,
      statistics: stats
    };
  } catch (error) {
    const errorData = error.response?.data || error.message;
    return {
      success: false,
      error: `Failed to get channel status: ${JSON.stringify(errorData)}`
    };
  }
}
