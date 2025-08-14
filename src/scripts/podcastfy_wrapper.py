#!/usr/bin/env python3
"""
Python wrapper script for Podcastfy integration.
Interfaces with external Podcastfy service via HTTP API and outputs progress updates to stdout in JSON format.
"""

import json
import sys
import os
import time
import argparse
import requests
from typing import Dict, Any, Optional
from urllib.parse import urljoin


class PodcastfyWrapper:
    def __init__(self, base_url: str = "http://localhost:8123"):
        self.base_url = base_url.rstrip('/')
        self.api_url = urljoin(self.base_url + '/', 'api/generate')
        self.session = requests.Session()
        self.session.timeout = 30
        
    def log_progress(self, message_type: str, data: Dict[str, Any]) -> None:
        """Output progress message to stdout in JSON format"""
        progress_message = {
            "type": message_type,
            "timestamp": int(time.time() * 1000),
            **data
        }
        print(json.dumps(progress_message), flush=True)
    
    def log_error(self, error_msg: str, error_code: str = "GENERAL_ERROR") -> None:
        """Output error message to stdout in JSON format"""
        self.log_progress("error", {
            "error": error_msg,
            "code": error_code
        })
    
    def generate_podcast(self, conversation_data: Dict[str, Any], generation_params: Dict[str, Any]) -> bool:
        """
        Generate podcast using external Podcastfy service
        Returns True on success, False on failure
        """
        try:
            self.log_progress("progress", {"step": "initializing", "percent": 0})
            
            # Prepare request payload
            payload = {
                "conversation": conversation_data,
                "config": generation_params,
                "format": "m4a",  # Default audio format
                "streaming": True  # Request streaming updates if supported
            }
            
            self.log_progress("progress", {"step": "connecting", "percent": 10})
            
            # Make request to Podcastfy service
            try:
                response = self.session.post(
                    self.api_url,
                    json=payload,
                    headers={
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    stream=True
                )
                response.raise_for_status()
                
            except requests.exceptions.ConnectionError:
                self.log_error(
                    f"Failed to connect to Podcastfy service at {self.api_url}. Is the service running?",
                    "CONNECTION_ERROR"
                )
                return False
            except requests.exceptions.Timeout:
                self.log_error(
                    "Request to Podcastfy service timed out",
                    "TIMEOUT_ERROR"
                )
                return False
            except requests.exceptions.HTTPError as e:
                self.log_error(
                    f"HTTP error from Podcastfy service: {e.response.status_code} - {e.response.text}",
                    "HTTP_ERROR"
                )
                return False
            
            self.log_progress("progress", {"step": "processing", "percent": 25})
            
            # Process streaming response if available
            if response.headers.get('content-type', '').startswith('application/x-ndjson'):
                return self._handle_streaming_response(response)
            else:
                return self._handle_json_response(response)
                
        except Exception as e:
            self.log_error(f"Unexpected error during podcast generation: {str(e)}", "UNEXPECTED_ERROR")
            return False
    
    def _handle_streaming_response(self, response: requests.Response) -> bool:
        """Handle streaming NDJSON response from Podcastfy service"""
        try:
            for line in response.iter_lines(decode_unicode=True):
                if line:
                    try:
                        update = json.loads(line)
                        
                        # Forward progress updates
                        if update.get("type") == "progress":
                            self.log_progress("progress", {
                                "step": update.get("step", "processing"),
                                "percent": min(update.get("percent", 50), 95)  # Cap at 95% until complete
                            })
                        
                        # Handle completion
                        elif update.get("type") == "complete":
                            self.log_progress("progress", {"step": "finalizing", "percent": 95})
                            return self._handle_completion(update)
                        
                        # Handle errors
                        elif update.get("type") == "error":
                            self.log_error(
                                update.get("message", "Unknown error from Podcastfy service"),
                                update.get("code", "PODCASTFY_ERROR")
                            )
                            return False
                            
                    except json.JSONDecodeError:
                        # Skip malformed lines
                        continue
            
            # If we get here without completion, it's an error
            self.log_error("Streaming response ended without completion", "INCOMPLETE_RESPONSE")
            return False
            
        except Exception as e:
            self.log_error(f"Error processing streaming response: {str(e)}", "STREAMING_ERROR")
            return False
    
    def _handle_json_response(self, response: requests.Response) -> bool:
        """Handle standard JSON response from Podcastfy service"""
        try:
            result = response.json()
            
            # Simulate progress for non-streaming response
            self.log_progress("progress", {"step": "processing", "percent": 50})
            time.sleep(0.1)  # Brief pause for UX
            self.log_progress("progress", {"step": "generating", "percent": 75})
            time.sleep(0.1)
            self.log_progress("progress", {"step": "finalizing", "percent": 95})
            
            return self._handle_completion(result)
            
        except json.JSONDecodeError:
            self.log_error("Invalid JSON response from Podcastfy service", "INVALID_RESPONSE")
            return False
        except Exception as e:
            self.log_error(f"Error processing JSON response: {str(e)}", "RESPONSE_ERROR")
            return False
    
    def _handle_completion(self, result: Dict[str, Any]) -> bool:
        """Handle successful completion and output final result"""
        try:
            # Extract file path and metadata
            file_path = result.get("file_path") or result.get("audio_file") or result.get("output")
            
            if not file_path:
                self.log_error("No file path in completion response", "MISSING_FILE_PATH")
                return False
            
            # Extract metadata
            metadata = result.get("metadata", {})
            
            # Ensure required metadata fields
            if not metadata.get("duration"):
                metadata["duration"] = result.get("duration", 0)
            
            if not metadata.get("format"):
                metadata["format"] = "m4a"
            
            # Output completion message
            self.log_progress("complete", {
                "file_path": file_path,
                "metadata": metadata,
                "percent": 100
            })
            
            return True
            
        except Exception as e:
            self.log_error(f"Error handling completion: {str(e)}", "COMPLETION_ERROR")
            return False


def main():
    parser = argparse.ArgumentParser(description="Podcastfy wrapper script")
    parser.add_argument("--config", type=str, required=True, help="JSON configuration file path")
    parser.add_argument("--url", type=str, default=None, help="Podcastfy service URL override")
    
    args = parser.parse_args()
    
    # Read configuration from file
    try:
        with open(args.config, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        print(json.dumps({
            "type": "error",
            "error": f"Configuration file not found: {args.config}",
            "code": "CONFIG_NOT_FOUND"
        }), flush=True)
        sys.exit(1)
    except json.JSONDecodeError:
        print(json.dumps({
            "type": "error",
            "error": f"Invalid JSON in configuration file: {args.config}",
            "code": "INVALID_CONFIG"
        }), flush=True)
        sys.exit(1)
    
    # Extract conversation data and generation parameters
    conversation_data = config.get("conversation", {})
    generation_params = config.get("params", {})
    
    if not conversation_data:
        print(json.dumps({
            "type": "error",
            "error": "No conversation data in configuration",
            "code": "MISSING_CONVERSATION"
        }), flush=True)
        sys.exit(1)
    
    # Determine service URL
    service_url = (
        args.url or 
        os.getenv("PODCASTFY_URL") or 
        generation_params.get("service_url") or
        "http://localhost:8123"
    )
    
    # Initialize wrapper and generate podcast
    wrapper = PodcastfyWrapper(service_url)
    success = wrapper.generate_podcast(conversation_data, generation_params)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()