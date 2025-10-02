const { ipcRenderer } = require("electron");

const CORRECT_PASSWORD = "premier123**";

document.addEventListener("DOMContentLoaded", () => {
  const passwordInput = document.getElementById("passwordInput");
  const loginButton = document.getElementById("loginButton");
  const closeButton = document.getElementById("closeButton");
  const errorMessage = document.getElementById("errorMessage");

  const closeWindow = () => {
    ipcRenderer.send("close-password-modal");
  };

  const checkPassword = () => {
    const inputPassword = passwordInput.value;

    if (inputPassword === CORRECT_PASSWORD) {
      errorMessage.style.visibility = "hidden";
      ipcRenderer.send("password-successful");
    } else {
      errorMessage.style.visibility = "visible";

      passwordInput.value = "";

      passwordInput.focus();

      setTimeout(() => {
        errorMessage.style.visibility = "hidden";
      }, 3000);
    }
  };

  loginButton.addEventListener("click", checkPassword);

  if (closeButton) {
    closeButton.addEventListener("click", closeWindow);
  }

  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      checkPassword();
    }
  });
});
