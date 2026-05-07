import { CURRICULUM_DATA, SUBJECTS_LIST } from './constants.js';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initLenis();
  initScrollNavbar();
  handleRouting();
  initAudio();
});

window.addEventListener('hashchange', () => {
  closePreview();
  handleRouting();
});

// --- Audio Logic ---
let buttonSound, exitSound;

function initAudio() {
  buttonSound = new Audio('./SFX/CLICK.mp3');
  exitSound = new Audio('./SFX/EXIT.mp3');

  document.addEventListener('click', (e) => {
    const target = e.target.closest('a, button, [role="button"]');
    if (!target) return;

    // Check if it's a back/exit button
    const isExit = target.innerText.toLowerCase().includes('back') || 
                   target.innerText.toLowerCase().includes('exit') ||
                   target.querySelector('[data-lucide="arrow-left"]');
    
    if (isExit) {
      exitSound.currentTime = 0;
      exitSound.play().catch(() => {});
    } else {
      buttonSound.currentTime = 0;
      buttonSound.play().catch(() => {});
    }
  });
}

// --- Lenis Smooth Scroll ---
function initLenis() {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);
}

// --- Navbar Logic ---
function initScrollNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('glass', 'py-4', 'border-b', 'border-white/10');
      navbar.classList.remove('py-6');
    } else {
      navbar.classList.remove('glass', 'py-4', 'border-b', 'border-white/10');
      navbar.classList.add('py-6');
    }
  });
}

// --- Preview Modal ---
// --- Preview Modal Logic ---
let viewerState = {
  zoom: 1,
  page: 1,
  total: 16,
  tool: 'pointer',
  isDrawing: false,
  ctx: null,
  canvas: null,
  lastX: 0,
  lastY: 0,
  objects: [], 
  history: [[]],
  historyIndex: 0,
  
  // Settings
  color: '#00ff88',
  size: 3,
  opacity: 1,
  font: 'JetBrains Mono',
  
  currentStroke: null
};

function saveState() {
  // Truncate history if we were in the middle of undoing
  viewerState.history = viewerState.history.slice(0, viewerState.historyIndex + 1);
  viewerState.history.push(JSON.parse(JSON.stringify(viewerState.objects)));
  viewerState.historyIndex++;
  
  // Cap history
  if (viewerState.history.length > 30) {
    viewerState.history.shift();
    viewerState.historyIndex--;
  }
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  if (btnUndo) {
    btnUndo.disabled = viewerState.historyIndex <= 0;
    btnUndo.classList.toggle('text-white/60', !btnUndo.disabled);
    btnUndo.classList.toggle('text-white/10', btnUndo.disabled);
    // Add a slight glow or scale if needed
    btnUndo.classList.toggle('hover:text-brand-accent', !btnUndo.disabled);
  }
  if (btnRedo) {
    btnRedo.disabled = viewerState.historyIndex >= viewerState.history.length - 1;
    btnRedo.classList.toggle('text-white/60', !btnRedo.disabled);
    btnRedo.classList.toggle('text-white/10', btnRedo.disabled);
    btnRedo.classList.toggle('hover:text-brand-accent', !btnRedo.disabled);
  }
}

function redraw() {
  const { ctx, canvas, objects, zoom } = viewerState;
  if (!ctx || !canvas) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  objects.forEach(obj => {
    if (obj.type === 'stroke') {
      ctx.beginPath();
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = obj.width;
      ctx.globalAlpha = obj.opacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (obj.points.length > 0) {
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for(let i = 1; i < obj.points.length; i++) {
          ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }
        ctx.stroke();
      }
    } else if (obj.type === 'text') {
      ctx.globalAlpha = 1;
      ctx.fillStyle = obj.color;
      ctx.font = `${obj.size}px ${obj.font}`;
      ctx.fillText(obj.text, obj.x, obj.y);
    }
  });
  ctx.globalAlpha = 1;
}

function initViewerControls() {
  const stage = document.getElementById('viewer-stage');
  const canvas = document.getElementById('viewer-canvas');
  const zoomDisplay = document.getElementById('zoom-val');
  const optionsPanel = document.getElementById('tool-options');
  
  viewerState.canvas = canvas;
  viewerState.ctx = canvas.getContext('2d');
  
  const resizeCanvas = () => {
    canvas.width = stage.clientWidth;
    canvas.height = stage.clientHeight * 2;
    redraw();
  };
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Zoom Handler
  const updateZoom = (delta) => {
    viewerState.zoom = Math.min(Math.max(0.5, viewerState.zoom + delta), 2);
    stage.style.transform = `scale(${viewerState.zoom})`;
    zoomDisplay.innerText = `${Math.round(viewerState.zoom * 100)}%`;
  };
  document.getElementById('z-plus')?.addEventListener('click', () => updateZoom(0.1));
  document.getElementById('z-minus')?.addEventListener('click', () => updateZoom(-0.1));

  // History Actions
  document.getElementById('btn-undo')?.addEventListener('click', () => {
    if (viewerState.historyIndex > 0) {
      viewerState.historyIndex--;
      viewerState.objects = JSON.parse(JSON.stringify(viewerState.history[viewerState.historyIndex]));
      redraw();
      updateHistoryButtons();
    }
  });
  document.getElementById('btn-redo')?.addEventListener('click', () => {
    if (viewerState.historyIndex < viewerState.history.length - 1) {
      viewerState.historyIndex++;
      viewerState.objects = JSON.parse(JSON.stringify(viewerState.history[viewerState.historyIndex]));
      redraw();
      updateHistoryButtons();
    }
  });

  // Tool Controls Panel Persistence
  const updateToolOptions = (tool) => {
    optionsPanel.classList.toggle('hidden', tool === 'pointer');
    optionsPanel.classList.toggle('flex', tool !== 'pointer');
    
    document.getElementById('opt-color').style.display = (tool === 'pen' || tool === 'text') ? 'flex' : 'none';
    document.getElementById('opt-size').style.display = (tool === 'pen' || tool === 'eraser') ? 'flex' : 'none';
    document.getElementById('opt-opacity').style.display = (tool === 'pen') ? 'flex' : 'none';
    document.getElementById('opt-font').style.display = (tool === 'text') ? 'flex' : 'none';
  };

  // Tool Settings Listeners
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active', 'ring-2', 'ring-white'));
      dot.classList.add('active', 'ring-2', 'ring-white');
      viewerState.color = dot.dataset.color;
    });
  });

  document.getElementById('size-slider')?.addEventListener('input', (e) => {
    viewerState.size = parseInt(e.target.value);
  });

  document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
    viewerState.opacity = parseFloat(e.target.value);
  });

  document.getElementById('font-select')?.addEventListener('change', (e) => {
    viewerState.font = e.target.value;
  });

  // Tool Selection
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.remove('active', 'bg-brand-accent/10', 'text-brand-accent');
        b.classList.add('text-white/40');
      });
      btn.classList.add('active', 'bg-brand-accent/10', 'text-brand-accent');
      btn.classList.remove('text-white/40');
      
      const tool = btn.dataset.tool;
      viewerState.tool = tool;
      updateToolOptions(tool);
      
      if (tool === 'pointer') {
        canvas.classList.add('pointer-events-none');
        canvas.classList.remove('pointer-events-auto', 'opacity-100');
      } else {
        canvas.classList.remove('pointer-events-none');
        canvas.classList.add('pointer-events-auto', 'opacity-100');
        canvas.style.cursor = tool === 'eraser' ? 'cell' : (tool === 'text' ? 'text' : 'crosshair');
      }
    });
  });

  // Drawing / Interaction logic
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / viewerState.zoom;
    const y = (e.clientY - rect.top) / viewerState.zoom;

    if (viewerState.tool === 'pen') {
      viewerState.isDrawing = true;
      viewerState.currentStroke = {
        type: 'stroke',
        points: [{ x, y }],
        color: viewerState.color,
        width: viewerState.size,
        opacity: viewerState.opacity
      };
      viewerState.objects.push(viewerState.currentStroke);
    } else if (viewerState.tool === 'eraser') {
      viewerState.isDrawing = true;
      handleErase(x, y);
    } else if (viewerState.tool === 'text') {
      addTextInput(e.clientX, e.clientY, x, y);
    }
    
    viewerState.lastX = x;
    viewerState.lastY = y;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!viewerState.isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / viewerState.zoom;
    const y = (e.clientY - rect.top) / viewerState.zoom;

    if (viewerState.tool === 'pen' && viewerState.currentStroke) {
      viewerState.currentStroke.points.push({ x, y });
      redraw();
    } else if (viewerState.tool === 'eraser') {
      handleErase(x, y);
    }
  });

  const handleErase = (ex, ey) => {
    const radius = viewerState.size * 2;
    let changed = false;

    // Erase strokes
    viewerState.objects = viewerState.objects.filter(obj => {
      if (obj.type === 'stroke') {
        const isNear = obj.points.some(p => Math.hypot(p.x - ex, p.y - ey) < radius);
        if (isNear) { changed = true; return false; }
      } else if (obj.type === 'text') {
        const ctx = viewerState.ctx;
        ctx.font = `${obj.size}px ${obj.font}`;
        const metrics = ctx.measureText(obj.text);
        const w = metrics.width;
        const h = obj.size;
        // Simple bounding box check
        if (ex > obj.x && ex < obj.x + w && ey > obj.y - h && ey < obj.y) {
          changed = true; return false;
        }
      }
      return true;
    });

    if (changed) redraw();
  };

  const addTextInput = (screenX, screenY, canvasX, canvasY) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('fixed', 'bg-black/80', 'text-white', 'border', 'border-brand-accent', 'px-2', 'py-1', 'rounded', 'outline-none', 'z-[1000]', 'font-mono');
    input.style.left = `${screenX}px`;
    input.style.top = `${screenY}px`;
    input.style.fontSize = `${20 * viewerState.zoom}px`;
    input.style.color = viewerState.color;
    input.style.fontFamily = viewerState.font === 'serif' ? 'Playfair Display' : (viewerState.font === 'Inter' ? 'Inter' : 'JetBrains Mono');
    document.body.appendChild(input);
    
    setTimeout(() => input.focus(), 10);

    const finishText = () => {
      if (input.value.trim()) {
        viewerState.objects.push({
          type: 'text',
          x: canvasX,
          y: canvasY,
          text: input.value,
          color: viewerState.color,
          font: viewerState.font,
          size: 20
        });
        redraw();
        saveState();
      }
      if (input.parentNode) document.body.removeChild(input);
    };

    input.addEventListener('blur', finishText);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finishText();
      if (e.key === 'Escape') document.body.removeChild(input);
    });
  };

  canvas.addEventListener('mouseup', () => {
    if (viewerState.isDrawing) saveState();
    viewerState.isDrawing = false;
    viewerState.currentStroke = null;
  });
  canvas.addEventListener('mouseleave', () => {
    if (viewerState.isDrawing) saveState();
    viewerState.isDrawing = false;
  });

  // Download logic 
  document.getElementById('btn-download')?.addEventListener('click', () => {
    const originalUrl = document.getElementById('preview-external').href;
    if (originalUrl.includes('drive.google.com')) {
      const fileId = originalUrl.match(/\/d\/(.+?)\//)?.[1];
      if (fileId) {
        window.open(`https://drive.google.com/uc?export=download&id=${fileId}`, '_blank');
      }
    }
  });

  // Re-run lucide icons for any new dynamically added elements
  if (window.lucide) window.lucide.createIcons();
}

window.openPreview = (url, title) => {
  const modal = document.getElementById('preview-modal');
  const iframe = document.getElementById('preview-iframe');
  const previewTitle = document.getElementById('preview-title');
  const previewExternal = document.getElementById('preview-external');
  const loader = document.getElementById('preview-loader');

  // Convert drive links to preview type if possible and add embedded param
  let previewUrl = url;
  if (url.includes('drive.google.com/file/d/')) {
    previewUrl = url.replace('/view', '/preview').replace('/edit', '/preview');
    if (!previewUrl.includes('embedded=true')) {
      previewUrl += (previewUrl.includes('?') ? '&' : '?') + 'embedded=true';
    }
  }

  // Set visual title in the pro sub-header
  previewTitle.innerText = (title || "SkillPoint Document").toUpperCase();
  previewExternal.href = url;
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  
  // Reset viewer stats and history
  viewerState.zoom = 1;
  viewerState.page = 1;
  viewerState.objects = [];
  viewerState.history = [[]];
  viewerState.historyIndex = 0;
  
  const pCurrent = document.getElementById('p-current');
  const stage = document.getElementById('viewer-stage');
  const zoomVal = document.getElementById('zoom-val');
  
  if (pCurrent) pCurrent.innerText = '1';
  if (stage) stage.style.transform = 'scale(1)';
  if (zoomVal) zoomVal.innerText = '100%';
  
  updateHistoryButtons();
  
  // Initialize controls if it's the first time
  if (!window.viewerInitialized) {
    initViewerControls();
    window.viewerInitialized = true;
  }
  
  // Clear canvas overlay
  const canvas = document.getElementById('viewer-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Lock background scroll
  document.body.style.overflow = 'hidden';
  
  // Reset and show loader
  loader.style.display = 'flex';
  loader.style.opacity = '1';
  iframe.src = previewUrl;
  
  iframe.onload = () => {
    // Artificial delay to show the "secure reader" initialization for feel
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
      }, 500);
    }, 800);
  };
};

window.closePreview = () => {
  const modal = document.getElementById('preview-modal');
  const iframe = document.getElementById('preview-iframe');
  
  modal.classList.remove('flex');
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  iframe.src = '';
};

// --- Routing ---
function handleRouting() {
  const hash = window.location.hash || '#/subjects';
  const app = document.getElementById('app');
  app.innerHTML = ''; // Clear current content

  // Simple route matching
  if (hash === '#/' || hash === '#/subjects') renderSubjects();
  else if (hash.startsWith('#/subjects/')) {
    const parts = hash.split('/');
    const subjectId = parts[2];
    const year = parts[3];
    const session = parts[4];
    renderSubjectExplorer(subjectId, year, session);
  }
  else render404();

  // Re-run lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Active Link logic
  document.querySelectorAll('[data-nav-link]').forEach(link => {
    const target = link.getAttribute('data-nav-link');
    if (hash === `#${target}` || (target !== '/' && hash.startsWith(`#${target}`))) {
      link.classList.add('bg-brand-accent/20', 'text-brand-accent');
    } else {
      link.classList.remove('bg-brand-accent/20', 'text-brand-accent');
    }
  });

  window.scrollTo(0, 0);
}

// --- Page Renderers ---

function renderSubjects() {
  const app = document.getElementById('app');
  
  // Separate subjects by category
  const categories = {
    'IGCSE': SUBJECTS_LIST.filter(s => s.category === 'IGCSE'),
    'AS Level (A1)': SUBJECTS_LIST.filter(s => s.category === 'AS Level (A1)')
  };

  app.innerHTML = `
    <div class="min-h-screen pt-32 pb-20 px-6">
      <div class="max-w-7xl mx-auto">
        <div class="mb-16">
          <span class="text-brand-accent font-mono text-sm uppercase tracking-[0.3em] mb-4 block">Knowledge Base</span>
          <h1 class="text-6xl font-bold tracking-tighter">Subject <span class="text-gradient">Explorer</span></h1>
        </div>

        ${Object.keys(categories).map(cat => `
          <div class="mb-20">
            <h2 class="text-3xl font-bold mb-10 flex items-center gap-4 text-white/40 italic font-serif">
              <span class="w-12 h-[1px] bg-white/10"></span> ${cat}
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${categories[cat].map(subject => `
                <a href="#/subjects/${subject.id}" 
                   class="group p-8 glass rounded-3xl border border-white/5 hover:border-brand-accent/50 transition-all duration-500 relative overflow-hidden">
                  <div class="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 blur-3xl group-hover:bg-brand-accent/10 transition-all"></div>
                  
                  <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 border border-white/10">
                    <i data-lucide="${subject.icon}" class="text-brand-accent w-8 h-8"></i>
                  </div>

                  <div>
                    <span class="text-xs font-mono text-brand-accent/60 uppercase tracking-widest mb-2 block">${subject.category} • ${subject.code}</span>
                    <h3 class="text-3xl font-bold mb-4">${subject.title}</h3>
                    <div class="flex items-center gap-2 text-white/30 text-sm font-medium">
                      Explore Resources <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-2 transition-transform"></i>
                    </div>
                  </div>
                </a>
              `).join('')}
            </div>
          </div>
        `).join('')}

        <div class="mt-20 pt-10 border-t border-white/5 text-center">
          <p class="text-white/30 text-sm font-medium tracking-wide italic">
             If you cannot find your subject, please be patient as we're constantly updating the site.
          </p>
        </div>
      </div>
    </div>
  `;
}

function renderSubjectExplorer(subjectId, year, session) {
  const subject = CURRICULUM_DATA[subjectId];
  const app = document.getElementById('app');

  if (!subject) {
    render404();
    return;
  }

  app.innerHTML = `
    <div class="min-h-screen pt-32 pb-20 px-6">
      <div class="max-w-7xl mx-auto">
        <!-- Explorer Header -->
        <div class="mb-16">
          <a href="#/subjects" class="inline-flex items-center gap-2 text-white/30 hover:text-brand-accent transition-colors mb-6 group">
            <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform"></i> Back to all subjects
          </a>
          <div class="flex items-center gap-4 mb-4">
             <span class="px-3 py-1 bg-brand-accent/10 text-brand-accent text-xs font-mono border border-brand-accent/20 rounded-full">${subject.category}</span>
             <span class="text-white/30 font-mono text-xs">${subject.code}</span>
          </div>
          <h1 class="text-7xl font-bold tracking-tighter">${subject.title}</h1>
          ${year ? `
            <div class="flex items-center gap-3 mt-4 text-2xl font-serif italic text-white/40">
              <span>Past Papers</span>
              <i data-lucide="chevron-right" class="w-5 h-5"></i>
              <span class="text-white group-hover:text-brand-accent transition-colors">${year}</span>
              ${session ? `
                <i data-lucide="chevron-right" class="w-5 h-5"></i>
                <span class="text-brand-accent">${decodeURIComponent(session)}</span>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Section Content -->
        <div id="explorer-content" class="min-h-[400px]">
           ${renderYearSessionContent(subject, year, session)}
        </div>
      </div>
    </div>
  `;
  
  if (window.lucide) window.lucide.createIcons();
}

function renderYearSessionContent(subject, year, session) {
  const pastPapers = subject.pastPapers || {};
  
  // 1. Show Years if no year selected
  if (!year) {
    const years = Object.keys(pastPapers).sort((a, b) => b - a);
    if (years.length === 0) return renderEmptyState('No past papers available for this subject yet.');

    return `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        ${years.map(y => `
          <a href="#/subjects/${subject.id}/${y}" 
             class="group p-8 glass rounded-2xl border border-white/5 hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all text-center">
            <span class="text-3xl font-bold text-white group-hover:text-brand-accent transition-colors">${y}</span>
            <div class="text-[10px] uppercase tracking-widest text-white/20 mt-2">View Papers</div>
          </a>
        `).join('')}
      </div>
    `;
  }

  // 2. Show Sessions if year selected but no session
  if (!session) {
    const sessions = Object.keys(pastPapers[year] || {}).sort();
    if (sessions.length === 0) return renderEmptyState(`No papers found for ${year}.`);

    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        ${sessions.map(s => `
          <a href="#/subjects/${subject.id}/${year}/${encodeURIComponent(s)}" 
             class="group p-10 glass rounded-3xl border border-white/5 hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all">
            <div class="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-white/10">
              <i data-lucide="calendar" class="text-brand-accent w-6 h-6"></i>
            </div>
            <h3 class="text-2xl font-bold text-white group-hover:text-brand-accent transition-colors">${s}</h3>
            <p class="text-white/30 text-sm mt-2">Exam series for ${year}</p>
          </a>
        `).join('')}
      </div>
    `;
  }

  // 3. Show Papers for selected year and session
  const papers = pastPapers[year]?.[decodeURIComponent(session)] || [];
  if (papers.length === 0) return renderEmptyState(`No papers found for ${year} ${decodeURIComponent(session)}.`);

  return `
    <div class="space-y-3">
      ${papers.map(paper => `
        <button onclick="openPreview('${paper.url}', '${paper.name}')" 
           class="w-full flex items-center justify-between p-5 glass rounded-2xl border border-white/5 hover:border-brand-accent/30 transition-all group text-left">
          <div class="flex items-center gap-5">
            <div class="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-brand-accent/10 transition-colors border border-white/10">
              <i data-lucide="file-text" class="text-brand-accent w-6 h-6"></i>
            </div>
            <div>
              <h4 class="font-bold text-lg text-white/90 group-hover:text-brand-accent transition-colors">${paper.name}</h4>
              <span class="text-xs text-white/30 uppercase tracking-tighter">${paper.name.includes('ms') ? 'Mark Scheme' : (paper.name.includes('qp') ? 'Question Paper' : 'Document')}</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs font-bold text-white/20 group-hover:text-white/40 transition-colors hidden sm:block">Preview</span>
            <i data-lucide="maximize-2" class="w-5 h-5 text-white/20 group-hover:text-brand-accent transition-all group-hover:scale-110"></i>
          </div>
        </button>
      `).join('')}
    </div>
  `;
}

function renderEmptyState(message) {
  return `
    <div class="flex flex-col items-center justify-center py-32 text-center glass rounded-[3rem] border-dashed border-2 border-white/10">
      <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 opacity-20">
        <i data-lucide="help-circle" class="w-10 h-10"></i>
      </div>
      <p class="text-white/30 text-xl italic font-serif">${message}</p>
    </div>
  `;
}

function render404() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="text-center">
        <h1 class="text-9xl font-bold text-brand-accent mb-4">404</h1>
        <p class="text-2xl text-white/40 mb-8 font-serif italic">The page you're looking for has vanished into thin air.</p>
        <a href="#/subjects" class="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-brand-accent transition-colors">Return Home</a>
      </div>
    </div>
  `;
}
