import { source, guard } from '@pulse-js/core';
import { usePulse, formatReason, useGuard } from '@pulse-js/react';

// 1. Logic (Outside Component)
const user = source<any>(null, { name: 'user' });
const balance = source(100, { name: 'balance' });
const unknown = source(null);
const isLoggedIn = guard('auth', () => !!user());
const hasBalance = guard('has-balance', () => balance() >= 150);
const canPurchase = guard.all('can-purchase', [
    isLoggedIn,
    hasBalance
]);

// 2. UI Component
export function PurchaseWidget() {
    const purchaseState = useGuard(canPurchase);
    const currentUser = usePulse(user);
    const currentBalance = usePulse(balance);
    
    return (
        <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
            <h3>Pulse + React</h3>
            
            {currentUser ? (
                <p>Logged in as: {currentUser.name}</p>
            ) : (
                <button onClick={() => user.set({ name: 'Jane' })}>Login</button>
            )}

            <div style={{ marginTop: '1rem' }}>
                <p>Status: <strong>{purchaseState.status.toUpperCase()}</strong></p>
                {purchaseState.status === 'fail' && (
                    <p style={{ color: 'red' }}>Reason: {formatReason(purchaseState.reason)}</p>
                )}
                
                <button 
                    disabled={purchaseState.status !== 'ok'}
                    onClick={() => {alert('Purchased!'); balance.update(b => b - 150)}}
                >
                    Buy Now ($150)
                </button>
            </div>

            <h1>{currentBalance}</h1>

            <div style={{ marginTop: '1rem' }}>
                <button onClick={() => balance.update(b => b + 50)}>Add $50</button>
                <button onClick={() => balance.set(100)}>Reset Balance</button>
            </div>
        </div>
    );
}
