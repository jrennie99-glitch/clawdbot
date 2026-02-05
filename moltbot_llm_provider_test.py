#!/usr/bin/env python3
"""
MoltBot LLM Provider Reliability Test Suite
Tests the new LLM provider reliability features including defaults, configuration, and provider endpoints.
"""

import sys
import json
import subprocess
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

class MoltBotLLMProviderTestSuite:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = {}
        self.app_dir = "/app"
        
    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def run_node_command(self, command: str) -> Dict[str, Any]:
        """Run a Node.js command and return results"""
        try:
            result = subprocess.run(
                ["node", "-e", command], 
                capture_output=True, 
                text=True, 
                cwd=self.app_dir
            )
            
            if result.returncode == 0:
                return {"success": True, "output": result.stdout.strip()}
            else:
                return {"success": False, "error": result.stderr.strip(), "output": result.stdout.strip()}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_defaults_exports(self):
        """Test that defaults.ts exports the required constants"""
        self.log("Testing defaults.ts exports...")
        self.tests_run += 1
        
        test_code = """
        try {
            const defaults = require('./dist/agents/defaults.js');
            
            const requiredExports = [
                'DEFAULT_LLM_TIMEOUT_MS',
                'DEFAULT_LLM_STREAMING', 
                'DEFAULT_PROVIDER'
            ];
            
            const missing = [];
            const values = {};
            
            for (const exportName of requiredExports) {
                if (defaults[exportName] === undefined) {
                    missing.push(exportName);
                } else {
                    values[exportName] = defaults[exportName];
                }
            }
            
            if (missing.length > 0) {
                console.log(JSON.stringify({
                    success: false,
                    error: `Missing exports: ${missing.join(', ')}`
                }));
            } else {
                console.log(JSON.stringify({
                    success: true,
                    exports: values
                }));
            }
        } catch (error) {
            console.log(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        """
        
        try:
            result = self.run_node_command(test_code)
            
            if result.get("success"):
                output_data = json.loads(result["output"])
                if output_data.get("success"):
                    self.tests_passed += 1
                    self.log("✅ defaults.ts exports - PASSED")
                    self.test_results["defaults_exports"] = {
                        "status": "PASSED",
                        "exports": output_data.get("exports", {}),
                        "details": "All required exports found"
                    }
                    return True
                else:
                    self.failed_tests.append("defaults.ts exports")
                    self.log(f"❌ defaults.ts exports - FAILED: {output_data.get('error')}")
                    self.test_results["defaults_exports"] = {
                        "status": "FAILED",
                        "error": output_data.get("error")
                    }
                    return False
            else:
                self.failed_tests.append("defaults.ts exports")
                self.log(f"❌ defaults.ts exports - FAILED: {result.get('error')}")
                self.test_results["defaults_exports"] = {
                    "status": "FAILED",
                    "error": result.get("error")
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("defaults.ts exports")
            self.log(f"❌ defaults.ts exports - ERROR: {str(e)}")
            self.test_results["defaults_exports"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_llm_config_exports(self):
        """Test that llm-config.ts exports the required functions"""
        self.log("Testing llm-config.ts exports...")
        self.tests_run += 1
        
        test_code = """
        try {
            const llmConfig = require('./src/agents/llm-config.js');
            
            const requiredExports = [
                'getLLMConfig',
                'isProviderConfigured',
                'formatProviderError'
            ];
            
            const missing = [];
            const types = {};
            
            for (const exportName of requiredExports) {
                if (llmConfig[exportName] === undefined) {
                    missing.push(exportName);
                } else {
                    types[exportName] = typeof llmConfig[exportName];
                }
            }
            
            if (missing.length > 0) {
                console.log(JSON.stringify({
                    success: false,
                    error: `Missing exports: ${missing.join(', ')}`
                }));
            } else {
                // Test function calls
                const config = llmConfig.getLLMConfig();
                const isConfigured = llmConfig.isProviderConfigured('groq');
                const errorMsg = llmConfig.formatProviderError({
                    provider: 'test',
                    status: 401,
                    message: 'Test error'
                });
                
                console.log(JSON.stringify({
                    success: true,
                    exports: types,
                    testResults: {
                        getLLMConfig: typeof config === 'object' && config.hasOwnProperty('providers'),
                        isProviderConfigured: typeof isConfigured === 'boolean',
                        formatProviderError: typeof errorMsg === 'string' && errorMsg.includes('Test')
                    }
                }));
            }
        } catch (error) {
            console.log(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        """
        
        try:
            result = self.run_node_command(test_code)
            
            if result.get("success"):
                output_data = json.loads(result["output"])
                if output_data.get("success"):
                    self.tests_passed += 1
                    self.log("✅ llm-config.ts exports - PASSED")
                    self.test_results["llm_config_exports"] = {
                        "status": "PASSED",
                        "exports": output_data.get("exports", {}),
                        "testResults": output_data.get("testResults", {}),
                        "details": "All required functions exported and working"
                    }
                    return True
                else:
                    self.failed_tests.append("llm-config.ts exports")
                    self.log(f"❌ llm-config.ts exports - FAILED: {output_data.get('error')}")
                    self.test_results["llm_config_exports"] = {
                        "status": "FAILED",
                        "error": output_data.get("error")
                    }
                    return False
            else:
                self.failed_tests.append("llm-config.ts exports")
                self.log(f"❌ llm-config.ts exports - FAILED: {result.get('error')}")
                self.test_results["llm_config_exports"] = {
                    "status": "FAILED",
                    "error": result.get("error")
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("llm-config.ts exports")
            self.log(f"❌ llm-config.ts exports - ERROR: {str(e)}")
            self.test_results["llm_config_exports"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_providers_handlers(self):
        """Test that providers.ts exports providersHandlers with required methods"""
        self.log("Testing providers.ts handlers...")
        self.tests_run += 1
        
        test_code = """
        try {
            const providers = require('./src/gateway/server-methods/providers.js');
            
            if (!providers.providersHandlers) {
                console.log(JSON.stringify({
                    success: false,
                    error: 'providersHandlers not exported'
                }));
            } else {
                const handlers = providers.providersHandlers;
                const requiredMethods = ['providers.status', 'providers.test'];
                const missing = [];
                
                for (const method of requiredMethods) {
                    if (typeof handlers[method] !== 'function') {
                        missing.push(method);
                    }
                }
                
                if (missing.length > 0) {
                    console.log(JSON.stringify({
                        success: false,
                        error: `Missing handler methods: ${missing.join(', ')}`
                    }));
                } else {
                    console.log(JSON.stringify({
                        success: true,
                        methods: Object.keys(handlers),
                        details: 'All required handler methods found'
                    }));
                }
            }
        } catch (error) {
            console.log(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        """
        
        try:
            result = self.run_node_command(test_code)
            
            if result.get("success"):
                output_data = json.loads(result["output"])
                if output_data.get("success"):
                    self.tests_passed += 1
                    self.log("✅ providers.ts handlers - PASSED")
                    self.test_results["providers_handlers"] = {
                        "status": "PASSED",
                        "methods": output_data.get("methods", []),
                        "details": output_data.get("details")
                    }
                    return True
                else:
                    self.failed_tests.append("providers.ts handlers")
                    self.log(f"❌ providers.ts handlers - FAILED: {output_data.get('error')}")
                    self.test_results["providers_handlers"] = {
                        "status": "FAILED",
                        "error": output_data.get("error")
                    }
                    return False
            else:
                self.failed_tests.append("providers.ts handlers")
                self.log(f"❌ providers.ts handlers - FAILED: {result.get('error')}")
                self.test_results["providers_handlers"] = {
                    "status": "FAILED",
                    "error": result.get("error")
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("providers.ts handlers")
            self.log(f"❌ providers.ts handlers - ERROR: {str(e)}")
            self.test_results["providers_handlers"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_server_methods_integration(self):
        """Test that server-methods.ts includes providersHandlers"""
        self.log("Testing server-methods.ts integration...")
        self.tests_run += 1
        
        test_code = """
        try {
            const serverMethods = require('./src/gateway/server-methods.js');
            
            if (!serverMethods.coreGatewayHandlers) {
                console.log(JSON.stringify({
                    success: false,
                    error: 'coreGatewayHandlers not exported'
                }));
            } else {
                const handlers = serverMethods.coreGatewayHandlers;
                const requiredMethods = ['providers.status', 'providers.test'];
                const missing = [];
                
                for (const method of requiredMethods) {
                    if (typeof handlers[method] !== 'function') {
                        missing.push(method);
                    }
                }
                
                if (missing.length > 0) {
                    console.log(JSON.stringify({
                        success: false,
                        error: `Missing methods in coreGatewayHandlers: ${missing.join(', ')}`
                    }));
                } else {
                    console.log(JSON.stringify({
                        success: true,
                        details: 'Provider methods integrated into coreGatewayHandlers'
                    }));
                }
            }
        } catch (error) {
            console.log(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        """
        
        try:
            result = self.run_node_command(test_code)
            
            if result.get("success"):
                output_data = json.loads(result["output"])
                if output_data.get("success"):
                    self.tests_passed += 1
                    self.log("✅ server-methods.ts integration - PASSED")
                    self.test_results["server_methods_integration"] = {
                        "status": "PASSED",
                        "details": output_data.get("details")
                    }
                    return True
                else:
                    self.failed_tests.append("server-methods.ts integration")
                    self.log(f"❌ server-methods.ts integration - FAILED: {output_data.get('error')}")
                    self.test_results["server_methods_integration"] = {
                        "status": "FAILED",
                        "error": output_data.get("error")
                    }
                    return False
            else:
                self.failed_tests.append("server-methods.ts integration")
                self.log(f"❌ server-methods.ts integration - FAILED: {result.get('error')}")
                self.test_results["server_methods_integration"] = {
                    "status": "FAILED",
                    "error": result.get("error")
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("server-methods.ts integration")
            self.log(f"❌ server-methods.ts integration - ERROR: {str(e)}")
            self.test_results["server_methods_integration"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_server_methods_list(self):
        """Test that server-methods-list.ts includes provider methods in BASE_METHODS"""
        self.log("Testing server-methods-list.ts...")
        self.tests_run += 1
        
        test_code = """
        try {
            const fs = require('fs');
            const content = fs.readFileSync('./src/gateway/server-methods-list.ts', 'utf8');
            
            const requiredMethods = ['providers.status', 'providers.test'];
            const missing = [];
            
            for (const method of requiredMethods) {
                if (!content.includes(`"${method}"`)) {
                    missing.push(method);
                }
            }
            
            if (missing.length > 0) {
                console.log(JSON.stringify({
                    success: false,
                    error: `Missing methods in BASE_METHODS: ${missing.join(', ')}`
                }));
            } else {
                console.log(JSON.stringify({
                    success: true,
                    details: 'Provider methods found in BASE_METHODS'
                }));
            }
        } catch (error) {
            console.log(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        """
        
        try:
            result = self.run_node_command(test_code)
            
            if result.get("success"):
                output_data = json.loads(result["output"])
                if output_data.get("success"):
                    self.tests_passed += 1
                    self.log("✅ server-methods-list.ts - PASSED")
                    self.test_results["server_methods_list"] = {
                        "status": "PASSED",
                        "details": output_data.get("details")
                    }
                    return True
                else:
                    self.failed_tests.append("server-methods-list.ts")
                    self.log(f"❌ server-methods-list.ts - FAILED: {output_data.get('error')}")
                    self.test_results["server_methods_list"] = {
                        "status": "FAILED",
                        "error": output_data.get("error")
                    }
                    return False
            else:
                self.failed_tests.append("server-methods-list.ts")
                self.log(f"❌ server-methods-list.ts - FAILED: {result.get('error')}")
                self.test_results["server_methods_list"] = {
                    "status": "FAILED",
                    "error": result.get("error")
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("server-methods-list.ts")
            self.log(f"❌ server-methods-list.ts - ERROR: {str(e)}")
            self.test_results["server_methods_list"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_timeout_imports(self):
        """Test that timeout.ts imports DEFAULT_LLM_TIMEOUT_MS from defaults"""
        self.log("Testing timeout.ts imports...")
        self.tests_run += 1
        
        test_code = """
        try {
            const fs = require('fs');
            const content = fs.readFileSync('./src/agents/timeout.ts', 'utf8');
            
            const hasImport = content.includes('DEFAULT_LLM_TIMEOUT_MS') && 
                             content.includes('from "./defaults.js"');
            
            if (!hasImport) {
                console.log(JSON.stringify({
                    success: false,
                    error: 'DEFAULT_LLM_TIMEOUT_MS import from defaults.js not found'
                }));
            } else {
                // Test that the import actually works
                const timeout = require('./src/agents/timeout.js');
                console.log(JSON.stringify({
                    success: true,
                    details: 'DEFAULT_LLM_TIMEOUT_MS imported and timeout module loads correctly'
                }));
            }
        } catch (error) {
            console.log(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        """
        
        try:
            result = self.run_node_command(test_code)
            
            if result.get("success"):
                output_data = json.loads(result["output"])
                if output_data.get("success"):
                    self.tests_passed += 1
                    self.log("✅ timeout.ts imports - PASSED")
                    self.test_results["timeout_imports"] = {
                        "status": "PASSED",
                        "details": output_data.get("details")
                    }
                    return True
                else:
                    self.failed_tests.append("timeout.ts imports")
                    self.log(f"❌ timeout.ts imports - FAILED: {output_data.get('error')}")
                    self.test_results["timeout_imports"] = {
                        "status": "FAILED",
                        "error": output_data.get("error")
                    }
                    return False
            else:
                self.failed_tests.append("timeout.ts imports")
                self.log(f"❌ timeout.ts imports - FAILED: {result.get('error')}")
                self.test_results["timeout_imports"] = {
                    "status": "FAILED",
                    "error": result.get("error")
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("timeout.ts imports")
            self.log(f"❌ timeout.ts imports - ERROR: {str(e)}")
            self.test_results["timeout_imports"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_moltbot_json_validity(self):
        """Test that docker/moltbot.json is valid JSON with provider configs"""
        self.log("Testing docker/moltbot.json validity...")
        self.tests_run += 1
        
        try:
            with open(os.path.join(self.app_dir, "docker/moltbot.json"), "r") as f:
                config = json.load(f)
            
            # Check for required provider configurations
            required_providers = ["groq", "openrouter", "ollama"]
            missing_providers = []
            
            providers = config.get("models", {}).get("providers", {})
            
            for provider in required_providers:
                if provider not in providers:
                    missing_providers.append(provider)
            
            if missing_providers:
                self.failed_tests.append("docker/moltbot.json validity")
                self.log(f"❌ docker/moltbot.json validity - FAILED: Missing providers: {', '.join(missing_providers)}")
                self.test_results["moltbot_json_validity"] = {
                    "status": "FAILED",
                    "error": f"Missing providers: {', '.join(missing_providers)}"
                }
                return False
            else:
                self.tests_passed += 1
                self.log("✅ docker/moltbot.json validity - PASSED")
                self.test_results["moltbot_json_validity"] = {
                    "status": "PASSED",
                    "providers": list(providers.keys()),
                    "details": "Valid JSON with all required provider configurations"
                }
                return True
                
        except json.JSONDecodeError as e:
            self.failed_tests.append("docker/moltbot.json validity")
            self.log(f"❌ docker/moltbot.json validity - FAILED: Invalid JSON: {str(e)}")
            self.test_results["moltbot_json_validity"] = {
                "status": "FAILED",
                "error": f"Invalid JSON: {str(e)}"
            }
            return False
        except Exception as e:
            self.failed_tests.append("docker/moltbot.json validity")
            self.log(f"❌ docker/moltbot.json validity - ERROR: {str(e)}")
            self.test_results["moltbot_json_validity"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_deploy_coolify_docs(self):
        """Test that docs/DEPLOY_COOLIFY.md exists and documents env vars"""
        self.log("Testing docs/DEPLOY_COOLIFY.md...")
        self.tests_run += 1
        
        try:
            doc_path = os.path.join(self.app_dir, "docs/DEPLOY_COOLIFY.md")
            
            if not os.path.exists(doc_path):
                self.failed_tests.append("docs/DEPLOY_COOLIFY.md")
                self.log("❌ docs/DEPLOY_COOLIFY.md - FAILED: File does not exist")
                self.test_results["deploy_coolify_docs"] = {
                    "status": "FAILED",
                    "error": "File does not exist"
                }
                return False
            
            with open(doc_path, "r") as f:
                content = f.read()
            
            # Check for required environment variables documentation
            required_env_vars = [
                "DEFAULT_LLM_PROVIDER",
                "LLM_STREAMING", 
                "LLM_REQUEST_TIMEOUT_MS",
                "GROQ_API_KEY",
                "OPENROUTER_API_KEY",
                "OLLAMA_BASE_URL"
            ]
            
            missing_vars = []
            for var in required_env_vars:
                if var not in content:
                    missing_vars.append(var)
            
            if missing_vars:
                self.failed_tests.append("docs/DEPLOY_COOLIFY.md")
                self.log(f"❌ docs/DEPLOY_COOLIFY.md - FAILED: Missing env vars: {', '.join(missing_vars)}")
                self.test_results["deploy_coolify_docs"] = {
                    "status": "FAILED",
                    "error": f"Missing env vars: {', '.join(missing_vars)}"
                }
                return False
            else:
                self.tests_passed += 1
                self.log("✅ docs/DEPLOY_COOLIFY.md - PASSED")
                self.test_results["deploy_coolify_docs"] = {
                    "status": "PASSED",
                    "documented_vars": required_env_vars,
                    "details": "All required environment variables documented"
                }
                return True
                
        except Exception as e:
            self.failed_tests.append("docs/DEPLOY_COOLIFY.md")
            self.log(f"❌ docs/DEPLOY_COOLIFY.md - ERROR: {str(e)}")
            self.test_results["deploy_coolify_docs"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_env_example(self):
        """Test that env.example has all new env vars documented"""
        self.log("Testing env.example...")
        self.tests_run += 1
        
        try:
            env_path = os.path.join(self.app_dir, "env.example")
            
            if not os.path.exists(env_path):
                self.failed_tests.append("env.example")
                self.log("❌ env.example - FAILED: File does not exist")
                self.test_results["env_example"] = {
                    "status": "FAILED",
                    "error": "File does not exist"
                }
                return False
            
            with open(env_path, "r") as f:
                content = f.read()
            
            # Check for required environment variables
            required_env_vars = [
                "DEFAULT_LLM_PROVIDER",
                "DEFAULT_MODEL",
                "LLM_STREAMING",
                "LLM_REQUEST_TIMEOUT_MS", 
                "LLM_MAX_RETRIES",
                "GROQ_API_KEY",
                "OPENROUTER_API_KEY",
                "OLLAMA_BASE_URL",
                "OLLAMA_MODEL"
            ]
            
            missing_vars = []
            for var in required_env_vars:
                if var not in content:
                    missing_vars.append(var)
            
            if missing_vars:
                self.failed_tests.append("env.example")
                self.log(f"❌ env.example - FAILED: Missing env vars: {', '.join(missing_vars)}")
                self.test_results["env_example"] = {
                    "status": "FAILED",
                    "error": f"Missing env vars: {', '.join(missing_vars)}"
                }
                return False
            else:
                self.tests_passed += 1
                self.log("✅ env.example - PASSED")
                self.test_results["env_example"] = {
                    "status": "PASSED",
                    "documented_vars": required_env_vars,
                    "details": "All required environment variables documented"
                }
                return True
                
        except Exception as e:
            self.failed_tests.append("env.example")
            self.log(f"❌ env.example - ERROR: {str(e)}")
            self.test_results["env_example"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def run_all_tests(self):
        """Run all MoltBot LLM provider tests"""
        self.log("🚀 Starting MoltBot LLM Provider Reliability Test Suite")
        self.log("=" * 70)
        
        # Test all components
        self.test_defaults_exports()
        self.test_llm_config_exports()
        self.test_providers_handlers()
        self.test_server_methods_integration()
        self.test_server_methods_list()
        self.test_timeout_imports()
        self.test_moltbot_json_validity()
        self.test_deploy_coolify_docs()
        self.test_env_example()
        
        # Print summary
        self.print_summary()
        
        return self.tests_passed == self.tests_run
    
    def print_summary(self):
        """Print test summary"""
        self.log("=" * 70)
        self.log("🔧 MOLTBOT LLM PROVIDER TEST SUMMARY")
        self.log("=" * 70)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        self.log(f"Tests Run: {self.tests_run}")
        self.log(f"Tests Passed: {self.tests_passed}")
        self.log(f"Tests Failed: {len(self.failed_tests)}")
        self.log(f"Success Rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            self.log("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                self.log(f"  - {test}")
        
        if success_rate == 100:
            self.log("\n🎉 ALL MOLTBOT LLM PROVIDER TESTS PASSED! 🎉")
        else:
            self.log(f"\n⚠️  {len(self.failed_tests)} tests failed. Review and fix issues.")
        
        # Save detailed results
        self.save_test_results()
    
    def save_test_results(self):
        """Save detailed test results to file"""
        try:
            results = {
                "timestamp": datetime.now().isoformat(),
                "test_suite": "MoltBot LLM Provider Reliability",
                "summary": {
                    "tests_run": self.tests_run,
                    "tests_passed": self.tests_passed,
                    "tests_failed": len(self.failed_tests),
                    "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
                },
                "failed_tests": self.failed_tests,
                "detailed_results": self.test_results
            }
            
            with open("/app/moltbot_llm_provider_test_results.json", "w") as f:
                json.dump(results, f, indent=2)
                
            self.log("📄 Detailed test results saved to /app/moltbot_llm_provider_test_results.json")
            
        except Exception as e:
            self.log(f"⚠️  Could not save test results: {str(e)}")

def main():
    """Main test runner"""
    suite = MoltBotLLMProviderTestSuite()
    success = suite.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())