const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');

// Initialize OpenAI client
let openai = null;

function initializeOpenAI() {
    if (!openai) {
        const apiKey = process.env.OPENAI_API_KEY || getAPIKeyFromFile();
        if (!apiKey) {
            throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable or add it to .env file.');
        }
        openai = new OpenAI({ apiKey });
    }
    return openai;
}

function getAPIKeyFromFile() {
    try {
        // Try to read from .env file in current directory or parent directories
        const envPaths = [
            path.join(process.cwd(), '.env'),
            path.join(__dirname, '../../.env'),
            path.join(__dirname, '../../../.env')
        ];

        for (const envPath of envPaths) {
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const match = envContent.match(/OPENAI_API_KEY=(.+)/);
                if (match && match[1]) {
                    return match[1].trim().replace(/['"]/g, '');
                }
            }
        }

        return null;
    } catch (error) {
        console.warn('Could not read .env file:', error.message);
        return null;
    }
}

/**
 * Generate HTML UI from Socket Agent descriptor using LLM
 * @param {Object} descriptor - The Socket Agent API descriptor
 * @returns {Promise<string>} - Generated HTML content
 */
async function generateUI(descriptor) {
    try {
        const client = initializeOpenAI();

        const prompt = buildUIGenerationPrompt(descriptor);

        console.log('Sending UI generation request to OpenAI...');

        const response = await client.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: `You are a UI generator that creates HTML interfaces for Socket Agent APIs.
                    Generate clean, functional HTML that uses the provided CSS classes and follows the patterns shown in the example.
                    Always include proper form elements, buttons with data-api-call attributes, and result containers.
                    Make the interface intuitive and user-friendly based on the API's purpose.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 3000
        });

        const generatedHTML = response.choices[0].message.content;

        console.log('UI generation completed successfully');

        // Clean up the HTML (remove markdown code blocks if present)
        return cleanGeneratedHTML(generatedHTML);

    } catch (error) {
        console.error('UI generation failed:', error.message);

        if (error.message.includes('API key')) {
            throw new Error('OpenAI API key is invalid or missing. Please check your configuration.');
        } else if (error.status === 429) {
            throw new Error('OpenAI rate limit exceeded. Please try again in a few minutes.');
        } else if (error.status === 403) {
            throw new Error('OpenAI API access denied. Please check your API key and billing status.');
        } else {
            throw new Error(`UI generation failed: ${error.message}`);
        }
    }
}

/**
 * Build the prompt for UI generation
 * @param {Object} descriptor - The Socket Agent descriptor
 * @returns {string} - The complete prompt
 */
function buildUIGenerationPrompt(descriptor) {
    const apiType = inferAPIType(descriptor);
    const endpoints = descriptor.endpoints || [];

    return `
Generate an HTML interface for this Socket Agent API:

**API Information:**
- Name: ${descriptor.name}
- Description: ${descriptor.description || 'No description provided'}
- Type: ${apiType}
- Base URL: ${descriptor.baseUrl}

**Available Endpoints:**
${endpoints.map(ep =>
    `- ${ep.operationId || ep.path}: ${ep.method} ${ep.path}${ep.summary ? ` - ${ep.summary}` : ''}`
).join('\n')}

**Requirements:**
1. Create a user-friendly interface appropriate for a ${apiType}
2. Use the existing CSS classes: .api-interface, .api-section, .api-form, .form-group, .api-button, etc.
3. For each endpoint, create a form with appropriate input fields
4. Add data-api-call attributes to buttons with the endpoint's operationId or path
5. Include proper labels and placeholders for form fields
6. Group related endpoints into sections
7. Make the interface intuitive - infer what users would want to do

**Example Structure:**
\`\`\`html
<div class="api-interface">
    <h1>🏪 ${descriptor.name}</h1>

    <div class="api-section">
        <h2>Browse Products</h2>
        <form class="api-form">
            <div class="form-group">
                <label>Search Term:</label>
                <input type="text" name="query" placeholder="Enter search term">
            </div>
            <button type="button" class="api-button" data-api-call="search_products">Search Products</button>
        </form>
    </div>
</div>
\`\`\`

Generate the complete HTML interface now:`;
}

/**
 * Infer the type of API from descriptor
 * @param {Object} descriptor - The Socket Agent descriptor
 * @returns {string} - Inferred API type
 */
function inferAPIType(descriptor) {
    const name = descriptor.name?.toLowerCase() || '';
    const description = descriptor.description?.toLowerCase() || '';
    const combined = `${name} ${description}`;

    if (combined.includes('grocery') || combined.includes('store') || combined.includes('shop')) {
        return 'grocery store';
    } else if (combined.includes('bank') || combined.includes('financial')) {
        return 'banking system';
    } else if (combined.includes('recipe') || combined.includes('cooking') || combined.includes('food')) {
        return 'recipe service';
    } else if (combined.includes('ecommerce') || combined.includes('commerce')) {
        return 'e-commerce platform';
    } else {
        return 'web service';
    }
}

/**
 * Clean generated HTML by removing markdown code blocks
 * @param {string} html - Raw generated HTML
 * @returns {string} - Cleaned HTML
 */
function cleanGeneratedHTML(html) {
    // Remove markdown code block markers
    let cleaned = html.replace(/```html\n?/g, '').replace(/```\n?/g, '');

    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Generate a fallback UI when LLM generation fails
 * @param {Object} descriptor - The Socket Agent descriptor
 * @returns {string} - Fallback HTML
 */
function generateFallbackUI(descriptor) {
    const endpoints = descriptor.endpoints || [];

    const endpointHTML = endpoints.map(ep => `
        <div class="api-section">
            <h3>${ep.operationId || ep.path}</h3>
            <p>${ep.summary || `${ep.method} ${ep.path}`}</p>
            <button class="api-button" data-api-call="${ep.operationId || ep.path}">
                Call ${ep.operationId || ep.path}
            </button>
        </div>
    `).join('');

    return `
        <div class="api-interface">
            <h1>${descriptor.name}</h1>
            <p>${descriptor.description || 'Socket Agent API'}</p>
            ${endpointHTML}
        </div>
    `;
}

module.exports = {
    generateUI,
    generateFallbackUI,
    inferAPIType
};