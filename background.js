/**
 * It authenticates the user using OAuth2
 * @returns the authentification token
 */

async function getAccessToken() {
  const clientId = CONFIG.client_id;

  if (!clientId) {
    throw new Error("OAuth client_id not found in manifest.");
  }

  const redirectUri = browser.identity.getRedirectURL();
  console.log("Redirect URI:", redirectUri);

  const scopes = CONFIG.scopes.join(" ");

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    "?client_id=" + encodeURIComponent(clientId) +
    "&response_type=token" +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&scope=" + encodeURIComponent(scopes);

  return new Promise((resolve, reject) => {
    browser.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true
      },
      (redirectedTo) => {

        if (browser.runtime.lastError) {
          console.error("Runtime error:", browser.runtime.lastError);
          reject(browser.runtime.lastError);
          return;
        }

        if (!redirectedTo) {
          reject(new Error("No redirect URL received."));
          return;
        }

        console.log("Redirected To:", redirectedTo);

        const hash = new URL(redirectedTo).hash.substring(1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get("access_token");

        if (!accessToken) {
          reject(new Error("Access token not found in response."));
          return;
        }

        resolve(accessToken);
      }
    );

  });
}

async function handlerToken() {
  try {
    const token = await getAccessToken();
    return token; 
  } catch (error) {
    browser.notifications.create("auth_denied", {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-48.png"),
      title: "MailCategoryManager",
      message: "Access denied. Please try again."
    });
    return null;
  }
}

async function deleteLabel(labelName) {
    const token = await handlerToken(); 
    
    if (!token) 
      return "Authentication failed.";

    // Get all labels
    const listResponse = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/labels",
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!listResponse.ok) {
      const err = await listResponse.json();
      return `Error fetching labels: ${err.error?.message || listResponse.statusText}`;
    }

    const listData = await listResponse.json();
    const labels = listData.labels || [];

    // Find label by name
    const label = labels.find(l => l.name === labelName);

    if (!label) {
      console.error(`Label '${labelName}' not found`);

      browser.notifications.create("label_error", {
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/error-48.png"),
        title: "GmailCategoryManager Error",
        message: `Label '${labelName}' not found!`
      });

      return `Label '${labelName}' not found.`;
    }
    else {
      // Delete label
      const deleteResponse = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/labels/${label.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        return `Failed to delete label: ${errorData.error?.message || deleteResponse.statusText}`;
      }
      else {
        browser.notifications.create("label_deleted", {
            type: "basic",
            iconUrl: browser.runtime.getURL("icons/success-48.png"),
            title: "GmailCategoryManager",
            message: `Label '${labelName}' deleted successfully.`
        });
      }

      return `Label '${labelName}' deleted successfully.`;
  }
}


async function createLabel(labelName, color) {
  const token = await getAccessToken();
  
  if (!token) return "Authentication failed.";

  try {
    const parts = labelName.split("/");
    let createdLabel; 

    for (let i = 0; i < parts.length; i++) {
      const partialPath = parts.slice(0, i + 1).join("/");

      const label = {
        name: partialPath,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        color: {
          backgroundColor: color,
          textColor: "#000000"
        }
      };

      const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/labels", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(label)
      });

      // 409 = label already exists, skip it
      if (response.status === 409) continue;

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }

      createdLabel = await response.json(); // ← saves last created label
    }

    console.log(`Label created: ${createdLabel.name} with ID: ${createdLabel.id}`);
    browser.notifications.create("label_created", {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/success-48.png"),
      title: "GmailCategoryManager",
      message: `Label created: ${createdLabel.name} with ID: ${createdLabel.id}`
    });
    return `Label created: ${createdLabel.name} with ID: ${createdLabel.id}`;

  } catch (error) {
    console.error("Error creating label:", error.message);
    browser.notifications.create("label_created_error", {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/error-48.png"),
      title: "GmailCategoryManager Error",
      message: `Error creating label: ${error.message}`
    });
    return `Error creating label: ${error.message}`;
  }
}


async function getLabelStats() {
  const token = await handlerToken();
  if (!token) throw new Error("Authentication failed.");

  const response = await fetch(
    "https://www.googleapis.com/gmail/v1/users/me/labels",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) 
    throw new Error("Failed to fetch labels");

  const data = await response.json();
  const labels = data.labels || [];

  const userLabels = labels.filter(l => l.type === "user");

  return {
    userCount: userLabels.length,
    allLabels: userLabels.map(l => ({
      name: l.name,
      color: l.color?.backgroundColor || null
    }))
  };
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);

  if (request.action === "notify_error") {
    browser.notifications.create("label_error", {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/error-48.png"),
      title: "GmailCategoryManager Error",
      message: request.message || "An error occurred"
    });

    sendResponse({ success: true });
    return true; 
  }

  if (request.action === "createLabel") {
    createLabel(request.labelName, request.color)  
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        browser.notifications.create("label_error", {
          type: "basic",
          iconUrl: browser.runtime.getURL("icons/error-48.png"),
          title: "GmailCategoryManager Error",
          message: error.message || "An error occurred"
        });

        sendResponse({ success: false, error: error.message });
      });

    return true; // keep message channel open for async response
  }

  if (request.action === "deleteLabel") {
    deleteLabel(request.labelName)
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        browser.notifications.create("label_error", {
          type: "basic",
          iconUrl: browser.runtime.getURL("icons/error-48.png"),
          title: "GmailCategoryManager Error",
          message: error.message || "An error occurred"
        });

        sendResponse({ success: false, error: error.message });
      });

    return true; 
  }

  if (request.action === "getLabelStats") {
    getLabelStats()
      .then(stats => {
        sendResponse({ success: true, stats });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; 
  }
});