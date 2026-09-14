// ----------------------------------------
// FUNDAMENTAL CONSTANTS

const DOUBLER = 2;  // To indicate somthing needs to be doubled or halved
const DEGS_IN_CIRCLE = 360;
const SECS_IN_HOUR = 3600;
const HOURS_IN_CLOCK = 12;
const NUM_CLOCK_MAJOR_HOURS = 3;  // Hours in a quarter circle
const SECS_IN_12_HOURS = SECS_IN_HOUR * HOURS_IN_CLOCK;
const PH_TZ_OFFSET = 8;  // in hours
const SVG_NS = 'http://www.w3.org/2000/svg';

// ----------------------------------------
// APP PARAMETERS

const INITIAL_DELAY = 1000;  // in ms

const MIN_TIMESTAMP = 1284163200;  // 8am
const MAX_TIMESTAMP = 1284202800;  // 7pm

const X_SCALE = 256;
const Y_SCALE = 116;
const X_TRIM = -0.75;
const Y_TRIM = 1.08;

const TIMESTAMP_DELTA = 20;

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1200;

const CLOCK_RADIUS = 150;
const CLOCK_HAND_COLOR = '#ffc';
const CLOCK_FACE_COLOR = '#555';
const CLOCK_TICK_COLOR = '#888';
const CLOCK_MAJOR_TICK_WIDTH = 7;
const CLOCK_MINOR_TICK_WIDTH = 2;
const CLOCK_TICK_MIN_RADIUS = 100;
const CLOCK_TICK_MAX_RADIUS = 140;
const CLOCK_HOUR_HAND_WIDTH = 10;
const CLOCK_MINUTE_HAND_WIDTH = 10;
const CLOCK_HOUR_HAND_RADIUS = 80;
const CLOCK_MINUTE_HAND_RADIUS = 140;
const CLOCK_HAND_REVERSE_RADIUS = 30;

const TRACK_WIDTH = 3;
const RED_TEAM_COLOR = '#f66';
const ORANGE_TEAM_COLOR = '#fb6';
const GREEN_TEAM_COLOR = '#6f6';
const TILE_X0 = 3419;
const TILE_X1 = 3425;
const TILE_Y0 = 1881;
const TILE_Y1 = 1886;
const TILE_SCALED_SIZE = 192;
const TILE_X_ADJUST = -79;
const TILE_Y_ADJUST = -138;

// ----------------------------------------
// GLOBAL VARIABLES

const TrackCtx = document.getElementById('track').getContext('2d');

let TeamInfo = {
  red    : { posCircle: document.getElementById('red-pos'   ), color: RED_TEAM_COLOR    },
  orange : { posCircle: document.getElementById('orange-pos'), color: ORANGE_TEAM_COLOR },
  green  : { posCircle: document.getElementById('green-pos' ), color: GREEN_TEAM_COLOR  },
};
let DataIsReady = false;
let IsPlaying = false;
let TimestampIter = MIN_TIMESTAMP;

// References to DOM elements
const MainDiv      = document.querySelector('main');
const PlayPauseBtn = document.querySelector('#play-pause');
const ResetBtn     = document.querySelector('#reset');
let HourHand, MinuteHand;

// ----------------------------------------
// FUNCTIONS

const getJson = filename => fetch(filename).then(response => response.json());

const createSvgElem = (elemName, attrs) => {
  const elem = document.createElementNS(SVG_NS, elemName);
  for (const attr of Object.entries(attrs)) elem.setAttribute(...attr);
  return elem;
};

const fitToViewport = () => {
  const scale = Math.min(
    window.innerWidth  / MAP_WIDTH,
    window.innerHeight / MAP_HEIGHT,
  );
  MainDiv.style.transform = `scale(${scale})`;
};

const processRawData = (data) => {
  const finalData = [];
  for (const [timestamp, xOffset, yOffset] of data) {
    const x = (xOffset - X_TRIM) * X_SCALE;
    const y = (yOffset - Y_TRIM) * Y_SCALE;
    finalData.push([timestamp, x, y]);
  }
  return finalData;
};

const renderBaseMap = () => {
  const div = document.getElementById('base-map');
  for (let x = TILE_X0; x <= TILE_X1; x++) {
    for (let y = TILE_Y0; y <= TILE_Y1; y++) {
      const tile = new Image();
      tile.className = 'tile';
      tile.src = `https://basemaps.cartocdn.com/rastertiles/dark_all/12/${x}/${y}@2x.png?key=cb1_2ive_2_49fd2dc5752eb5e5a73c9e7c`;
      tile.style.left = `${(x - TILE_X0) * TILE_SCALED_SIZE + TILE_X_ADJUST}px`;
      tile.style.top  = `${(y - TILE_Y0) * TILE_SCALED_SIZE + TILE_Y_ADJUST}px`;
      div.appendChild(tile);
    }
  }
};

const createClock = () => {

  const clockSvg = document.querySelector('#clock');
  clockSvg.setAttribute('viewBox', `${-CLOCK_RADIUS} ${-CLOCK_RADIUS} ${CLOCK_RADIUS * DOUBLER} ${CLOCK_RADIUS * DOUBLER}`);

  // Clock background
  clockSvg.appendChild(createSvgElem('circle', {
    r      : CLOCK_RADIUS,
    fill   : CLOCK_FACE_COLOR,
    stroke : 'none',
  }));

  // Clock tick marks
  for (let hour = 0; hour < HOURS_IN_CLOCK; hour++) {
    clockSvg.appendChild(createSvgElem('path', {
      d              : `M0,${CLOCK_TICK_MIN_RADIUS}L0,${CLOCK_TICK_MAX_RADIUS}`,
      fill           : 'none',
      stroke         : CLOCK_TICK_COLOR,
      'stroke-width' : hour % NUM_CLOCK_MAJOR_HOURS === 0 ? CLOCK_MAJOR_TICK_WIDTH : CLOCK_MINOR_TICK_WIDTH,
      transform      : `rotate(${DEGS_IN_CIRCLE * hour / HOURS_IN_CLOCK})`,
    }));
  }

  // Clock hour hand
  const HOUR_HAND_HALF_WIDTH = CLOCK_HOUR_HAND_WIDTH / DOUBLER;
  HourHand = clockSvg.appendChild(createSvgElem('path', {
    d      : `M0,${CLOCK_HAND_REVERSE_RADIUS}L${-HOUR_HAND_HALF_WIDTH},0L0,${-CLOCK_HOUR_HAND_RADIUS}L${HOUR_HAND_HALF_WIDTH},0Z`,
    fill   : CLOCK_HAND_COLOR,
    stroke : 'none',
  }));

  // Clock minute hand
  const MINUTE_HAND_HALF_WIDTH = CLOCK_MINUTE_HAND_WIDTH / DOUBLER;
  MinuteHand = clockSvg.appendChild(createSvgElem('path', {
    d      : `M0,${CLOCK_HAND_REVERSE_RADIUS}L${-MINUTE_HAND_HALF_WIDTH},0L0,${-CLOCK_MINUTE_HAND_RADIUS}L${MINUTE_HAND_HALF_WIDTH},0Z`,
    fill   : CLOCK_HAND_COLOR,
    stroke : 'none',
  }));
};

const updateClock = (timestamp) => {

  const timeDelta = timestamp - (MIN_TIMESTAMP - PH_TZ_OFFSET * SECS_IN_HOUR);

  const hourAngle = timeDelta / SECS_IN_12_HOURS * DEGS_IN_CIRCLE;
  HourHand.setAttribute('transform', `rotate(${hourAngle})`);

  const minuteAngle = (timeDelta % SECS_IN_HOUR) / SECS_IN_HOUR * DEGS_IN_CIRCLE;
  MinuteHand.setAttribute('transform', `rotate(${minuteAngle})`);
};

const drawGpx = (teamInfo) => {

  let hasStarted;
  let firstRecord = teamInfo.track[0];
  let finalXY;

  // Draw portion of track between maxTime - TIMESTAMP_DELTA and maxTime
  for (const record of teamInfo.track) {
    const [timestamp, x, y] = record;
    if (timestamp < TimestampIter - TIMESTAMP_DELTA) {
      firstRecord = record;
    }
    else if (timestamp <= TimestampIter) {
      if (!hasStarted) {
        hasStarted = true;
        TrackCtx.beginPath();
        TrackCtx.moveTo(x, y);
      }
      TrackCtx.lineTo(x, y);

      finalXY = `${x},${y}`;
    }
    else break;
  }
  if (hasStarted) {
    TrackCtx.strokeStyle = teamInfo.color;
    TrackCtx.stroke();
  }
  else {
    const [, x, y] = firstRecord;
    finalXY = `${x},${y}`;
  }

  // Update position circle
  teamInfo.posCircle.setAttribute('transform', `translate(${finalXY})`);
};

const drawFrame = () => {

  updateClock(TimestampIter);

  for (const info of Object.values(TeamInfo)) drawGpx(info);

  if (TimestampIter < MAX_TIMESTAMP) {
    TimestampIter += TIMESTAMP_DELTA;
    if (IsPlaying) requestAnimationFrame(drawFrame);
  }
  else {
    pause();
  }
};

const play = () => {
  if (!DataIsReady || IsPlaying) return;
  if (TimestampIter >= MAX_TIMESTAMP) reset();
  IsPlaying = true;
  PlayPauseBtn.className = 'pause';
  PlayPauseBtn.setAttribute('title', 'Pause');
  PlayPauseBtn.setAttribute('aria-label', 'Pause');
  requestAnimationFrame(drawFrame);
};

const pause = () => {
  IsPlaying = false;
  PlayPauseBtn.className = 'play';
  PlayPauseBtn.setAttribute('title', 'Play');
  PlayPauseBtn.setAttribute('aria-label', 'Play');
};

const reset = () => {
  TimestampIter = MIN_TIMESTAMP;
  updateClock(MIN_TIMESTAMP);
  TrackCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (const info of Object.values(TeamInfo)) drawGpx(info);
};

// ----------------------------------------
// MAIN PROCESS

window.addEventListener('resize', fitToViewport);
window.addEventListener('orientationchange', fitToViewport);
PlayPauseBtn.addEventListener('click', () => { (IsPlaying ? pause : play)(); });
ResetBtn.addEventListener('click', reset);

TrackCtx.lineWidth = TRACK_WIDTH;
TrackCtx.lineCap = 'round';
TrackCtx.lineJoin = 'round';

fitToViewport();
renderBaseMap();
createClock();
updateClock(MIN_TIMESTAMP);

Promise.all(
  Object.keys(TeamInfo).map((colorName) => getJson(`${colorName}.json`).then(data => {
    TeamInfo[colorName].track = processRawData(data);
  }))
).then(() => {

  DataIsReady = true;
  PlayPauseBtn.disabled = false;
  ResetBtn.disabled = false;
  reset();

  setTimeout(play, INITIAL_DELAY);
});
