// main.js

let socket;
let emojiMap = {}; // Custom emojis from Slack
let unicodeEmojiMap = {}; // Standard Unicode emojis from emoji.json
const root = document.documentElement;// Select the root element

// Add a toggle event (e.g., a button click)
document.getElementById('theme-toggle').addEventListener('click', () => {
  // Check if light mode is active
  if (root.classList.contains('light-mode')) {
      root.classList.remove('light-mode'); // Switch to dark mode
      localStorage.setItem('theme', 'dark'); // Save preference
  } else {
      root.classList.add('light-mode'); // Switch to light mode
      localStorage.setItem('theme', 'light'); // Save preference
  }
});

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
function replaceLinksWithHyperlink(text) {
  // Ignore messages that are purely emojis in the format :emoji:
  if (/^:[a-zA-Z0-9_+]+:$/.test(text)) {
    return text; // Return the text as-is
  }

  // Match HTTPS links with optional enclosing < and >
  const linkRegex = /<?(https:\/\/[^\s>]+)>?/g;

  // Replace each match with a clickable hyperlink
  return text.replace(linkRegex, (match, url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="styled-link">
                Link 
              </a>`;
  });
  
}
   // Initialize emojis
   async function initializeEmojis() {
    try {
        // Retrieve emojis from Chrome storage
        chrome.storage.local.get(['emojiMap', 'unicodeEmojiMap'], (result) => {
            if (result.emojiMap && result.unicodeEmojiMap) {
                emojiMap = result.emojiMap;
                unicodeEmojiMap = result.unicodeEmojiMap;
                console.log("Emojis loaded from cache.");
            } else {
                console.warn("No cached emojis found. Fallback to fetching.");
                fetchAndCacheEmojis(); // Trigger fallback if emojis are missing
            }
        });
    } catch (error) {
        console.error("Error loading cached emojis:", error);
        await fetchAndCacheEmojis(); // Fallback in case of storage retrieval error
    }
}

// Helper function for fallback fetching and caching
async function fetchAndCacheEmojis() {
    try {
        const customEmojis = await fetch('https://question-bot.replit.app/api/emojis').then(res => res.json());
        const unicodeEmojiData = await fetch(chrome.runtime.getURL('/assets/emoji.json')).then(res => res.json());

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

        // Update global variables
        emojiMap = customEmojis;
        unicodeEmojiMap = unicodeEmojiMap;

        // Cache in Chrome storage
        chrome.storage.local.set({ emojiMap, unicodeEmojiMap }, () => {
            console.log("Fallback: Emojis cached successfully.");
        });
    } catch (error) {
        console.error("Fallback emoji fetch failed:", error);
    }
}

    // Display existing data with emoji support
    function getEmoji(emojiName) {
      console.log("Emoji Name:", emojiName);
console.log("Emoji Map:", emojiMap);
console.log("Custom Emoji URL:", emojiMap[emojiName]);
      // Remove any skin-tone modifiers or additional properties
      const baseEmoji = emojiName.split('::')[0];
    
      // Check for Slack custom emoji
      if (emojiMap[baseEmoji]) {
        const emojiValue = emojiMap[baseEmoji];
        if (emojiValue.startsWith('http')) {
          // Return a properly formatted <img> tag for custom emojis
          return `<img src="${emojiValue}" alt=":${baseEmoji}:" class="emoji" style="width: 20px; height: 20px; vertical-align: middle;">`;
        }
      }
    
      // Check for Unicode standard emoji
      if (unicodeEmojiMap[baseEmoji]) {
        return unicodeEmojiMap[baseEmoji]; // Return Unicode emoji directly
      }
    
      // Fallback: Return the original :emoji: shortcode if not found
      return `:${emojiName}:`;
    }
    

    function escapeHTML(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML; // This escapes special characters
    }

    function replaceEmojisInText(text) {
      // Replace emoji shortcodes with actual emojis
      return text.replace(/:([a-zA-Z0-9_+]+):/g, (match, emojiName) => {
        const emojiHTML = getEmoji(emojiName);
    
        // Check if getEmoji returned a valid emoji (custom or Unicode)
        if (emojiHTML) {
          return emojiHTML; // Return the emoji HTML
        }
    
        // Fallback: Return the original text if no emoji is found
        return match;
      });
    }
    
    

    function displayExistingData(data) {
      const existingDataDiv = document.getElementById('existing-data');
      const conversationTextarea = document.getElementById('conversation-text');
      const sendReplyButton = document.getElementById('send-reply');
      existingDataDiv.style.display = 'block';
      document.getElementById('data-form').style.display = 'none';
      currentThreadTS = data.thread_ts; // Save thread timestamp
      
    // Enable the textarea if there are replies or reactions
    if (data.replies && data.replies.length > 0) {
      conversationTextarea.disabled = false;
      sendReplyButton.disabled = false;
      conversationTextarea.placeholder = "Type your reply here...";
  } else {
      conversationTextarea.disabled = true;
      sendReplyButton.disabled = true;
      conversationTextarea.placeholder = "No replies yet. Replies are disabled.";
  }
        
// Populate the existing data div
existingDataDiv.innerHTML = `
    <div class="existing-data-header">
        <h3 class="user-name">${data.fullName}</h3>
    </div>

    <div class="existing-data-question">
        <p class="selected-checks">${data.selectedChecks.join('<br>')}</p>
        <p class="question-message"> ${replaceEmojisInText(replaceLinksWithHyperlink(data.messageText))}</p>
        ${
            data.reactions && data.reactions.length > 0
                ? `<div class="reactions">${data.reactions.map(r => `
                    <span data-tooltip="${r.user}\n:${r.name.split('::')[0]}:" class="reaction-icon">${getEmoji(r.name)}</span>`
                ).join(' ')}</div>`
                : ''
        }
    </div>

    <div class="existing-data-replies">
        <ul class="replies-list">
            ${
                data.replies.length > 0
                    ? data.replies.map(reply => `
                        <li class="reply-item">
                            <strong class="reply-user">${reply.user}:</strong> 
                            <span class="reply-text">${replaceEmojisInText(replaceLinksWithHyperlink(reply.text))}</span>
                            ${
                                reply.reactions && reply.reactions.length > 0
                                    ? `<div class="reply-reactions">${reply.reactions.map(r => `
                                        <span data-tooltip="${r.user}\n:${r.name.split('::')[0]}:" class="reaction-icon">${getEmoji(r.name)}</span>`
                                    ).join(' ')}</div>`
                                    : ''
                            }
                        </li>
                    `).join('')
                    : '<p>No replies yet.</p>'
            }
        </ul>
    </div>
`;
    
      document.getElementById('conversation-form').style.display = 'block'; // Show reply form

    }
    




document.addEventListener('DOMContentLoaded', function() {
  const userFullname = document.getElementById('user-fullname');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const logoutLink = document.getElementById('logout-link');

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
      root.classList.add('light-mode');
  }
  // Toggle dropdown menu visibility
  userFullname.addEventListener('click', () => {
      const isMenuVisible = dropdownMenu.style.display === 'block';
      dropdownMenu.style.display = isMenuVisible ? 'none' : 'block';
  });

    // Handle logout action
    logoutLink.addEventListener('click', (event) => {
      event.preventDefault(); // Prevent the default anchor behavior
      chrome.storage.local.remove(['accessToken', 'userId', 'fullName', 'authStatus', 'errorMsg', 'loggedIn'], () => {
          window.location.href = 'popup.html'; // Redirect to the login page
      });
  });
  // Close dropdown menu when clicking outside
  document.addEventListener('click', (event) => {
      if (!userFullname.contains(event.target) && !dropdownMenu.contains(event.target)) {
          dropdownMenu.style.display = 'none';
      }
  });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentURL = currentTab.url || '';
    const urlObj = new URL(currentURL);
    const compareCrossLinks = urlObj.searchParams.get('compareCrossLinks');

    // Create the overlay upfront (hidden by default)
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '9999';
    overlay.style.fontFamily = "'Vazirmatn', sans-serif";
    overlay.style.textAlign = 'center';
    overlay.style.padding = '20px';

    // Spinner
    const spinner = document.createElement('div');
    spinner.style.width = '40px';
    spinner.style.height = '40px';
    spinner.style.border = '4px solid #272727';
    spinner.style.borderTop = '4px solid #77edd1';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'spin 1s linear infinite';
    spinner.style.marginBottom = '20px';

    // Message (default)
    let messageText = "You can use this only with a VT Session";

    // If compareCrossLinks is true, change the message
    if (compareCrossLinks === 'true') {
      messageText = "Please close Cross-links and try again";
    }

    const message = document.createElement('div');
    message.style.color = '#ffffff';
    message.style.fontSize = '14px';
    message.style.backgroundColor = '#212121';
    message.style.padding = '10px 20px';
    message.style.borderRadius = '5px';
    message.textContent = messageText;

    overlay.appendChild(spinner);
    overlay.appendChild(message);

    // Spinner animation keyframe
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(overlay);

    // Conditions to hide overlay:
    // 1. URL starts with the allowed prefix
    // 2. compareCrossLinks is not true
    if (currentURL.startsWith("https://vt.penguin-eu.vrff.io/manual-assignments/") && compareCrossLinks !== 'true') {
      overlay.style.display = 'none';
    }
  
  
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
  if (!navigator.onLine) {
    alert('No internet connection. Please check your network.', 'error');
    return;
  }
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
  
      // Replace links in the reply text
      const formattedReplyText = replaceLinksWithHyperlink(replyText);
  
      // Proceed with sending the formatted text to the server
      chrome.storage.local.get(['accessToken', 'userId'], async ({ accessToken, userId }) => {
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
  
                  checkForExistingQuestion(window.currentURL);
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
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        const rawTooltipText = target.getAttribute('data-tooltip');
        const htmlTooltipText = rawTooltipText.replace(/\n/g, '<br>');
    
        const tooltip = document.createElement('div');
        tooltip.className = 'my-tooltip';
        tooltip.innerHTML = htmlTooltipText;
        document.body.appendChild(tooltip);
    
  
          // Get bounding rectangles for positioning
          const targetRect = target.getBoundingClientRect();
          const tooltipRect = tooltip.getBoundingClientRect();
  
          // Calculate where to place the tooltip initially (below the target)
          let top = targetRect.bottom + 5; 
          let left = targetRect.left;
  
          // Get the extension's visible width and height
          const extensionWidth = document.documentElement.clientWidth;
          const extensionHeight = document.documentElement.clientHeight;
  
          // Adjust horizontal position if it overflows on the right
          if (left + tooltipRect.width > extensionWidth) {
              left = extensionWidth - tooltipRect.width - 5;
          }
  
          // If placing below doesn't fit, place it above
          if (top + tooltipRect.height > extensionHeight) {
              top = targetRect.top - tooltipRect.height - 5;
          }
  
          tooltip.style.top = `${top}px`;
          tooltip.style.left = `${left}px`;
  
          // Remove tooltip on mouseout
          target.addEventListener('mouseout', () => {
              if (tooltip.parentNode) {
                  tooltip.parentNode.removeChild(tooltip);
              }
          }, { once: true });
      }
  });
});
});
});