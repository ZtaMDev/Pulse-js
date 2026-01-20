import { guard, guardFail } from '@pulse-js/core';
import { formatReason, usePulse } from '@pulse-js/react';
import { useState } from 'react';

// Mock API state
let mockUser: any = null;
// Mock fetch to simulate the user's logic
const mockFetch = async (url: string) => {
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network lag
  if (url === '/api/user') {
    return {
      json: async () => mockUser
    };
  }
  throw new Error('Not found');
};

// 1. Define a semantic business rule with async logic
const isAdmin = guard('admin-check', async () => {
    // We use mockFetch instead of real fetch for testing
  const response = await mockFetch('/api/user');
  const user = await response.json();
  
  if (!user) return guardFail({code: 'AUTH', message: 'Authentication required'});
  if (user.role !== 'admin') return guardFail({code: 'AUTH', message: 'You are not an admin'});
  return true; // Success!
});

function Spinner() {
  return <div style={{ color: 'blue' }}>Loading user data...</div>;
}

function ErrorMessage({ msg }: { msg: any }) {
  const isObject = typeof msg === 'object' && msg !== null;
  const code = isObject ? msg.code : null;
  const message = isObject ? msg.message : msg;

  return (
    <div style={{ 
      color: '#d32f2f', 
      background: '#ffebee', 
      border: '1px solid #ef9a9a', 
      padding: '12px', 
      marginTop: '10px',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <strong>Blocked</strong>
        {code && (
          <span style={{ 
            fontSize: '0.75rem', 
            background: '#d32f2f', 
            color: 'white', 
            padding: '2px 6px', 
            borderRadius: '4px',
            textTransform: 'uppercase'
          }}>
            {code}
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.95rem' }}>{message}</div>
    </div>
  );
}

function Dashboard() {
  return (
    <div style={{ color: 'green', border: '1px solid green', padding: '10px', marginTop: '10px' }}>
      <h2>✅ Admin Dashboard</h2>
      <p>Welcome, Admin! All systems operational.</p>
    </div>
  );
}

// 2. Consume it in your UI
export default function AdminPanel() {
  const { status, reason } = usePulse(isAdmin);
  const [lastAction, setLastAction] = useState('');

  const setRole = (role: string | null) => {
    mockUser = role === null ? null : { role };
    isAdmin._evaluate(); // Manually trigger re-evaluation
    setLastAction(`Set role to: ${role}`);
  };

  return (
    <section>
      <h2>Admin Panel Test</h2>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setRole('admin')}>Set Admin</button>
        <button onClick={() => setRole('editor')}>Set Editor</button>
        <button onClick={() => setRole(null)}>Log Out</button>
        <p><small>Last Action: {lastAction || 'None'}</small></p>
      </div>

      <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
        {status === 'pending' && <Spinner />}
        {status === 'fail' && <ErrorMessage msg={reason} />}
        {status === 'ok' && <Dashboard />}
      </div>
    </section>
  );
}
