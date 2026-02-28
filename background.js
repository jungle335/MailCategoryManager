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
  let token;
    
  try {
    token = await getAccessToken();
  } catch (error) {
    browser.notifications.create("auth_denied", {
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-48.png"),
      title: "GmailCategoryManager",
      message: "Access denied. Please try again."
    });
    return "User cancelled or denied access.";
  }
}

async function deleteLabel(labelName) {
    handlerToken(); // Ensure we have a valid token before proceeding

    // 1️⃣ Get all labels
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

    console.log("Fetched labels:", listData.labels);
    const labels = listData.labels || [];

    // 2️⃣ Find label by name
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

      browser.notifications.create("label_deleted", {
          type: "basic",
          iconUrl: browser.runtime.getURL("icons/success-48.png"),
          title: "GmailCategoryManager",
          message: `Label '${labelName}' deleted successfully.`
      });

      return `Label '${labelName}' deleted successfully.`;
  }
}


async function createLabel(labelName) {
  const token = await getAccessToken();

  const label = {
    name: labelName,
    labelListVisibility: "labelShow",
    messageListVisibility: "show",
    color: {
      backgroundColor: "#ffbc6b", // bright yellow
      textColor: "#000000"        // black text
    }
  };

  try {
    const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/labels", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(label)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message);
    }

    const createdLabel = await response.json();
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


async function createEmailRule(sendersEmail, labelName, token) {
  try {
    const token = await getAccessToken();
    // 1️⃣ Get all labels
    const emailsArray = sendersEmail.split(",").map(email => email.trim());
    const query = emailsArray.map(email => `from:${email}`).join(" OR ");

    // 2️⃣ Get label ID
    const labelsResponse = await fetch("https://www.googleapis.com/gmail/v1/users/me/labels", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!labelsResponse.ok) {
      throw new Error(`Error fetching labels: ${await labelsResponse.text()}`);
    }

    const labelsData = await labelsResponse.json();
    const label = labelsData.labels.find(l => l.name === labelName);
    if (!label) {
      console.error(`Label '${labelName}' not found`);

      browser.notifications.create("label_error", {
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/error-48.png"),
        title: "GmailCategoryManager Error",
        message: `Label '${labelName}' not found!`
      });

      return;
    }

    const labelId = label.id;
    console.log(`ID of label '${labelName}': ${labelId}`);

    // 3️⃣ List messages matching the query
    const messagesResponse = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!messagesResponse.ok) {
      throw new Error(`Error fetching messages: ${await messagesResponse.text()}`);
    }

    const messagesData = await messagesResponse.json();
    const messages = messagesData.messages || [];

    console.log(`Found ${messages.length} messages to label.`);

    // 4️⃣ Apply label to each message
    for (const msg of messages) {
      await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            addLabelIds: [labelId]
          })
        }
      );
    }
    
    browser.notifications.create("label_applied", {
          type: "basic",
          iconUrl: browser.runtime.getURL("icons/success-48.png"),
          title: "GmailCategoryManager",
          message: `Applied label '${labelName}' to existing emails from: ${sendersEmail}`
    });

  } catch (error) {
    console.error("Failed to apply label:", error.message);

    browser.notifications.create("label_applied_error", {
          type: "basic",
          iconUrl: browser.runtime.getURL("icons/error-48.png"),
          title: "GmailCategoryManager Error",
          message: `Failed to apply label '${labelName}' to existing emails from: ${sendersEmail}`
    });
  }
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
    return true; // keep async response alive
  }

  if (request.action === "createLabel") {
    createLabel(request.labelName)
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
        // browser.notifications.create("label_deleted", {
        //   type: "basic",
        //   iconUrl: browser.runtime.getURL("icons/success-48.png"),
        //   title: "GmailMozillaExtension",
        //   message: "Label deleted successfully!"
        // });
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

  if (request.action === "createEmailRule") {
    createEmailRule(request.senderEmail, request.labelName)
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
});
