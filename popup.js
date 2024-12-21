document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login');
  const userInfo = document.getElementById('user-info');
  const fullNameElement = document.getElementById('fullName');
  const notification = document.getElementById('notification');
  const spinnerOverlay = document.getElementById('spinner-overlay');

  let loginInProgress = false;

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

  function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => {
      notification.style.display = 'none';
    }, 5000);
  }

  function showSpinner() {
    const spinnerOverlay = document.getElementById('spinner-overlay');
    if (spinnerOverlay) {
        spinnerOverlay.style.display = 'flex'; // Ensure it becomes visible
    } else {
        console.error('Spinner overlay element not found');
    }
}


  function hideSpinner() {
    spinnerOverlay.style.display = 'none';
  }

  function redirectToMain() {
    window.location.href = chrome.runtime.getURL("main.html");
  }

  // Initial check
  chrome.storage.local.get(['accessToken', 'fullName', 'authStatus', 'errorMsg'], (result) => {
    if (result.authStatus === 'success' && result.accessToken && result.fullName) {
      updateUI(true, result.fullName);
      redirectToMain();
    } else if (result.authStatus === 'error') {
      showNotification(`Authentication Failed: ${result.errorMsg}`, 'error');
      updateUI(false);
      chrome.storage.local.remove(['authStatus', 'errorMsg']);
    } else {
      updateUI(false);
    }
  });

  loginButton.addEventListener('click', () => {
    if (loginInProgress) return;
    loginInProgress = true;

    // Disable the login button and show spinner
    loginButton.classList.add('disabled');
    showSpinner();

    setTimeout(() => {
      // Re-enable the button after 30 seconds
      loginInProgress = false;
      loginButton.classList.remove('disabled');
      hideSpinner();
    }, 30000);

    chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
      if (!response) {
        console.error('No response from background script');
      } else if (response.success) {
        console.log('Authentication initiated');
        // After successful initiation, the background script should handle the popup and
        // storage updates. Once auth completes, storage changes should trigger UI update below.
      } else {
        console.error(`Authentication Failed: ${response.error}`);
        showNotification(`Authentication Failed: ${response.error}`, 'error');
      }
    });
  });



  // Listen for changes in storage to catch when auth is done
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.authStatus && changes.authStatus.newValue === 'success') {
        chrome.storage.local.get(['fullName'], (res) => {
          updateUI(true, res.fullName);
          redirectToMain();
        });
      } else if (changes.authStatus && changes.authStatus.newValue === 'error') {
        chrome.storage.local.get(['errorMsg'], (res) => {
          showNotification(`Authentication Failed: ${res.errorMsg}`, 'error');
          updateUI(false);
          chrome.storage.local.remove(['authStatus', 'errorMsg']);
        });
      }
    }
  });
});
