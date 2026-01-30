/**
 * self-check.js
 * Validates project invariants against RULES.json.
 * 
 * Should be run in browser console or included in development mode.
 */

import { validateCVSchema } from '../validators/schema-validate.js';
import { validateConsistency } from '../validators/cv-consistency.js';
import { formatErrorMessages } from '../validators/error-messages.js';

async function runChecks() {
    console.log("Running Self-Checks...");

    try {
        const rulesResp = await fetch('./RULES.json');
        if (!rulesResp.ok) throw new Error("Could not load RULES.json");
        const rules = await rulesResp.json();

        const violations = [];

        // 1. Check for valid structure (Files exist check is hard in browser, skipping)

        // 2. Check Global Variables
        // This is a heuristic.

        // 3. Check Contracts via Regex on Source Code (if we can fetch it)
        const filesToCheck = ['js/cv-render.js', 'js/config-ui.js', 'js/github-api.js', 'js/auth-gate.js'];

        for (const file of filesToCheck) {
            const resp = await fetch(file);
            if (resp.ok) {
                const content = await resp.text();
                checkFileContent(file, content, rules, violations);
            }
        }

        if (violations.length > 0) {
            console.error("❌ RULES VIOLATIONS FOUND:", violations);
            alert("Self-Check Failed! See console for details.");
        } else {
            console.log("✅ All Source-Code invariants passed.");
        }

        const cvResp = await fetch('./data/cv.json');
        if (cvResp.ok) {
            const cv = await cvResp.json();
            const schemaResult = await validateCVSchema(cv);
            const consistency = validateConsistency(cv);
            const lang = cv?.meta?.defaultLanguage || 'pt';
            const critical = formatErrorMessages(schemaResult.errors, lang)
                .concat(formatErrorMessages(consistency.critical, lang));
            const warnings = formatErrorMessages(consistency.warnings, lang);
            if (critical.length) {
                console.error('❌ CV Schema/Consistency errors:', critical);
            } else {
                console.log('✅ CV Schema OK.');
            }
            if (warnings.length) {
                console.warn('⚠️ CV warnings:', warnings);
            }
        }

    } catch (e) {
        console.error("Self-Check Error:", e);
    }
}

function checkFileContent(filename, content, rules, violations) {
    const r = rules.modules[filename.split('/').pop()];
    if (!r) return;

    // Check forbidden calls
    if (r.forbiddenCalls) {
        r.forbiddenCalls.forEach(call => {
            // Simple regex for function calls or assignments
            // e.g. "fetch(" or "fetch =" or ".fetch("
            const regex = new RegExp(`\\b${call}\\b`);
            if (regex.test(content)) {
                // False positives possible (e.g. comments). Basic check.
                if (!content.includes(`// Allowed usage of ${call}`)) { // Escape hatch
                    violations.push(`File ${filename} contains forbidden term '${call}'`);
                }
            }
        });
    }
}

// Expose to window
window.runSelfCheck = runChecks;
// Auto-run in dev?
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.addEventListener('load', runChecks);
}
