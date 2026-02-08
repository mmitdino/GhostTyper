// DOM Elements
const shortcutList = document.getElementById('shortcutList');
const emptyState = document.getElementById('emptyState');
const modalOverlay = document.getElementById('modalOverlay');
const shortcutForm = document.getElementById('shortcutForm');
const triggerInput = document.getElementById('trigger');
const expansionInput = document.getElementById('expansion');
const searchInput = document.getElementById('searchInput');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const modalTitle = document.getElementById('modalTitle');
const submitBtn = document.getElementById('submitBtn');

// Stats elements (shortcuts section)
const totalShortcutsEl = document.getElementById('totalShortcuts');
const totalExpansionsEl = document.getElementById('totalExpansions');
const charsSavedEl = document.getElementById('charsSaved');

// Stats elements (statistics section)
const statTotalShortcutsEl = document.getElementById('statTotalShortcuts');
const statTotalExpansionsEl = document.getElementById('statTotalExpansions');
const statCharsSavedEl = document.getElementById('statCharsSaved');
const statTimeSavedEl = document.getElementById('statTimeSaved');

// Sections
const sections = {
    shortcuts: document.getElementById('shortcutsSection'),
    stats: document.getElementById('statsSection'),
    defaults: document.getElementById('defaultsSection'),
    communication: document.getElementById('communicationSection'),
    appShortcuts: document.getElementById('appShortcutsSection'),
    settings: document.getElementById('settingsSection')
};

// State
let shortcuts = [];
let editingTrigger = null;
let stats = {
    expansions: 0,
    charsSaved: 0
};
let settings = {
    startWithWindows: false,
    startMinimized: false,
    playSound: true,
    caseSensitive: false
};

// Initialize
async function init() {
    shortcuts = await window.ghostAPI.getShortcuts();
    stats = await window.ghostAPI.getStats();
    settings = await window.ghostAPI.getSettings();
    renderShortcuts(shortcuts);
    updateStats();
    applySettingsToUI();
    setupNavigation();
    setupSettings();
}

// Setup navigation
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            
            // Update active nav
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show correct section
            Object.keys(sections).forEach(key => {
                sections[key].classList.remove('active');
            });
            sections[section].classList.add('active');
            
            // Update stats when switching to stats section
            if (section === 'stats') {
                updateStats();
            }
        });
    });
}

// Setup settings
function setupSettings() {
    // Export
    document.getElementById('exportBtn').addEventListener('click', async () => {
        const data = JSON.stringify(shortcuts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ghost-typer-shortcuts.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Shortcuts exported!');
    });

    // Import
    document.getElementById('importBtn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const text = await file.text();
                try {
                    const imported = JSON.parse(text);
                    if (Array.isArray(imported)) {
                        for (const s of imported) {
                            if (s.trigger && s.expansion) {
                                if (!shortcuts.find(existing => existing.trigger === s.trigger)) {
                                    await window.ghostAPI.addShortcut(s);
                                }
                            }
                        }
                        showToast(`Imported ${imported.length} shortcuts!`);
                    }
                } catch (err) {
                    alert('Invalid JSON file');
                }
            }
        };
        input.click();
    });

    // Reset
    document.getElementById('resetBtn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete ALL shortcuts? This cannot be undone!')) {
            for (const s of [...shortcuts]) {
                await window.ghostAPI.deleteShortcut(s.trigger);
            }
            showToast('All data reset');
        }
    });

    // Toggle Listeners
    const toggles = {
        'startWithWindows': 'startWithWindows',
        'startMinimized': 'startMinimized',
        'playSound': 'playSound',
        'caseSensitive': 'caseSensitive'
    };

    Object.keys(toggles).forEach(key => {
        const el = document.getElementById(toggles[key]);
        if (el) {
            el.addEventListener('change', async (e) => {
                settings[key] = e.target.checked;
                await window.ghostAPI.updateSettings(settings);
                showToast('Settings saved');
            });
        }
    });
}

function applySettingsToUI() {
    const toggles = {
        'startWithWindows': 'startWithWindows',
        'startMinimized': 'startMinimized',
        'playSound': 'playSound',
        'caseSensitive': 'caseSensitive'
    };

    Object.keys(toggles).forEach(key => {
        const el = document.getElementById(toggles[key]);
        if (el) {
            el.checked = settings[key];
        }
    });
}

// Render shortcuts
function renderShortcuts(list) {
    if (list.length === 0) {
        shortcutList.style.display = 'none';
        emptyState.classList.add('show');
        return;
    }

    shortcutList.style.display = 'grid';
    emptyState.classList.remove('show');

    shortcutList.innerHTML = list.map(s => `
        <div class="shortcut-card" data-trigger="${escapeHtml(s.trigger)}">
            <div class="shortcut-header">
                <span class="shortcut-trigger">${escapeHtml(s.trigger)}</span>
                <div class="shortcut-actions">
                    <button class="btn-icon edit" title="Edit shortcut">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon delete" title="Delete shortcut">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="shortcut-expansion">${escapeHtml(s.expansion)}</div>
        </div>
    `).join('');

    // Attach event listeners
    document.querySelectorAll('.shortcut-card .edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.shortcut-card');
            const trigger = card.dataset.trigger;
            openEditModal(trigger);
        });
    });

    document.querySelectorAll('.shortcut-card .delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const card = e.target.closest('.shortcut-card');
            const trigger = card.dataset.trigger;
            if (confirm(`Delete shortcut "${trigger}"?`)) {
                await window.ghostAPI.deleteShortcut(trigger);
                showToast('Shortcut deleted');
            }
        });
    });
}

// Update stats
function updateStats() {
    // Use actual tracked stats from main process
    const charsSaved = stats.charsSaved || 0;
    
    // Mini stats
    totalShortcutsEl.textContent = shortcuts.length;
    totalExpansionsEl.textContent = stats.expansions;
    charsSavedEl.textContent = charsSaved;
    
    // Big stats
    statTotalShortcutsEl.textContent = shortcuts.length;
    statTotalExpansionsEl.textContent = stats.expansions;
    statCharsSavedEl.textContent = charsSaved;
    
    // Calculate time saved (0.2 seconds per character)
    const timeSaved = charsSaved * 0.2;
    if (timeSaved < 60) {
        statTimeSavedEl.textContent = `${Math.round(timeSaved)}s`;
    } else if (timeSaved < 3600) {
        statTimeSavedEl.textContent = `${Math.round(timeSaved / 60)}m`;
    } else {
        statTimeSavedEl.textContent = `${(timeSaved / 3600).toFixed(1)}h`;
    }
}

// Open modal for adding
function openAddModal() {
    editingTrigger = null;
    modalTitle.textContent = 'Add New Shortcut';
    submitBtn.textContent = 'Add Shortcut';
    triggerInput.value = '';
    expansionInput.value = '';
    triggerInput.disabled = false;
    modalOverlay.classList.add('active');
    triggerInput.focus();
}

// Open modal for editing
function openEditModal(trigger) {
    const shortcut = shortcuts.find(s => s.trigger === trigger);
    if (!shortcut) return;

    editingTrigger = trigger;
    modalTitle.textContent = 'Edit Shortcut';
    submitBtn.textContent = 'Save Changes';
    // Remove the ; prefix for display since it's shown separately
    triggerInput.value = shortcut.trigger.replace(/^;/, '');
    expansionInput.value = shortcut.expansion;
    triggerInput.disabled = true; // Can't change trigger when editing
    modalOverlay.classList.add('active');
    expansionInput.focus();
}

// Close modal
function closeModal() {
    modalOverlay.classList.remove('active');
    shortcutForm.reset();
    triggerInput.disabled = false; // Ensure enabled for next time
    editingTrigger = null;
}

// Show toast notification
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Play premium expansion sound
function playExpansionSound() {
    if (!settings.playSound) return;
    
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create multiple oscillators for a richer, more "premium" sound
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // High-pitched chime component
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.1);

        // Softer body component
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.15);

        // Volume (increased as requested)
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.2);
        osc2.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
        console.error('Error playing sound:', e);
    }
}

// Search functionality
function filterShortcuts(query) {
    if (!query) {
        renderShortcuts(shortcuts);
        return;
    }
    
    const filtered = shortcuts.filter(s => 
        s.trigger.toLowerCase().includes(query.toLowerCase()) ||
        s.expansion.toLowerCase().includes(query.toLowerCase())
    );
    renderShortcuts(filtered);
}

// Event Listeners
document.getElementById('openAddModal').addEventListener('click', openAddModal);
document.getElementById('emptyAddBtn').addEventListener('click', openAddModal);
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

shortcutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let trigger = triggerInput.value.trim();
    
    // Always add ; prefix if not present
    if (!trigger.startsWith(';')) {
        trigger = ';' + trigger;
    }
    
    const expansion = expansionInput.value;

    if (editingTrigger) {
        // Update existing
        await window.ghostAPI.updateShortcut(editingTrigger, { trigger: editingTrigger, expansion });
        showToast('Shortcut updated');
    } else {
        // Check for duplicates
        if (shortcuts.find(s => s.trigger === trigger)) {
            alert('This trigger already exists!');
            return;
        }
        await window.ghostAPI.addShortcut({ trigger, expansion });
        showToast('Shortcut added');
    }
    
    closeModal();
});

searchInput.addEventListener('input', (e) => {
    filterShortcuts(e.target.value);
});

// Listen for updates from main process
window.ghostAPI.onShortcutsUpdated((updatedShortcuts) => {
    shortcuts = updatedShortcuts;
    renderShortcuts(shortcuts);
    updateStats();
});

window.ghostAPI.onStatsUpdated((updatedStats) => {
    stats = updatedStats;
    updateStats();
});

window.ghostAPI.onPlaySound(() => {
    playExpansionSound();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
    }
    // Ctrl+N to add new
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openAddModal();
    }
});

// Initialize app
init();
