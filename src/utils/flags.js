/**
 * Flag system for managing operation locks
 * Flags are stored in /tmp/prompt-reels-flags/ (cleared on Docker restart)
 */

const fs = require('fs');
const path = require('path');

// Use /tmp for flags (cleared on Docker restart)
const FLAGS_DIR = '/tmp/prompt-reels-flags';

// Ensure flags directory exists
if (!fs.existsSync(FLAGS_DIR)) {
  fs.mkdirSync(FLAGS_DIR, { recursive: true });
}

/**
 * Set a flag
 * @param {string} flagName - Name of the flag
 * @param {object} data - Optional data to store with flag
 */
const setFlag = (flagName, data = {}) => {
  const flagPath = path.join(FLAGS_DIR, `${flagName}.flag`);
  const flagData = {
    setAt: new Date().toISOString(),
    ...data,
  };
  fs.writeFileSync(flagPath, JSON.stringify(flagData, null, 2));
};

/**
 * Check if a flag exists
 * @param {string} flagName - Name of the flag
 * @returns {boolean} True if flag exists
 */
const hasFlag = (flagName) => {
  const flagPath = path.join(FLAGS_DIR, `${flagName}.flag`);
  return fs.existsSync(flagPath);
};

/**
 * Get flag data
 * @param {string} flagName - Name of the flag
 * @returns {object|null} Flag data or null if not exists
 */
const getFlag = (flagName) => {
  const flagPath = path.join(FLAGS_DIR, `${flagName}.flag`);
  if (!fs.existsSync(flagPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(flagPath, 'utf8'));
  } catch (error) {
    return null;
  }
};

/**
 * Clear a flag
 * @param {string} flagName - Name of the flag
 */
const clearFlag = (flagName) => {
  const flagPath = path.join(FLAGS_DIR, `${flagName}.flag`);
  if (fs.existsSync(flagPath)) {
    fs.unlinkSync(flagPath);
  }
};

/**
 * Clear all flags
 */
const clearAllFlags = () => {
  if (fs.existsSync(FLAGS_DIR)) {
    const files = fs.readdirSync(FLAGS_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(FLAGS_DIR, file));
    }
  }
};

module.exports = {
  setFlag,
  hasFlag,
  getFlag,
  clearFlag,
  clearAllFlags,
};
