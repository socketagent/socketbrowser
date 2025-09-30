"""LLM provider abstraction for Socket Browser."""

import os
import json
import requests
from openai import OpenAI


class LLMProvider:
    """Base class for LLM providers."""

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Generate text from prompts."""
        raise NotImplementedError


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider."""

    def __init__(self, model="gpt-4o", api_key=None):
        self.model = model
        self.api_key = api_key or self._get_api_key()
        self.client = OpenAI(api_key=self.api_key)

    def _get_api_key(self):
        """Get API key from environment or .env file."""
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            # Try to read from .env file
            env_paths = ['.env', '../.env', '../../.env', '../../../.env']
            for env_path in env_paths:
                try:
                    if os.path.exists(env_path):
                        with open(env_path, 'r') as f:
                            for line in f:
                                if line.startswith('OPENAI_API_KEY='):
                                    api_key = line.split('=', 1)[1].strip().strip('"\'')
                                    break
                        if api_key:
                            break
                except:
                    continue

        if not api_key:
            raise Exception("OpenAI API key not found")

        return api_key

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Generate text using OpenAI."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_completion_tokens=4000,
            timeout=60
        )
        return response.choices[0].message.content


class OllamaProvider(LLMProvider):
    """Ollama local LLM provider."""

    def __init__(self, model="qwen2.5-coder:7b", base_url="http://localhost:11434"):
        self.model = model
        self.base_url = base_url.rstrip("/")

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Generate text using Ollama."""

        # Combine prompts for Ollama
        combined_prompt = f"""{system_prompt}

{user_prompt}