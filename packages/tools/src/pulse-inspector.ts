
import { PulseRegistry, type PulseUnit } from '@pulse-js/core';

// --- STYLES & THEME ---
const COLORS = {
  bg: 'rgba(13, 13, 18, 0.96)',
  border: 'rgba(255, 255, 255, 0.1)',
  accent: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
  accentColor: '#00d2ff',
  error: '#ff4b2b',
  success: '#00f260',
  pending: '#fdbb2d',
  text: '#ffffff',
  secondaryText: '#a0a0a0',
  cardBg: 'rgba(255, 255, 255, 0.05)',
  cardHover: 'rgba(255, 255, 255, 0.08)',
  inputBg: 'rgba(0,0,0,0.3)',
};

const ICONS = {
  tree: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12h-4l-3 8-4-16-3 8H2"/></svg>`,
  list: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  chevronRight: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`,
  chevronDown: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`,
  edit: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
};

const STORAGE_KEY = 'pulse-devtools-state';

interface DevToolsState {
  pos: { x: number; y: number };
  isOpen: boolean;
  activeTab: 'inspector' | 'tree';
  expandedNodes: string[]; // For tree view identifiers
}

class PulseInspector extends HTMLElement {
  private shadow: ShadowRoot;
  private units: PulseUnit[] = [];
  
  // State
  private state: DevToolsState = {
    pos: { x: window.innerWidth - 360, y: 20 },
    isOpen: true,
    activeTab: 'inspector',
    expandedNodes: [],
  };

  private isDragging = false;
  private offset = { x: 0, y: 0 };
  private editingUnit: PulseUnit | null = null;
  private editValue = '';
  
  private unsubscribeRegistry?: () => void;
  private unitSubscriptions = new Map<PulseUnit, () => void>();

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.loadState();
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.refreshUnits();
    
    this.unsubscribeRegistry = PulseRegistry.onRegister(() => {
      this.refreshUnits();
    });

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('resize', this.handleResize);
  }

  disconnectedCallback() {
    if (this.unsubscribeRegistry) this.unsubscribeRegistry();
    this.unitSubscriptions.forEach(unsub => unsub());
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('resize', this.handleResize);
  }

  private loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      }
    } catch (e) {}
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {}
  }

  private refreshUnits() {
    this.units = PulseRegistry.getAll();
    this.updateUnitSubscriptions();
    this.render();
  }

  private updateUnitSubscriptions() {
    this.unitSubscriptions.forEach(unsub => unsub());
    this.unitSubscriptions.clear();

    this.units.forEach(unit => {
      const unsub = unit.subscribe(() => {
        // If we heavily render on every update it might lag, but for devtools it's okay
        // We could debounce this in the future
        this.render();
      });
      this.unitSubscriptions.set(unit, unsub);
    });
  }

  private setupListeners() {
    // We bind once, render re-attaches dynamic listeners
    this.shadow.addEventListener('mousedown', this.handleMouseDown as EventListener);
    this.shadow.addEventListener('click', this.handleClick as EventListener);
    this.shadow.addEventListener('submit', this.handleEditSubmit as EventListener);
    this.shadow.addEventListener('keydown', this.handleEditKeydown as EventListener);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      this.toggle();
    }
  }

  private handleResize = () => {
    // Keep within bounds
    const maxW = window.innerWidth - (this.state.isOpen ? 400 : 120);
    const maxH = window.innerHeight - (this.state.isOpen ? 500 : 45);
    this.state.pos.x = Math.max(0, Math.min(maxW, this.state.pos.x));
    this.state.pos.y = Math.max(0, Math.min(maxH, this.state.pos.y));
    this.render();
  }

  private toggle() {
    this.state.isOpen = !this.state.isOpen;
    this.saveState();
    this.render();
  }

  // --- DRAG LOGIC ---
  private totalDragDistance = 0;

  private handleMouseDown = (e: Event) => {
    const me = e as MouseEvent;
    const target = me.target as HTMLElement;
    const isHeader = target.closest('.header') || target.classList.contains('toggle-btn');
    const isClose = target.closest('#close');
    
    // Don't drag if clicking buttons
    if (!isHeader || isClose) return;

    this.isDragging = true;
    this.totalDragDistance = 0;
    this.offset = {
      x: me.clientX - this.state.pos.x,
      y: me.clientY - this.state.pos.y
    };

    const move = (ev: MouseEvent) => {
      if (!this.isDragging) return;
      ev.preventDefault();

      // Track distance
      this.totalDragDistance += Math.abs(ev.movementX) + Math.abs(ev.movementY);
      
      const width = this.state.isOpen ? 400 : 140;
      const height = this.state.isOpen ? 600 : 48;
      
      this.state.pos = {
        x: Math.max(0, Math.min(window.innerWidth - width, ev.clientX - this.offset.x)),
        y: Math.max(0, Math.min(window.innerHeight - height, ev.clientY - this.offset.y))
      };

      const container = this.shadow.querySelector('.container') as HTMLElement;
      if (container) {
        container.style.left = `${this.state.pos.x}px`;
        container.style.top = `${this.state.pos.y}px`;
      }
    };

    const up = () => {
      this.isDragging = false;
      this.saveState();
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  // --- INTERACTION LOGIC ---
  private handleClick = (e: Event) => {
    // If we dragged more than a few pixels, ignore the click (it was a drag)
    if (this.totalDragDistance > 5) {
      this.totalDragDistance = 0;
      return;
    }

    const target = e.target as HTMLElement;

    // Toggle Open/Close
    if (target.id === 'toggle' || target.closest('#close')) {
      this.toggle();
      return;
    }

    // Tabs
    const tabEl = target.closest('.tab-btn');
    if (tabEl) {
      const tab = tabEl.getAttribute('data-tab') as 'inspector' | 'tree';
      if (tab) {
        this.state.activeTab = tab;
        this.saveState();
        this.render();
      }
      return;
    }

    // Edit Source
    const valueEl = target.closest('.editable-value');
    if (valueEl) {
      const name = valueEl.getAttribute('data-name');
      const unit = this.units.find(u => (u as any)._name === name);
      if (unit && !('state' in unit)) { // Only sources
        this.editingUnit = unit;
        this.editValue = JSON.stringify((unit as any)());
        this.render();
        // Focus input
        requestAnimationFrame(() => {
          const input = this.shadow.querySelector('.edit-input') as HTMLInputElement;
          if (input) {
            input.focus();
            input.select();
          }
        });
      }
      return;
    }
    
    // Stop editing if clicked outside
    if (this.editingUnit && !target.closest('.edit-form')) {
      this.editingUnit = null;
      this.render();
    }

    // Tree Expansion
    const treeNode = target.closest('.tree-toggle');
    if (treeNode) {
      e.stopPropagation();
      const id = treeNode.getAttribute('data-id');
      if (id) {
        if (this.state.expandedNodes.includes(id)) {
          this.state.expandedNodes = this.state.expandedNodes.filter(n => n !== id);
        } else {
          this.state.expandedNodes.push(id);
        }
        this.saveState();
        this.render();
      }
    }
  }

  private handleEditSubmit = (e: Event) => {
    e.preventDefault();
    if (!this.editingUnit) return;
    
    try {
      const form = e.target as HTMLFormElement;
      const input = form.querySelector('input') as HTMLInputElement;
      let val: any = input.value;
      
      // Attempt generic parsing
      try {
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (val === 'null') val = null;
        else if (val === 'undefined') val = undefined;
        else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
        else if (val.startsWith('{') || val.startsWith('[')) val = JSON.parse(val);
      } catch (err) {
        // Fallback to string
      }

      (this.editingUnit as any).set(val);
      this.editingUnit = null;
      this.render();
    } catch (err) {
      console.error('Pulse DevTools: Failed to update value', err);
    }
  }

  private handleEditKeydown = (e: KeyboardEvent) => {
    if (this.editingUnit && e.key === 'Escape') {
      this.editingUnit = null;
      this.render();
    }
  }

  // --- RENDERERS ---

  private render() {
    // Clean up if closed
    if (!this.state.isOpen) {
      this.shadow.innerHTML = this.getStyles() + `
        <div class="container" style="left: ${this.state.pos.x}px; top: ${this.state.pos.y}px">
          <div class="glass" style="border-radius:30px; width:auto;">
            <div class="toggle-btn" id="toggle">
              <div class="dot"></div>
              Pulse (${this.units.length})
            </div>
          </div>
        </div>
      `;
      return;
    }

    this.shadow.innerHTML = this.getStyles() + `
      <div class="container" style="left: ${this.state.pos.x}px; top: ${this.state.pos.y}px">
        <div class="glass">
          
          <div class="header">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="dot" style="width:10px;height:10px"></div>
              <strong style="font-size:14px;letter-spacing:0.5px">PULSE</strong>
              <span style="font-size:10px;opacity:0.5;margin-top:2px">v0.2.0</span>
            </div>
            <div id="close" class="icon-btn">×</div>
          </div>

          <div class="tabs">
            <div class="tab-btn ${this.state.activeTab === 'inspector' ? 'active' : ''}" data-tab="inspector">
              ${ICONS.list} Inspector
            </div>
            <div class="tab-btn ${this.state.activeTab === 'tree' ? 'active' : ''}" data-tab="tree">
              ${ICONS.tree} Pulse Tree
            </div>
          </div>

          <div class="content">
            ${this.state.activeTab === 'inspector' 
              ? this.renderInspector() 
              : this.renderTree()
            }
          </div>

        </div>
      </div>
    `;
  }

  private renderInspector() {
    if (this.units.length === 0) {
      return `<div class="empty-state">No Pulse units detected.</div>`;
    }
    return `
      <div class="list">
        ${this.units.map(u => this.renderUnitCard(u)).join('')}
      </div>
    `;
  }

  private renderUnitCard(unit: PulseUnit) {
    const isGuard = 'state' in unit;
    const name = (unit as any)._name || 'unnamed';
    const explanation = isGuard ? (unit as any).explain() : null;
    const value = isGuard ? explanation.value : (unit as any)();
    
    // Status Logic
    let status = 'ok';
    if (isGuard) status = explanation.status;
    
    const isEditing = this.editingUnit === unit;

    return `
      <div class="unit-card ${isGuard ? '' : 'source-card'}" style="border-left-color: ${this.getStatusColor(status)}">
        <div class="unit-header">
          <div style="display:flex;align-items:center;gap:6px">
            <div class="status-dot status-${status}"></div>
            <strong title="${name}">${name}</strong>
          </div>
          <span class="badg type-${isGuard ? 'guard' : 'source'}">${isGuard ? 'GUARD' : 'SOURCE'}</span>
        </div>

        <div class="unit-body">
          ${isEditing ? `
            <form class="edit-form">
              <input class="edit-input" value='${this.safeStringify(value)}' />
            </form>
          ` : `
            <div class="value-row ${!isGuard ? 'editable-value' : ''}" data-name="${name}" title="${!isGuard ? 'Click to edit' : ''}">
              <span style="opacity:0.5;margin-right:6px">Value:</span> 
              <span class="value-text">${this.formatValue(value)}</span>
              ${!isGuard ? `<span class="edit-icon">${ICONS.edit}</span>` : ''}
            </div>
          `}

          ${isGuard && explanation.status === 'fail' ? this.renderReason(explanation.reason) : ''}
          ${isGuard && explanation.status === 'pending' ? `
             <div class="reason pending-reason">
                ⏳ Evaluating... ${explanation.lastReason ? `<br/><span style="opacity:0.7;font-size:9px">Last error: ${this.formatReasonText(explanation.lastReason)}</span>` : ''}
             </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderTree() {
    // 1. Identify Roots (Guards that are not dependencies of any other guard)
    // Actually, showing all guards as roots is messy.
    // Let's show specific "Roots" or just list all top-level guards.
    // Ideally we filter out guards that are purely internal dependencies, but Pulse doesn't distinct them yet.
    // For now, we list all Guards at the top level, and they expand to show their deps.
    
    const guards = this.units.filter(u => 'state' in u);
    
    if (guards.length === 0) return `<div class="empty-state">No Guards to visualize.</div>`;

    return `
      <div class="tree-view">
        ${guards.map(g => this.renderTreeNode(g, 0, (g as any)._name)).join('')}
      </div>
    `;
  }

  private renderTreeNode(guard: any, depth: number, key: string): string {
    const isExpanded = this.state.expandedNodes.includes(key);
    const explanation = guard.explain();
    const deps = explanation.dependencies || [];
    const hasDeps = deps.length > 0;
    
    const statusColor = this.getStatusColor(explanation.status);

    return `
      <div class="tree-node" style="padding-left:${depth * 12}px">
        <div class="tree-row tree-toggle" data-id="${key}">
          <span class="tree-icon" style="visibility:${hasDeps ? 'visible' : 'hidden'}">
            ${isExpanded ? ICONS.chevronDown : ICONS.chevronRight}
          </span>
          <span class="status-dot status-${explanation.status}" style="width:6px;height:6px;margin:0 6px"></span>
          <span class="tree-name" style="color:${explanation.status === 'fail' ? COLORS.error : 'inherit'}">
            ${explanation.name}
          </span>
           ${explanation.status === 'fail' ? `
            <span class="mini-badge fail">!</span>
           ` : ''}
        </div>
      </div>
      ${isExpanded && hasDeps ? `
        <div class="tree-children">
           ${deps.map((dep: any) => {
              // Try to find the actual unit object if possible to recurse deeply
              // But explain() only gives shallow descriptions. 
              // To enable deep tree we would need the actual objects.
              // For v0.2.0 let's Stick to shallow deps list or try to look up in Registry.
              // Lookup:
              const unit = this.units.find(u => (u as any)._name === dep.name);
              const childKey = key + '-' + dep.name;
              
              if (unit && 'state' in unit) {
                 return this.renderTreeNode(unit, depth + 1, childKey);
              } else {
                 // It's a source or untracked unit
                 return `
                   <div class="tree-node" style="padding-left:${(depth + 1) * 12}px">
                      <div class="tree-row">
                        <span class="tree-icon" style="visibility:hidden"></span>
                        <span class="status-dot status-ok" style="background:${COLORS.secondaryText}"></span>
                        <span class="tree-name" style="opacity:0.7">${dep.name}</span>
                        <span class="mini-badge source">S</span>
                      </div>
                   </div>
                 `;
              }
           }).join('')}
        </div>
      ` : ''}
    `;
  }

  // --- HELPERS ---

  private renderReason(reason: any) {
    if (!reason) return '';
    const text = this.formatReasonText(reason);
    const meta = typeof reason === 'object' && reason.meta ? reason.meta : null;
    
    return `
      <div class="reason">
        <strong>${typeof reason === 'object' ? reason.code || 'ERROR' : 'FAIL'}</strong>
        <div>${text}</div>
        ${meta ? `<pre class="meta-block">${JSON.stringify(meta, null, 2)}</pre>` : ''}
      </div>
    `;
  }

  private formatReasonText(reason: any): string {
    if (typeof reason === 'string') return reason;
    return reason.message || JSON.stringify(reason);
  }

  private formatValue(val: any): string {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'function') return 'ƒ()';
    if (typeof val === 'object') return '{...}';
    return String(val);
  }

  private safeStringify(val: any): string {
    try {
      if (val === undefined) return 'undefined';
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }

  private getStatusColor(status: string) {
    switch (status) {
      case 'ok': return COLORS.success;
      case 'fail': return COLORS.error;
      case 'pending': return COLORS.pending;
      default: return COLORS.secondaryText;
    }
  }

  private getStyles() {
    return `
      <style>
        :host { all: initial; font-family: 'Inter', -apple-system, sans-serif; }
        * { box-sizing: border-box; }
        
        .container {
          position: fixed;
          height: auto;
          z-index: 999999;
          filter: drop-shadow(0 8px 32px rgba(0,0,0,0.5));
          color: ${COLORS.text};
        }

        .glass {
          background: ${COLORS.bg};
          backdrop-filter: blur(12px);
          border: 1px solid ${COLORS.border};
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          width: 400px;
          max-height: 80vh;
          transition: width 0.2s, height 0.2s;
        }

        /* TOGGLE BUTTON MODE */
        .toggle-btn {
          width: 140px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          background: rgba(255,255,255,0.03);
        }
        .toggle-btn:hover { background: rgba(255,255,255,0.08); }

        /* HEADER */
        .header {
          padding: 12px 16px;
          background: rgba(0,0,0,0.2);
          border-bottom: 1px solid ${COLORS.border};
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: move;
          flex-shrink: 0;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${COLORS.accent};
          box-shadow: 0 0 12px ${COLORS.accentColor};
        }
        .icon-btn { cursor: pointer; opacity: 0.6; padding: 4px; font-size: 18px; line-height: 1; }
        .icon-btn:hover { opacity: 1; color: white; }

        /* TABS */
        .tabs {
          display: flex;
          background: rgba(0,0,0,0.2);
          border-bottom: 1px solid ${COLORS.border};
          font-size: 11px;
          font-weight: 600;
        }
        .tab-btn {
          flex: 1;
          padding: 10px;
          text-align: center;
          cursor: pointer;
          opacity: 0.6;
          border-bottom: 2px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .tab-btn:hover { opacity: 0.9; background: rgba(255,255,255,0.02); }
        .tab-btn.active { opacity: 1; border-bottom-color: ${COLORS.accentColor}; color: ${COLORS.accentColor}; background: rgba(0,210,255,0.05); }

        /* CONTENT */
        .content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          min-height: 300px;
        }
        .content::-webkit-scrollbar { width: 6px; }
        .content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        /* INSPECTOR LIST */
        .list { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .empty-state { padding: 40px; text-align: center; opacity: 0.4; font-size: 12px; }

        .unit-card {
          background: ${COLORS.cardBg};
          border: 1px solid ${COLORS.border};
          border-left: 3px solid transparent;
          border-radius: 6px;
          padding: 10px;
          transition: background 0.1s;
        }
        .unit-card:hover { background: ${COLORS.cardHover}; }
        .source-card { border-left-color: ${COLORS.secondaryText} !important; }

        .unit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .status-ok { background: ${COLORS.success}; box-shadow: 0 0 6px ${COLORS.success}; }
        .status-fail { background: ${COLORS.error}; box-shadow: 0 0 6px ${COLORS.error}; }
        .status-pending { background: ${COLORS.pending}; box-shadow: 0 0 6px ${COLORS.pending}; }

        .badg { font-size: 8px; font-weight: 700; padding: 2px 4px; border-radius: 3px; background: rgba(255,255,255,0.1); }
        .type-guard { color: ${COLORS.accentColor}; background: rgba(0,210,255,0.1); }
        .type-source { color: ${COLORS.secondaryText}; }

        .value-row {
          font-size: 11px;
          font-family: monospace;
          background: rgba(0,0,0,0.2);
          padding: 6px 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .value-text { color: ${COLORS.accentColor}; }
        .editable-value { cursor: pointer; border: 1px dashed transparent; }
        .editable-value:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); }
        .edit-icon { opacity: 0; transition: opacity 0.2s; }
        .editable-value:hover .edit-icon { opacity: 0.7; }

        .edit-form { margin: 0; padding: 0; width: 100%; }
        .edit-input {
          width: 100%;
          background: ${COLORS.inputBg};
          border: 1px solid ${COLORS.accentColor};
          color: white;
          font-family: monospace;
          font-size: 11px;
          padding: 6px;
          border-radius: 4px;
          outline: none;
        }

        .reason {
          margin-top: 8px;
          padding: 8px;
          background: rgba(255, 75, 43, 0.1);
          border: 1px solid rgba(255, 75, 43, 0.2);
          border-radius: 4px;
          color: ${COLORS.error};
          font-size: 11px;
        }
        .pending-reason { color: ${COLORS.pending} !important; background: rgba(253, 187, 45, 0.1); border-color: rgba(253, 187, 45, 0.2); }
        .meta-block { margin: 4px 0 0 0; opacity: 0.7; font-size: 10px; }

        /* TREE VIEW */
        .tree-view { padding: 12px; font-size: 12px; }
        .tree-node { margin-bottom: 2px; }
        .tree-row {
          display: flex;
          align-items: center;
          padding: 4px 6px;
          border-radius: 4px;
          cursor: pointer;
          user-select: none;
        }
        .tree-row:hover { background: rgba(255,255,255,0.05); }
        .tree-icon { margin-right: 4px; opacity: 0.5; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; }
        .tree-name { opacity: 0.9; }
        .mini-badge { 
          font-size: 9px; margin-left: auto; padding: 1px 4px; border-radius: 3px; 
          font-weight: bold; opacity: 0.6;
        }
        .mini-badge.fail { background: ${COLORS.error}; color: white; opacity: 1; }
        .mini-badge.source { background: rgba(255,255,255,0.1); }

      </style>
    `;
  }
}

if (!customElements.get('pulse-inspector')) {
  customElements.define('pulse-inspector', PulseInspector);
}

export { PulseInspector };
