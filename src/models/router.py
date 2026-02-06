import os
import yaml
import httpx
from typing import Optional, Dict, Any, AsyncGenerator
from pathlib import Path

class ModelRouter:
    def __init__(self, config_path: str = "config/models.yaml"):
        self.config = self._load_config(config_path)
        self.default_model = self.config.get("default_model", "kimi-k2.5")
        self.providers = self.config.get("providers", {})
        self.task_routing = self.config.get("task_routing", {})
        self.auto_switch = self.config.get("auto_switch", {})
        
    def _load_config(self, path: str) -> Dict[str, Any]:
        """Load model configuration from YAML"""
        config_full_path = Path(__file__).parent.parent.parent / path
        with open(config_full_path, 'r') as f:
            return yaml.safe_load(f)
    
    def get_api_key(self, provider: str) -> str:
        """Get API key from environment variable"""
        env_var = self.providers[provider]["api_key_env"]
        api_key = os.getenv(env_var)
        if not api_key:
            raise ValueError(f"Missing API key: {env_var}")
        return api_key
    
    def detect_task_type(self, message: str) -> str:
        """Detect task type from message content"""
        message_lower = message.lower()
        
        # Coding detection
        code_keywords = ["code", "function", "bug", "error", "python", "javascript", "typescript", "html", "css", "sql", "api", "database"]
        if any(kw in message_lower for kw in code_keywords):
            return "coding"
        
        # Math/reasoning detection
        math_keywords = ["calculate", "math", "solve", "equation", "logic", "reasoning", "proof", "algorithm"]
        if any(kw in message_lower for kw in math_keywords):
            return "reasoning"
        
        # Creative writing detection
        creative_keywords = ["write", "story", "poem", "creative", "essay", "blog", "article", "draft"]
        if any(kw in message_lower for kw in creative_keywords):
            return "creative_writing"
        
        # Long context detection (length-based)
        if len(message) > 4000:
            return "long_context"
        
        # Fast response detection (short, simple queries)
        if len(message) < 50 and "?" in message:
            return "fast_responses"
        
        return "default"
    
    def select_model(self, message: str, preferred_model: Optional[str] = None) -> Dict[str, Any]:
        """Select best model for the task"""
        if preferred_model:
            return self._get_model_config(preferred_model)
        
        if not self.auto_switch.get("enabled", True):
            return self._get_model_config(self.default_model)
        
        task_type = self.detect_task_type(message)
        routing = self.task_routing.get(task_type, {})
        
        primary_id = routing.get("primary", self.default_model)
        fallback_id = routing.get("fallback", self.default_model)
        
        # Try primary, fallback to default if not available
        try:
            return self._get_model_config(primary_id)
        except:
            return self._get_model_config(fallback_id)
    
    def _get_model_config(self, model_id: str) -> Dict[str, Any]:
        """Get full configuration for a model"""
        # Check Moonshot
        if "moonshot" in self.providers:
            moonshot_models = self.providers["moonshot"].get("models", {})
            if model_id in moonshot_models:
                return {
                    "provider": "moonshot",
                    "provider_config": self.providers["moonshot"],
                    **moonshot_models[model_id]
                }
        
        # Check OpenRouter
        if "openrouter" in self.providers:
            or_models = self.providers["openrouter"].get("models", {})
            for key, config in or_models.items():
                if config.get("id") == model_id or key == model_id:
                    return {
                        "provider": "openrouter",
                        "provider_config": self.providers["openrouter"],
                        **config
                    }
        
        raise ValueError(f"Model not found: {model_id}")
    
    async def chat_completion(
        self, 
        message: str, 
        model: Optional[str] = None,
        stream: bool = False
    ) -> AsyncGenerator[str, None]:
        """Send chat completion request to selected model"""
        model_config = self.select_model(message, model)
        provider = model_config["provider"]
        
        if provider == "moonshot":
            async for chunk in self._call_moonshot(message, model_config, stream):
                yield chunk
        elif provider == "openrouter":
            async for chunk in self._call_openrouter(message, model_config, stream):
                yield chunk
    
    async def _call_moonshot(
        self, 
        message: str, 
        model_config: Dict[str, Any],
        stream: bool
    ) -> AsyncGenerator[str, None]:
        """Call Moonshot API"""
        api_key = self.get_api_key("moonshot")
        base_url = model_config["provider_config"]["base_url"]
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model_config["id"],
            "messages": [{"role": "user", "content": message}],
            "stream": stream,
            "max_tokens": model_config.get("max_tokens", 4096)
        }
        
        async with httpx.AsyncClient() as client:
            if stream:
                async with client.stream(
                    "POST",
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            yield self._extract_content(data)
            else:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0
                )
                data = response.json()
                yield data["choices"][0]["message"]["content"]
    
    async def _call_openrouter(
        self, 
        message: str, 
        model_config: Dict[str, Any],
        stream: bool
    ) -> AsyncGenerator[str, None]:
        """Call OpenRouter API"""
        api_key = self.get_api_key("openrouter")
        base_url = model_config["provider_config"]["base_url"]
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://clawdbot.app",
            "X-Title": "Clawdbot"
        }
        
        payload = {
            "model": model_config["id"],
            "messages": [{"role": "user", "content": message}],
            "stream": stream,
            "max_tokens": model_config.get("max_tokens", 4096)
        }
        
        async with httpx.AsyncClient() as client:
            if stream:
                async with client.stream(
                    "POST",
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            yield self._extract_content(data)
            else:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60.0
                )
                data = response.json()
                yield data["choices"][0]["message"]["content"]
    
    def _extract_content(self, data: str) -> str:
        """Extract content from SSE stream"""
        import json
        try:
            parsed = json.loads(data)
            delta = parsed["choices"][0].get("delta", {})
            return delta.get("content", "")
        except:
            return ""

# Singleton instance for import
router = ModelRouter()
