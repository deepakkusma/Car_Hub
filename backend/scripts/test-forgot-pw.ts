import fs from "fs";
import path from "path";

async function testForgotPassword() {
    const API_URL = "http://localhost:3001"; // Assuming backend runs on 3001
    const testEmail = "nonexistent@example.com";
    const logPath = path.join(process.cwd(), "scripts", "test-output.log");

    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync(logPath, msg + "\n");
    };

    // Clear log file
    fs.writeFileSync(logPath, "");

    log(`Testing forgot password with email: ${testEmail}`);

    const tryPath = async (pathName: string) => {
        log(`Trying path: ${pathName}`);
        try {
            const response = await fetch(`${API_URL}/api/auth/${pathName}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Origin": "http://localhost:5173"
                },
                body: JSON.stringify({
                    email: testEmail,
                    redirectTo: "http://localhost:3000/reset-password",
                }),
            });

            log(`Path ${pathName} - Response Status: ${response.status}`);
            const text = await response.text();
            log(`Path ${pathName} - Response Body: ${text}`);

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                log("Response is not JSON");
            }

            if (response.status === 400 && data?.message === "No email exists") {
                log("✅ SUCCESS: Correctly received 'No email exists' error.");
                return true;
            } else if (response.status === 400 && data?.body?.message === "No email exists") {
                log("✅ SUCCESS: Correctly received 'No email exists' error (in body).");
                return true;
            } else {
                log("❌ FAILURE: Did not receive expected error.");
                return false;
            }
        } catch (error) {
            log(`Error running test for ${pathName}: ${error}`);
            return false;
        }
    }


    // Check health first
    try {
        const healthRes = await fetch(`${API_URL}/api/health`);
        log(`Health Check: ${healthRes.status}`);
        log(`Health Body: ${await healthRes.text()}`);
    } catch (e) {
        log(`Health Check Failed: ${e}`);
    }

    await tryPath("forget-password");
    await tryPath("forgot-password");
}

testForgotPassword();
