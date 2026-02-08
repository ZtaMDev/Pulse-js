
import { PulseAgent } from './agent';

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
  // Empty for now or add future icons
};

const STORAGE_KEY = 'pulse-devtools-state';

/**
 * Pulse Inspector Web Component (Client) 2.0
 */
export class PulseInspector extends HTMLElement {
  private shadow: ShadowRoot;
  private units: any[] = [];
  
  // State
  private state = {
    pos: { x: window.innerWidth - 360, y: 20 },
    isOpen: true,
  };

  private isDragging = false;
  private offset = { x: 0, y: 0 };
  private totalDragDistance = 0;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.loadState();
  }

  connectedCallback() {
    this.setupAgentConnection();
    this.setupGlobalListeners();
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.handleResize);
  }

  private loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.state = { ...this.state, ...JSON.parse(saved) };
      }
    } catch (e) {}
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {}
  }

  private setupAgentConnection() {
    const agent = PulseAgent.getInstance();
    agent.onEvent((event) => {
      if (event.type === 'STATE_UPDATE') {
        this.units = event.payload;
        this.render();
      }
    });
    agent.broadcastState();
  }

  private setupGlobalListeners() {
    this.shadow.addEventListener('mousedown', this.handleMouseDown as EventListener);
    this.shadow.addEventListener('click', this.handleClick as EventListener);
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    const width = this.state.isOpen ? 400 : 140;
    const height = this.state.isOpen ? 600 : 48;
    this.state.pos.x = Math.max(0, Math.min(window.innerWidth - width, this.state.pos.x));
    this.state.pos.y = Math.max(0, Math.min(window.innerHeight - height, this.state.pos.y));
    this.render();
  };

  private handleMouseDown = (e: MouseEvent) => {
    this.totalDragDistance = 0; // Essential: Reset on EVERY mouse down
    
    const target = e.target as HTMLElement;
    const isHeader = target.closest('.header') || target.closest('.toggle-btn');
    const isAction = target.closest('#close') || target.closest('[data-action]');
    
    if (!isHeader || isAction) return;

    this.isDragging = true;
    this.offset = {
      x: e.clientX - this.state.pos.x,
      y: e.clientY - this.state.pos.y
    };

    const move = (ev: MouseEvent) => {
      if (!this.isDragging) return;
      ev.preventDefault();
      
      const dx = ev.clientX - (this.state.pos.x + this.offset.x);
      const dy = ev.clientY - (this.state.pos.y + this.offset.y);
      this.totalDragDistance += Math.abs(dx) + Math.abs(dy);
      
      const width = this.state.isOpen ? 380 : 140;
      const height = this.state.isOpen ? 400 : 48; // Estimate
      
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
  };

  private handleClick = (e: MouseEvent) => {
    // Small threshold for accidental displacement
    if (this.totalDragDistance > 10) return;

    const target = e.target as HTMLElement;

    if (target.closest('#toggle') || target.closest('#close')) {
      this.state.isOpen = !this.state.isOpen;
      this.saveState();
      this.render();
      return;
    }
    
    // Actions like Reset Guard or Edit Source could be added here
    const actionBtn = target.closest('[data-action]');
    if (actionBtn) {
      const type = actionBtn.getAttribute('data-action')!;
      const uid = actionBtn.getAttribute('data-uid')!;
      this.sendAction(type, uid);
    }
  };

  private sendAction(type: string, uid: string, payload?: any) {
    window.postMessage({
      source: 'pulse-ui',
      action: { type, uid, payload }
    }, '*');
  }

  private render() {
    if (!this.state.isOpen) {
      this.shadow.innerHTML = this.getStyles() + `
        <div class="container" style="left: ${this.state.pos.x}px; top: ${this.state.pos.y}px">
          <div class="glass toggle-btn" id="toggle">
            <div class="dot"></div>
            Pulse (${this.units.length})
          </div>
        </div>
      `;
      return;
    }

    this.shadow.innerHTML = this.getStyles() + `
      <div class="container" style="left: ${this.state.pos.x}px; top: ${this.state.pos.y}px">
        <div class="glass window">
          
          <div class="header">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="dot" style="width:10px;height:10px"></div>
              <strong style="font-size:14px;letter-spacing:0.5px">PULSE</strong>
              <span style="font-size:10px;opacity:0.5;margin-top:2px">v2.0</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <div id="close" class="icon-btn" title="Minimize">×</div>
            </div>
          </div>

          <div class="content">
            ${this.units.length === 0 
              ? `<div class="empty-state">No reactive units detected.</div>` 
              : `<div class="list">${this.units.map(u => this.renderUnitCard(u)).join('')}</div>`
            }
          </div>

        </div>
      </div>
    `;
  }

  private renderUnitCard(u: any) {
    const status = u.status || 'ok';
    const hasDeps = u.dependencies && u.dependencies.length > 0;
    
    return `
      <div class="unit-card ${u.type}-card" style="border-left-color: ${this.getStatusColor(status)}">
        <div class="unit-header">
           <div style="display:flex;align-items:center;gap:6px">
             <div class="status-dot status-${status}"></div>
             <strong title="${u.name}">${u.name}</strong>
           </div>
           <span class="badg type-${u.type}">${u.type.toUpperCase()}</span>
        </div>
        <div class="value-row">
          <span style="opacity:0.5;margin-right:6px">Value:</span> 
          <span class="value-text">${this.formatValue(u.value)}</span>
        </div>
        
        ${u.reason ? `
          <div class="reason-box">
            <strong>${u.reason.code || 'FAILURE'}</strong>
            <div>${u.reason.message}</div>
          </div>
        ` : ''}

        ${hasDeps ? `
          <div class="deps-list">
            <div class="deps-label">Dependencies:</div>
            ${u.dependencies.map((d: any) => `
              <div class="dep-item">
                <span class="dep-dot"></span>
                ${d.name}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  private formatValue(val: any): string {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch (e) {
        return '{...}';
      }
    }
    return String(val);
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
        :host { all: initial; font-family: 'Inter', system-ui, sans-serif; }
        .container { position: fixed; z-index: 1000000; filter: drop-shadow(0 8px 32px rgba(0,0,0,0.5)); color: white; }
        .glass { background: ${COLORS.bg}; backdrop-filter: blur(12px); border: 1px solid ${COLORS.border}; border-radius: 12px; overflow: hidden; }
        .window { width: 380px; max-height: 80vh; display: flex; flex-direction: column; }
        .toggle-btn { width: 140px; height: 48px; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; font-weight: 600; font-size: 13px; }
        .header { padding: 12px 16px; background: rgba(0,0,0,0.2); border-bottom: 1px solid ${COLORS.border}; display: flex; justify-content: space-between; align-items: center; cursor: move; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: ${COLORS.accent}; box-shadow: 0 0 12px ${COLORS.accentColor}; }
        .icon-btn { cursor: pointer; opacity: 0.6; padding: 4px; font-size: 18px; line-height: 1; display: flex; align-items: center; }
        .icon-btn:hover { opacity: 1; }
        .content { flex: 1; overflow-y: auto; padding: 12px; min-height: 200px; }
        .content::-webkit-scrollbar { width: 6px; }
        .content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .list { display: flex; flex-direction: column; gap: 8px; }
        .unit-card { background: ${COLORS.cardBg}; border: 1px solid ${COLORS.border}; border-left: 3px solid transparent; border-radius: 6px; padding: 10px; }
        .unit-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .status-ok { background: ${COLORS.success}; box-shadow: 0 0 6px ${COLORS.success}; }
        .status-fail { background: ${COLORS.error}; box-shadow: 0 0 6px ${COLORS.error}; }
        .status-pending { background: ${COLORS.pending}; box-shadow: 0 0 6px ${COLORS.pending}; }
        .badg { font-size: 8px; font-weight: 700; padding: 2px 4px; border-radius: 3px; }
        .type-guard { color: ${COLORS.accentColor}; background: rgba(0,210,255,0.1); }
        .type-source { color: ${COLORS.secondaryText}; background: rgba(255,255,255,0.05); }
        .value-row { font-size: 11px; font-family: monospace; background: rgba(0,0,0,0.2); padding: 6px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; }
        .value-text { color: ${COLORS.accentColor}; }
        .reason-box {
          margin-top: 8px;
          padding: 8px;
          background: rgba(255, 75, 43, 0.1);
          border: 1px solid rgba(255, 75, 43, 0.2);
          border-radius: 4px;
          color: ${COLORS.error};
          font-size: 11px;
        }
        .reason-box strong { font-size: 10px; display: block; opacity: 0.8; margin-bottom: 2px; }
        .deps-list { margin-top: 10px; border-top: 1px solid ${COLORS.border}; padding-top: 8px; }
        .deps-label { font-size: 9px; opacity: 0.5; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
        .dep-item { font-size: 10px; opacity: 0.8; display: flex; align-items: center; gap: 6px; padding: 2px 0; }
        .dep-dot { width: 4px; height: 4px; background: ${COLORS.accentColor}; border-radius: 50%; opacity: 0.5; }
        .error-text { color: ${COLORS.error}; font-size: 10px; margin-top: 6px; }
        .empty-state { padding: 40px; text-align: center; opacity: 0.4; font-size: 12px; }
        .mini-btn { background: ${COLORS.accent}; border: none; color: white; border-radius: 3px; font-size: 9px; padding: 2px 6px; cursor: pointer; }
      </style>
    `;
  }
}

if (!customElements.get('pulse-inspector')) {
  customElements.define('pulse-inspector', PulseInspector);
}
