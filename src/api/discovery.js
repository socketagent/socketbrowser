const axios = require('axios');

/**
 * Discover Socket Agent API descriptor from a given URL
 * @param {string} baseUrl - The base URL of the Socket Agent API
 * @returns {Promise<Object>} - The Socket Agent descriptor
 */
async function discoverSocketAgent(baseUrl) {
    try {
        // Normalize URL
        const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        // Try the standard Socket Agent discovery endpoint
        const discoveryUrl = `${url}/.well-known/socket-agent`;

        console.log(`Discovering Socket Agent at: ${discoveryUrl}`);

        const response = await axios.get(discoveryUrl, {
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Socket-Browser/0.1.0'
            }
        });

        const descriptor = response.data;

        // Validate descriptor structure
        if (!descriptor.name || !descriptor.endpoints) {
            throw new Error('Invalid Socket Agent descriptor: missing required fields');
        }

        // Ensure baseUrl is set correctly
        if (!descriptor.baseUrl) {
            descriptor.baseUrl = url;
        }

        console.log(`Discovered API: ${descriptor.name} with ${descriptor.endpoints.length} endpoints`);

        return descriptor;

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error(`Cannot connect to ${baseUrl}. Is the server running?`);
        } else if (error.response) {
            if (error.response.status === 404) {
                throw new Error(`No Socket Agent API found at ${baseUrl}. Make sure it's a Socket Agent compliant API.`);
            } else {
                throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
            }
        } else if (error.code === 'ENOTFOUND') {
            throw new Error(`Cannot resolve hostname: ${baseUrl}`);
        } else {
            throw new Error(`Discovery failed: ${error.message}`);
        }
    }
}

/**
 * Validate that a descriptor has the required Socket Agent structure
 * @param {Object} descriptor - The descriptor to validate
 * @returns {boolean} - Whether the descriptor is valid
 */
function validateDescriptor(descriptor) {
    const required = ['name', 'endpoints'];
    return required.every(field => descriptor.hasOwnProperty(field));
}

/**
 * Get endpoint details by operation ID or path
 * @param {Object} descriptor - The Socket Agent descriptor
 * @param {string} endpointId - The operation ID or path to find
 * @returns {Object|null} - The endpoint object or null if not found
 */
function getEndpoint(descriptor, endpointId) {
    return descriptor.endpoints.find(ep =>
        ep.operationId === endpointId ||
        ep.path === endpointId ||
        `${ep.method}:${ep.path}` === endpointId
    );
}

module.exports = {
    discoverSocketAgent,
    validateDescriptor,
    getEndpoint
};