async function getLabelId(labelName) {
  const token = await getAccessToken();
  
  const response = await fetch(
    "https://www.googleapis.com/gmail/v1/users/me/labels",
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await response.json();

  const label = data.labels?.find(l => l.name === labelName);
  return label ? label.id : null;
}


/**
* Event listener for deleting a label
* @author Mihai <tudose.mihai622@gmail.com>
*/
function deleteCategory() {
  document.getElementById("deleteCategoryBtn").addEventListener("click", async () => {
      const label_text = document.getElementById("deleteLabel").value;

      console.log("Label to delete:", label_text);
      if (!label_text) {
        console.error("Label name is empty!");

        browser.runtime.sendMessage({
          action: "notify_error",
          message: "Label name is empty!"
        });
        return;
      }
      else {
        browser.runtime.sendMessage({
            action: "deleteLabel",
            labelName: label_text
        }).then(response => {
            browser.notifications.create({
              type: "basic",
              iconUrl: browser.runtime.getURL("icons/success-48.png"),
              title: "GmailCategoryManager",
              message: "Label deleted successfully!"
          });
        });
      }
  });
}

/**
* Event listener for creating label option
* @author Mihai <tudose.mihai622@gmail.com>
*/
function createCategory() {
  document.getElementById("createBtn").addEventListener("click", async () => {
      const label_text = document.getElementById("createLabel").value;

      console.log("Label to create:", label_text);
      if (!label_text) {
        console.error("Label name is empty!");

        browser.runtime.sendMessage({
          action: "notify_error",
          message: "Label name is empty!"
        });
        return;
      }
      else {
        browser.runtime.sendMessage({
            action: "createLabel",
            labelName: label_text
        }).then(response => {
            console.log("Response:", response);
            
            browser.notifications.create({
              type: "basic",
              iconUrl: browser.runtime.getURL("icons/success-48.png"),
              title: "GmailCategoryManager",
              message: "Label created successfully!"
          });
        });
      } 
  });
}


/**
* Event listener for creating label option
* @author Mihai <tudose.mihai622@gmail.com>
*/
function applyCategory() {
  document.getElementById("applyCategoryBtn").addEventListener("click", async () => {
      const sendersEmail = document.getElementById("sendersEmail").value;
      const label_text = document.getElementById("searchLabel").value;

      console.log("Label to apply:", label_text);
      console.log("Sender's email:", sendersEmail);

      if (!label_text || !sendersEmail) {
        console.error("One of the fields is empty!");

        browser.runtime.sendMessage({
          action: "notify_error",
          message: "One of the fields is empty!"
        });
        return;
      }
      else {
        browser.runtime.sendMessage({
            action: "createEmailRule",
            senderEmail: sendersEmail,
            labelName: label_text
        }).then(response => {
            browser.notifications.create({
              type: "basic",
              iconUrl: browser.runtime.getURL("icons/icon-48.png"),
              title: "GmailCategoryManager",
              message: "Email rule applied successfully!"
          });
        });
      }
  });
}

deleteCategory();
createCategory();
applyCategory();