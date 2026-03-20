import { mirthClient } from '../mirthClient.js';

export async function listMirthChannels({ name_filter = null } = {}) {
  try {
    const data = await mirthClient.listChannels();
    
    let result = {};
    if (data && typeof data === 'object') {
       let channels = data;
       // Handle Mirth's map/entry structure
       if (data.map && data.map.entry) {
         channels = {};
         const entries = Array.isArray(data.map.entry) ? data.map.entry : [data.map.entry];
         entries.forEach(entry => {
           if (entry.string && entry.string.length === 2) {
             const [id, name] = entry.string;
             channels[id] = name;
           }
         });
       }

       // Flip it to Map<Name, ID> for easier lookup as per requirements
       for (const [id, name] of Object.entries(channels)) {
         if (!name_filter || (typeof name === 'string' && name.toLowerCase().includes(name_filter.toLowerCase()))) {
           result[name] = id;
         }
       }
    }
    
    return result;
  } catch (error) {
    const errorData = error.response?.data || error.message;
    throw new Error(`Failed to list channels: ${JSON.stringify(errorData)}`);
  }
}
