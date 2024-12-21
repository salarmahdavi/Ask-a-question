
chrome.runtime.onInstalled.addListener(async () => {
  try {
      console.log("Fetching and caching emojis...");
      // Fetch custom emojis from the server
      const customEmojis = await fetch('https://question-bot.replit.app/api/emojis').then(res => res.json());

      // Fetch Unicode emojis from local JSON
      const unicodeEmojiData = await fetch(chrome.runtime.getURL('/assets/emoji.json')).then(res => res.json());

      // Convert Unicode emoji JSON into a lookup map
      const unicodeEmojiMap = {};
      unicodeEmojiData.forEach(emoji => {
          unicodeEmojiMap[emoji.short_name] = emoji.unified
              .split('-')
              .map(code => String.fromCodePoint(parseInt(code, 16)))
              .join('');
          if (emoji.short_names) {
              emoji.short_names.forEach(name => {
                  unicodeEmojiMap[name] = unicodeEmojiMap[emoji.short_name];
              });
          }
      });

      // Store emojis in Chrome storage
      chrome.storage.local.set({ emojiMap: customEmojis, unicodeEmojiMap }, () => {
          console.log("Emojis cached successfully.");
      });
  } catch (error) {
      console.error("Failed to fetch emojis during installation:", error);
  }
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

    if (response.ok && data.accessToken) {
      chrome.storage.local.set({
        accessToken: data.accessToken,
        userId: data.userId,
        fullName: data.fullName,
        loggedIn: true,
        authStatus: 'success'
      });
    } else {
      chrome.storage.local.set({
        authStatus: 'error',
        errorMsg: data.error || "Failed to exchange code for tokens"
      });
    }
    
  } catch (error) {
    console.error('[ERROR] Authentication failed:', error.message);

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
