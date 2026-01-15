import { PulseRegistry, type PulseUnit } from '@pulse-js/core';

const COLORS = {
  bg: 'rgba(13, 13, 18, 0.95)',
  border: 'rgba(255, 255, 255, 0.1)',
  accent: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
  error: '#ff4b2b',
  success: '#00f260',
  pending: '#fdbb2d',
  text: '#ffffff',
  secondaryText: '#a0a0a0',
  cardBg: 'rgba(255, 255, 255, 0.05)',
};

const STORAGE_KEY = 'pulse-devtools-pos';

class PulseInspector extends HTMLElement {
  private shadow: ShadowRoot;
  private units: PulseUnit[] = [];
  private isOpen: boolean = false;
  private position = { x: window.innerWidth - 140, y: window.innerHeight - 65 };
  private isDragging = false;
  private offset = { x: 0, y: 0 };
  private totalMovement = 0;
  private lastMousePos = { x: 0, y: 0 };
  private unsubscribeRegistry?: () => void;
  private unitSubscriptions = new Map<PulseUnit, () => void>();

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.loadPosition();
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.refreshUnits();
    
    this.unsubscribeRegistry = PulseRegistry.onRegister(() => {
      this.refreshUnits();
    });

    window.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback() {
    if (this.unsubscribeRegistry) this.unsubscribeRegistry();
    this.unitSubscriptions.forEach(unsub => unsub());
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  private loadPosition() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) this.position = JSON.parse(saved);
    } catch (e) {}
  }

  private savePosition() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.position));
    } catch (e) {}
  }

  private refreshUnits() {
    this.units = PulseRegistry.getAll();
    this.updateUnitSubscriptions();
    this.render();
  }

  private updateUnitSubscriptions() {
    // Clear old subscriptions
    this.unitSubscriptions.forEach(unsub => unsub());
    this.unitSubscriptions.clear();

    // Subscribe to each unit for updates
    this.units.forEach(unit => {
      const unsub = unit.subscribe(() => {
        this.render();
      });
      this.unitSubscriptions.set(unit, unsub);
    });
  }

  private setupListeners() {
    this.shadow.addEventListener('mousedown', (e) => this.startDragging(e as MouseEvent));
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      this.toggle();
    }
  }

  private toggle() {
    if (this.totalMovement < 5) {
      this.isOpen = !this.isOpen;
      // Adjust position if it's currently a button vs full window
      if (this.isOpen) {
        // Expand
        this.position.x = Math.max(0, Math.min(window.innerWidth - 350, this.position.x));
        this.position.y = Math.max(0, Math.min(window.innerHeight - 450, this.position.y));
      } else {
        // Shrink
        this.position.x = Math.max(0, Math.min(window.innerWidth - 120, this.position.x));
        this.position.y = Math.max(0, Math.min(window.innerHeight - 45, this.position.y));
      }
      this.savePosition();
      this.render();
    }
  }

  private startDragging(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const isHeader = target.closest('.header') || target.classList.contains('toggle-btn');
    if (!isHeader) return;

    this.isDragging = true;
    this.totalMovement = 0;
    this.lastMousePos = { x: e.clientX, y: e.clientY };
    this.offset = {
      x: e.clientX - this.position.x,
      y: e.clientY - this.position.y
    };

    const onMouseMove = (moveEv: MouseEvent) => {
      if (!this.isDragging) return;
      this.totalMovement += Math.abs(moveEv.clientX - this.lastMousePos.x) + Math.abs(moveEv.clientY - this.lastMousePos.y);
      this.lastMousePos = { x: moveEv.clientX, y: moveEv.clientY };

      const w = this.isOpen ? 350 : 120;
      const h = this.isOpen ? 450 : 45;

      this.position = {
        x: Math.max(0, Math.min(window.innerWidth - w, moveEv.clientX - this.offset.x)),
        y: Math.max(0, Math.min(window.innerHeight - h, moveEv.clientY - this.offset.y))
      };
      
      const container = this.shadow.querySelector('.container') as HTMLElement;
      if (container) {
        container.style.left = `${this.position.x}px`;
        container.style.top = `${this.position.y}px`;
      }
    };

    const onMouseUp = () => {
      this.isDragging = false;
      this.savePosition();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private render() {
    const w = this.isOpen ? 350 : 120;
    const h = this.isOpen ? 450 : 45;

    this.shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }
        .container {
          position: fixed;
          left: ${this.position.x}px;
          top: ${this.position.y}px;
          width: ${w}px;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: white;
          user-select: none;
        }
        .glass {
          background: ${COLORS.bg};
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid ${COLORS.border};
          border-radius: ${this.isOpen ? '16px' : '30px'};
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          overflow: hidden;
          transition: border-radius 0.2s ease;
          display: flex;
          flex-direction: column;
        }
        .toggle-btn {
          width: 120px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          font-weight: 600;
          font-size: 13px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${COLORS.accent};
          margin-right: 10px;
          box-shadow: 0 0 10px #00d2ff;
        }
        .header {
          padding: 12px 16px;
          background: rgba(0,0,0,0.3);
          border-bottom: 1px solid ${COLORS.border};
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: grab;
        }
        .list {
          flex: 1;
          overflow-y: auto;
          max-height: 380px;
          padding: 12px;
        }
        .list::-webkit-scrollbar { width: 5px; }
        .list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        
        .unit-card {
          padding: 10px;
          margin-bottom: 10px;
          border-radius: 10px;
          background: ${COLORS.cardBg};
          border: 1px solid ${COLORS.border};
          font-size: 12px;
        }
        .unit-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .unit-type {
          font-size: 9px;
          opacity: 0.5;
          text-transform: uppercase;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 6px;
        }
        .status-ok { background: ${COLORS.success}; box-shadow: 0 0 5px ${COLORS.success}; }
        .status-fail { background: ${COLORS.error}; box-shadow: 0 0 5px ${COLORS.error}; }
        .status-pending { background: ${COLORS.pending}; box-shadow: 0 0 5px ${COLORS.pending}; }
        
        .value {
          color: #00d2ff;
          font-family: monospace;
          word-break: break-all;
        }
        .reason {
          color: ${COLORS.error};
          margin-top: 4px;
          font-size: 11px;
          background: rgba(255,75,43,0.1);
          padding: 4px;
          border-radius: 4px;
        }
        .footer {
          padding: 8px 12px;
          font-size: 10px;
          opacity: 0.5;
          text-align: right;
          background: rgba(0,0,0,0.1);
        }
        .explain-toggle {
          margin-top: 8px;
          font-size: 10px;
          color: ${COLORS.secondaryText};
          cursor: pointer;
          text-decoration: underline;
        }
        .explanation {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed ${COLORS.border};
        }
        .dep-item {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          opacity: 0.8;
        }
      </style>
      <div class="container">
        <div class="glass">
          ${!this.isOpen ? `
            <div class="toggle-btn" id="toggle">
              <div class="dot"></div>
              Pulse (${this.units.length})
            </div>
          ` : `
            <div class="header">
              <div style="display:flex;align-items:center">
                <div class="dot" style="width:10px;height:10px"></div>
                <strong style="font-size:14px">Pulse Inspector</strong>
              </div>
              <div id="close" style="cursor:pointer;font-size:18px;opacity:0.6">×</div>
            </div>
            <div class="list">
              ${this.units.length === 0 ? '<div style="text-align:center;padding:20px;opacity:0.5">No units detected</div>' : ''}
              ${this.units.map(u => this.renderUnit(u)).join('')}
            </div>
            <div class="footer">v0.2.0 • Framework-Agnostic</div>
          `}
        </div>
      </div>
    `;

    this.shadow.getElementById('toggle')?.addEventListener('click', () => this.toggle());
    this.shadow.getElementById('close')?.addEventListener('click', () => this.toggle());
  }

  private renderUnit(unit: PulseUnit) {
    const isGuard = 'state' in unit;
    const name = (unit as any)._name || 'unnamed';
    
    if (isGuard) {
      const g = unit as any;
      const explanation = g.explain();
      const statusClass = `status-${explanation.status}`;
      
      const renderReason = (reason: any) => {
        if (!reason) return '';
        if (typeof reason === 'string') return `<div class="reason">${reason}</div>`;
        return `
          <div class="reason">
            <div style="font-weight:bold;font-size:9px;margin-bottom:2px">${reason.code}</div>
            ${reason.message}
            ${reason.meta ? `<pre style="font-size:8px;margin-top:4px;opacity:0.7">${JSON.stringify(reason.meta, null, 2)}</pre>` : ''}
          </div>
        `;
      };

      return `
        <div class="unit-card" style="border-color: ${explanation.status === 'fail' ? COLORS.error + '44' : COLORS.border}">
          <div class="unit-header">
            <span>
              <span class="status-dot ${statusClass}"></span>
              <strong>${name}</strong>
            </span>
            <span class="unit-type">Guard</span>
          </div>
          ${explanation.status === 'ok' ? `<div class="value">Value: ${JSON.stringify(explanation.value, null, 2)}</div>` : ''}
          
          ${explanation.status === 'fail' ? renderReason(explanation.reason) : ''}
          ${explanation.status === 'pending' ? `
            <div style="opacity:0.5;margin-bottom:4px">Evaluating...</div>
            ${explanation.lastReason ? `
              <div style="font-size:9px;opacity:0.6;margin-bottom:2px">LAST FAILURE:</div>
              ${renderReason(explanation.lastReason)}
            ` : ''}
          ` : ''}
          
          ${explanation.dependencies.length > 0 ? `
            <div class="explanation">
              <div style="font-size:9px;opacity:0.5;margin-bottom:4px">DEPENDENCIES</div>
              ${explanation.dependencies.map((dep: any) => `
                <div class="dep-item">
                  <span>${dep.name} <small opacity="0.5">(${dep.type})</small></span>
                  ${dep.status ? `<span class="status-dot status-${dep.status}" style="width:4px;height:4px"></span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    } else {
      const value = (unit as any)();
      return `
        <div class="unit-card">
          <div class="unit-header">
            <span>
              <span class="status-dot status-ok"></span>
              <strong>${name}</strong>
            </span>
            <span class="unit-type">Source</span>
          </div>
          <div class="value">Value: ${JSON.stringify(value)}</div>
        </div>
      `;
    }
  }
}

if (!customElements.get('pulse-inspector')) {
  customElements.define('pulse-inspector', PulseInspector);
}

export { PulseInspector };
