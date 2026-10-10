const guide = document.getElementById("how-to");
const openGuide = document.getElementById("how-to-open");
const closeGuide = document.getElementById("how-to-close");

openGuide.addEventListener("click", () => {
  guide.hidden = false;
});

closeGuide.addEventListener("click", () => {
  guide.hidden = true;
});
