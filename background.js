chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Function to initiate OAuth flow
function initiateOAuth() {
  const clientId = '14839921698.7579204113414';
  const redirectUri = chrome.identity.getRedirectURL('provider_cb');
  const botScope = 'users:read,chat:write';
  const userScope = 'users:read,chat:write';
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${botScope}&user_scope=${userScope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  console.log('[DEBUG] Auth URL:', authUrl);
  console.log('[DEBUG] Redirect URI:', redirectUri);


  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      (redirectedTo) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError));
        }

        // Parse the redirected URL to extract the code
        try {
          const url = new URL(redirectedTo);
          const code = url.searchParams.get('code');

          if (code) {
            resolve(code);
          } else {
            reject(new Error('No code found in the redirected URL'));
          }
        } catch (error) {
          reject(new Error('Invalid redirect URI'));
        }
      }
    );
  });
}

async function authenticateWithSlack() {
  try {
    const code = await initiateOAuth();
    console.log('[DEBUG] Authorization code retrieved:', code);

    const response = await fetch('https://question-bot.replit.app/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();
    console.log('[DEBUG] Token exchange response:', data);

    if (response.ok && data.message === "Tokens saved successfully!") {
      console.log('[DEBUG] Authentication succeeded:', data);

      chrome.storage.local.set({
        accessToken: data.accessToken,
        userId: data.userId, // Save userId from the backend response
        fullName: data.fullName,
        loggedIn: true
      });

      chrome.runtime.sendMessage({
        action: 'authSuccess',
        fullName: data.fullName,
      });
    } else {
      console.error('[ERROR] Backend error:', data.error || "Unknown error");
      chrome.runtime.sendMessage({
        action: 'authError',
        error: data.error || "Failed to exchange code for tokens",
      });
    }
  } catch (error) {
    console.error('[ERROR] Authentication failed:', error.message);
    chrome.runtime.sendMessage({
      action: 'authError',
      error: error.message || "An unexpected error occurred.",
    });
  }
}


// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[DEBUG] Message received in popup:', request);

  if (request.action === 'authenticate') {
    // Handle authentication flow
    authenticateWithSlack()
      .then(() => {
        console.log('Authentication succeeded');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Authentication failed:', error.message);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate async response
    return true;
  }


  if (request.action === 'postMessage') {
    chrome.storage.local.get(['accessToken'], async ({ accessToken }) => {
        if (!accessToken) {
            sendResponse({ success: false, error: 'Access token missing' });
            return;
        }

        try {
            const payload = {
                channel: request.channel,
                text: request.text,
            };

            if (request.thread_ts) {
                payload.thread_ts = request.thread_ts; // Include thread timestamp if provided
            }

            const response = await fetch('https://question-bot.replit.app/api/postMessage', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (result.success) {
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: result.error });
            }
        } catch (error) {
            console.error("Error sending message:", error);
            sendResponse({ success: false, error: error.message });
        }
    });

    return true; // Indicate async response
}


  // Handle unknown actions
  sendResponse({ success: false, error: 'Unknown action' });
});
