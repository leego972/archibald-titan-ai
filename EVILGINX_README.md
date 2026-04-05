# How to Use Evilginx in Audit Titan

Evilginx is a powerful tool for testing if your employees can be tricked into giving away their login sessions (even if they use Two-Factor Authentication). 

Because it is a sensitive tool, **Audit Titan does not run Evilginx on its own servers**. Instead, you must provide your own cheap, temporary server (VPS) for it to run on. Audit Titan will automatically install and control it for you.

Here is the simple, step-by-step guide to getting started.

---

## Step 1: Get a Temporary Server (VPS)
You need a fresh, blank Linux server. You can rent one for about $5/month from providers like DigitalOcean, Linode, or Hetzner.

1. Create a new server (Droplet/Instance).
2. Choose **Ubuntu 22.04** or **Debian 11/12** as the operating system.
3. Choose the cheapest plan (1GB RAM is plenty).
4. Save the **IP Address** and the **root password** (or SSH key) they give you.

## Step 2: Connect Your Server to Audit Titan
Now you need to tell Audit Titan where your server is so it can install Evilginx.

1. Open Audit Titan and go to the **Evilginx** page in the sidebar.
2. Click **Add Node**.
3. Fill in the details:
   - **Label:** Give it a name (e.g., "Test Server 1").
   - **Host / IP:** Paste the IP address of your new server.
   - **SSH Username:** Type `root`.
   - **Password:** Paste the root password for your server.
4. Click **Save**.

## Step 3: Install and Start Evilginx
Audit Titan will now do all the hard work of installing the software and setting up firewalls.

1. On the Evilginx page, find your new server in the list.
2. Click the **Deploy** button. 
   - *Wait 1-2 minutes. Audit Titan is logging into your server, downloading Evilginx, and locking down the firewall.*
3. Once it says "Ready", click the **Start Server** button.
   - *The status will change to "Running". Evilginx is now active!*

## Step 4: Set Up a Phishing Template (Phishlet)
Evilginx uses "Phishlets" — these are pre-made templates that look exactly like real login pages (like Microsoft 365, Google, or LinkedIn).

1. Scroll down to the **Phishlets** section.
2. Find the template you want to use (e.g., `microsoft`).
3. Click **Set Hostname** and type the fake web address you bought for this test (e.g., `login-security-check.com`).
4. Click **Enable**.

## Step 5: Create a Trap Link (Lure)
A "Lure" is the specific, unique link you will send to your employees to test them.

1. Scroll down to the **Lures** section.
2. Click **Create Lure**.
3. Select the Phishlet you just enabled (e.g., `microsoft`).
4. (Optional) Set a **Redirect URL**. This is where the employee will be sent *after* they log in (e.g., `https://yourcompany.com/security-training`).
5. Click **Create**.
6. Click **Get URL** next to your new Lure. This is the link you will email to your employees.

## Step 6: View Captured Sessions
When an employee clicks your link and logs in, Evilginx captures their username, password, and their active login session (cookie).

1. Scroll down to the **Sessions** section.
2. Click **Refresh**.
3. You will see a list of everyone who fell for the test. If the "Tokens" column says "Yes", it means Evilginx successfully bypassed their Two-Factor Authentication.

---

### ⚠️ Important Rules
- **Only test your own employees.** You must have written permission to run these tests.
- **Delete the server when you are done.** When your test is over, go back to DigitalOcean/Linode and destroy the server. This ensures no sensitive data is left behind.
- **Never use your main company domain.** Always buy a cheap, lookalike domain (like `yourcompany-login.com`) for these tests.
