import db from '../utils/db.js';

/**
 * MessageLink Model
 * Handles database operations for scraped link metadata from messages
 */

/**
 * Create a new message link record
 * @param {Object} data - {messageId, url, title, description, imageUrl, domain}
 * @returns {Promise<Object>} Created message link
 */
export const createMessageLink = async (data) => {
  const { messageId, url, title = null, description = null, imageUrl = null, domain = null } = data;

  const [link] = await db`
    INSERT INTO message_links (message_id, url, title, description, image_url, domain)
    VALUES (${messageId}, ${url}, ${title}, ${description}, ${imageUrl}, ${domain})
    RETURNING id, message_id, url, title, description, image_url, domain, created_at
  `;

  return link;
};

/**
 * Get link metadata for a specific message
 * @param {number} messageId 
 * @returns {Promise<Object|null>} Link metadata or null
 */
export const getLinkByMessageId = async (messageId) => {
  const [link] = await db`
    SELECT id, message_id, url, title, description, image_url, domain, created_at
    FROM message_links
    WHERE message_id = ${messageId}
  `;
  return link || null;
};

/**
 * Get all links for a channel with pagination
 * @param {number} channelId 
 * @param {Object} options - {limit, offset}
 * @returns {Promise<Array>} Array of link records with message info
 */
export const getChannelLinks = async (channelId, options = {}) => {
  const { limit = 50, offset = 0 } = options;

  const links = await db`
    SELECT 
      ml.id,
      ml.message_id,
      ml.url,
      ml.title,
      ml.description,
      ml.image_url,
      ml.domain,
      ml.created_at,
      m.user_id,
      u.username
    FROM message_links ml
    INNER JOIN messages m ON ml.message_id = m.id
    INNER JOIN users u ON m.user_id = u.id
    WHERE m.channel_id = ${channelId}
    ORDER BY ml.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return links;
};

/**
 * Delete a message link
 * @param {number} linkId 
 * @returns {Promise<void>}
 */
export const deleteMessageLink = async (linkId) => {
  await db`
    DELETE FROM message_links WHERE id = ${linkId}
  `;
};

/**
 * Check if a link already exists for a message
 * @param {number} messageId 
 * @returns {Promise<boolean>}
 */
export const linkExistsForMessage = async (messageId) => {
  const [result] = await db`
    SELECT EXISTS(
      SELECT 1 FROM message_links WHERE message_id = ${messageId}
    ) as exists
  `;
  return result?.exists || false;
};
