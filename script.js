const letterEl = document.querySelector("#love-letter");
const memoryGrid = document.querySelector("#memory-grid");
const openButton = document.querySelector("[data-open-letter]");
const musicToggle = document.querySelector("[data-music-toggle]");
const backgroundMusic = new Audio("content/music/music.mp3");

let musicReady = false;
let musicWanted = true;

const memorySources = [
  {
    key: "photo",
    title: "The photo I love",
    folder: "content/cards/photo",
    fallback:
      "This is not just a cute picture. It is one of those little images that feels warm because it looks like you in a way I love.",
    tilt: "-0.8deg",
  },
  {
    key: "screenshot",
    title: "The confession",
    folder: "content/cards/screenshot",
    fallback:
      "The moment I finally said how deeply I love you. I meant it then, and every word still matters to me.",
    tilt: "0.7deg",
  },
  {
    key: "favorite_moment",
    title: "The song",
    folder: "content/cards/favorite_moment",
    fallback:
      "That time I made you a song and you loved it. I still keep that moment because it felt like something from my heart reached yours.",
    tilt: "-0.35deg",
  },
];

const imageNames = ["image.jpg", "image.jpeg", "image.png", "photo.jpg", "photo.png", "screenshot.png"];
const textNames = ["text.txt", "caption.txt", "note.txt"];

const fallbackLetter = `I wanted this to feel like opening a letter that had been folded carefully and kept somewhere safe.

Replace this text in content/love_letter.txt with the real Arabic letter.

The strongest version will be specific, honest, and written like you are sitting there at night with the words you truly mean.`;

function textToParagraphs(text) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p dir="rtl">${escapeHtml(paragraph.trim())}</p>`)
    .join("");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

async function fetchText(path, fallback = "") {
  try {
    const response = await fetch(withCacheBust(path), { cache: "no-store" });
    if (!response.ok) return fallback;
    const text = await response.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function findImage(folder) {
  for (const name of imageNames) {
    const path = `${folder}/${name}`;
    try {
      const response = await fetch(withCacheBust(path), { method: "HEAD", cache: "no-store" });
      if (response.ok) return path;
    } catch {
      return "";
    }
  }
  return "";
}

async function findCaption(folder, fallback) {
  for (const name of textNames) {
    const text = await fetchText(`${folder}/${name}`, "");
    if (text) return text;
  }
  return fallback;
}

async function loadLetter() {
  const letter = await fetchText("content/love_letter.txt", fallbackLetter);
  letterEl.innerHTML = textToParagraphs(letter);
}

async function loadMemories() {
  const cards = await Promise.all(
    memorySources.map(async (memory) => {
      const [image, caption] = await Promise.all([
        findImage(memory.folder),
        findCaption(memory.folder, memory.fallback),
      ]);

      return `
        <article class="memory-card" data-card="${memory.key}" style="--tilt: ${memory.tilt}">
          <div class="memory-card__media">
            ${
              image
                ? `<img src="${image}" alt="${escapeHtml(memory.title)} memory" />`
                : `<span>${escapeHtml(memory.title)}</span>`
            }
          </div>
          <div class="memory-card__body">
            <h3>${escapeHtml(memory.title)}</h3>
            <p>${escapeHtml(caption)}</p>
          </div>
        </article>
      `;
    })
  );

  memoryGrid.innerHTML = cards.join("");
}

function setupReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.18 }
  );

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}

function setupInteractions() {
  openButton.addEventListener("click", () => {
    document.body.classList.remove("intro-locked");
    document.body.classList.add("letter-open");
    playMusicAfterOpen();
    document.querySelector("#intro").scrollIntoView({ behavior: "smooth" });
  });

  document.querySelector(".secret-note").addEventListener("click", (event) => {
    event.currentTarget.classList.add("revealed");
    event.currentTarget.textContent = "I notice more than you think.";
  });

  musicToggle.addEventListener("click", () => {
    if (!musicReady) return;

    if (backgroundMusic.paused) {
      musicWanted = true;
      backgroundMusic.play().then(updateMusicButton).catch(updateMusicButton);
    } else {
      musicWanted = false;
      backgroundMusic.pause();
      updateMusicButton();
    }
  });
}

async function setupMusic() {
  const config = await fetchJson("content/music/control.json", {
    volume: 0.35,
    loop: true,
    autoplayAfterOpen: true,
  });

  backgroundMusic.volume = clamp(Number(config.volume ?? 0.35), 0, 1);
  backgroundMusic.loop = config.loop !== false;
  musicWanted = config.autoplayAfterOpen !== false;
  backgroundMusic.preload = "auto";
  musicReady = true;
  updateMusicButton();

  if (document.body.classList.contains("letter-open")) {
    playMusicAfterOpen();
  }
}

async function fetchJson(path, fallback) {
  try {
    const response = await fetch(withCacheBust(path), { cache: "no-store" });
    if (!response.ok) return fallback;
    return { ...fallback, ...(await response.json()) };
  } catch {
    return fallback;
  }
}

function withCacheBust(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${Date.now()}`;
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function playMusicAfterOpen() {
  if (!musicReady || !musicWanted) return;
  backgroundMusic.play().then(updateMusicButton).catch(updateMusicButton);
}

function updateMusicButton() {
  musicToggle.classList.toggle("is-playing", !backgroundMusic.paused);
  musicToggle.textContent = backgroundMusic.paused ? "Play music" : "Pause music";
}

function setupScrollGate() {
  window.scrollTo(0, 0);

  const keepAtOpening = (event) => {
    if (!document.body.classList.contains("intro-locked")) return;
    window.scrollTo(0, 0);
    event.preventDefault();
  };

  window.addEventListener("wheel", keepAtOpening, { passive: false });
  window.addEventListener("touchmove", keepAtOpening, { passive: false });
}

loadLetter();
loadMemories();
setupMusic();
setupReveal();
setupInteractions();
setupScrollGate();
