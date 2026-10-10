const card = JSON.parse(document.getElementById("escape-card").textContent)
const button = document.getElementById("share")

button.addEventListener("click", async () => {
  if (navigator.share) {
    try {
      await navigator.share({ title: "CODE: ADRIFT", text: card })
      return
    } catch {
      return
    }
  }
  await navigator.clipboard.writeText(card)
  button.textContent = "Copied"
})
