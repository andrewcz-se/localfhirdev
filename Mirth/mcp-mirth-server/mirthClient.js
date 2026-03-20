import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const MIRTH_URL = process.env.MIRTH_URL || 'https://localhost:8444';
const MIRTH_USERNAME = process.env.MIRTH_USERNAME || 'admin';
const MIRTH_PASSWORD = process.env.MIRTH_PASSWORD || 'adminpassword';

// Handle self-signed SSL certs for local development
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
});

class MirthClient {
  constructor() {
    this.sessionCookie = null;
    this.client = axios.create({
      baseURL: MIRTH_URL,
      httpsAgent,
      withCredentials: true,
      headers: {
        'X-Requested-With': 'Gemini'
      }
    });
  }

  async login() {
    try {
      const params = new URLSearchParams();
      params.append('username', MIRTH_USERNAME);
      params.append('password', MIRTH_PASSWORD);

      const response = await this.client.post('/api/users/_login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'Gemini'
        }
      });

      const cookies = response.headers['set-cookie'];
      if (cookies) {
        this.sessionCookie = cookies.find(cookie => cookie.startsWith('JSESSIONID'));
        this.client.defaults.headers.common['Cookie'] = this.sessionCookie;
      }
      
      return response.data;
    } catch (error) {
      console.error('Mirth Login Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async ensureLogin() {
    if (!this.sessionCookie) {
      await this.login();
    }
  }

  async request(config) {
    await this.ensureLogin();
    try {
      const response = await this.client(config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        this.sessionCookie = null;
        await this.ensureLogin();
        const retryResponse = await this.client(config);
        return retryResponse.data;
      }
      throw error;
    }
  }

  async createChannel(xmlPayload) {
    return this.request({
      method: 'post',
      url: '/api/channels',
      data: xmlPayload,
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  }

  async listChannels() {
    return this.request({
      method: 'get',
      url: '/api/channels/idsAndNames',
      headers: {
        'Accept': 'application/json'
      }
    });
  }

  async deployChannel(channelId) {
    return this.request({
      method: 'post',
      url: `/api/channels/${channelId}/_deploy`,
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  }

  async undeployChannel(channelId) {
    return this.request({
      method: 'post',
      url: `/api/channels/${channelId}/_undeploy`,
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  }

  async getChannelStatuses() {
    return this.request({
      method: 'get',
      url: '/api/channels/statuses',
      headers: {
        'Accept': 'application/json'
      }
    });
  }
}

export const mirthClient = new MirthClient();
