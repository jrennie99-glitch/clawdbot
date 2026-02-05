#!/usr/bin/env python3
"""
Cybersecurity Defense System Test Suite
Tests the new security modules: firewall, gateway protection, lockdown mode, and dashboard handlers.
"""

import sys
import json
import subprocess
import time
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

class CybersecurityDefenseTestSuite:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = {}
        
    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def run_node_test(self, test_code: str) -> Dict[str, Any]:
        """Run Node.js test code and return results"""
        try:
            # Create a temporary test file
            test_file = "/tmp/security_test.mjs"
            with open(test_file, "w") as f:
                f.write(test_code)
            
            # Run the test
            result = subprocess.run(
                ["node", test_file], 
                capture_output=True, 
                text=True, 
                cwd="/app"
            )
            
            if result.returncode == 0:
                try:
                    # Try to parse JSON output
                    return json.loads(result.stdout.strip())
                except json.JSONDecodeError:
                    return {"success": True, "output": result.stdout}
            else:
                return {"success": False, "error": result.stderr, "output": result.stdout}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            # Clean up temp file
            if os.path.exists(test_file):
                os.remove(test_file)
    
    def test_firewall_module_exports(self):
        """Test firewall.ts module exports all required functions"""
        self.log("Testing firewall module exports...")
        self.tests_run += 1
        
        test_code = '''
import { 
    FIREWALL_CONFIG, 
    isIpBlocked, 
    blockIp, 
    unblockIp, 
    getBlockedIps, 
    recordFailedAuth, 
    checkApiRateLimit, 
    checkLoginRateLimit, 
    trackWsConnection, 
    releaseWsConnection, 
    validateHeaders, 
    validatePayloadSize, 
    validateUrlLength, 
    detectAttackPatterns, 
    logSecurityIncident, 
    getSecurityLog, 
    getSecurityStats 
} from './dist/security/firewall.js';

const result = {
    success: true,
    exports: {
        FIREWALL_CONFIG: typeof FIREWALL_CONFIG,
        isIpBlocked: typeof isIpBlocked,
        blockIp: typeof blockIp,
        unblockIp: typeof unblockIp,
        getBlockedIps: typeof getBlockedIps,
        recordFailedAuth: typeof recordFailedAuth,
        checkApiRateLimit: typeof checkApiRateLimit,
        checkLoginRateLimit: typeof checkLoginRateLimit,
        trackWsConnection: typeof trackWsConnection,
        releaseWsConnection: typeof releaseWsConnection,
        validateHeaders: typeof validateHeaders,
        validatePayloadSize: typeof validatePayloadSize,
        validateUrlLength: typeof validateUrlLength,
        detectAttackPatterns: typeof detectAttackPatterns,
        logSecurityIncident: typeof logSecurityIncident,
        getSecurityLog: typeof getSecurityLog,
        getSecurityStats: typeof getSecurityStats
    }
};

console.log(JSON.stringify(result));
'''
        
        try:
            result = self.run_node_test(test_code)
            
            if result.get("success"):
                exports = result.get("exports", {})
                expected_functions = [
                    "isIpBlocked", "blockIp", "unblockIp", "getBlockedIps", 
                    "recordFailedAuth", "checkApiRateLimit", "checkLoginRateLimit",
                    "trackWsConnection", "releaseWsConnection", "validateHeaders",
                    "validatePayloadSize", "validateUrlLength", "detectAttackPatterns",
                    "logSecurityIncident", "getSecurityLog", "getSecurityStats"
                ]
                
                missing_functions = [f for f in expected_functions if exports.get(f) != "function"]
                
                if not missing_functions and exports.get("FIREWALL_CONFIG") == "object":
                    self.tests_passed += 1
                    self.log("✅ Firewall module exports - PASSED")
                    self.test_results["firewall_exports"] = {
                        "status": "PASSED",
                        "details": "All required functions and config exported correctly"
                    }
                    return True
                else:
                    self.failed_tests.append("Firewall module exports")
                    self.log(f"❌ Firewall module exports - FAILED: Missing functions: {missing_functions}")
                    self.test_results["firewall_exports"] = {
                        "status": "FAILED",
                        "error": f"Missing functions: {missing_functions}"
                    }
                    return False
            else:
                self.failed_tests.append("Firewall module exports")
                self.log(f"❌ Firewall module exports - FAILED: {result.get('error', 'Unknown error')}")
                self.test_results["firewall_exports"] = {
                    "status": "FAILED",
                    "error": result.get('error', 'Unknown error')
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("Firewall module exports")
            self.log(f"❌ Firewall module exports - ERROR: {str(e)}")
            self.test_results["firewall_exports"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_gateway_protection_module_exports(self):
        """Test gateway-protection.ts module exports all required functions"""
        self.log("Testing gateway protection module exports...")
        self.tests_run += 1
        
        test_code = '''
import { 
    GATEWAY_SECURITY_CONFIG,
    trackGatewayConnection,
    removeGatewayConnection,
    authenticateGateway,
    getActiveConnections,
    getGatewayStats
} from './dist/security/gateway-protection.js';

const result = {
    success: true,
    exports: {
        GATEWAY_SECURITY_CONFIG: typeof GATEWAY_SECURITY_CONFIG,
        trackGatewayConnection: typeof trackGatewayConnection,
        removeGatewayConnection: typeof removeGatewayConnection,
        authenticateGateway: typeof authenticateGateway,
        getActiveConnections: typeof getActiveConnections,
        getGatewayStats: typeof getGatewayStats
    }
};

console.log(JSON.stringify(result));
'''
        
        try:
            result = self.run_node_test(test_code)
            
            if result.get("success"):
                exports = result.get("exports", {})
                expected_functions = [
                    "trackGatewayConnection", "removeGatewayConnection", 
                    "authenticateGateway", "getActiveConnections", "getGatewayStats"
                ]
                
                missing_functions = [f for f in expected_functions if exports.get(f) != "function"]
                
                if not missing_functions and exports.get("GATEWAY_SECURITY_CONFIG") == "object":
                    self.tests_passed += 1
                    self.log("✅ Gateway protection module exports - PASSED")
                    self.test_results["gateway_protection_exports"] = {
                        "status": "PASSED",
                        "details": "All required functions and config exported correctly"
                    }
                    return True
                else:
                    self.failed_tests.append("Gateway protection module exports")
                    self.log(f"❌ Gateway protection module exports - FAILED: Missing functions: {missing_functions}")
                    self.test_results["gateway_protection_exports"] = {
                        "status": "FAILED",
                        "error": f"Missing functions: {missing_functions}"
                    }
                    return False
            else:
                self.failed_tests.append("Gateway protection module exports")
                self.log(f"❌ Gateway protection module exports - FAILED: {result.get('error', 'Unknown error')}")
                self.test_results["gateway_protection_exports"] = {
                    "status": "FAILED",
                    "error": result.get('error', 'Unknown error')
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("Gateway protection module exports")
            self.log(f"❌ Gateway protection module exports - ERROR: {str(e)}")
            self.test_results["gateway_protection_exports"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_lockdown_mode_module_exports(self):
        """Test lockdown-mode.ts module exports all required functions"""
        self.log("Testing lockdown mode module exports...")
        self.tests_run += 1
        
        test_code = '''
import { 
    LOCKDOWN_CONFIG,
    getLockdownState,
    isLockdownActive,
    activateLockdown,
    deactivateLockdown,
    isAdminUser,
    checkLockdownAccess
} from './dist/security/lockdown-mode.js';

const result = {
    success: true,
    exports: {
        LOCKDOWN_CONFIG: typeof LOCKDOWN_CONFIG,
        getLockdownState: typeof getLockdownState,
        isLockdownActive: typeof isLockdownActive,
        activateLockdown: typeof activateLockdown,
        deactivateLockdown: typeof deactivateLockdown,
        isAdminUser: typeof isAdminUser,
        checkLockdownAccess: typeof checkLockdownAccess
    }
};

console.log(JSON.stringify(result));
'''
        
        try:
            result = self.run_node_test(test_code)
            
            if result.get("success"):
                exports = result.get("exports", {})
                expected_functions = [
                    "getLockdownState", "isLockdownActive", "activateLockdown",
                    "deactivateLockdown", "isAdminUser", "checkLockdownAccess"
                ]
                
                missing_functions = [f for f in expected_functions if exports.get(f) != "function"]
                
                if not missing_functions and exports.get("LOCKDOWN_CONFIG") == "object":
                    self.tests_passed += 1
                    self.log("✅ Lockdown mode module exports - PASSED")
                    self.test_results["lockdown_mode_exports"] = {
                        "status": "PASSED",
                        "details": "All required functions and config exported correctly"
                    }
                    return True
                else:
                    self.failed_tests.append("Lockdown mode module exports")
                    self.log(f"❌ Lockdown mode module exports - FAILED: Missing functions: {missing_functions}")
                    self.test_results["lockdown_mode_exports"] = {
                        "status": "FAILED",
                        "error": f"Missing functions: {missing_functions}"
                    }
                    return False
            else:
                self.failed_tests.append("Lockdown mode module exports")
                self.log(f"❌ Lockdown mode module exports - FAILED: {result.get('error', 'Unknown error')}")
                self.test_results["lockdown_mode_exports"] = {
                    "status": "FAILED",
                    "error": result.get('error', 'Unknown error')
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("Lockdown mode module exports")
            self.log(f"❌ Lockdown mode module exports - ERROR: {str(e)}")
            self.test_results["lockdown_mode_exports"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_dashboard_handlers_module_exports(self):
        """Test dashboard-handlers.ts module exports securityDashboardHandlers"""
        self.log("Testing dashboard handlers module exports...")
        self.tests_run += 1
        
        test_code = '''
import { securityDashboardHandlers } from './src/security/integration/dashboard-handlers.js';

const result = {
    success: true,
    exports: {
        securityDashboardHandlers: typeof securityDashboardHandlers
    },
    handlers: Object.keys(securityDashboardHandlers || {})
};

console.log(JSON.stringify(result));
'''
        
        try:
            result = self.run_node_test(test_code)
            
            if result.get("success"):
                exports = result.get("exports", {})
                handlers = result.get("handlers", [])
                
                expected_handlers = [
                    "security.dashboard", "security.blocked.list", "security.blocked.add",
                    "security.blocked.remove", "security.incidents.list", 
                    "security.gateway.connections", "security.lockdown.toggle",
                    "security.lockdown.status"
                ]
                
                missing_handlers = [h for h in expected_handlers if h not in handlers]
                
                if exports.get("securityDashboardHandlers") == "object" and not missing_handlers:
                    self.tests_passed += 1
                    self.log("✅ Dashboard handlers module exports - PASSED")
                    self.test_results["dashboard_handlers_exports"] = {
                        "status": "PASSED",
                        "details": f"All required handlers exported: {handlers}"
                    }
                    return True
                else:
                    self.failed_tests.append("Dashboard handlers module exports")
                    self.log(f"❌ Dashboard handlers module exports - FAILED: Missing handlers: {missing_handlers}")
                    self.test_results["dashboard_handlers_exports"] = {
                        "status": "FAILED",
                        "error": f"Missing handlers: {missing_handlers}"
                    }
                    return False
            else:
                self.failed_tests.append("Dashboard handlers module exports")
                self.log(f"❌ Dashboard handlers module exports - FAILED: {result.get('error', 'Unknown error')}")
                self.test_results["dashboard_handlers_exports"] = {
                    "status": "FAILED",
                    "error": result.get('error', 'Unknown error')
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("Dashboard handlers module exports")
            self.log(f"❌ Dashboard handlers module exports - ERROR: {str(e)}")
            self.test_results["dashboard_handlers_exports"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_server_methods_integration(self):
        """Test server-methods.ts imports and includes securityDashboardHandlers"""
        self.log("Testing server methods integration...")
        self.tests_run += 1
        
        test_code = '''
import fs from 'fs';

const serverMethodsContent = fs.readFileSync('./src/gateway/server-methods.ts', 'utf8');

const result = {
    success: true,
    hasImport: serverMethodsContent.includes('securityDashboardHandlers'),
    hasInclude: serverMethodsContent.includes('...securityDashboardHandlers'),
    importLine: serverMethodsContent.split('\\n').find(line => line.includes('securityDashboardHandlers')) || null
};

console.log(JSON.stringify(result));
'''
        
        try:
            result = self.run_node_test(test_code)
            
            if result.get("success"):
                has_import = result.get("hasImport", False)
                has_include = result.get("hasInclude", False)
                
                if has_import and has_include:
                    self.tests_passed += 1
                    self.log("✅ Server methods integration - PASSED")
                    self.test_results["server_methods_integration"] = {
                        "status": "PASSED",
                        "details": "securityDashboardHandlers properly imported and included"
                    }
                    return True
                else:
                    self.failed_tests.append("Server methods integration")
                    self.log(f"❌ Server methods integration - FAILED: Import: {has_import}, Include: {has_include}")
                    self.test_results["server_methods_integration"] = {
                        "status": "FAILED",
                        "error": f"Import: {has_import}, Include: {has_include}"
                    }
                    return False
            else:
                self.failed_tests.append("Server methods integration")
                self.log(f"❌ Server methods integration - FAILED: {result.get('error', 'Unknown error')}")
                self.test_results["server_methods_integration"] = {
                    "status": "FAILED",
                    "error": result.get('error', 'Unknown error')
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("Server methods integration")
            self.log(f"❌ Server methods integration - ERROR: {str(e)}")
            self.test_results["server_methods_integration"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_server_methods_list_integration(self):
        """Test server-methods-list.ts includes all security methods"""
        self.log("Testing server methods list integration...")
        self.tests_run += 1
        
        test_code = '''
import fs from 'fs';

const serverMethodsListContent = fs.readFileSync('./src/gateway/server-methods-list.ts', 'utf8');

const expectedMethods = [
    'security.dashboard',
    'security.blocked.list',
    'security.blocked.add',
    'security.blocked.remove',
    'security.incidents.list',
    'security.gateway.connections',
    'security.lockdown.toggle',
    'security.lockdown.status'
];

const result = {
    success: true,
    foundMethods: expectedMethods.filter(method => serverMethodsListContent.includes(`"${method}"`)),
    missingMethods: expectedMethods.filter(method => !serverMethodsListContent.includes(`"${method}"`))
};

console.log(JSON.stringify(result));
'''
        
        try:
            result = self.run_node_test(test_code)
            
            if result.get("success"):
                found_methods = result.get("foundMethods", [])
                missing_methods = result.get("missingMethods", [])
                
                if not missing_methods:
                    self.tests_passed += 1
                    self.log("✅ Server methods list integration - PASSED")
                    self.test_results["server_methods_list_integration"] = {
                        "status": "PASSED",
                        "details": f"All security methods found: {found_methods}"
                    }
                    return True
                else:
                    self.failed_tests.append("Server methods list integration")
                    self.log(f"❌ Server methods list integration - FAILED: Missing methods: {missing_methods}")
                    self.test_results["server_methods_list_integration"] = {
                        "status": "FAILED",
                        "error": f"Missing methods: {missing_methods}"
                    }
                    return False
            else:
                self.failed_tests.append("Server methods list integration")
                self.log(f"❌ Server methods list integration - FAILED: {result.get('error', 'Unknown error')}")
                self.test_results["server_methods_list_integration"] = {
                    "status": "FAILED",
                    "error": result.get('error', 'Unknown error')
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("Server methods list integration")
            self.log(f"❌ Server methods list integration - ERROR: {str(e)}")
            self.test_results["server_methods_list_integration"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_env_example_security_vars(self):
        """Test env.example contains all required security environment variables"""
        self.log("Testing env.example security variables...")
        self.tests_run += 1
        
        try:
            with open("/app/env.example", "r") as f:
                env_content = f.read()
            
            expected_vars = [
                "SECURITY_FIREWALL", "SECURITY_STRICT_MODE", "MAX_PAYLOAD_SIZE_BYTES",
                "RATE_LIMIT_API_PER_MINUTE", "RATE_LIMIT_LOGIN_PER_HOUR", "RATE_LIMIT_WS_PER_IP",
                "AUTO_BLOCK_DURATION_MS", "MAX_FAILED_AUTH_ATTEMPTS", "GATEWAY_PASSWORD_REQUIRED",
                "GATEWAY_PASSWORD", "GATEWAY_MAX_CONNECTIONS", "GATEWAY_CONNECTION_TIMEOUT_MS",
                "SECURITY_LOCKDOWN", "SECURITY_ADMIN_EMAIL", "SECURITY_EMERGENCY",
                "SECURITY_ADMIN_ONLY", "SECURITY_CHAT_DISABLED", "SECURITY_TOOLS_DISABLED",
                "SECURITY_GATEWAY_RESTRICTED", "KILL_SWITCH", "KILL_SWITCH_CONFIRM_CODE"
            ]
            
            found_vars = [var for var in expected_vars if var in env_content]
            missing_vars = [var for var in expected_vars if var not in env_content]
            
            if not missing_vars:
                self.tests_passed += 1
                self.log("✅ Env.example security variables - PASSED")
                self.test_results["env_example_security_vars"] = {
                    "status": "PASSED",
                    "details": f"All {len(found_vars)} security variables found"
                }
                return True
            else:
                self.failed_tests.append("Env.example security variables")
                self.log(f"❌ Env.example security variables - FAILED: Missing variables: {missing_vars}")
                self.test_results["env_example_security_vars"] = {
                    "status": "FAILED",
                    "error": f"Missing variables: {missing_vars}"
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("Env.example security variables")
            self.log(f"❌ Env.example security variables - ERROR: {str(e)}")
            self.test_results["env_example_security_vars"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_deploy_coolify_security_docs(self):
        """Test DEPLOY_COOLIFY.md contains Security Configuration section"""
        self.log("Testing DEPLOY_COOLIFY.md security documentation...")
        self.tests_run += 1
        
        try:
            with open("/app/docs/DEPLOY_COOLIFY.md", "r") as f:
                docs_content = f.read()
            
            required_sections = [
                "Security Configuration",
                "Basic Security Setup", 
                "Gateway Protection",
                "Lockdown Mode",
                "Emergency Mode",
                "Kill Switch",
                "Security Dashboard"
            ]
            
            found_sections = [section for section in required_sections if section in docs_content]
            missing_sections = [section for section in required_sections if section not in docs_content]
            
            if not missing_sections:
                self.tests_passed += 1
                self.log("✅ DEPLOY_COOLIFY.md security documentation - PASSED")
                self.test_results["deploy_coolify_security_docs"] = {
                    "status": "PASSED",
                    "details": f"All {len(found_sections)} security sections found"
                }
                return True
            else:
                self.failed_tests.append("DEPLOY_COOLIFY.md security documentation")
                self.log(f"❌ DEPLOY_COOLIFY.md security documentation - FAILED: Missing sections: {missing_sections}")
                self.test_results["deploy_coolify_security_docs"] = {
                    "status": "FAILED",
                    "error": f"Missing sections: {missing_sections}"
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("DEPLOY_COOLIFY.md security documentation")
            self.log(f"❌ DEPLOY_COOLIFY.md security documentation - ERROR: {str(e)}")
            self.test_results["deploy_coolify_security_docs"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_changelog_security_entry(self):
        """Test CHANGELOG.md contains 2026.1.28-fix.2 with Cybersecurity Defense System"""
        self.log("Testing CHANGELOG.md security entry...")
        self.tests_run += 1
        
        try:
            with open("/app/CHANGELOG.md", "r") as f:
                changelog_content = f.read()
            
            required_elements = [
                "2026.1.28-fix.2",
                "Cybersecurity Defense System",
                "Request Firewall (Mini-WAF)",
                "Rate Limiting",
                "Gateway Protection",
                "Lockdown Mode",
                "Security Dashboard"
            ]
            
            found_elements = [element for element in required_elements if element in changelog_content]
            missing_elements = [element for element in required_elements if element not in changelog_content]
            
            if not missing_elements:
                self.tests_passed += 1
                self.log("✅ CHANGELOG.md security entry - PASSED")
                self.test_results["changelog_security_entry"] = {
                    "status": "PASSED",
                    "details": f"All {len(found_elements)} security elements found"
                }
                return True
            else:
                self.failed_tests.append("CHANGELOG.md security entry")
                self.log(f"❌ CHANGELOG.md security entry - FAILED: Missing elements: {missing_elements}")
                self.test_results["changelog_security_entry"] = {
                    "status": "FAILED",
                    "error": f"Missing elements: {missing_elements}"
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("CHANGELOG.md security entry")
            self.log(f"❌ CHANGELOG.md security entry - ERROR: {str(e)}")
            self.test_results["changelog_security_entry"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def test_firewall_functionality(self):
        """Test basic firewall functionality"""
        self.log("Testing firewall functionality...")
        self.tests_run += 1
        
        test_code = '''
import { 
    isIpBlocked, 
    blockIp, 
    unblockIp, 
    detectAttackPatterns,
    validateHeaders,
    validatePayloadSize,
    validateUrlLength
} from './src/security/firewall.js';

// Test IP blocking
const testIp = "192.168.1.100";
blockIp(testIp, "Test block");
const blocked = isIpBlocked(testIp);
unblockIp(testIp);
const unblocked = isIpBlocked(testIp);

// Test attack detection
const sqlInjection = detectAttackPatterns({
    url: "/api/users?id=1' OR '1'='1",
    body: "SELECT * FROM users"
});

const xssAttack = detectAttackPatterns({
    body: "<script>alert('xss')</script>"
});

// Test validation
const headerValidation = validateHeaders({"content-type": "application/json"});
const payloadValidation = validatePayloadSize(1000);
const urlValidation = validateUrlLength("/api/test");

const result = {
    success: true,
    tests: {
        ipBlocking: blocked.blocked === true && unblocked.blocked === false,
        sqlDetection: sqlInjection.detected === true,
        xssDetection: xssAttack.detected === true,
        headerValidation: headerValidation.allowed === true,
        payloadValidation: payloadValidation.allowed === true,
        urlValidation: urlValidation.allowed === true
    }
};

console.log(JSON.stringify(result));
'''
        
        try:
            result = self.run_node_test(test_code)
            
            if result.get("success"):
                tests = result.get("tests", {})
                failed_tests = [test for test, passed in tests.items() if not passed]
                
                if not failed_tests:
                    self.tests_passed += 1
                    self.log("✅ Firewall functionality - PASSED")
                    self.test_results["firewall_functionality"] = {
                        "status": "PASSED",
                        "details": "IP blocking, attack detection, and validation working correctly"
                    }
                    return True
                else:
                    self.failed_tests.append("Firewall functionality")
                    self.log(f"❌ Firewall functionality - FAILED: Failed tests: {failed_tests}")
                    self.test_results["firewall_functionality"] = {
                        "status": "FAILED",
                        "error": f"Failed tests: {failed_tests}"
                    }
                    return False
            else:
                self.failed_tests.append("Firewall functionality")
                self.log(f"❌ Firewall functionality - FAILED: {result.get('error', 'Unknown error')}")
                self.test_results["firewall_functionality"] = {
                    "status": "FAILED",
                    "error": result.get('error', 'Unknown error')
                }
                return False
                
        except Exception as e:
            self.failed_tests.append("Firewall functionality")
            self.log(f"❌ Firewall functionality - ERROR: {str(e)}")
            self.test_results["firewall_functionality"] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def run_all_tests(self):
        """Run all cybersecurity defense tests"""
        self.log("🛡️  Starting Cybersecurity Defense System Test Suite")
        self.log("=" * 60)
        
        # Test module exports
        self.test_firewall_module_exports()
        self.test_gateway_protection_module_exports()
        self.test_lockdown_mode_module_exports()
        self.test_dashboard_handlers_module_exports()
        
        # Test integration
        self.test_server_methods_integration()
        self.test_server_methods_list_integration()
        
        # Test documentation
        self.test_env_example_security_vars()
        self.test_deploy_coolify_security_docs()
        self.test_changelog_security_entry()
        
        # Test functionality
        self.test_firewall_functionality()
        
        # Print summary
        self.print_summary()
        
        return self.tests_passed == self.tests_run
    
    def print_summary(self):
        """Print test summary"""
        self.log("=" * 60)
        self.log("🛡️  CYBERSECURITY DEFENSE TEST SUMMARY")
        self.log("=" * 60)
        
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
            self.log("\n🎉 ALL CYBERSECURITY DEFENSE TESTS PASSED! 🎉")
        else:
            self.log(f"\n⚠️  {len(self.failed_tests)} tests failed. Review and fix issues.")
        
        # Save detailed results
        self.save_test_results()
    
    def save_test_results(self):
        """Save detailed test results to file"""
        try:
            results = {
                "timestamp": datetime.now().isoformat(),
                "summary": {
                    "tests_run": self.tests_run,
                    "tests_passed": self.tests_passed,
                    "tests_failed": len(self.failed_tests),
                    "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
                },
                "failed_tests": self.failed_tests,
                "detailed_results": self.test_results
            }
            
            with open("/app/cybersecurity_defense_test_results.json", "w") as f:
                json.dump(results, f, indent=2)
                
            self.log("📄 Detailed test results saved to /app/cybersecurity_defense_test_results.json")
            
        except Exception as e:
            self.log(f"⚠️  Could not save test results: {str(e)}")

def main():
    """Main test runner"""
    suite = CybersecurityDefenseTestSuite()
    success = suite.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())