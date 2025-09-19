const axios = require('axios');
const { getEndpoint } = require('./discovery');

/**
 * Make an API call to a Socket Agent endpoint
 * @param {string} baseUrl - The base URL of the API
 * @param {string} endpointId - The endpoint operation ID or path
 * @param {Object} params - Parameters for the API call
 * @param {Object} descriptor - The Socket Agent descriptor (optional, for validation)
 * @returns {Promise<any>} - The API response data
 */
async function callAPI(baseUrl, endpointId, params = {}, descriptor = null) {
    try {
        let endpoint = null;
        let method = 'GET';
        let path = endpointId;

        // If we have the descriptor, use it to get endpoint details
        if (descriptor) {
            endpoint = getEndpoint(descriptor, endpointId);
            if (endpoint) {
                method = endpoint.method || 'GET';
                path = endpoint.path || path;
            }
        }

        // Substitute path parameters
        let finalPath = path;
        const pathParams = {};
        const queryParams = {};
        const bodyParams = {};

        // Separate parameters into path, query, and body
        Object.entries(params).forEach(([key, value]) => {
            if (finalPath.includes(`{${key}}`) || finalPath.includes(`{id}`) && key === 'id') {
                pathParams[key] = value;
                finalPath = finalPath.replace(`{${key}}`, value);
            } else if (method === 'GET' || method === 'DELETE') {
                queryParams[key] = value;
            } else {
                bodyParams[key] = value;
            }
        });

        // Build final URL
        const url = `${baseUrl.replace(/\/$/, '')}${finalPath}`;

        // Prepare request config
        const config = {
            method: method.toLowerCase(),
            url,
            timeout: 15000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Socket-Browser/0.1.0'
            }
        };

        // Add query parameters
        if (Object.keys(queryParams).length > 0) {
            config.params = queryParams;
        }

        // Add body for non-GET requests
        if (method !== 'GET' && method !== 'DELETE' && Object.keys(bodyParams).length > 0) {
            config.data = bodyParams;
            config.headers['Content-Type'] = 'application/json';
        }

        console.log(`Making API call: ${method} ${url}`, { params: queryParams, body: bodyParams });

        const response = await axios(config);

        console.log(`API response: ${response.status}`, response.data);

        return response.data;

    } catch (error) {
        console.error('API call failed:', error.message);

        if (error.response) {
            // Server responded with error status
            const status = error.response.status;
            const data = error.response.data;

            if (status >= 400 && status < 500) {
                throw new Error(`Client error (${status}): ${data?.message || data?.error || 'Bad request'}`);
            } else if (status >= 500) {
                throw new Error(`Server error (${status}): ${data?.message || data?.error || 'Internal server error'}`);
            } else {
                throw new Error(`HTTP ${status}: ${data?.message || data?.error || 'Request failed'}`);
            }
        } else if (error.code === 'ECONNREFUSED') {
            throw new Error('Connection refused. Is the API server running?');
        } else if (error.code === 'ENOTFOUND') {
            throw new Error('Cannot resolve hostname');
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout');
        } else {
            throw new Error(`Request failed: ${error.message}`);
        }
    }
}

/**
 * Build query string from parameters
 * @param {Object} params - Parameters object
 * @returns {string} - Query string (without leading ?)
 */
function buildQueryString(params) {
    return Object.entries(params)
        .filter(([key, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
}

module.exports = {
    callAPI,
    buildQueryString
};