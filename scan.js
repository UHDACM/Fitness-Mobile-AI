const scanModeButtons = document.querySelectorAll('[data-scan-mode]');
const scanPanels = document.querySelectorAll('[data-scan-panel]');
const results = document.querySelector('#scan-results');
const barcodeStatus = document.querySelector('#barcode-status');
const plateStatus = document.querySelector('#plate-status');
const video = document.querySelector('#barcode-video');
const cameraWrap = document.querySelector('[data-camera-wrap]');
const cameraButton = document.querySelector('#barcode-camera');
const plateInput = document.querySelector('#plate-photo');
const platePreview = document.querySelector('#plate-preview');
const analyzeButton = document.querySelector('#analyze-plate');
let cameraStream = null;
let cameraFrame = 0;
let zxingControls = null;
let scanning = false;
let selectedPhoto = null;
let foods = [];

function scanStatus(element, message) { element.textContent = message; }
function stopCamera() {
  scanning = false;
  cancelAnimationFrame(cameraFrame);
  zxingControls?.stop();
  zxingControls = null;
  cameraStream?.getTracks().forEach(track => track.stop());
  cameraStream = null;
  video.srcObject = null;
  cameraWrap.hidden = true;
  cameraButton.textContent = 'Start barcode camera';
}

scanModeButtons.forEach(button => button.addEventListener('click', () => {
  const mode = button.dataset.scanMode;
  stopCamera();
  scanModeButtons.forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('is-selected', active);
    tab.setAttribute('aria-selected', String(active));
  });
  scanPanels.forEach(panel => panel.hidden = panel.dataset.scanPanel !== mode);
  results.hidden = true;
}));
document.querySelectorAll('[data-tab], [data-nav-target]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.tab !== 'scan' && button.dataset.navTarget !== 'scan') stopCamera();
}));
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });

async function lookUpBarcode(code, statusElement = barcodeStatus) {
  stopCamera();
  const normalized = code.replace(/\D/g, '');
  if (!/^\d{8,14}$/.test(normalized)) { scanStatus(barcodeStatus, 'Enter an 8 to 14 digit barcode.'); return; }
  document.querySelector('#barcode-input').value = normalized;
  results.hidden = true;
  scanStatus(statusElement, 'Looking up food…');
  try {
    const response = await fetch(`/api/food/${normalized}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Food lookup failed.');
    foods = [{...data.food, grams: data.food.servingAmount || 100}];
    renderResults(data.food.name, 'Label data · Open Food Facts', 'barcode');
    scanStatus(statusElement, 'Food found. Adjust the amount above.');
  } catch (error) { scanStatus(statusElement, error.message || 'Food lookup failed.'); }
}

const searchPanel = document.querySelector('#food-search');
const searchStatus = document.querySelector('#food-search-status');
const searchResults = document.querySelector('#food-search-results');
document.querySelector('#open-food-search').addEventListener('click', event => {
  const opening = searchPanel.hidden;
  searchPanel.hidden = !opening;
  event.currentTarget.setAttribute('aria-expanded', String(opening));
  if (opening) document.querySelector('#food-search-input').focus();
});
document.querySelector('#food-search-form').addEventListener('submit', async event => {
  event.preventDefault();
  const query = document.querySelector('#food-search-input').value.trim();
  if (query.length < 2) { scanStatus(searchStatus, 'Enter at least two characters.'); return; }
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  searchResults.replaceChildren();
  scanStatus(searchStatus, 'Searching foods…');
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search is unavailable.');
    if (!data.products.length) { scanStatus(searchStatus, 'No products found. Try a different name.'); return; }
    scanStatus(searchStatus, 'Select a product to see its nutrition.');
    data.products.forEach(product => {
      const item = document.createElement('button'); item.type = 'button';
      const title = document.createElement('strong'); title.textContent = product.name;
      const detail = document.createElement('small'); detail.textContent = product.brand || 'Brand not listed';
      item.append(title, detail); item.addEventListener('click', () => lookUpBarcode(product.code, searchStatus));
      searchResults.append(item);
    });
  } catch (error) { scanStatus(searchStatus, error.message || 'Search failed.'); }
  finally { button.disabled = false; }
});

document.querySelector('#barcode-form').addEventListener('submit', event => {
  event.preventDefault();
  lookUpBarcode(document.querySelector('#barcode-input').value);
});

cameraButton.addEventListener('click', async () => {
  if (cameraStream) { stopCamera(); return; }
  if (!navigator.mediaDevices?.getUserMedia) { scanStatus(barcodeStatus, 'Camera unavailable here. Enter the barcode number instead.'); return; }
  if (!('BarcodeDetector' in window)) {
    if (!window.ZXingBrowser?.BrowserMultiFormatReader) { scanStatus(barcodeStatus, 'Camera barcode reading is unavailable. Enter the number below.'); return; }
    try {
      cameraWrap.hidden = false;
      cameraButton.textContent = 'Stop camera';
      scanStatus(barcodeStatus, 'Hold the barcode inside the frame.');
      const reader = new ZXingBrowser.BrowserMultiFormatReader();
      zxingControls = await reader.decodeFromVideoDevice(undefined, video, result => {
        const value = result?.getText?.();
        if (value && /^\d{8,14}$/.test(value)) lookUpBarcode(value);
      });
    } catch (error) { stopCamera(); scanStatus(barcodeStatus, error.message || 'Camera access failed. Enter the barcode number instead.'); }
    return;
  }
  try {
    const formats = await BarcodeDetector.getSupportedFormats();
    const supported = ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(format => formats.includes(format));
    if (!supported.length) throw new Error('Barcode reading is unavailable in this browser. Enter the number below.');
    const detector = new BarcodeDetector({formats: supported});
    cameraStream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
    video.srcObject = cameraStream;
    await video.play();
    cameraWrap.hidden = false;
    cameraButton.textContent = 'Stop camera';
    scanStatus(barcodeStatus, 'Hold the barcode inside the frame.');
    scanning = true;
    let lastScan = 0;
    const tick = async now => {
      if (!scanning) return;
      if (now - lastScan > 350 && video.readyState >= 2) {
        lastScan = now;
        try {
          const codes = await detector.detect(video);
          const match = codes.find(item => /^\d{8,14}$/.test(item.rawValue || ''));
          if (match) { lookUpBarcode(match.rawValue); return; }
        } catch { /* Keep the camera running for the next frame. */ }
      }
      cameraFrame = requestAnimationFrame(tick);
    };
    cameraFrame = requestAnimationFrame(tick);
  } catch (error) { stopCamera(); scanStatus(barcodeStatus, error.message || 'Camera access failed. Enter the barcode number instead.'); }
});

plateInput.addEventListener('change', async () => {
  const file = plateInput.files?.[0];
  selectedPhoto = null;
  analyzeButton.disabled = true;
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    scanStatus(plateStatus, 'Choose a JPG, PNG, or WebP image under 8 MB.'); return;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    selectedPhoto = canvas.toDataURL('image/jpeg', .82);
    platePreview.src = selectedPhoto;
    platePreview.hidden = false;
    analyzeButton.disabled = false;
    results.hidden = true;
    scanStatus(plateStatus, 'Ready to estimate. Check the foods and portions after analysis.');
  } catch { scanStatus(plateStatus, 'Could not read that image. Please choose another photo.'); }
});

analyzeButton.addEventListener('click', async () => {
  if (!selectedPhoto) return;
  analyzeButton.disabled = true;
  results.hidden = true;
  scanStatus(plateStatus, 'Estimating foods and portions…');
  try {
    const response = await fetch('/api/plate', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({image: selectedPhoto})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Plate estimate failed.');
    foods = data.foods.map(food => ({...food, grams: food.grams}));
    if (!foods.length) throw new Error('No food was found in this photo. Try a clearer photo.');
    renderResults('Whole plate estimate', 'Photo estimate · edit the portions', 'plate');
    scanStatus(plateStatus, 'Estimate ready. Review every item before using these numbers.');
  } catch (error) { scanStatus(plateStatus, error.message || 'Plate estimate failed.'); }
  finally { analyzeButton.disabled = false; }
});

const nutrients = ['calories', 'protein', 'carbs', 'fat'];
function safeNumber(value) { return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0; }
function totals() {
  if (foods.some(food => food.grams == null)) return null;
  return foods.reduce((sum, food) => {
    const ratio = safeNumber(food.grams) / 100;
    nutrients.forEach(key => sum[key] += safeNumber(food.per100g[key]) * ratio);
    return sum;
  }, {calories: 0, protein: 0, carbs: 0, fat: 0});
}
function renderTotals() {
  const sum = totals();
  if (!sum) { results.querySelectorAll('[data-total]').forEach(element => { element.textContent = '—'; }); return; }
  const display = value => Number(value.toFixed(1)).toLocaleString();
  results.querySelector('[data-total="calories"]').textContent = `${display(sum.calories)} kcal`;
  for (const key of ['protein', 'carbs', 'fat']) results.querySelector(`[data-total="${key}"]`).textContent = `${display(sum[key])} g`;
}
function renderResults(title, source, kind) {
  results.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'result-heading';
  const label = document.createElement('small'); label.textContent = source;
  const h2 = document.createElement('h2'); h2.textContent = title;
  heading.append(label, h2);
  results.append(heading);
  const summary = document.createElement('div'); summary.className = 'macro-summary';
  for (const [key, labelText] of [['calories', 'Calories'], ['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']]) {
    const item = document.createElement('div');
    const value = document.createElement('strong'); value.dataset.total = key;
    const label = document.createElement('small'); label.textContent = labelText;
    item.append(value, label); summary.append(item);
  }
  results.append(summary);
  const list = document.createElement('div'); list.className = 'food-result-list';
  foods.forEach((food, index) => {
    const row = document.createElement('article');
    const name = document.createElement('strong'); name.textContent = food.name;
    const unit = food.baseUnit || 'g';
    const options = unit === 'ml' ? [['ml', 'Milliliters', 1], ['floz', 'Fluid ounces (US)', 29.5735295625], ['cup', 'Cups (US)', 236.5882365]] : [['g', 'Grams', 1], ['oz', 'Ounces', 28.349523125]];
    if (unit === 'g') options.push(['cup', food.gramsPerCup > 0 ? 'Cups (label)' : 'Cups (enter weight)', food.gramsPerCup || 0]);
    if (food.servingAmount > 0) options.push(['serving', `Serving${food.servingText ? ` (${food.servingText})` : ''}`, food.servingAmount]);
    if (food.packageAmount > 0) options.push(['package', `Whole package${food.packageText ? ` (${food.packageText})` : ''}`, food.packageAmount]);
    const portion = document.createElement('label'); portion.textContent = 'Amount';
    const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.step = 'any'; input.inputMode = 'decimal'; input.value = food.servingAmount ? '1' : String(food.grams); input.setAttribute('aria-label', `${food.name} amount`);
    const unitLabel = document.createElement('label'); unitLabel.textContent = 'Unit';
    const select = document.createElement('select'); select.setAttribute('aria-label', `${food.name} unit`);
    options.forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); });
    if (food.servingAmount) select.value = 'serving';
    const cupLabel = document.createElement('label'); cupLabel.textContent = 'Grams per cup'; cupLabel.hidden = true;
    const cupInput = document.createElement('input'); cupInput.type = 'number'; cupInput.min = '0'; cupInput.step = 'any'; cupInput.inputMode = 'decimal'; cupInput.placeholder = 'From food label'; cupInput.setAttribute('aria-label', `${food.name} grams per cup`); cupLabel.append(cupInput);
    function updatePortion() {
      const customCup = select.value === 'cup' && unit === 'g' && !food.gramsPerCup;
      cupLabel.hidden = !customCup;
      const factor = customCup ? safeNumber(cupInput.value) : options.find(option => option[0] === select.value)[2];
      foods[index].grams = factor > 0 && input.value !== '' ? safeNumber(input.value) * factor : null;
      renderTotals();
    }
    input.addEventListener('input', updatePortion);
    select.addEventListener('change', updatePortion);
    cupInput.addEventListener('input', updatePortion);
    portion.append(input); unitLabel.append(select);
    const detail = document.createElement('small'); detail.textContent = `${Number(safeNumber(food.per100g.calories).toFixed(1))} kcal per 100 ${unit}${food.confidence ? ` · ${food.confidence} confidence` : ''}${unit === 'g' && !food.gramsPerCup ? ' · Cups available when the label provides a cup weight' : ''}`;
    row.append(name, portion, unitLabel, cupLabel, detail); list.append(row);
  });
  results.append(list);
  const note = document.createElement('p'); note.className = 'result-note';
  note.textContent = kind === 'plate' ? 'AI estimates cannot measure hidden ingredients, oils, or portion weight from a photo. Adjust amounts for a better total.' : 'Nutrition data is contributed by the Open Food Facts community. Check the package label for accuracy.';
  results.append(note);
  renderTotals();
  results.hidden = false;
  results.scrollIntoView({behavior: 'smooth', block: 'start'});
}
