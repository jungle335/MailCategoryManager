/**
* Event listener for the dropdown menu
* @author Mihai <tudose.mihai622@gmail.com>
*/

function menuListener() {
    const select = document.getElementById("select-content");

    select.addEventListener("change", (event) => {
    const selectedOption = event.target.selectedOptions[0]; // selected <option>

    if (selectedOption.classList.contains("option-content")) {
        const elements = document.querySelectorAll('.elements');
        const idx = parseInt(selectedOption.dataset.index, 10);

        elements.forEach((el, i) => {
            el.style.display = (i === idx) ? 'block' : 'none';
        });

        const helperDoc = document.getElementById("helper-doc");
        helperDoc.style.display = "none";
    }
    });
}


function subscribeNewsletter() {
  const select = document.getElementById("select-content-helpers");

  select.addEventListener("change", function () {
   const elements = document.querySelectorAll('.elements');

    elements.forEach(el => {
        el.style.display = 'none';
    });

    const helperDoc = document.getElementById("helper-doc");
    const selectedOption = select.selectedOptions[0];

    if (!selectedOption) return;

    const index = selectedOption.dataset.index;
    const value = selectedOption.value;

    // Case 1: Show documentation
    if (index === "1") {
        helperDoc.style.display = "block";
    }

    // Case 2: Open external link
    else if (index === "2" && value) {
        browser.tabs.create({ url: value });
        helperDoc.style.display = "none";
    }

    // Default: Hide documentation
    else {
        helperDoc.style.display = "none";
    }

    // Always reset dropdown after action
    select.value = "";

    });
};

menuListener();
subscribeNewsletter();