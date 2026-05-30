import * as ChannelModel from '../models/channel.model.js';
import * as MessageLinkModel from '../models/messageLink.model.js';

/**
 * URL Regex Pattern
 * Matches HTTP and HTTPS URLs in text
 */
const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;

/**
 * Extract first URL from text content
 * @param {string} text 
 * @returns {string|null} First URL found or null
 */
const extractFirstUrl = (text) => {
  if (!text) return null;
  const matches = text.match(URL_REGEX);
  return matches ? matches[0] : null;
};

/**
 * Extract domain from URL
 * @param {string} url 
 * @returns {string|null} Domain (e.g., "youtube.com")
 */
const extractDomain = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

/**
 * Scrape Open Graph metadata from URL (async, non-blocking)
 * Uses dynamic import to handle the ESM module
 * @param {string} url 
 * @returns {Promise<Object>} { title, description, imageUrl }
 */
const scrapeUrlMetadata = async (url) => {
  try {
    // Dynamic import of open-graph-scraper
    const ogs = (await import('open-graph-scraper')).default;

    const options = {
      url,
      timeout: 5000, // 5 second timeout to not block too long
      fetchOptions: {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; TeamManagementBot/1.0)'
        }
      }
    };

    const { result, error } = await ogs(options);

    if (error || !result.success) {
      console.log(`[scrapeUrlMetadata] Failed to scrape ${url}:`, error);
      return { title: null, description: null, imageUrl: null };
    }

    return {
      title: result.ogTitle || result.twitterTitle || result.dcTitle || null,
      description: result.ogDescription || result.twitterDescription || result.dcDescription || null,
      imageUrl: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url || null
    };
  } catch (err) {
    console.error(`[scrapeUrlMetadata] Error scraping ${url}:`, err.message);
    return { title: null, description: null, imageUrl: null };
  }
};

/**
 * Process and save link metadata for a message (runs async in background)
 * @param {number} messageId 
 * @param {string} content 
 */
const processMessageLinks = async (messageId, content) => {
  try {
    const url = extractFirstUrl(content);
    if (!url) return;

    const domain = extractDomain(url);

    // Scrape metadata (this can take a few seconds)
    const { title, description, imageUrl } = await scrapeUrlMetadata(url);

    // Save to database
    await MessageLinkModel.createMessageLink({
      messageId,
      url,
      title,
      description,
      imageUrl,
      domain
    });

    console.log(`[processMessageLinks] Saved link metadata for message ${messageId}: ${url}`);
  } catch (err) {
    console.error(`[processMessageLinks] Error processing links for message ${messageId}:`, err.message);
    // Don't throw - we don't want to fail the message if link scraping fails
  }
};

/**
 * Channel Controller
 * Handles HTTP requests for channel and message operations
 * 
 * Security Notes:
 * - Authentication: Handled by auth middleware (verifyToken)
 * - Team Membership: Verified by verifyTeamMember middleware
 * - Role-based Access: Enforced by verifyTeamRole middleware for create/delete operations
 * - Project Membership: Checked at model layer for project-specific channels
 * 
 * Note: Use req.validated.params and req.validated.query for Zod-transformed values
 * (e.g., string IDs converted to numbers)
 */

/**
 * GET /teams/:teamId/channels
 * Get all channels for a team that user has access to
 * 
 * Middleware: verifyTeamMember (ensures user is team member)
 */
/**
 * GET /teams/:teamId/channels/:channelId/messages/search
 * Search messages in a channel
 * 
 * Middleware: verifyTeamMember (ensures user is team member)
 */
export const searchMessages = async (req, res, next) => {
  try {
    const { channelId } = req.validated?.params || req.params;
    const { q: searchQuery } = req.validated?.query || req.query;
    const userId = req.user.id;

    console.log(`[searchMessages] User ${userId} searching in channel ${channelId} for: "${searchQuery}"`);

    const messages = await ChannelModel.searchMessages(channelId, userId, searchQuery);

    console.log(`[searchMessages] Found ${messages.length} matching messages`);

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('[searchMessages] Error:', error.message);
    if (error.message.includes('Access denied') || error.message.includes('not found')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const getTeamChannels = async (req, res, next) => {
  try {
    // Use validated params for transformed (numeric) teamId
    const { teamId } = req.validated?.params || req.params;
    const userId = req.user.id;

    console.log(`[getTeamChannels] User ${userId} requesting channels for team ${teamId}`);

    // Note: verifyTeamMember middleware already confirmed team membership
    // Model still checks for project-specific channel access
    const channels = await ChannelModel.getTeamChannels(teamId, userId);

    console.log(`[getTeamChannels] Found ${channels.length} channels`);

    res.status(200).json({
      success: true,
      data: channels,
    });
  } catch (error) {
    console.error('[getTeamChannels] Error:', error.message);
    // Handle known authorization errors (from model layer project checks)
    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * GET /teams/:teamId/channels/:channelId
 * Get a single channel by ID
 * 
 * Middleware: verifyTeamMember (ensures user is team member)
 */
export const getChannel = async (req, res, next) => {
  try {
    const { channelId } = req.validated?.params || req.params;
    const userId = req.user.id;

    const channel = await ChannelModel.getChannelById(channelId, userId);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found',
      });
    }

    res.status(200).json({
      success: true,
      data: channel,
    });
  } catch (error) {
    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * POST /teams/:teamId/channels
 * Create a new channel in a team
 * 
 * Middleware: 
 * - verifyTeamMember (ensures user is team member)
 * - verifyTeamRole(['owner', 'admin']) (ensures user has permission to create channels)
 * 
 * Security: Role check is done at middleware level, not repeated here
 */
export const createChannel = async (req, res, next) => {
  try {
    const { teamId } = req.validated?.params || req.params;
    const userId = req.user.id;

    // Use validated body - Zod already sanitized and validated these
    const { name, type, projectId, isPrivate } = req.validated?.body || req.body;

    console.log(`[createChannel] User ${userId} (role: ${req.teamMembership?.role}) creating channel "${name}" in team ${teamId}`);

    const channel = await ChannelModel.createChannel(
      { teamId, name, type, projectId, isPrivate },
      userId
    );

    console.log(`[createChannel] Channel created successfully: ID ${channel.id}`);

    res.status(201).json({
      success: true,
      message: 'Channel created successfully',
      data: channel,
    });
  } catch (error) {
    console.error('[createChannel] Error:', error.message);

    // Handle duplicate channel name (PostgreSQL unique constraint violation)
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'A channel with this name already exists in the team',
      });
    }

    // Handle project validation errors
    if (error.message.includes('Project not found')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle access denied (shouldn't happen if middleware is configured correctly)
    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};

/**
 * GET /teams/:teamId/channels/:channelId/messages
 * Get messages for a channel with pagination
 */
export const getChannelMessages = async (req, res, next) => {
  try {
    const { channelId } = req.validated?.params || req.params;
    const userId = req.user.id;
    // Use validated query for transformed (numeric) values
    const { limit, before } = req.validated?.query || req.query;

    const messages = await ChannelModel.getChannelMessages(channelId, userId, {
      limit: limit || 50,
      before,
    });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    if (error.message.includes('Access denied') || error.message.includes('not found')) {
      return res.status(403).json({
        success: false,
        message: 'Channel not found or access denied',
      });
    }
    next(error);
  }
};

/**
 * POST /teams/:teamId/channels/:channelId/messages
 * Create a new message in a channel (REST fallback, prefer WebSocket)
 * Supports file attachments via multipart/form-data (files uploaded to S3)
 * 
 * Multiple files: Since DB only allows one attachment_url per message,
 * we create separate messages for each file:
 * - Message 1: content + file1
 * - Message 2: empty content + file2
 * - Message 3: empty content + file3
 */
export const createMessage = async (req, res, next) => {
  try {
    const { channelId } = req.validated?.params || req.params;
    const userId = req.user.id;

    // Get content from body (may come from FormData or JSON)
    const content = (req.body.content || '').trim();

    // Collect all uploaded files from multer-s3
    const uploadedFiles = req.files || [];

    // Log uploaded files for debugging
    if (uploadedFiles.length > 0) {
      console.log(`[createMessage] ${uploadedFiles.length} file(s) uploaded to S3:`);
      uploadedFiles.forEach((file, index) => {
        console.log(`  File ${index + 1}: ${file.originalname} -> ${file.location}`);
      });
    }

    // Validate: must have either content or at least one file
    if (!content && uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message must have content or attachment',
      });
    }

    const createdMessages = [];

    // Case 1: No files - just create one message with content
    if (uploadedFiles.length === 0) {
      const message = await ChannelModel.createMessage(
        { channelId, content, attachmentUrl: null },
        userId
      );
      createdMessages.push(message);
      console.log(`[createMessage] Text message created: ID ${message.id}`);
    }
    // Case 2: One or more files - create separate message for each
    else {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const attachmentUrl = file.location;

        // First message gets the text content, subsequent messages get empty content
        const messageContent = i === 0 ? content : '';

        const message = await ChannelModel.createMessage(
          { channelId, content: messageContent, attachmentUrl },
          userId
        );
        createdMessages.push(message);
        console.log(`[createMessage] Message ${i + 1} created: ID ${message.id}, file: ${file.originalname}`);
      }
    }

    console.log(`[createMessage] Total messages created: ${createdMessages.length}`);

    // Process link metadata in background (non-blocking)
    // Only process the first message if it has text content
    if (createdMessages.length > 0 && content) {
      const firstMessage = createdMessages[0];
      // Fire and forget - don't await, let it run in background
      processMessageLinks(firstMessage.id, content).catch(err => {
        console.error('[createMessage] Background link processing failed:', err.message);
      });
    }

    // Emit real-time events for created message(s) via Socket.io
    const io = req.app.get('io');
    if (io) {
      const roomName = `channel:${channelId}`;
      createdMessages.forEach((msg) => {
        io.to(roomName).emit('new-message', msg);
      });
      console.log(`[createMessage] Emitted ${createdMessages.length} new-message event(s) to ${roomName}`);
    }

    // Return response
    // If single message, return it directly for backward compatibility
    // If multiple messages, return array
    res.status(201).json({
      success: true,
      data: createdMessages.length === 1 ? createdMessages[0] : createdMessages,
      count: createdMessages.length,
    });
  } catch (error) {
    console.error('[createMessage] Error:', error.message);
    if (error.message.includes('Access denied') || error.message.includes('not found')) {
      return res.status(403).json({
        success: false,
        message: 'Channel not found or access denied',
      });
    }
    next(error);
  }
};

/**
 * DELETE /teams/:teamId/channels/:channelId
 * Delete a channel
 * 
 * Middleware: verifyTeamMember, verifyTeamRole(['owner', 'admin'])
 * Security: Only team owners and admins can delete channels
 */
export const deleteChannel = async (req, res, next) => {
  try {
    const { teamId, channelId } = req.validated?.params || req.params;
    const userId = req.user.id;

    console.log(`[deleteChannel] User ${userId} deleting channel ${channelId} in team ${teamId}`);

    // Delete the channel (cascades to messages via FK constraint)
    await ChannelModel.deleteChannel(channelId, teamId, userId);

    console.log(`[deleteChannel] Channel ${channelId} deleted successfully`);

    res.status(200).json({
      success: true,
      message: 'Channel deleted successfully',
    });
  } catch (error) {
    console.error('[deleteChannel] Error:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found',
      });
    }
    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    next(error);
  }
};

/**
 * GET /teams/:teamId/channels/:channelId/links
 * Get all scraped links for a channel (for Channel Info sidebar)
 * 
 * Middleware: verifyTeamMember
 */
export const getChannelLinks = async (req, res, next) => {
  try {
    const { channelId } = req.validated?.params || req.params;
    const userId = req.user.id;
    const { limit, offset } = req.validated?.query || req.query;

    // Verify user has access to this channel
    const channel = await ChannelModel.getChannelById(channelId, userId);
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found or access denied',
      });
    }

    // Fetch links for this channel
    const links = await MessageLinkModel.getChannelLinks(channelId, {
      limit: limit || 50,
      offset: offset || 0
    });

    console.log(`[getChannelLinks] Found ${links.length} links for channel ${channelId}`);

    res.status(200).json({
      success: true,
      data: links,
    });
  } catch (error) {
    console.error('[getChannelLinks] Error:', error.message);
    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * DELETE /teams/:teamId/channels/:channelId/messages/:messageId
 * Withdraw (soft-delete) a message
 * 
 * Security: Only message owner can withdraw their own messages
 * Action: Replaces content with "This message has been withdrawn."
 */
export const withdrawMessage = async (req, res, next) => {
  try {
    const { channelId, messageId } = req.validated?.params || req.params;
    const userId = req.user.id;

    console.log(`[withdrawMessage] User ${userId} withdrawing message ${messageId} in channel ${channelId}`);

    const updatedMessage = await ChannelModel.withdrawMessage(messageId, channelId, userId);

    console.log(`[withdrawMessage] Message ${messageId} withdrawn successfully`);

    // Emit socket event for real-time UI update
    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('message-withdrawn', {
        messageId: parseInt(messageId),
        channelId: parseInt(channelId),
        content: updatedMessage.content,
        is_withdrawn: true,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message withdrawn successfully',
      data: updatedMessage,
    });
  } catch (error) {
    console.error('[withdrawMessage] Error:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    if (error.message.includes('Access denied') || error.message.includes('only withdraw your own')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('already been withdrawn')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};
