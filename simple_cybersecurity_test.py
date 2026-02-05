#!/usr/bin/env python3
"""
Simple Cybersecurity Defense System Test Suite
Tests the basic structure and existence of security modules.
"""

import sys
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

class SimpleCybersecurityTest:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = {}
        
    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
    
    def test_file_exists(self, file_path: str, test_name: str) -> bool:
        """Test if a file exists"""
        self.tests_run += 1
        
        if os.path.exists(file_path):
            self.tests_passed += 1
            self.log(f"✅ {test_name} - PASSED")
            self.test_results[test_name.lower().replace(" ", "_")] = {
                "status": "PASSED",
                "details": f"File exists at {file_path}"
            }
            return True
        else:
            self.failed_tests.append(test_name)
            self.log(f"❌ {test_name} - FAILED: File not found at {file_path}")
            self.test_results[test_name.lower().replace(" ", "_")] = {
                "status": "FAILED",
                "error": f"File not found at {file_path}"
            }
            return False
    
    def test_file_contains(self, file_path: str, search_terms: List[str], test_name: str) -> bool:
        """Test if a file contains specific terms"""
        self.tests_run += 1
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            missing_terms = [term for term in search_terms if term not in content]
            
            if not missing_terms:
                self.tests_passed += 1
                self.log(f"✅ {test_name} - PASSED")
                self.test_results[test_name.lower().replace(" ", "_")] = {
                    "status": "PASSED",
                    "details": f"All {len(search_terms)} terms found"
                }
                return True
            else:
                self.failed_tests.append(test_name)
                self.log(f"❌ {test_name} - FAILED: Missing terms: {missing_terms}")
                self.test_results[test_name.lower().replace(" ", "_")] = {
                    "status": "FAILED",
                    "error": f"Missing terms: {missing_terms}"
                }
                return False
                
        except Exception as e:
            self.failed_tests.append(test_name)
            self.log(f"❌ {test_name} - ERROR: {str(e)}")
            self.test_results[test_name.lower().replace(" ", "_")] = {
                "status": "ERROR",
                "error": str(e)
            }
            return False
    
    def run_all_tests(self):
        """Run all cybersecurity defense tests"""
        self.log("🛡️  Starting Simple Cybersecurity Defense System Test Suite")
        self.log("=" * 60)
        
        # Test source files exist
        self.test_file_exists("/app/src/security/firewall.ts", "Firewall source file exists")
        self.test_file_exists("/app/src/security/gateway-protection.ts", "Gateway protection source file exists")
        self.test_file_exists("/app/src/security/lockdown-mode.ts", "Lockdown mode source file exists")
        self.test_file_exists("/app/src/security/integration/dashboard-handlers.ts", "Dashboard handlers source file exists")
        
        # Test compiled files exist
        self.test_file_exists("/app/dist/security/firewall.js", "Firewall compiled file exists")
        self.test_file_exists("/app/dist/security/gateway-protection.js", "Gateway protection compiled file exists")
        self.test_file_exists("/app/dist/security/lockdown-mode.js", "Lockdown mode compiled file exists")
        self.test_file_exists("/app/dist/security/integration/dashboard-handlers.js", "Dashboard handlers compiled file exists")
        
        # Test firewall exports
        self.test_file_contains(
            "/app/src/security/firewall.ts",
            ["FIREWALL_CONFIG", "isIpBlocked", "blockIp", "unblockIp", "getBlockedIps", 
             "recordFailedAuth", "checkApiRateLimit", "checkLoginRateLimit", "trackWsConnection",
             "releaseWsConnection", "validateHeaders", "validatePayloadSize", "validateUrlLength",
             "detectAttackPatterns", "logSecurityIncident", "getSecurityLog", "getSecurityStats"],
            "Firewall exports all required functions"
        )
        
        # Test gateway protection exports
        self.test_file_contains(
            "/app/src/security/gateway-protection.ts",
            ["GATEWAY_SECURITY_CONFIG", "trackGatewayConnection", "removeGatewayConnection",
             "authenticateGateway", "getActiveConnections", "getGatewayStats"],
            "Gateway protection exports all required functions"
        )
        
        # Test lockdown mode exports
        self.test_file_contains(
            "/app/src/security/lockdown-mode.ts",
            ["LOCKDOWN_CONFIG", "getLockdownState", "isLockdownActive", "activateLockdown",
             "deactivateLockdown", "isAdminUser", "checkLockdownAccess"],
            "Lockdown mode exports all required functions"
        )
        
        # Test dashboard handlers exports
        self.test_file_contains(
            "/app/src/security/integration/dashboard-handlers.ts",
            ["securityDashboardHandlers", "security.dashboard", "security.blocked.list",
             "security.blocked.add", "security.blocked.remove", "security.incidents.list",
             "security.gateway.connections", "security.lockdown.toggle", "security.lockdown.status"],
            "Dashboard handlers exports all required handlers"
        )
        
        # Test server methods integration
        self.test_file_contains(
            "/app/src/gateway/server-methods.ts",
            ["securityDashboardHandlers", "...securityDashboardHandlers"],
            "Server methods imports and includes security handlers"
        )
        
        # Test server methods list integration
        self.test_file_contains(
            "/app/src/gateway/server-methods-list.ts",
            ["security.dashboard", "security.blocked.list", "security.blocked.add",
             "security.blocked.remove", "security.incidents.list", "security.gateway.connections",
             "security.lockdown.toggle", "security.lockdown.status"],
            "Server methods list includes all security methods"
        )
        
        # Test environment variables
        self.test_file_contains(
            "/app/env.example",
            ["SECURITY_FIREWALL", "RATE_LIMIT_API_PER_MINUTE", "GATEWAY_PASSWORD",
             "SECURITY_LOCKDOWN", "SECURITY_ADMIN_EMAIL", "KILL_SWITCH"],
            "Env.example contains security variables"
        )
        
        # Test documentation
        self.test_file_contains(
            "/app/docs/DEPLOY_COOLIFY.md",
            ["Security Configuration", "Gateway Protection", "Lockdown Mode", "Kill Switch"],
            "DEPLOY_COOLIFY.md contains security documentation"
        )
        
        # Test changelog
        self.test_file_contains(
            "/app/CHANGELOG.md",
            ["2026.1.28-fix.2", "Cybersecurity Defense System", "Request Firewall", "Rate Limiting"],
            "CHANGELOG.md contains security entry"
        )
        
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
            
            with open("/app/simple_cybersecurity_test_results.json", "w") as f:
                json.dump(results, f, indent=2)
                
            self.log("📄 Detailed test results saved to /app/simple_cybersecurity_test_results.json")
            
        except Exception as e:
            self.log(f"⚠️  Could not save test results: {str(e)}")

def main():
    """Main test runner"""
    suite = SimpleCybersecurityTest()
    success = suite.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())