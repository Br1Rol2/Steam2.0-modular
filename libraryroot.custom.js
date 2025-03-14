/**
 * @description This JS waits for the friends list panel to load dynamically
 * and adds a button to toggle its visibility.
 *
 * @note Only functions if the user has JavaScript enabled.
 */

function addToggleButton(panel) {
    if (panel.querySelector(".toggle-panel-button")) return; // Evitar agregar el botón varias veces

    const toggleButton = document.createElement("button");
    toggleButton.innerText = "⮜"; // Flecha indicando que se puede contraer
    toggleButton.classList.add("toggle-panel-button");
    toggleButton.style.position = "absolute";
    toggleButton.style.right = "-35px"; // Sobresale del panel
    toggleButton.style.top = "1%";
    //toggleButton.style.transform = "translateY(-50%)";
    toggleButton.style.padding = "5px 10px";
    toggleButton.style.background = "rgb(51 51 51 / 57%)";
    toggleButton.style.color = "white";
    toggleButton.style.border = "none";
    toggleButton.style.cursor = "pointer";
    toggleButton.style.zIndex = "1000";
    toggleButton.style.borderRadius = "5px";
    toggleButton.style.boxShadow = "0 0 5px rgba(0,0,0,0.5)";

    let isOpen = true;

    toggleButton.addEventListener("click", () => {
        if (isOpen) {
            panel.style.width = "0px"; // Ocultar completamente el panel
            toggleButton.innerText = "⮞"; // Cambiar la flecha
            toggleButton.style.right = "-33px"; // Mover el botón más afuera
        } else {
            panel.style.width = "272px"; // Restaurar tamaño original
            toggleButton.innerText = "⮜";
            toggleButton.style.right = "-33px"; // Restaurar la posición original
        }
        isOpen = !isOpen;
    });

    panel.appendChild(toggleButton);
}

function observePanel() {
    const observer = new MutationObserver(() => {
        const panel = document.querySelector("._9sPoVBFyE_vE87mnZJ5aB");
        if (panel) {
            addToggleButton(panel);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

observePanel();
