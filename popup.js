// popup.js


document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login');
    const logoutButton = document.getElementById('logout');
    const userInfo = document.getElementById('user-info');
    const fullNameElement = document.getElementById('fullName');
    const notification = document.getElementById('notification');
  
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[DEBUG] Message received in popup:', message);
      
        if (message.action === 'authSuccess') {
        } else if (message.action === 'authError') {
          alert(`Authentication Failed: ${message.error}`);
        }
      
        sendResponse({ success: true });
      });
      
    // Function to update the UI based on authentication status
    function updateUI(isAuthenticated, fullName = '') {
      if (isAuthenticated) {
        loginButton.style.display = 'none';
        userInfo.style.display = 'block';
        fullNameElement.textContent = fullName;
      } else {
        loginButton.style.display = 'block';
        userInfo.style.display = 'none';
      }
    }
  
    // Function to show notifications
    function showNotification(message, type) {
      notification.textContent = message;
      notification.className = `notification ${type}`;
      notification.style.display = 'block';
      setTimeout(() => {
        notification.style.display = 'none';
      }, 5000);
    }
  
    function redirectToMain() {
        // Redirect the current popup to main.html
        window.location.href = chrome.runtime.getURL("main.html");
    }
  
    // Check if the user is already authenticated on popup load
    chrome.storage.local.get(['accessToken', 'fullName'], (result) => {
      if (result.accessToken && result.fullName) {
        updateUI(true, result.fullName);
        // Redirect to main.html and close the popup
        redirectToMain();
      } else {
        updateUI(false);
      }
    });
  
    // Listen for messages from background.js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'authSuccess') {
        updateUI(true, request.fullName);
        showNotification('Login successful!', 'success');
        // Redirect to main.html and close the popup
        redirectToMain();
      } else if (request.action === 'authError') {
        showNotification(`Authentication Error: ${request.error}`, 'error');
      }
    });
  
    // Initiate OAuth flow when login button is clicked
    loginButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
        console.log('Response from background:', response);
        if (!response) {
          console.error('No response from background script');
        } else if (response.success) {
          console.log('Authentication initiated');
        } else {
            console.error(`Authentication Failed: ${response.error}`);
          showNotification(`Authentication Failed: ${response.error}`, 'error');
        }
      });
    });
  
    // Handle logout
    logoutButton.addEventListener('click', () => {
      chrome.storage.local.remove(['accessToken', 'userId', 'fullName'], () => {
        updateUI(false);
        showNotification('Logged out successfully.', 'success');
        // Optionally, you can redirect to popup.html or another page
      });
    });
});
