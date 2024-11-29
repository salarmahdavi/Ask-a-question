// main.js

let socket;
let emojiMap = {}; // Custom emojis from Slack
let unicodeEmojiMap = {}; // Standard Unicode emojis from emoji.json

function validateForm() {
    const checks = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    const comment = document.getElementById('comment').value.trim();
    const sendButton = document.querySelector('button[type="submit"]');

    // Check if at least one checkbox is selected or the comment is not empty
    const isAnyCheckSelected = checks.some(check => check.checked);
    const isCommentNotEmpty = comment.length > 0;

    if (isAnyCheckSelected || isCommentNotEmpty) {
        sendButton.disabled = false; // Enable button
    } else {
        sendButton.disabled = true; // Disable button
    }
}

document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['loggedIn', 'fullName'], function(result) {
    if (!result.loggedIn) {
      window.location.href = 'popup.html';
      return; // Exit early if not logged in
    } else {
      document.getElementById('user-fullname').innerText = result.fullName;
    }

    const apiDataUrl = 'https://question-bot.replit.app/api/data';
    const apiQuestionsUrl = 'https://question-bot.replit.app/api/questions';
    const emojiApiUrl = 'https://question-bot.replit.app/api/emojis';
    const wsUrl = 'wss://question-bot.replit.app/ws';

    // WebSocket Reconnection Settings
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const checks = document.querySelectorAll('input[type="checkbox"]');
    const comment = document.getElementById('comment');

    // Attach event listeners to each checkbox
    checks.forEach(check => {
        check.addEventListener('change', validateForm);
    });

    // Attach event listener to the comment text area
    comment.addEventListener('input', validateForm);

    // Initial validation check on page load
    validateForm();

  
    

    // Initialize emojis
    async function initializeEmojis() {
      try {
        // Fetch custom emojis from the server
        const response = await fetch(emojiApiUrl);
        const customEmojis = await response.json();
        emojiMap = { ...emojiMap, ...customEmojis };

        // Load standard Unicode emojis from emoji.json
        const unicodeEmojiResponse = await fetch(chrome.runtime.getURL('/assets/emoji.json'));
        const unicodeEmojiData = await unicodeEmojiResponse.json();

        // Convert JSON array to a lookup map for easier access
        unicodeEmojiData.forEach(emoji => {
          unicodeEmojiMap[emoji.short_name] = emoji.unified.split('-').map(code => String.fromCodePoint(parseInt(code, 16))).join('');
          if (emoji.short_names) {
            emoji.short_names.forEach(name => {
              unicodeEmojiMap[name] = unicodeEmojiMap[emoji.short_name];
            });
          }
        });
      } catch (error) {
        console.error("Error initializing emojis:", error);
      }
    }

    // Call emoji initialization on load
    initializeEmojis();

    function connectWebSocket() {
      socket = new WebSocket(wsUrl);

      socket.addEventListener('open', () => {
        console.log('WebSocket connection opened');
        reconnectAttempts = 0;
      });

      socket.addEventListener('message', (event) => {
        console.log('WebSocket message received:', event.data);
        const message = JSON.parse(event.data);
      
        if (window.currentURL && message.type === 'update' && message.data.url === window.currentURL) {
          // Re-render the data to reflect the changes
          displayExistingData(message.data);
        }
      });

      socket.addEventListener('close', (event) => {
        console.log('WebSocket connection closed:', event);
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(connectWebSocket, 5000);
        } else {
          console.error('Maximum reconnection attempts reached');
        }
      });

      socket.addEventListener('error', (event) => {
        console.error('WebSocket error:', event);
      });
    }

    connectWebSocket();

// Function to check for existing questions (HTTP-based)
async function checkForExistingQuestion(currentURL) {
    const formElement = document.getElementById('data-form');
    const existingDataElement = document.getElementById('existing-data');
  
    try {
      // Perform the fetch call
      const response = await fetch(`${apiQuestionsUrl}?url=${encodeURIComponent(currentURL)}`);
  
      // Handle the response based on the status
      if (response.status === 404) {
        // No questions exist
        formElement.style.display = 'block';
        existingDataElement.style.display = 'none';
        console.log('No existing questions found.');
      } else if (!response.ok) {
        // General error response
        throw new Error(`Unexpected response: ${response.status} ${response.statusText}`);
      } else {
        // Questions exist, parse and display data
        const data = await response.json();
        displayExistingData(data);
      }
    } catch (error) {
      // Centralized error handling
      console.error('Error fetching question:', error);
      formElement.style.display = 'block';
      existingDataElement.style.display = 'none';
      alert('An error occurred while checking for existing questions. Please try again later.');
    }
  }

    // Display existing data with emoji support
    function getEmoji(emojiName) {
      // Check for a custom emoji URL
      if (emojiMap[emojiName] && emojiMap[emojiName].startsWith('http')) {
        return `<img src="${emojiMap[emojiName]}" alt="${emojiName}" class="emoji" style="width: 20px; height: 20px;">`;
      }
      // Check for a standard Unicode emoji
      return unicodeEmojiMap[emojiName] || emojiName; // Fallback to name if emoji is not found
    }

    function escapeHTML(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML; // This escapes special characters
    }

    function replaceEmojisInText(text) {
      // Escape the text first to prevent issues with HTML special characters
      const escapedText = escapeHTML(text);
      
      // Replace emoji shortcodes with actual emojis
      return escapedText.replace(/:([a-zA-Z0-9_+]+):/g, (match, emojiName) => {
        return getEmoji(emojiName) || match;
      });
    }

    function displayExistingData(data) {
      const existingDataDiv = document.getElementById('existing-data');
      const conversationTextarea = document.getElementById('conversation-text');
      existingDataDiv.style.display = 'block';
      document.getElementById('data-form').style.display = 'none';
      currentThreadTS = data.thread_ts; // Save thread timestamp
      
        // Enable the textarea if there are replies or reactions
        if (data.replies && data.replies.length > 0) {
            conversationTextarea.disabled = false;
        } else {
            conversationTextarea.disabled = true;
        }
      existingDataDiv.innerHTML = `
          <p><strong>Question:</strong></p>
          <p>${data.selectedChecks.join('<br>')}</p>
          <p>${replaceEmojisInText(data.messageText)}</p>
          ${
              data.reactions && data.reactions.length > 0
                  ? `<p>${data.reactions.map(r => `<span data-tooltip="${r.user}">${getEmoji(r.name)}</span>`).join(' ')}</p>`
                  : ''
          }
          <h4>Replies:</h4>
          <ul>
              ${data.replies.length > 0
                  ? data.replies.map(reply => `
                      <li class="reply-item">
                          <strong>${reply.user}:</strong> ${replaceEmojisInText(reply.text)}</br>${
                              reply.reactions && reply.reactions.length > 0
                                  ? `<span class="reply-reactions">${reply.reactions.map(r => `<span data-tooltip="${r.user}">${getEmoji(r.name)}</span>`).join(' ')}</span>`
                                  : ''
                          }
                      </li>
                  `).join('')
                  : ''
              }
          </ul>
      `;
      document.getElementById('conversation-form').style.display = 'block'; // Show reply form

    }

    // Get the current URL and check for existing questions
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const currentURL = currentTab.url;
      window.currentURL = currentURL;

      checkForExistingQuestion(currentURL);
    });

    // Handle form submission (HTTP-based)
    document.getElementById("data-form").addEventListener("submit", function(event) {
      event.preventDefault();

      const messageText = document.getElementById('comment').value.trim();
      const checks = [
        { label: "Specimen Similarity", value: document.getElementById('check1').checked },
        { label: "Face Match", value: document.getElementById('check2').checked },
        { label: "Face Real", value: document.getElementById('check3').checked },
        { label: "Physical Screen", value: document.getElementById('check4').checked },
        { label: "Unicolor", value: document.getElementById('check5').checked },
        { label: "Screen Shot", value: document.getElementById('check6').checked },
        { label: "Damaged Document", value: document.getElementById('check7').checked },
        { label: "IDV", value: document.getElementById('check8').checked },
        { label: "Policy", value: document.getElementById('check9').checked },
        { label: "Which Specimen?", value: document.getElementById('check10').checked }
    ];

      const selectedChecks = checks.filter(check => check.value).map(check => check.label).join(', ');

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const currentTab = tabs[0];
          const currentURL = currentTab.url;

          chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              func: () => {
                  const customerNameElement = document.querySelector('.genoma-c-gPjxah.genoma-c-gPjxah-buEGHh-level-6');
                  const customerName = customerNameElement ? customerNameElement.textContent : null;

                  const fullSpecimenIDElement = document.querySelector('.genoma-c-hDLMSu.genoma-c-hDLMSu-fEUGzH-textStyle-small.genoma-c-hDLMSu-eoGMvP-color-stronger');
                  const fullSpecimenID = fullSpecimenIDElement ? fullSpecimenIDElement.textContent : null;

                  const sessionTimeElement = document.querySelector('.genoma-c-hDLMSu.genoma-c-hDLMSu-iWFnmw-textStyle-mono.genoma-c-hDLMSu-OgOui-color-strongest');
                  const sessionTime = sessionTimeElement ? sessionTimeElement.textContent : null;
          
                  return { customerName, fullSpecimenID, sessionTime };
              }
          }, (results) => {
              if (results && results[0] && results[0].result) {
                  const { customerName, fullSpecimenID, sessionTime } = results[0].result;
                  chrome.storage.local.get(['fullName'], function(result) {
                      const data = {
                          fullName: result.fullName,
                          selectedChecks,
                          messageText,
                          url: currentURL,
                          customerName,
                          fullSpecimenID,
                          sessionTime
                      };
                      chrome.storage.local.get(['accessToken', 'userId'], ({ accessToken, userId }) => {
                        console.log('Retrieved from storage:', { accessToken, userId }); // Debug log
                      
                        if (!accessToken || !userId) {
                          console.error("Access token or user ID missing.");
                          return;
                        }
                      
                        fetch(apiDataUrl, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                            'user-id': userId,
                          },
                          body: JSON.stringify(data),
                        })
                        .then(response => {
                          console.log('API Response:', response);
                          if (!response.ok) {
                            return response.text().then(text => { throw new Error(text); });
                          }
                          return response.json();
                        })
                        .then(data => {
                            console.log('Data sent successfully:', data);
                            document.getElementById('notification').textContent = "Data sent successfully!";
                            document.getElementById('notification').className = "notification success";
                            document.getElementById('notification').style.display = "block";
  
                            document.getElementById('data-form').style.display = 'none';
                            checkForExistingQuestion(window.currentURL);
  
                            event.target.querySelector('button[type="submit"]').disabled = true;
                            setTimeout(() => {
                                event.target.querySelector('button[type="submit"]').disabled = false;
                            }, 5000);
  
                            setTimeout(() => {
                                document.getElementById('notification').style.display = "none";
                            }, 5000);
                        })
                        .catch(error => {
                          console.error('Error:', error);
                          
                        });
                      });
                  });
              }
            
          });
      });
    });

    window.addEventListener('unload', () => {
      if (socket) {
          socket.close();
      }
    });


    let isReplyManuallyAdded = false; // Flag to track manual reply addition

    // Function to handle conversation replies

document.getElementById('send-reply').addEventListener('click', async function () {
    const replyText = document.getElementById('conversation-text').value.trim();
    if (!replyText) return alert("Please enter a message!");

        chrome.storage.local.get(['accessToken', 'userId'], async ({ accessToken, userId }) => {
            console.log('Retrieved from storage:', { accessToken, userId }); // Debug log
        if (!accessToken) {
            console.error("Access token missing.");
            return alert("You are not authenticated!");
        }

        try {
            const response = await fetch('https://question-bot.replit.app/api/reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'user-id': userId, // Include user-id
                  },
                body: JSON.stringify({
                    text: replyText,
                    thread_ts: currentThreadTS || '', // Ensure thread_ts is correct
                }),
            });

            if (!response.ok) {
                // Handle non-2xx status codes explicitly
                const errorText = await response.text();
                throw new Error(`Failed to send reply: ${errorText}`);
            }

            const data = await response.json();
            if (data.success) {
                document.getElementById('notification').textContent = "Data sent successfully!";
                document.getElementById('notification').className = "notification success";
                document.getElementById('notification').style.display = "block";
                document.getElementById('conversation-text').value = '';
                setTimeout(() => {
                    document.getElementById('notification').style.display = "none";
                }, 2000);
                // Set the flag to ignore WebSocket updates for this manual reply
                isReplyManuallyAdded = true;
                

                // Refresh conversation after a short delay
                setTimeout(() => {
                    isReplyManuallyAdded = false;
                    checkForExistingQuestion(window.currentURL);
                }, 2000);
            } else {
                throw new Error(data.error || "Failed to send reply.");
            }
        } catch (error) {
            console.error("Error sending reply:", error);
            alert(error.message || "An error occurred.");
        }
    });
});

    
    
    // Modify WebSocket handling to respect the manual addition flag
    socket.addEventListener('message', (event) => {
        console.log('WebSocket message received:', event.data);
        const message = JSON.parse(event.data);
    
        // Skip updates if the reply was manually added
        if (isReplyManuallyAdded) {
            console.log("Skipping WebSocket update due to manual reply addition.");
            return;
        }
    
        // Process updates only for the current thread
        if (message.type === 'update' && message.data.thread_ts === currentThreadTS) {
            console.log("Updating UI with WebSocket data.");
            displayExistingData(message.data);
        } else {
            console.log("Ignoring irrelevant WebSocket update.");
        }
    });
    

    document.getElementById("logout-button").addEventListener("click", function() {
      chrome.storage.local.set({ loggedIn: false, fullName: '' }, function() {
          window.location.href = 'popup.html';
      });
    });

    document.getElementById('comment').addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          document.getElementById('data-form').dispatchEvent(new Event('submit'));
      }
    });
    document.getElementById('conversation-text').addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent the default new line insertion
    
            const sendButton = document.getElementById('send-reply');
            sendButton.click(); // Simulate a click on the Send Reply button
        }
    });
    
});
});