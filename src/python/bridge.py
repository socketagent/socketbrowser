#!/usr/bin/env python3
"""
Python bridge for Socket Browser - Website Generation Approach
This script generates complete websites from Socket Agent APIs using LLMs.
"""

import sys
import json
import os
import requests
from openai import OpenAI

# socketagentlib not needed for direct API calls

def get_openai_client():
    """Get OpenAI client with API key from environment."""
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        # Try to read from .env file
        env_files = ['.env', '../.env', '../../.env', '../../../.env']
        for env_file in env_files:
            try:
                if os.path.exists(env_file):
                    with open(env_file, 'r') as f:
                        for line in f:
                            if line.startswith('OPENAI_API_KEY='):
                                api_key = line.split('=', 1)[1].strip().strip('"\'')
                                break
                    if api_key:
                        break
            except:
                continue

    if not api_key:
        raise Exception("OpenAI API key not found. Set OPENAI_API_KEY environment variable or add to .env file.")

    return OpenAI(api_key=api_key)


def discover_api(url):
    """Discover Socket Agent API at the given URL."""
    try:
        discovery_url = f"{url.rstrip('/')}/.well-known/socket-agent"
        response = requests.get(discovery_url, timeout=10)
        response.raise_for_status()

        descriptor = response.json()
        return {
            "success": True,
            "descriptor": descriptor
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def generate_complete_website(descriptor_data):
    """Generate a complete website (HTML/CSS/JS) from Socket Agent descriptor."""
    try:
        client = get_openai_client()

        # Determine the type of service
        service_type = infer_service_type(descriptor_data)
        endpoints = descriptor_data.get("endpoints", [])
        base_url = descriptor_data.get("baseUrl", "")

        # Create a comprehensive prompt for website generation
        prompt = build_website_prompt(descriptor_data, service_type, endpoints, base_url)

        response = client.chat.completions.create(
            model='gpt-4o',  # GPT-4o has larger context and better performance
            messages=[
                {
                    "role": "system",
                    "content": """You are a web developer that creates complete, functional websites from API specifications.

                    Generate a COMPLETE website that users can naturally interact with. The website should:
                    1. Look and feel like a real business website (not an API testing tool)
                    2. Have embedded JavaScript that makes API calls transparently
                    3. Include beautiful CSS styling
                    4. Handle user interactions naturally (shopping, browsing, etc.)
                    5. Make API calls behind the scenes when users interact with the site

                    Generate only the HTML content with embedded CSS and JavaScript. No markdown code blocks."""
                },
                {"role": "user", "content": prompt}
            ],
            max_completion_tokens=4000,  # Reasonable for GPT-4o
            timeout=60  # 60 second timeout
        )

        website_html = response.choices[0].message.content

        # Clean up any markdown if present
        website_html = clean_html(website_html)

        return {
            "success": True,
            "html": website_html
        }

    except Exception as e:
        import traceback
        error_details = f"Error: {str(e)}\nTraceback: {traceback.format_exc()}"
        print(f"Website generation error: {error_details}", file=sys.stderr)
        return {
            "success": False,
            "error": error_details
        }


def infer_service_type(descriptor):
    """Infer what kind of service this is from the descriptor."""
    name = descriptor.get("name", "").lower()
    description = descriptor.get("description", "").lower()
    combined = f"{name} {description}"

    if "grocery" in combined or "store" in combined or "shop" in combined:
        return "grocery_store"
    elif "bank" in combined or "financial" in combined:
        return "bank"
    elif "recipe" in combined or "cooking" in combined or "food" in combined:
        return "recipe_site"
    elif "ecommerce" in combined or "commerce" in combined:
        return "ecommerce"
    else:
        return "generic_service"


def build_website_prompt(descriptor, service_type, endpoints, base_url):
    """Build a comprehensive prompt for website generation."""

    service_templates = {
        "grocery_store": {
            "name": "Fresh Market",
            "description": "Create a modern grocery shopping website with product browsing, search, and shopping cart",
            "features": ["product catalog", "search functionality", "shopping cart", "product categories"]
        },
        "bank": {
            "name": "Secure Bank",
            "description": "Create a banking website with account management, transactions, and transfers",
            "features": ["account overview", "transaction history", "money transfers", "account management"]
        },
        "recipe_site": {
            "name": "Recipe Hub",
            "description": "Create a cooking website with recipe search, favorites, and meal planning",
            "features": ["recipe search", "recipe details", "favorites", "meal planning"]
        },
        "ecommerce": {
            "name": "Online Store",
            "description": "Create an e-commerce website with product catalog and shopping features",
            "features": ["product catalog", "product search", "shopping cart", "user accounts"]
        },
        "generic_service": {
            "name": descriptor.get("name", "Service Portal"),
            "description": f"Create a website for {descriptor.get('name', 'this service')}",
            "features": ["service features", "user interactions"]
        }
    }

    template = service_templates.get(service_type, service_templates["generic_service"])

    endpoint_list = "\n".join([
        f"- {ep.get('operationId', ep.get('path', ''))}: {ep.get('method', 'GET')} {ep.get('path', '')} - {ep.get('summary', '')}"
        for ep in endpoints
    ])

    return f"""
Create a complete, beautiful website for: {descriptor.get("name", "Unknown Service")}

Service Type: {template["name"]}
Description: {template["description"]}

API Base URL: {base_url}

Available API Endpoints:
{endpoint_list}

Requirements:
1. Create a COMPLETE website that looks professional and modern
2. Users should be able to naturally interact with it (no "Call API" buttons)
3. Embed JavaScript functions that call the actual API endpoints
4. Include beautiful CSS styling (modern design, responsive)
5. Handle loading states and errors gracefully
6. Make it feel like a real {service_type.replace('_', ' ')} website

For API calls, use this pattern in your JavaScript:
```javascript
async function apiCall(endpoint, params = {{}}) {{
    // This will be handled by the browser
    const result = await window.electronAPI.callAPI('{base_url}', endpoint, params);
    return result;
}}
```

Generate the complete HTML page with embedded CSS and JavaScript:
"""


def clean_html(html):
    """Clean generated HTML by removing markdown code blocks."""
    # Remove markdown code block markers
    html = html.replace('```html', '').replace('```', '')
    return html.strip()


def call_api(url, endpoint, params):
    """Make an API call to the Socket Agent endpoint."""
    try:
        # Simple implementation for now
        if endpoint.startswith('/'):
            api_url = f"{url.rstrip('/')}{endpoint}"
        else:
            api_url = f"{url.rstrip('/')}/{endpoint}"

        response = requests.get(api_url, params=params, timeout=10)
        response.raise_for_status()

        return {
            "success": True,
            "data": response.json(),
            "status_code": response.status_code
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def main():
    """Main entry point for the bridge."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command specified"}))
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == "discover":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "URL required for discover command"}))
                sys.exit(1)

            url = sys.argv[2]
            result = discover_api(url)
            print(json.dumps(result))

        elif command == "generate-website":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Descriptor JSON required for generate-website command"}))
                sys.exit(1)

            descriptor_json = sys.argv[2]
            descriptor = json.loads(descriptor_json)
            result = generate_complete_website(descriptor)
            print(json.dumps(result))

        elif command == "call-api":
            if len(sys.argv) < 5:
                print(json.dumps({"error": "URL, endpoint, and params required for call-api command"}))
                sys.exit(1)

            url = sys.argv[2]
            endpoint = sys.argv[3]
            params_json = sys.argv[4]
            params = json.loads(params_json)
            result = call_api(url, endpoint, params)
            print(json.dumps(result))

        # Natural language command removed - using direct UI interactions

        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": f"Command failed: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()