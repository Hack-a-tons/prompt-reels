/**
 * Persistent queue system for article processing actions
 * Queues persist across Docker restarts (stored in data/queues/)
 * 
 * Queue types:
 * - fetch: Article fetching
 * - describe: Scene description  
 * - rate: Article rating
 * - fpo: Prompt optimization
 * 
 * Only one action of each type runs at once, others wait in queue
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

// Queue storage directory (persists across restarts)
const QUEUES_DIR = path.join(config.dataDir, 'queues');

// Ensure queues directory exists
if (!fs.existsSync(QUEUES_DIR)) {
  fs.mkdirSync(QUEUES_DIR, { recursive: true });
}

// Queue types
const QUEUE_TYPES = {
  FETCH: 'fetch',
  DESCRIBE: 'describe',
  RATE: 'rate',
  FPO: 'fpo',
};

/**
 * Get queue file path for a type
 */
const getQueuePath = (queueType) => {
  return path.join(QUEUES_DIR, `${queueType}.json`);
};

/**
 * Load queue from disk
 */
const loadQueue = (queueType) => {
  const queuePath = getQueuePath(queueType);
  if (!fs.existsSync(queuePath)) {
    return { items: [], processing: null };
  }
  try {
    return JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  } catch (error) {
    console.error(`Error loading queue ${queueType}:`, error.message);
    return { items: [], processing: null };
  }
};

/**
 * Save queue to disk
 */
const saveQueue = (queueType, queueData) => {
  const queuePath = getQueuePath(queueType);
  fs.writeFileSync(queuePath, JSON.stringify(queueData, null, 2));
};

/**
 * Add item to queue
 * @param {string} queueType - Type of queue (fetch, describe, rate, fpo)
 * @param {object} item - Item to add to queue
 * @returns {number} Position in queue (0 = currently processing)
 */
const enqueue = (queueType, item) => {
  const queue = loadQueue(queueType);
  
  // Check if item already exists (by id or articleId)
  const itemId = item.id || item.articleId;
  if (itemId) {
    const exists = queue.items.some(i => (i.id || i.articleId) === itemId);
    if (exists) {
      console.log(`Item ${itemId} already in ${queueType} queue`);
      return queue.items.findIndex(i => (i.id || i.articleId) === itemId) + 1;
    }
  }
  
  // Add metadata
  const queueItem = {
    ...item,
    queuedAt: new Date().toISOString(),
    status: 'queued',
  };
  
  queue.items.push(queueItem);
  saveQueue(queueType, queue);
  
  console.log(`✓ Added to ${queueType} queue: ${itemId || 'item'} (position: ${queue.items.length})`);
  return queue.items.length;
};

/**
 * Get next item from queue and mark as processing
 * @param {string} queueType - Type of queue
 * @returns {object|null} Next item or null if queue empty or already processing
 */
const dequeue = (queueType) => {
  const queue = loadQueue(queueType);
  
  // Check if already processing something
  if (queue.processing) {
    console.log(`${queueType} queue already processing: ${queue.processing.id || queue.processing.articleId}`);
    return null;
  }
  
  // Get next item
  if (queue.items.length === 0) {
    return null;
  }
  
  const item = queue.items.shift();
  queue.processing = {
    ...item,
    status: 'processing',
    startedAt: new Date().toISOString(),
  };
  
  saveQueue(queueType, queue);
  console.log(`▶ Processing ${queueType}: ${item.id || item.articleId}`);
  
  return queue.processing;
};

/**
 * Mark current item as complete and remove from processing
 * @param {string} queueType - Type of queue
 * @param {boolean} success - Whether processing was successful
 * @param {object} result - Result data
 */
const complete = (queueType, success = true, result = {}) => {
  const queue = loadQueue(queueType);
  
  if (!queue.processing) {
    console.log(`No item being processed in ${queueType} queue`);
    return;
  }
  
  const item = queue.processing;
  queue.processing = null;
  
  // Log completion
  const itemId = item.id || item.articleId || 'item';
  if (success) {
    console.log(`✓ Completed ${queueType}: ${itemId}`);
  } else {
    console.log(`✗ Failed ${queueType}: ${itemId}`);
    
    // Re-queue failed items (max 3 attempts)
    item.attempts = (item.attempts || 0) + 1;
    if (item.attempts < 3) {
      console.log(`  Re-queuing (attempt ${item.attempts + 1}/3)`);
      queue.items.push(item);
    } else {
      console.log(`  Max attempts reached, discarding`);
    }
  }
  
  saveQueue(queueType, queue);
};

/**
 * Get queue status
 * @param {string} queueType - Type of queue (or 'all' for all queues)
 * @returns {object} Queue status
 */
const getStatus = (queueType = 'all') => {
  if (queueType === 'all') {
    return {
      fetch: getStatus(QUEUE_TYPES.FETCH),
      describe: getStatus(QUEUE_TYPES.DESCRIBE),
      rate: getStatus(QUEUE_TYPES.RATE),
      fpo: getStatus(QUEUE_TYPES.FPO),
    };
  }
  
  const queue = loadQueue(queueType);
  return {
    type: queueType,
    processing: queue.processing,
    queued: queue.items.length,
    items: queue.items,
  };
};

/**
 * Clear entire queue (emergency use only)
 */
const clearQueue = (queueType) => {
  saveQueue(queueType, { items: [], processing: null });
  console.log(`✓ Cleared ${queueType} queue`);
};

/**
 * Process queues automatically
 * Call this periodically to process pending items
 */
const processQueues = async (processors) => {
  const queues = [
    QUEUE_TYPES.FETCH,
    QUEUE_TYPES.DESCRIBE,
    QUEUE_TYPES.RATE,
    QUEUE_TYPES.FPO,
  ];
  
  for (const queueType of queues) {
    const status = getStatus(queueType);
    
    // Skip if already processing or empty
    if (status.processing || status.queued === 0) {
      continue;
    }
    
    // Get next item
    const item = dequeue(queueType);
    if (!item) {
      continue;
    }
    
    // Process item with provided processor
    const processor = processors[queueType];
    if (!processor) {
      console.error(`No processor defined for ${queueType}`);
      complete(queueType, false);
      continue;
    }
    
    try {
      const result = await processor(item);
      complete(queueType, true, result);
    } catch (error) {
      console.error(`Error processing ${queueType}:`, error.message);
      complete(queueType, false);
    }
  }
};

module.exports = {
  QUEUE_TYPES,
  enqueue,
  dequeue,
  complete,
  getStatus,
  clearQueue,
  processQueues,
};
