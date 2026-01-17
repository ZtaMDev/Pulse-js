import { guard, source } from '@pulse-js/core';
import { usePulse } from '@pulse-js/react';
import { useState } from 'react';

// Mock API state
let mockUser: any = null;
let exmp = source(0);
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
  
  if (!user) throw 'Authentication required';
  if (user.role !== 'admin') return false; // Fails with default reason
  
  return true; // Success!
});

function Spinner() {
  return <div style={{ color: 'blue' }}>Loading user data...</div>;
}

function ErrorMessage({ msg }: { msg: any }) {
  return (
    <div style={{ color: 'red', border: '1px solid red', padding: '10px', marginTop: '10px' }}>
      <strong>Blocked:</strong> {typeof msg === 'string' ? msg : JSON.stringify(msg)}
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
