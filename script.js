const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const music = document.getElementById("music");
const intro = document.getElementById("intro");
const startButton = document.getElementById("start");
const finalMessage = document.getElementById("final");

const rootStyles = getComputedStyle(document.documentElement);
const pageData = document.documentElement.dataset;

const CONFIG = {
  textStart: "#B5D8C8",
  textMiddle: "#E5EFE5",
  textEnd: "#91C4B3",

  fontSize: 18,
  minFontSize: 11,

  rowSpacing: 17,
  wordSpacing: 8,

  heartWidth: 0.82,
  heartHeight: 0.66,
  heartPositionY: 0.4,

  shadowColor: "#286B64",
  shadowBlur: 8,

  cueCount:
    Number(
      pageData.vocalCueCount ||
        rootStyles.getPropertyValue("--vocal-cue-count"),
    ) || 25,

  cueStart:
    Number(
      pageData.vocalCueStart ||
        rootStyles.getPropertyValue("--vocal-cue-start"),
    ) || 4,

  cueEnd:
    Number(
      pageData.vocalCueEnd || rootStyles.getPropertyValue("--vocal-cue-end"),
    ) || 20,

  waveDuration:
    parseFloat(rootStyles.getPropertyValue("--vocal-wave-duration")) / 1000 ||
    0.28,
};

const LOVE = [
  "عاشقتم",
  "I LOVE YOU",
  "JE T'AIME",
  "TI AMO",
  "TE AMO",
  "ICH LIEBE DICH",
  "Я ТЕБЯ ЛЮБЛЮ",
  "愛してる",
  "사랑해",
  "أحبك",
  "EU TE AMO",
  "Σ' ΑΓΑΠΩ",
  "SENI SEVIYORUM",
  "我爱你",
  "KOCHAM CIĘ",
  "IK HOU VAN JOU",
  "VOLIM TE",
  "TE QUIERO",
  "MAHAL KITA",
  "MO GRÁ THÚ",
  "MI AMAS VIN",
  "T'ESTIMO",
  "TE IUBESC",
  "JAG ÄLSKAR DIG",
  "JEG ELSKER DEG",
  "MINÄ RAKASTAN SINUA",
  "NAKUPENDA",
  "MAITE ZAITUT",
  "OBICHAM TE",
  "TE ADORO",
  "AMO TE",
  "I LOVE THEE",
  "我愛汝",
  "愛汝",
  "사랑한다",
  "愛してるよ",
  "S'AGAPO",
  "TE QUIERO MUCHO",
  "T'ESTIMO MOLT",
  "ANA BAHEBAK",
];

const VOCAL_CUES = Array.from(
  { length: CONFIG.cueCount },
  (_, index) =>
    CONFIG.cueStart +
    ((CONFIG.cueEnd - CONFIG.cueStart) * index) / (CONFIG.cueCount - 1),
);

let W = 0;
let H = 0;
let DPR = 1;

let heartWords = [];
let revealedWords = 0;

let heartScale = 1;
let heartCenterX = 0;
let heartCenterY = 0;

let started = false;
let fontsReady = false;
let animationFrame = 0;

function resizeCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);

  W = window.innerWidth;
  H = window.innerHeight;

  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);

  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function heartPoint(t) {
  return {
    x: 16 * Math.pow(Math.sin(t), 3),

    y:
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t),
  };
}

function createHeartPolygon() {
  const points = [];
  const segments = 1600;

  for (let index = 0; index <= segments; index++) {
    points.push(heartPoint((Math.PI * 2 * index) / segments));
  }

  return points;
}

function getHeartBounds(polygon) {
  return polygon.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    },
  );
}

function getIntervals(y, polygon) {
  const intersections = [];

  for (let index = 0; index < polygon.length - 1; index++) {
    const first = polygon[index];
    const second = polygon[index + 1];

    if ((first.y <= y && second.y > y) || (second.y <= y && first.y > y)) {
      const ratio = (y - first.y) / (second.y - first.y);

      intersections.push(first.x + ratio * (second.x - first.x));
    }
  }

  intersections.sort((a, b) => a - b);

  const intervals = [];

  for (let index = 0; index < intersections.length - 1; index += 2) {
    intervals.push([intersections[index], intersections[index + 1]]);
  }

  return intervals;
}

function isPersian(text) {
  return /[\u0600-\u06FF]/.test(text);
}

function getFontFamily(text) {
  return isPersian(text)
    ? '"Noto Naskh Arabic", serif'
    : '"Cormorant Garamond", serif';
}

function setCanvasFont(size, text) {
  ctx.font = `${size}px ${getFontFamily(text)}`;
}

function createTextGradient() {
  const gradient = ctx.createLinearGradient(0, H * 0.15, W, H * 0.85);

  gradient.addColorStop(0, CONFIG.textStart);
  gradient.addColorStop(0.5, CONFIG.textMiddle);
  gradient.addColorStop(1, CONFIG.textEnd);

  return gradient;
}

function prepareHeart() {
  heartWords = [];

  const polygon = createHeartPolygon();
  const bounds = getHeartBounds(polygon);

  const shapeWidth = bounds.maxX - bounds.minX;
  const shapeHeight = bounds.maxY - bounds.minY;

  const availableWidth = W * CONFIG.heartWidth;
  const availableHeight = H * CONFIG.heartHeight;

  heartScale = Math.min(
    availableWidth / shapeWidth,
    availableHeight / shapeHeight,
  );

  heartCenterX = W / 2;
  heartCenterY = H * CONFIG.heartPositionY;

  let languageIndex = 0;

  const yStep = CONFIG.rowSpacing / heartScale;

  for (let y = bounds.maxY; y >= bounds.minY; y -= yStep) {
    const intervals = getIntervals(y, polygon);

    for (const [left, right] of intervals) {
      const pixelLeft = heartCenterX + left * heartScale;

      const pixelRight = heartCenterX + right * heartScale;

      const rowWidth = pixelRight - pixelLeft;

      if (rowWidth < CONFIG.minFontSize + CONFIG.wordSpacing) {
        continue;
      }

      const line = [];
      let totalWidth = 0;

      while (languageIndex < 10000 && totalWidth < rowWidth) {
        const phrase = LOVE[languageIndex % LOVE.length];

        let fontSize = CONFIG.fontSize;
        let phraseWidth = 0;

        while (fontSize >= CONFIG.minFontSize) {
          setCanvasFont(fontSize, phrase);

          phraseWidth = ctx.measureText(phrase).width;

          if (totalWidth + phraseWidth + CONFIG.wordSpacing <= rowWidth) {
            break;
          }

          fontSize--;
        }

        if (fontSize < CONFIG.minFontSize) {
          break;
        }

        line.push({
          text: phrase,
          width: phraseWidth,
          size: fontSize,
          isPersian: isPersian(phrase),
        });

        totalWidth += phraseWidth + CONFIG.wordSpacing;

        languageIndex++;
      }

      if (line.length === 0) continue;

      totalWidth -= CONFIG.wordSpacing;

      let x = pixelLeft + (rowWidth - totalWidth) / 2;

      for (const item of line) {
        heartWords.push({
          text: item.text,
          x: x + item.width / 2,
          y: heartCenterY - y * heartScale,
          size: item.size,
          isPersian: item.isPersian,
        });

        x += item.width + CONFIG.wordSpacing;
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = createTextGradient();

  ctx.shadowColor = CONFIG.shadowColor;
  ctx.shadowBlur = CONFIG.shadowBlur;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let index = 0; index < revealedWords; index++) {
    const item = heartWords[index];

    ctx.font = `${item.size}px ${getFontFamily(item.text)}`;

    ctx.direction = item.isPersian ? "rtl" : "ltr";

    ctx.fillText(item.text, item.x, item.y);
  }

  ctx.shadowBlur = 0;
}

function getRevealedWordCount(time) {
  if (time < VOCAL_CUES[0] || heartWords.length === 0) {
    return 0;
  }

  let cueIndex = -1;

  for (let index = 0; index < VOCAL_CUES.length; index++) {
    if (time >= VOCAL_CUES[index]) {
      cueIndex = index;
    } else {
      break;
    }
  }

  if (cueIndex < 0) return 0;

  const startIndex = Math.floor(
    (cueIndex / CONFIG.cueCount) * heartWords.length,
  );

  const endIndex =
    cueIndex === CONFIG.cueCount - 1
      ? heartWords.length
      : Math.floor(((cueIndex + 1) / CONFIG.cueCount) * heartWords.length);

  const elapsed = time - VOCAL_CUES[cueIndex];

  const progress = Math.max(0, Math.min(1, elapsed / CONFIG.waveDuration));

  const waveWords = endIndex - startIndex;

  return Math.min(
    heartWords.length,
    startIndex + Math.ceil(waveWords * progress),
  );
}

function updateExperience() {
  if (!started || !fontsReady) return;

  const nextCount = getRevealedWordCount(music.currentTime);

  if (nextCount !== revealedWords) {
    revealedWords = nextCount;
    draw();
  }

  if (music.ended) {
    finishExperience();
    return;
  }

  animationFrame = requestAnimationFrame(updateExperience);
}

function finishExperience() {
  if (!started) return;

  revealedWords = heartWords.length;

  draw();

  finalMessage.classList.add("show");

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }
}

async function loadFonts() {
  await Promise.all([
    document.fonts.load('18px "Cormorant Garamond"'),

    document.fonts.load('18px "Noto Naskh Arabic"'),

    document.fonts.load('18px "Playfair Display"'),
  ]);

  await document.fonts.ready;

  fontsReady = true;
}

const fontsPromise = loadFonts().catch((error) => {
  console.warn("Font loading fallback:", error);
  fontsReady = true;
});

async function startExperience() {
  if (started || startButton.disabled) return;

  startButton.disabled = true;

  const playbackPromise = music.play();

  try {
    await Promise.all([playbackPromise, fontsPromise]);

    prepareHeart();

    revealedWords = getRevealedWordCount(music.currentTime);

    started = true;

    intro.classList.add("hide");

    finalMessage.classList.remove("show");

    draw();

    if (music.ended) {
      finishExperience();
      return;
    }

    animationFrame = requestAnimationFrame(updateExperience);
  } catch (error) {
    console.error("The experience could not start:", error);

    started = false;

    music.pause();
    music.currentTime = 0;

    startButton.disabled = false;

    intro.classList.remove("hide");
  }
}

function handleResize() {
  resizeCanvas();

  if (!started || !fontsReady) return;

  prepareHeart();

  revealedWords = getRevealedWordCount(music.currentTime);

  draw();
}

music.addEventListener("ended", finishExperience);

music.addEventListener("timeupdate", () => {
  if (!started || !fontsReady) return;

  const nextCount = getRevealedWordCount(music.currentTime);

  if (nextCount !== revealedWords) {
    revealedWords = nextCount;
    draw();
  }
});

music.addEventListener("seeked", () => {
  if (!started || !fontsReady) return;

  revealedWords = getRevealedWordCount(music.currentTime);

  draw();
});

startButton.addEventListener("click", startExperience);

window.addEventListener("resize", handleResize);

resizeCanvas();

fontsPromise.then(() => {
  prepareHeart();
  draw();
});
