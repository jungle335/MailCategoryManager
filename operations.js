/**
 * It returns the id of the matched label
 * @param {String} labelName 
 * @returns 
 */
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
 * It updates the historic of statistics
 */

async function refreshStats() {
  const response = await browser.runtime.sendMessage({ action: "getLabelStats" });
  if (response?.success) {
    displayStats(response.stats);
  }
}


function clearAllInputs() {
  document.querySelectorAll("input").forEach(el => {
    el.value = "";
  });
  // Reset color picker
  document.getElementById("colorSwatch").style.background = "#fb4c2f";
  window.getSelectedColor = () => "#fb4c2f";
}


/**
* Event listener for deleting a label
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
            if (response?.success) {
              clearAllInputs(); 
              refreshStats();
            }
        });
      }
  });
}

/**
* Event listener for creating label option
*/
function createCategory() {
  document.getElementById("createBtn").addEventListener("click", async () => {
      const label_text = document.getElementById("createLabel").value;
      const color = window.getSelectedColor();

      console.log("Label to create:", label_text);
      console.log("Selected color:", color);
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
            labelName: label_text,
            color: color

        }).then(response => {
            console.log("Response:", response);
            if (response?.success) {
              clearAllInputs(); 
              refreshStats();
            }
        });
      } 
  });
}


/**
 * Color picker for the catergory label
 */
function initColorPicker() {
  const swatch = document.getElementById("colorSwatch");
  const dropdown = document.getElementById("colorDropdown");
  let selectedColor = "#fb4c2f";

  const COLORS = [
    "#fb4c2f", "#f691b3", "#f6c5be", "#efa093",
    "#ffad47", "#fad165", "#ffbc6b", "#fcda83",
    "#16a766", "#43d692", "#b9e4d0", "#a0eac9",
    "#a4c2f4", "#6d9eeb", "#3c78d8", "#a479e2", 
    "#d0bcf1", "#8e63ce", "#000000", "#434343", 
    "#cccccc", "#ffffff"
  ];

  COLORS.forEach(color => {
    const dot = document.createElement("div");
    dot.style.cssText = `
      width:24px; height:24px; border-radius:50%;
      background:${color}; cursor:pointer;
      border:2px solid transparent; flex-shrink:0;
    `;
    dot.addEventListener("click", () => {
      selectedColor = color;
      swatch.style.background = color;
      // close dropdown
      dropdown.style.cssText = `
        display:none; position:absolute; top:34px; left:0;
        background:#222; padding:8px; border-radius:8px;
        flex-wrap:wrap; gap:6px; width:152px;
        z-index:999; border:1px solid #444;
      `;
      dropdown.querySelectorAll("div").forEach(d => d.style.borderColor = "transparent");
      dot.style.borderColor = "white";
    });
    dropdown.appendChild(dot);
  });

  // Toggle dropdown
  swatch.addEventListener("click", () => {
    const isOpen = dropdown.style.display === "flex";
    dropdown.style.cssText = `
      display:${isOpen ? "none" : "flex"};
      position:absolute; top:34px; left:0;
      background:#222; padding:8px; border-radius:8px;
      flex-wrap:wrap; gap:6px; width:152px;
      z-index:999; border:1px solid #444;
    `;
  });

  window.getSelectedColor = () => selectedColor;
}

/**
* Function to display statistics about the labels
*/
function displayStats(stats) {
  const statsArea = document.getElementById("statsArea");
  statsArea.style.display = "block";
  renderTab(stats);
}

/**
 * It renders the historic about the labels
 * @param {*} stats 
 */
function renderTab(stats) {
  const canvas = document.getElementById("statsChart");
  canvas.style.display = "none";

  let container = document.getElementById("statsContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "statsContainer";
    canvas.parentNode.appendChild(container);
  }
  container.innerHTML = "";

  const heatmap = document.createElement('div')
  const title = document.createElement("h3");
  title.textContent = `User Labels (${stats.userCount})`;
  title.style.marginBottom = "12px";
  heatmap.appendChild(title);

  // Grid container
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(2, 1fr)";
  grid.style.gap = "8px 12px";

  heatmap.appendChild(grid);

  stats.allLabels.forEach(l => {
    const item = document.createElement("div");
    item.style = "display:flex; align-items:center; gap:8px;";

    const colorDot = document.createElement("span");
    colorDot.style.width = "14px";
    colorDot.style.height = "14px";
    colorDot.style.borderRadius = "50%";
    colorDot.style.flexShrink = "0";
    colorDot.style.background = l.color || "#cccccc";
    colorDot.style.border = "1px solid #aaa";

    const name = document.createElement("span");
    name.style.fontSize = "13px";
    name.textContent = l.name;

    item.appendChild(colorDot);
    item.appendChild(name);
    grid.appendChild(item);
  });

  // --- Colors used ---
  const usedColors = [...new Set(stats.allLabels.map(l => l.color).filter(Boolean))];
  const colorSection = document.createElement("div");
  colorSection.innerHTML = `<h3 style="margin-top:16px;">Colors Used (${usedColors.length})</h3>`;

  const colorRow = document.createElement("div");
  colorRow.style = "display:flex; flex-wrap:wrap; gap:6px;";
  usedColors.forEach(color => {
    const swatch = document.createElement("div");
    swatch.style = `
      width:24px; height:24px; border-radius:4px;
      background:${color}; border:1px solid #aaa;
      title="${color}";
    `;
    swatch.title = color;
    colorRow.appendChild(swatch);
  });
  colorSection.appendChild(colorRow);

  container.appendChild(heatmap);
  container.appendChild(colorSection);
}


async function getStatistics() {
    try {
      const response = await browser.runtime.sendMessage({
        action: "getLabelStats"
      });

      if (response?.success) {
        displayStats(response.stats);
      } else {
        console.error("Failed to get stats:", response?.error);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } 
}

/**
 * Export all the labels names with their colors in a JSON
 */
function exportLabels() {
  document.getElementById("exportBtn").addEventListener("click", async () => {
    try {
      const response = await browser.runtime.sendMessage({
        action: "getLabelStats"
      });

      if (!response?.success) {
        console.error("Failed to fetch labels:", response?.error);
        return;
      }

      const json = JSON.stringify(response.stats.allLabels, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "gmail_labels.json";
      a.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Export error:", error);
    }
  });
}

initColorPicker();
deleteCategory();
createCategory();
getStatistics();
exportLabels();